// src/collectors/NetworkCollector.ts

/**
 * 网络采集器
 *
 * 拦截并监控所有网络请求：
 * - fetch API
 * - XMLHttpRequest
 *
 * 自动上报请求错误、慢请求。
 *
 * @example
 * ```ts
 * const collector = new NetworkCollector(reportFn, {
 *   slowThreshold: 3000,
 *   ignoreUrls: [/\/api\/health/]
 * });
 * collector.start();
 * ```
 */

import type { NetworkCollectorConfig, ReportFunction, EventParams } from '../types';
import { safeExecute, isBrowser, shouldIgnoreUrl } from '../core/utils';

/**
 * 网络采集器
 */
export class NetworkCollector {
  private reportFn: ReportFunction;
  private config: Required<NetworkCollectorConfig>;
  private isRunning: boolean = false;

  /** 保存的原始方法 */
  private originalFetch: typeof fetch | null = null;
  private originalXHROpen: typeof XMLHttpRequest.prototype.open | null = null;
  private originalXHRSend: typeof XMLHttpRequest.prototype.send | null = null;

  /**
   * @param reportFn - 上报函数
   * @param config - 采集器配置
   */
  constructor(reportFn: ReportFunction, config?: NetworkCollectorConfig) {
    this.reportFn = reportFn;
    this.config = {
      debug: config?.debug ?? false,
      slowThreshold: config?.slowThreshold ?? 3000,
      ignoreUrls: config?.ignoreUrls ?? [],
      reportSuccess: config?.reportSuccess ?? false,
      sampleRate: config?.sampleRate ?? 0.1
    };
  }

  /**
   * 启动网络采集
   */
  start(): void {
    if (!isBrowser() || this.isRunning) return;

    safeExecute(() => {
      this.interceptFetch();
      this.interceptXHR();
      this.isRunning = true;

      if (this.config.debug) {
        console.log('[NetworkCollector] Started');
      }
    }, undefined, 'NetworkCollector.start');
  }

  /**
   * 停止网络采集
   */
  stop(): void {
    if (!this.isRunning) return;

    safeExecute(() => {
      // 恢复原始方法
      if (this.originalFetch) {
        window.fetch = this.originalFetch;
      }
      if (this.originalXHROpen && this.originalXHRSend) {
        XMLHttpRequest.prototype.open = this.originalXHROpen;
        XMLHttpRequest.prototype.send = this.originalXHRSend;
      }

      this.originalFetch = null;
      this.originalXHROpen = null;
      this.originalXHRSend = null;
      this.isRunning = false;

      if (this.config.debug) {
        console.log('[NetworkCollector] Stopped');
      }
    }, undefined, 'NetworkCollector.stop');
  }

  /**
   * 拦截 fetch API
   * @internal
   */
  private interceptFetch(): void {
    this.originalFetch = window.fetch;
    const self = this;

    window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();
      const method = init?.method || 'GET';
      const startTime = performance.now();

      try {
        const response = await self.originalFetch!.apply(this, [input, init] as any);
        self.reportNetworkEvent({
          url,
          method,
          status: response.status,
          duration: Math.round(performance.now() - startTime),
          type: 'fetch',
          isSuccess: response.ok
        });
        return response;
      } catch (error: any) {
        self.reportNetworkEvent({
          url,
          method,
          status: 0,
          duration: Math.round(performance.now() - startTime),
          type: 'fetch',
          isSuccess: false,
          errorMessage: error.message
        });
        throw error;
      }
    };
  }

  /**
   * 拦截 XMLHttpRequest
   * @internal
   */
  private interceptXHR(): void {
    const self = this;
    this.originalXHROpen = XMLHttpRequest.prototype.open;
    this.originalXHRSend = XMLHttpRequest.prototype.send;

    // 重写 open 方法记录请求信息
    XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...args: any[]) {
      (this as any).__trackerMeta = {
        method,
        url: url.toString(),
        startTime: 0
      };
      return self.originalXHROpen!.apply(this, [method, url, ...args] as any);
    };

    // 重写 send 方法记录时间和处理响应
    XMLHttpRequest.prototype.send = function(body?: Document | XMLHttpRequestBodyInit | null) {
      const meta = (this as any).__trackerMeta;
      if (meta) {
        meta.startTime = performance.now();
      }

      // 监听加载完成
      this.addEventListener('load', function() {
        if (meta) {
          self.reportNetworkEvent({
            url: meta.url,
            method: meta.method,
            status: this.status,
            duration: Math.round(performance.now() - meta.startTime),
            type: 'xhr',
            isSuccess: this.status >= 200 && this.status < 400
          });
        }
      });

      // 监听错误
      this.addEventListener('error', function() {
        if (meta) {
          self.reportNetworkEvent({
            url: meta.url,
            method: meta.method,
            status: 0,
            duration: Math.round(performance.now() - meta.startTime),
            type: 'xhr',
            isSuccess: false,
            errorMessage: 'Network error'
          });
        }
      });

      // 监听超时
      this.addEventListener('timeout', function() {
        if (meta) {
          self.reportNetworkEvent({
            url: meta.url,
            method: meta.method,
            status: 0,
            duration: Math.round(performance.now() - meta.startTime),
            type: 'xhr',
            isSuccess: false,
            errorMessage: 'Request timeout'
          });
        }
      });

      return self.originalXHRSend!.apply(this, [body] as any);
    };
  }

  /**
   * 上报网络事件
   * @internal
   */
  private reportNetworkEvent(data: {
    url: string;
    method: string;
    status: number;
    duration: number;
    type: 'fetch' | 'xhr';
    isSuccess: boolean;
    errorMessage?: string;
  }): void {
    safeExecute(() => {
      // 检查是否忽略
      if (this.config.ignoreUrls.length > 0 && shouldIgnoreUrl(data.url, this.config.ignoreUrls)) {
        return;
      }

      // 采样率检查（只对成功请求）
      if (data.isSuccess && !this.config.reportSuccess && Math.random() > this.config.sampleRate) {
        return;
      }

      const isSlow = data.duration >= this.config.slowThreshold;
      const isError = !data.isSuccess || data.status >= 400;

      // 只上报错误和慢请求
      if (!isError && !isSlow && !this.config.reportSuccess) {
        return;
      }

      const eventName = isError ? 'network_error' : (isSlow ? 'network_slow' : 'network_request');
      const params: EventParams = {
        category: 'network',
        network_url: this.truncateUrl(data.url),
        network_method: data.method,
        network_status: data.status,
        network_duration: data.duration,
        network_type: data.type,
        network_is_slow: isSlow,
        network_is_error: isError
      };

      if (data.errorMessage) {
        params.network_error_message = data.errorMessage;
      }

      this.reportFn(eventName, params);

      if (this.config.debug) {
        console.log(`[NetworkCollector] ${eventName}:`, params);
      }
    }, undefined, 'NetworkCollector.reportNetworkEvent');
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