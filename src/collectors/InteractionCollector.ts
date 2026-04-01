// src/collectors/InteractionCollector.ts

/**
 * 交互采集器
 *
 * 自动追踪用户交互行为：
 * - 点击事件
 * - 滚动深度
 * - 元素曝光
 *
 * @example
 * ```ts
 * const collector = new InteractionCollector(reportFn, {
 *   trackClicks: true,
 *   trackScrollDepth: true,
 *   trackExposure: false
 * });
 * collector.start();
 * ```
 */

import type { InteractionCollectorConfig, ReportFunction, EventParams } from '../types';
import { safeExecute, isBrowser, throttle } from '../core/utils';

/** 滚动数据 */
interface ScrollData {
  depth: number;
  direction: 'up' | 'down';
}

/** 元素信息 */
interface ElementInfo {
  tagName: string;
  id?: string;
  className?: string;
  trackName?: string;
  text?: string;
}

/**
 * 交互采集器
 */
export class InteractionCollector {
  private reportFn: ReportFunction;
  private config: Required<InteractionCollectorConfig>;
  private isRunning: boolean = false;

  /** 绑定的事件处理器 */
  private boundHandlers: {
    onClick: (event: MouseEvent) => void;
    onScroll: () => void;
  } | null = null;

  /** 滚动状态 */
  private lastScrollTop: number = 0;
  private reportedScrollDepths: Set<number> = new Set();

  /** 曝光观察器 */
  private intersectionObserver: IntersectionObserver | null = null;

  /**
   * @param reportFn - 上报函数
   * @param config - 采集器配置
   */
  constructor(reportFn: ReportFunction, config?: InteractionCollectorConfig) {
    this.reportFn = reportFn;
    this.config = {
      debug: config?.debug ?? false,
      trackClicks: config?.trackClicks ?? true,
      trackForms: config?.trackForms ?? true,
      trackScrollDepth: config?.trackScrollDepth ?? true,
      trackExposure: config?.trackExposure ?? false,
      exposureThreshold: config?.exposureThreshold ?? 0.5,
      scrollThresholds: config?.scrollThresholds ?? [25, 50, 75, 100],
      ignoreSelectors: config?.ignoreSelectors ?? []
    };
  }

  /**
   * 启动交互采集
   */
  start(): void {
    if (!isBrowser() || this.isRunning) return;

    safeExecute(() => {
      this.boundHandlers = {
        onClick: this.handleClick.bind(this),
        onScroll: throttle(this.handleScroll.bind(this), 200)
      };

      // 点击追踪
      if (this.config.trackClicks) {
        document.addEventListener('click', this.boundHandlers.onClick, true);
      }

      // 滚动追踪
      if (this.config.trackScrollDepth) {
        window.addEventListener('scroll', this.boundHandlers.onScroll);
      }

      // 曝光追踪
      if (this.config.trackExposure) {
        this.initExposureObserver();
      }

      this.isRunning = true;

      if (this.config.debug) {
        console.log('[InteractionCollector] Started');
      }
    }, undefined, 'InteractionCollector.start');
  }

  /**
   * 停止交互采集
   */
  stop(): void {
    if (!this.isRunning || !this.boundHandlers) return;

    safeExecute(() => {
      if (this.config.trackClicks) {
        document.removeEventListener('click', this.boundHandlers!.onClick, true);
      }

      if (this.config.trackScrollDepth) {
        window.removeEventListener('scroll', this.boundHandlers!.onScroll);
      }

      if (this.intersectionObserver) {
        this.intersectionObserver.disconnect();
        this.intersectionObserver = null;
      }

      this.boundHandlers = null;
      this.reportedScrollDepths.clear();
      this.isRunning = false;

      if (this.config.debug) {
        console.log('[InteractionCollector] Stopped');
      }
    }, undefined, 'InteractionCollector.stop');
  }

