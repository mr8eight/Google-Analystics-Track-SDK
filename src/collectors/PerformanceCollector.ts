// src/collectors/PerformanceCollector.ts

/**
 * 性能采集器
 *
 * 自动采集页面性能指标：
 * - 页面加载性能 (DNS, TCP, SSL, TTFB, DOM, Load)
 * - Web Vitals 核心指标 (LCP, FID, CLS)
 * - 资源加载性能
 *
 * @example
 * ```ts
 * const collector = new PerformanceCollector(reportFn, { debug: true });
 * collector.start();
 *
 * // 获取当前性能指标
 * const metrics = collector.getMetrics();
 *
 * // 停止采集
 * collector.stop();
 * ```
 */

import type { PerformanceCollectorConfig, ReportFunction, EventParams } from '../types';
import { safeExecute, isBrowser } from '../core/utils';

/** 页面加载性能数据 */
interface PageTiming {
  dns: number;
  tcp: number;
  ssl: number;
  ttfb: number;
  dom_parse: number;
  dom_ready: number;
  load: number;
  fp: number | null;
  fcp: number | null;
}

/** Web Vitals 数据 */
interface WebVitals {
  lcp: number | null;
  fid: number | null;
  cls: number | null;
}

/** Layout Shift Entry 接口 */
interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

/**
 * 性能采集器
 */
export class PerformanceCollector {
  private reportFn: ReportFunction;
  private config: Required<PerformanceCollectorConfig>;
  private isRunning: boolean = false;
  private performanceObserver: PerformanceObserver | null = null;
  private reportedResources: Set<string> = new Set();

  /**
   * @param reportFn - 上报函数
   * @param config - 采集器配置
   */
  constructor(reportFn: ReportFunction, config?: PerformanceCollectorConfig) {
    this.reportFn = reportFn;
    this.config = {
      debug: config?.debug ?? false,
      collectResourceTiming: config?.collectResourceTiming ?? true,
      resourceSampleRate: config?.resourceSampleRate ?? 0.1
    };
  }

  /**
   * 启动性能采集
   */
  start(): void {
    if (!isBrowser() || this.isRunning) return;

    safeExecute(() => {
      // 采集页面加载性能（延迟执行确保数据完整）
      if (document.readyState === 'complete') {
        this.collectPageTiming();
      } else {
        window.addEventListener('load', () => {
          setTimeout(() => this.collectPageTiming(), 0);
        });
      }

      // 初始化 Web Vitals 观察器
      this.initWebVitalsObserver();

      // 初始化资源加载观察器
      if (this.config.collectResourceTiming) {
        this.initResourceObserver();
      }

      this.isRunning = true;

      if (this.config.debug) {
        console.log('[PerformanceCollector] Started');
      }
    }, undefined, 'PerformanceCollector.start');
  }

  /**
   * 停止性能采集
   */
  stop(): void {
    if (!this.isRunning) return;

    safeExecute(() => {
      if (this.performanceObserver) {
        this.performanceObserver.disconnect();
        this.performanceObserver = null;
      }

      this.reportedResources.clear();
      this.isRunning = false;

      if (this.config.debug) {
        console.log('[PerformanceCollector] Stopped');
      }
    }, undefined, 'PerformanceCollector.stop');
  }

  /**
   * 获取当前性能指标
   */
  getMetrics(): { pageTiming: PageTiming | null; webVitals: WebVitals } {
    const pageTiming = this.collectPageTimingSync();
    const webVitals = this.getWebVitalsSync();

    return { pageTiming, webVitals };
  }

  /**
   * 采集页面加载性能
   * @internal
   */
  private collectPageTiming(): void {
    safeExecute(() => {
      const timing = this.getPageTiming();
      if (!timing) return;

      const params: EventParams = {
        category: 'performance',
        ...timing
      };

      this.reportFn('performance_page_load', params);

      if (this.config.debug) {
        console.log('[PerformanceCollector] Page timing:', timing);
      }
    }, undefined, 'PerformanceCollector.collectPageTiming');
  }

  /**
   * 同步采集页面加载性能（不自动上报）
   * @internal
   */
  private collectPageTimingSync(): PageTiming | null {
    return safeExecute(() => this.getPageTiming(), null, 'collectPageTimingSync') ?? null;
  }

