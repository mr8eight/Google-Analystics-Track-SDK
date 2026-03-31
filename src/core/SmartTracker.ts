// src/core/SmartTracker.ts

/**
 * 智能埋点追踪器
 *
 * 单例模式实现，提供统一的事件采集和上报能力。
 * 支持性能监控、错误监控、网络监控、交互追踪。
 *
 * @example
 * ```ts
 * // 初始化
 * SmartTracker.init({
 *   measurementId: 'G-XXXXXXXXXX',
 *   enablePerformance: true,
 *   enableError: true,
 *   enableOffline: true
 * });
 *
 * // 用户追踪
 * SmartTracker.getInstance()?.setUser('user-123', { role: 'admin', plan: 'pro' });
 *
 * // 手动埋点
 * SmartTracker.getInstance()?.trackEvent('button_click', { category: 'ui', label: 'submit' });
 *
 * // 销毁
 * SmartTracker.getInstance()?.destroy();
 * ```
 */

import type { TrackerConfig, EventParams, UserTraits, ReportFunction } from '../types';
import { setGlobalConfig, safeExecute, isBrowser } from './utils';
import { UserTracker } from './UserTracker';
import { OfflineQueue } from './OfflineQueue';
import { injectGtagScript, sendToGtag, sendPageView, setUserProperties, clearUserProperties } from '../reporter/gtag';

/** 默认配置 */
const DEFAULT_CONFIG: Partial<TrackerConfig> = {
  enablePerformance: true,
  enableError: true,
  enableNetwork: true,
  enableInteraction: false,
  enableOffline: false,
  debug: false
};

/**
 * 智能追踪器主类
 */
export class SmartTracker {
  private static instance: SmartTracker | null = null;
  private config: TrackerConfig;
  private userTracker: UserTracker;
  private offlineQueue: OfflineQueue | null = null;
  private collectors: {
    performance?: { stop: () => void };
    error?: { stop: () => void };
    network?: { stop: () => void };
    interaction?: { stop: () => void };
  } = {};
  private isInitialized: boolean = false;
  private isDestroyed: boolean = false;

  /**
   * 私有构造函数，使用 init() 方法初始化
   */
  private constructor(config: TrackerConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.userTracker = new UserTracker();
    setGlobalConfig(this.config);
    this.init();
  }

  /**
   * 初始化追踪器
   *
   * @param config - 配置项
   * @returns SmartTracker 实例
   * @throws 如果 measurementId 未提供
   *
   * @example
   * ```ts
   * const tracker = SmartTracker.init({
   *   measurementId: 'G-XXXXXXXXXX',
   *   enablePerformance: true
   * });
   * ```
   */
  static init(config: TrackerConfig): SmartTracker {
    if (!config.measurementId) {
      throw new Error('[Tracker] measurementId is required');
    }

    if (SmartTracker.instance) {
      if (config.debug) {
        console.warn('[Tracker] Already initialized, returning existing instance');
      }
      return SmartTracker.instance;
    }

    SmartTracker.instance = new SmartTracker(config);
    return SmartTracker.instance;
  }

  /**
   * 获取单例实例
   *
   * @returns SmartTracker 实例，未初始化时返回 null
   */
  static getInstance(): SmartTracker | null {
    return SmartTracker.instance;
  }

  /**
   * 设置当前用户信息
   *
   * @param userId - 用户唯一标识
   * @param traits - 用户属性（角色、计划等）
   *
   * @example
   * ```ts
   * tracker.setUser('user-123', { role: 'admin', plan: 'pro' });
   * ```
   */
  setUser(userId: string, traits?: UserTraits): void {
    safeExecute(() => {
      this.userTracker.setUser(userId, traits);
      setUserProperties(userId, traits, this.config);
    }, undefined, 'SmartTracker.setUser');
  }

  /**
   * 清除用户信息
   *
   * 登出时调用。
   */
  clearUser(): void {
    safeExecute(() => {
      this.userTracker.clearUser();
      clearUserProperties(this.config);
    }, undefined, 'SmartTracker.clearUser');
  }

  /**
   * 上报自定义事件
   *
   * @param name - 事件名称
   * @param params - 事件参数
   *
   * @example
   * ```ts
   * tracker.trackEvent('button_click', {
   *   category: 'ui',
   *   label: 'submit',
   *   value: 1
   * });
   * ```
   */
  trackEvent(name: string, params?: EventParams): void {
    safeExecute(() => {
      const mergedParams = {
        ...params,
        ...this.userTracker.getContext()
      };

      // 检查是否需要离线缓存
      if (!navigator.onLine && this.offlineQueue) {
        this.offlineQueue.enqueue(name, mergedParams);
        return;
      }

      sendToGtag(name, mergedParams, this.config);
    }, undefined, 'SmartTracker.trackEvent');
  }

  /**
   * 手动上报页面访问
   *
   * @param path - 页面路径，默认当前路径
   * @param title - 页面标题
   *
   * @example
   * ```ts
   * // SPA 路由切换时
   * tracker.trackPageView('/products/123', '产品详情');
   * ```
   */
  trackPageView(path?: string, title?: string): void {
    safeExecute(() => {
      const pagePath = path || (isBrowser() ? window.location.pathname + window.location.search : '');
      if (pagePath) {
        sendPageView(pagePath, title, this.config);
      }
    }, undefined, 'SmartTracker.trackPageView');
  }

  /**
   * 销毁实例
   *
   * 清理所有采集器和监听器，用于 SPA 路由切换或组件卸载场景。
   *
   * @example
   * ```ts
   * tracker.destroy();
   * ```
   */
  destroy(): void {
    if (this.isDestroyed) return;

    safeExecute(() => {
      // 停止所有采集器
      Object.values(this.collectors).forEach(collector => {
        if (collector && typeof collector.stop === 'function') {
          collector.stop();
        }
      });

      // 销毁离线队列
      if (this.offlineQueue) {
        this.offlineQueue.destroy();
      }

      this.isDestroyed = true;
      this.isInitialized = false;
      SmartTracker.instance = null;
    }, undefined, 'SmartTracker.destroy');
  }

  // ============================================
  // Internal Methods
  // ============================================

  /**
   * 内部上报函数
   * @internal
   */
  private report: ReportFunction = (eventName: string, params: EventParams) => {
    const mergedParams = {
      ...params,
      ...this.userTracker.getContext()
    };

    // 检查是否需要离线缓存
    if (isBrowser() && !navigator.onLine && this.offlineQueue) {
      this.offlineQueue.enqueue(eventName, mergedParams);
      return;
    }

    sendToGtag(eventName, mergedParams, this.config);
  };

  /**
   * 初始化内部逻辑
   * @internal
   */
  private init(): void {
    if (!isBrowser()) return;
    if (this.isInitialized) return;

    safeExecute(() => {
      // 注入 GA 脚本
      injectGtagScript(this.config.measurementId, this.config);

      // 初始化离线队列
      if (this.config.enableOffline) {
        this.offlineQueue = new OfflineQueue({
          reportFn: this.report
        });
        this.offlineQueue.startRetryTimer();
      }

      // 注意：采集器将在 Task 7-10 中实现
      // 目前只初始化基础功能

      this.isInitialized = true;

      if (this.config.debug) {
        console.log('[Tracker] Initialized successfully');
      }
    }, undefined, 'SmartTracker.init');
  }
}