  /**
   * 处理点击事件
   * @internal
   */
  private handleClick(event: MouseEvent): void {
    safeExecute(() => {
      const target = event.target as Element;
      if (!target) return;

      // 检查是否忽略
      if (this.shouldIgnoreElement(target)) return;

      // 查找最近的带有 data-track-name 的元素
      const trackElement = target.closest('[data-track-name]');
      const elementInfo = this.getElementInfo(trackElement || target);

      // 如果没有 trackName 且是普通元素，不追踪
      if (!trackElement && !this.isInterestingElement(target)) {
        return;
      }

      const params: EventParams = {
        category: 'interaction',
        interaction_type: 'click',
        ...elementInfo
      };

      this.reportFn('interaction_click', params);

      if (this.config.debug) {
        console.log('[InteractionCollector] Click:', elementInfo);
      }
    }, undefined, 'InteractionCollector.handleClick');
  }

  /**
   * 处理滚动事件
   * @internal
   */
  private handleScroll(): void {
    safeExecute(() => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;
      const maxScroll = scrollHeight - clientHeight;
      const scrollPercent = maxScroll > 0 ? Math.round((scrollTop / maxScroll) * 100) : 0;

      const direction: ScrollData['direction'] = scrollTop > this.lastScrollTop ? 'down' : 'up';
      this.lastScrollTop = scrollTop;

      // 检查是否达到阈值
      for (const threshold of this.config.scrollThresholds) {
        if (scrollPercent >= threshold && !this.reportedScrollDepths.has(threshold)) {
          this.reportedScrollDepths.add(threshold);

          const params: EventParams = {
            category: 'interaction',
            interaction_type: 'scroll',
            scroll_depth: threshold,
            scroll_direction: direction
          };

          this.reportFn('interaction_scroll', params);

          if (this.config.debug) {
            console.log(`[InteractionCollector] Scroll: ${threshold}%`);
          }
        }
      }
    }, undefined, 'InteractionCollector.handleScroll');
  }

  /**
   * 初始化曝光观察器
   * @internal
   */
  private initExposureObserver(): void {
    safeExecute(() => {
      if (!IntersectionObserver) return;

      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting && entry.intersectionRatio >= this.config.exposureThreshold) {
              const element = entry.target as Element;
              const elementInfo = this.getElementInfo(element);

              const params: EventParams = {
                category: 'interaction',
                interaction_type: 'exposure',
                exposure_ratio: Math.round(entry.intersectionRatio * 100),
                ...elementInfo
              };

              this.reportFn('interaction_exposure', params);

              if (this.config.debug) {
                console.log('[InteractionCollector] Exposure:', elementInfo);
              }

              // 上报后停止观察
              this.intersectionObserver!.unobserve(element);
            }
          });
        },
        { threshold: [this.config.exposureThreshold] }
      );

      // 观察所有带 data-track-exposure 的元素
      const elements = document.querySelectorAll('[data-track-exposure]');
      elements.forEach(el => this.intersectionObserver!.observe(el));
    }, undefined, 'InteractionCollector.initExposureObserver');
  }

  /**
   * 获取元素信息
   * @internal
   */
  private getElementInfo(element: Element): ElementInfo {
    const info: ElementInfo = {
      tagName: element.tagName.toLowerCase()
    };

    const id = element.getAttribute('id');
    if (id) info.id = id;

    const className = element.getAttribute('class');
    if (className) info.className = className.split(' ').slice(0, 3).join(' ');

    const trackName = element.getAttribute('data-track-name');
    if (trackName) info.trackName = trackName;

    // 获取元素文本（截断）
    const text = element.textContent?.trim();
    if (text) {
      info.text = text.length > 50 ? text.substring(0, 50) + '...' : text;
    }

    return info;
  }

  /**
   * 检查是否应该忽略元素
   * @internal
   */
  private shouldIgnoreElement(element: Element): boolean {
    if (element.hasAttribute('data-track-ignore')) return true;

    for (const selector of this.config.ignoreSelectors) {
      if (element.matches(selector)) return true;
    }

    return false;
  }

  /**
   * 检查是否是值得追踪的元素
   * @internal
   */
  private isInterestingElement(element: Element): boolean {
    const tagName = element.tagName.toLowerCase();
    const interestingTags = ['button', 'a', 'input', 'select', 'textarea'];

    if (interestingTags.includes(tagName)) return true;
    if (element.hasAttribute('onclick')) return true;
    if (element.getAttribute('role') === 'button') return true;

    return false;
  }
}