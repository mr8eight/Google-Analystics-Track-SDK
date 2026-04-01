// src/collectors/ErrorCollector.ts

/**
 * 错误采集器
 *
 * 自动采集以下类型的错误：
 * - JS 运行时错误 (window.onerror)
 * - Promise 未捕获异常 (unhandledrejection)
 * - 资源加载错误 (script, link, img, audio, video)
 *
 * @example
 * ```ts
 * const collector = new ErrorCollector(reportFn, { debug: true });
 * collector.start();
 *
 * // 手动捕获错误
 * collector.captureError(new Error('manual error'), { context: 'checkout' });
 *
 * // 停止采集
 * collector.stop();
 * ```
 */

import type { ErrorCollectorConfig, ReportFunction, EventParams } from '../types';
import { safeExecute, isBrowser } from '../core/utils';

/** 错误类型 */
type ErrorType = 'js_error' | 'promise_error' | 'resource_error';

/** 格式化后的错误信息 */
interface FormattedError {
  type: ErrorType;
  message: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
  resourceUrl?: string;
  resourceType?: string;
}

/**
 * 错误采集器
 */
export class ErrorCollector {
  private reportFn: ReportFunction;
  private config: Required<ErrorCollectorConfig>;
  private isRunning: boolean = false;

  /** 绑定的事件处理器，用于移除监听 */
  private boundHandlers: {
    onError: (event: ErrorEvent) => void;
    onUnhandledRejection: (event: PromiseRejectionEvent) => void;
  } | null = null;

  /**
   * @param reportFn - 上报函数
   * @param config - 采集器配置
   */
  constructor(reportFn: ReportFunction, config?: ErrorCollectorConfig) {
    this.reportFn = reportFn;
    this.config = {
      debug: config?.debug ?? false,
      captureResourceError: config?.captureResourceError ?? true,
      capturePromiseError: config?.capturePromiseError ?? true,
      ignoreErrors: config?.ignoreErrors ?? []
    };
  }

  /**
   * 启动错误采集
   */
  start(): void {
    if (!isBrowser() || this.isRunning) return;

    safeExecute(() => {
      // 创建绑定的处理器
      this.boundHandlers = {
        onError: this.handleError.bind(this),
        onUnhandledRejection: this.handleRejection.bind(this)
      };

      // 监听 JS 运行时错误
      window.addEventListener('error', this.boundHandlers.onError, true);

      // 监听 Promise 未捕获异常
      if (this.config.capturePromiseError) {
        window.addEventListener('unhandledrejection', this.boundHandlers.onUnhandledRejection);
      }

      this.isRunning = true;

      if (this.config.debug) {
        console.log('[ErrorCollector] Started');
      }
    }, undefined, 'ErrorCollector.start');
  }

  /**
   * 停止错误采集
   */
  stop(): void {
    if (!this.isRunning || !this.boundHandlers) return;

    safeExecute(() => {
      window.removeEventListener('error', this.boundHandlers!.onError, true);

      if (this.config.capturePromiseError) {
        window.removeEventListener('unhandledrejection', this.boundHandlers!.onUnhandledRejection);
      }

      this.boundHandlers = null;
      this.isRunning = false;

      if (this.config.debug) {
        console.log('[ErrorCollector] Stopped');
      }
    }, undefined, 'ErrorCollector.stop');
  }

  /**
   * 手动捕获错误
   *
   * @param error - 错误对象
   * @param context - 附加上下文信息
   */
  captureError(error: Error, context?: Record<string, any>): void {
    safeExecute(() => {
      const formatted: FormattedError = {
        type: 'js_error',
        message: error.message,
        stack: error.stack
      };

      this.reportFormattedError(formatted, context);
    }, undefined, 'ErrorCollector.captureError');
  }

  /**
   * 处理 JS 运行时错误
   * @internal
   */
  private handleError(event: ErrorEvent): void {
    safeExecute(() => {
      // 区分资源加载错误和 JS 错误
      if (event.target !== window) {
        // 资源加载错误
        if (this.config.captureResourceError) {
          this.handleResourceError(event);
        }
        return;
      }

      // JS 运行时错误
      const formatted: FormattedError = {
        type: 'js_error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      };

      this.reportFormattedError(formatted);
    }, undefined, 'ErrorCollector.handleError');
  }

  /**
   * 处理 Promise 未捕获异常
   * @internal
   */
  private handleRejection(event: PromiseRejectionEvent): void {
    safeExecute(() => {
      const reason = event.reason;
      let message: string;
      let stack: string | undefined;

      if (reason instanceof Error) {
        message = reason.message;
        stack = reason.stack;
      } else if (typeof reason === 'string') {
        message = reason;
      } else {
        message = JSON.stringify(reason);
      }

      const formatted: FormattedError = {
        type: 'promise_error',
        message,
        stack
      };

      this.reportFormattedError(formatted);
    }, undefined, 'ErrorCollector.handleRejection');
  }

  /**
   * 处理资源加载错误
   * @internal
   */
  private handleResourceError(event: ErrorEvent): void {
    safeExecute(() => {
      const target = event.target as Element;
      if (!target) return;

      const tagName = target.tagName?.toLowerCase();
      const resourceUrl = this.getResourceUrl(target);
      const resourceType = this.getResourceType(tagName);

      if (!resourceUrl || !resourceType) return;

      const formatted: FormattedError = {
        type: 'resource_error',
        message: `Failed to load ${resourceType}: ${resourceUrl}`,
        resourceUrl,
        resourceType
      };

      this.reportFormattedError(formatted);
    }, undefined, 'ErrorCollector.handleResourceError');
  }

  /**
   * 上报格式化后的错误
   * @internal
   */
  private reportFormattedError(formatted: FormattedError, context?: Record<string, any>): void {
    // 检查是否在忽略列表中
    if (this.shouldIgnore(formatted.message)) {
      return;
    }

    const params: EventParams = {
      category: 'error',
      error_type: formatted.type,
      error_message: formatted.message,
      error_filename: formatted.filename,
      error_lineno: formatted.lineno,
      error_colno: formatted.colno,
      error_stack: formatted.stack ? this.truncateStack(formatted.stack) : undefined,
      resource_url: formatted.resourceUrl,
      resource_type: formatted.resourceType,
      ...context
    };

    this.reportFn('error', params);

    if (this.config.debug) {
      console.log('[ErrorCollector] Error captured:', formatted);
    }
  }

  /**
   * 检查是否应该忽略该错误
   * @internal
   */
  private shouldIgnore(message: string): boolean {
    return this.config.ignoreErrors.some(pattern => pattern.test(message));
  }

  /**
   * 获取资源 URL
   * @internal
   */
  private getResourceUrl(element: Element): string | undefined {
    return (
      element.getAttribute('src') ||
      element.getAttribute('href') ||
      element.getAttribute('data-src') ||
      undefined
    );
  }

  /**
   * 获取资源类型
   * @internal
   */
  private getResourceType(tagName: string): string | undefined {
    const typeMap: Record<string, string> = {
      script: 'script',
      link: 'stylesheet',
      img: 'image',
      audio: 'audio',
      video: 'video',
      source: 'media'
    };
    return typeMap[tagName];
  }

  /**
   * 截断堆栈信息
   * @internal
   */
  private truncateStack(stack: string): string {
    const maxLength = 500;
    return stack.length > maxLength ? stack.substring(0, maxLength) + '...' : stack;
  }
}