  /**
   * 获取页面加载性能数据
   * @internal
   */
  private getPageTiming(): PageTiming | null {
    const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (!perfData) return null;

    const paintEntries = performance.getEntriesByType('paint');
    const fp = paintEntries.find(e => e.name === 'first-paint');
    const fcp = paintEntries.find(e => e.name === 'first-contentful-paint');

    return {
      dns: Math.round(perfData.domainLookupEnd - perfData.domainLookupStart),
      tcp: Math.round(perfData.connectEnd - perfData.connectStart),
      ssl: perfData.secureConnectionStart > 0
        ? Math.round(perfData.connectEnd - perfData.secureConnectionStart)
        : 0,
      ttfb: Math.round(perfData.responseStart - perfData.requestStart),
      dom_parse: Math.round(perfData.domContentLoadedEventStart - perfData.responseEnd),
      dom_ready: Math.round(perfData.domContentLoadedEventStart - perfData.fetchStart),
      load: Math.round(perfData.loadEventEnd - perfData.fetchStart),
      fp: fp ? Math.round(fp.startTime) : null,
      fcp: fcp ? Math.round(fcp.startTime) : null
    };
  }

  /**
   * 初始化 Web Vitals 观察器
   * @internal
   */
  private initWebVitalsObserver(): void {
    safeExecute(() => {
      if (!PerformanceObserver) return;

      // LCP (Largest Contentful Paint)
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          if (lastEntry) {
            this.reportWebVital('lcp', Math.round(lastEntry.startTime));
          }
        });
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      } catch {
        // 浏览器不支持
      }

      // FID (First Input Delay)
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach(entry => {
            if ('processingStart' in entry) {
              const fid = (entry as PerformanceEventTiming).processingStart - entry.startTime;
              this.reportWebVital('fid', Math.round(fid));
            }
          });
        });
        fidObserver.observe({ type: 'first-input', buffered: true });
      } catch {
        // 浏览器不支持
      }

      // CLS (Cumulative Layout Shift)
      try {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach(entry => {
            const lsEntry = entry as LayoutShiftEntry;
            if (!lsEntry.hadRecentInput && 'value' in entry) {
              clsValue += lsEntry.value;
            }
          });
          this.reportWebVital('cls', Math.round(clsValue * 1000) / 1000);
        });
        clsObserver.observe({ type: 'layout-shift', buffered: true });
      } catch {
        // 浏览器不支持
      }
    }, undefined, 'PerformanceCollector.initWebVitalsObserver');
  }

  /**
   * 获取 Web Vitals 同步数据
   * @internal
   */
  private getWebVitalsSync(): WebVitals {
    const vitals: WebVitals = { lcp: null, fid: null, cls: null };

    safeExecute(() => {
      // LCP
      const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
      if (lcpEntries.length > 0) {
        vitals.lcp = Math.round(lcpEntries[lcpEntries.length - 1].startTime);
      }

      // FID
      const fidEntries = performance.getEntriesByType('first-input');
      if (fidEntries.length > 0) {
        const entry = fidEntries[0] as PerformanceEventTiming;
        vitals.fid = Math.round(entry.processingStart - entry.startTime);
      }
    }, undefined, 'getWebVitalsSync');

    return vitals;
  }

  /**
   * 上报 Web Vital 指标
   * @internal
   */
  private reportWebVital(name: string, value: number): void {
    const params: EventParams = {
      category: 'performance',
      metric_name: name,
      metric_value: value
    };

    this.reportFn('performance_web_vital', params);

    if (this.config.debug) {
      console.log(`[PerformanceCollector] Web Vital ${name}:`, value);
    }
  }

  /**
   * 初始化资源加载观察器
   * @internal
   */
  private initResourceObserver(): void {
    safeExecute(() => {
      if (!PerformanceObserver) return;

      this.performanceObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          if (entry.entryType === 'resource') {
            this.reportResource(entry as PerformanceResourceTiming);
          }
        });
      });

      this.performanceObserver.observe({ entryTypes: ['resource'] });
    }, undefined, 'PerformanceCollector.initResourceObserver');
  }

  /**
   * 上报资源加载性能
   * @internal
   */
  private reportResource(entry: PerformanceResourceTiming): void {
    // 采样率检查
    if (Math.random() > this.config.resourceSampleRate) return;

    // 防止重复上报
    if (this.reportedResources.has(entry.name)) return;
    this.reportedResources.add(entry.name);

    const params: EventParams = {
      category: 'performance',
      resource_name: this.truncateUrl(entry.name),
      resource_type: this.getResourceType(entry.initiatorType),
      resource_duration: Math.round(entry.duration),
      resource_size: Math.round(entry.transferSize || entry.encodedBodySize || 0)
    };

    this.reportFn('performance_resource', params);
  }

  /**
   * 获取资源类型
   * @internal
   */
  private getResourceType(initiatorType: string): string {
    const typeMap: Record<string, string> = {
      script: 'script',
      link: 'stylesheet',
      img: 'image',
      css: 'stylesheet',
      fetch: 'api',
      xmlhttprequest: 'api',
      other: 'other'
    };
    return typeMap[initiatorType] || 'other';
  }

  /**
   * 截断 URL
   * @internal
   */
  private truncateUrl(url: string): string {
    const maxLength = 200;
    return url.length > maxLength ? url.substring(0, maxLength) + '...' : url;
  }
}