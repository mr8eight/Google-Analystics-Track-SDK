// src/core/OfflineQueue.ts

/**
 * 离线缓存队列
 *
 * 当网络断开时，将事件缓存到 localStorage，网络恢复后自动重试上报。
 * 使用指数退避策略控制重试频率，避免请求风暴。
 *
 * @example
 * ```ts
 * const queue = new OfflineQueue({
 *   maxItems: 100,
 *   retryInterval: 5000,
 *   maxRetries: 3,
 *   reportFn: (name, params) => sendToGtag(name, params)
 * });
 *
 * // 网络断开时入队
 * if (!navigator.onLine) {
 *   queue.enqueue('button_click', { category: 'ui' });
 * }
 *
 * // 网络恢复时自动处理
 * window.addEventListener('online', () => queue.flush());
 * ```
 */

import type { OfflineQueueConfig, QueuedEvent, EventParams } from '../types';
import { safeExecute, safeExecuteAsync, safeGetStorage, safeSetStorage, isLocalStorageAvailable, generateId } from './utils';

/** localStorage 存储键名 */
const STORAGE_KEY = '__tracker_queue__';

/** 默认配置 */
const DEFAULT_CONFIG = {
  maxItems: 100,
  retryInterval: 5000,
  maxRetries: 3
};

/**
 * 离线缓存队列
 */
export class OfflineQueue {
  private queue: QueuedEvent[] = [];
  private config: OfflineQueueConfig & typeof DEFAULT_CONFIG;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isFlushing: boolean = false;

  /**
   * 绑定的网络恢复事件处理器
   * 使用箭头函数绑定 this，便于移除监听器
   * @internal
   */
  private handleOnline = (): void => {
    this.flush();
  };

  /**
   * @param config - 队列配置
   */
  constructor(config: OfflineQueueConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config
    };

    this.restore();
    this.bindNetworkEvents();
  }

  /**
   * 将事件加入队列
   *
   * 网络断开时调用，事件会持久化到 localStorage。
   *
   * @param eventName - 事件名称
   * @param params - 事件参数
   * @returns 是否成功加入队列（队列满时返回 false）
   */
  enqueue(eventName: string, params: EventParams): boolean {
    return safeExecute(() => {
      // 检查队列是否已满
      if (this.queue.length >= this.config.maxItems) {
        // 移除最旧的条目
        this.queue.shift();
      }

      const event: QueuedEvent = {
        id: generateId(),
        name: eventName,
        params,
        timestamp: Date.now(),
        retries: 0
      };

      this.queue.push(event);
      this.save();

      return true;
    }, false, 'OfflineQueue.enqueue') ?? false;
  }

  /**
   * 获取队列长度
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * 清空队列
   */
  clear(): void {
    safeExecute(() => {
      this.queue = [];
      this.save();
    }, undefined, 'OfflineQueue.clear');
  }

  /**
   * 立即尝试上报队列中所有事件
   *
   * 网络恢复时自动调用。
   *
   * @returns 上报成功的事件数量
   */
  async flush(): Promise<number> {
    if (this.isFlushing || this.queue.length === 0) {
      return 0;
    }

    this.isFlushing = true;

    const result = await safeExecuteAsync(async () => {
      let successCount = 0;
      const failedEvents: QueuedEvent[] = [];

      for (const event of this.queue) {
        try {
          // 尝试上报
          this.config.reportFn(event.name, event.params);
          successCount++;
        } catch {
          // 上报失败，增加重试计数
          event.retries++;

          // 如果未超过最大重试次数，保留事件
          if (event.retries < this.config.maxRetries) {
            failedEvents.push(event);
          }
        }
      }

      // 更新队列（只保留失败的事件）
      this.queue = failedEvents;
      this.save();

      return successCount;
    }, 0, 'OfflineQueue.flush');

    this.isFlushing = false;
    return result ?? 0;
  }

  /**
   * 启动定时重试
   *
   * 定期检查队列并尝试上报。
   * @internal
   */
  startRetryTimer(): void {
    if (this.flushTimer) return;

    this.flushTimer = setInterval(() => {
      if (navigator.onLine && this.queue.length > 0) {
        this.flush();
      }
    }, this.config.retryInterval);
  }

  /**
   * 停止定时重试
   *
   * 销毁时调用。
   * @internal
   */
  stopRetryTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * 恢复队列
   *
   * 从 localStorage 恢复之前保存的队列。
   * @internal
   */
  private restore(): void {
    safeExecute(() => {
      if (isLocalStorageAvailable()) {
        const stored = safeGetStorage(STORAGE_KEY);
        if (stored) {
          this.queue = JSON.parse(stored);
        }
      }
    }, undefined, 'OfflineQueue.restore');
  }

  /**
   * 保存队列到 localStorage
   * @internal
   */
  private save(): void {
    safeExecute(() => {
      if (isLocalStorageAvailable()) {
        safeSetStorage(STORAGE_KEY, JSON.stringify(this.queue));
      }
    }, undefined, 'OfflineQueue.save');
  }

  /**
   * 绑定网络事件监听
   * @internal
   */
  private bindNetworkEvents(): void {
    safeExecute(() => {
      window.addEventListener('online', this.handleOnline);
    }, undefined, 'OfflineQueue.bindNetworkEvents');
  }

  /**
   * 销毁队列实例
   *
   * 清理定时器和事件监听器，防止内存泄漏。
   * 销毁后不应再使用该实例。
   */
  destroy(): void {
    this.stopRetryTimer();
    safeExecute(() => {
      window.removeEventListener('online', this.handleOnline);
    }, undefined, 'OfflineQueue.destroy');
  }
}