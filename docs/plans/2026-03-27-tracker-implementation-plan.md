# Smart Tracker SDK 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 优化现有埋点 SDK，添加用户追踪、离线缓存、完整错误隔离、完善采集器、支持 CDN 构建。

**Architecture:** 基于现有代码渐进式重构，保持向后兼容。采用模块化设计，每个采集器独立，核心类统一管理。

**Tech Stack:** TypeScript, tsup (构建), web-vitals (性能采集), localStorage (离线缓存)

---

## Task 1: 重构目录结构和类型定义

**Files:**
- Create: `src/types/index.ts`
- Modify: `src/types.ts` → 删除后迁移到新位置
- Modify: `src/index.ts`

**Step 1: 创建新的类型定义文件**

```typescript
// src/types/index.ts

/**
 * @packageDocumentation
 * Smart Tracker SDK 类型定义
 */

// ============================================
// 核心配置类型
// ============================================

/**
 * 追踪器配置
 */
export interface TrackerConfig {
  /** GA4 Measurement ID，必填 */
  measurementId: string;

  /** 是否启用性能监控，默认 true */
  enablePerformance?: boolean;

  /** 是否启用错误监控，默认 true */
  enableError?: boolean;

  /** 是否启用网络监控，默认 true */
  enableNetwork?: boolean;

  /** 是否启用交互追踪，默认 false */
  enableInteraction?: boolean;

  /** 是否启用离线缓存，默认 false */
  enableOffline?: boolean;

  /** 调试模式，控制台输出日志，默认 false */
  debug?: boolean;
}

/**
 * 用户属性
 */
export interface UserTraits {
  /** 用户角色 */
  role?: string;

  /** 用户等级/计划 */
  plan?: string;

  /** 公司名称 */
  company?: string;

  /** 其他自定义属性 */
  [key: string]: string | number | boolean | undefined;
}

/**
 * 事件参数
 */
export interface EventParams {
  /** 事件类别 */
  category?: string;

  /** 事件标签 */
  label?: string;

  /** 事件值 */
  value?: number;

  /** 是否非交互事件 */
  non_interaction?: boolean;

  /** 其他自定义参数 */
  [key: string]: any;
}

// 保留原有类型别名，向后兼容
export type ReportParams = EventParams;

// ============================================
// 采集器类型
// ============================================

/**
 * 采集器接口
 */
export interface Collector {
  /** 启动采集 */
  start(): void;

  /** 停止采集 */
  stop(): void;
}

/**
 * 上报函数类型
 */
export type ReportFunction = (eventName: string, params: EventParams) => void;

/**
 * 错误采集器配置
 */
export interface ErrorCollectorConfig {
  /** 调试模式 */
  debug?: boolean;

  /** 是否捕获资源加载错误，默认 true */
  captureResourceError?: boolean;

  /** 是否捕获 Promise 错误，默认 true */
  capturePromiseError?: boolean;

  /** 忽略的错误类型（正则匹配错误消息） */
  ignoreErrors?: RegExp[];
}

/**
 * 性能采集器配置
 */
export interface PerformanceCollectorConfig {
  /** 调试模式 */
  debug?: boolean;

  /** 是否采集资源加载性能，默认 true */
  collectResourceTiming?: boolean;

  /** 资源采样率 (0-1)，默认 0.1 */
  resourceSampleRate?: number;
}

/**
 * 网络采集器配置
 */
export interface NetworkCollectorConfig {
  /** 调试模式 */
  debug?: boolean;

  /** 慢请求阈值（毫秒），默认 3000 */
  slowThreshold?: number;

  /** 忽略的 URL 正则列表 */
  ignoreUrls?: RegExp[];

  /** 是否上报成功请求，默认 false */
  reportSuccess?: boolean;

  /** 请求采样率 (0-1)，默认 0.1 */
  sampleRate?: number;
}

/**
 * 交互采集器配置
 */
export interface InteractionCollectorConfig {
  /** 调试模式 */
  debug?: boolean;

  /** 是否追踪点击，默认 true */
  trackClicks?: boolean;

  /** 是否追踪表单提交，默认 true */
  trackForms?: boolean;

  /** 是否追踪滚动深度，默认 true */
  trackScrollDepth?: boolean;

  /** 是否追踪元素曝光，默认 false */
  trackExposure?: boolean;

  /** 曝光阈值，默认 0.5 */
  exposureThreshold?: number;

  /** 滚动深度阈值，默认 [25, 50, 75, 100] */
  scrollThresholds?: number[];

  /** 忽略的元素选择器 */
  ignoreSelectors?: string[];
}

// ============================================
// 离线缓存类型
// ============================================

/**
 * 离线队列配置
 */
export interface OfflineQueueConfig {
  /** 最大缓存数量，默认 100 */
  maxItems?: number;

  /** 重试间隔（毫秒），默认 5000 */
  retryInterval?: number;

  /** 最大重试次数，默认 3 */
  maxRetries?: number;

  /** 上报函数 */
  reportFn: ReportFunction;
}

/**
 * 队列中的事件
 */
export interface QueuedEvent {
  /** 事件 ID */
  id: string;

  /** 事件名称 */
  name: string;

  /** 事件参数 */
  params: EventParams;

  /** 入队时间戳 */
  timestamp: number;

  /** 已重试次数 */
  retries: number;
}

// ============================================
// Window 扩展类型
// ============================================

declare global {
  interface Window {
    /** Google Tag Manager 数据层 */
    dataLayer: any[];

    /** Google Tag 函数 */
    gtag: (...args: any[]) => void;

    /** 自动初始化配置（CDN 使用） */
    __TRACKER_CONFIG__?: TrackerConfig;
  }
}
```

**Step 2: 更新入口文件导出**

```typescript
// src/index.ts

/**
 * Smart Tracker SDK
 *
 * Google Analytics 4 埋点 SDK，支持：
 * - 自动性能采集
 * - 完整错误监控
 * - 网络请求监控
 * - 用户交互追踪
 * - 用户身份追踪
 * - 离线缓存
 *
 * @packageDocumentation
 */

// 核心类
export { SmartTracker } from './core/SmartTracker';

// 类型导出
export type {
  TrackerConfig,
  UserTraits,
  EventParams,
  ReportParams,
  Collector,
  ReportFunction,
  ErrorCollectorConfig,
  PerformanceCollectorConfig,
  NetworkCollectorConfig,
  InteractionCollectorConfig,
  OfflineQueueConfig,
  QueuedEvent
} from './types';

// 采集器（可选单独使用）
export { ErrorCollector } from './collectors/ErrorCollector';
export { PerformanceCollector } from './collectors/PerformanceCollector';
export { NetworkCollector } from './collectors/NetworkCollector';
export { InteractionCollector } from './collectors/InteractionCollector';

// Reporter（可选单独使用）
export { injectGtagScript, sendToGtag } from './reporter/gtag';
```

**Step 3: 删除旧的 types.ts 文件**

```bash
rm src/types.ts
```

**Step 4: 创建目录结构**

```bash
mkdir -p src/core
mkdir -p src/reporter
mkdir -p src/collectors
```

**Step 5: Commit**

```bash
git add src/types/index.ts src/index.ts
git commit -m "refactor: 重构类型定义，创建模块化目录结构"
```

---

## Task 2: 创建工具函数模块

**Files:**
- Create: `src/core/utils.ts`

**Step 1: 创建工具函数文件**

```typescript
// src/core/utils.ts

/**
 * @packageDocumentation
 * SDK 内部工具函数
 */

import type { TrackerConfig } from '../types';

/**
 * 追踪器全局配置（内部使用）
 * @internal
 */
let globalConfig: TrackerConfig | null = null;

/**
 * 设置全局配置
 * @internal
 */
export function setGlobalConfig(config: TrackerConfig): void {
  globalConfig = config;
}

/**
 * 获取全局配置
 * @internal
 */
export function getGlobalConfig(): TrackerConfig | null {
  return globalConfig;
}

/**
 * 安全执行同步函数
 *
 * 所有 SDK 内部逻辑都通过此函数执行，确保不会抛出异常到外部。
 *
 * @param fn - 要执行的函数
 * @param fallback - 失败时的返回值
 * @param context - 上下文描述（用于调试日志）
 * @returns 函数执行结果或 fallback
 *
 * @example
 * ```ts
 * const result = safeExecute(() => {
 *   return JSON.parse(data);
 * }, null, 'parseData');
 * ```
 *
 * @internal
 */
export function safeExecute<T>(
  fn: () => T,
  fallback?: T,
  context?: string
): T | undefined {
  try {
    return fn();
  } catch (error) {
    if (globalConfig?.debug) {
      console.warn('[Tracker] Internal error:', context || 'unknown', error);
    }
    return fallback;
  }
}

/**
 * 安全执行异步函数
 *
 * @param fn - 要执行的异步函数
 * @param fallback - 失败时的返回值
 * @param context - 上下文描述
 * @returns Promise 包裹的执行结果
 *
 * @internal
 */
export async function safeExecuteAsync<T>(
  fn: () => Promise<T>,
  fallback?: T,
  context?: string
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    if (globalConfig?.debug) {
      console.warn('[Tracker] Internal async error:', context || 'unknown', error);
    }
    return fallback;
  }
}

/**
 * 生成唯一 ID
 *
 * @returns 唯一标识符
 * @internal
 */
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 检查是否在浏览器环境
 *
 * @returns 是否在浏览器环境
 * @internal
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * 检查 localStorage 是否可用
 *
 * @returns localStorage 是否可用
 * @internal
 */
export function isLocalStorageAvailable(): boolean {
  if (!isBrowser()) return false;

  try {
    const testKey = '__tracker_test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * 安全读取 localStorage
 *
 * @param key - 存储键名
 * @returns 存储值或 null
 * @internal
 */
export function safeGetStorage(key: string): string | null {
  if (!isLocalStorageAvailable()) return null;

  return safeExecute(() => {
    return localStorage.getItem(key);
  }, null, 'safeGetStorage');
}

/**
 * 安全写入 localStorage
 *
 * @param key - 存储键名
 * @param value - 存储值
 * @returns 是否写入成功
 * @internal
 */
export function safeSetStorage(key: string, value: string): boolean {
  if (!isLocalStorageAvailable()) return false;

  return safeExecute(() => {
    localStorage.setItem(key, value);
    return true;
  }, false, 'safeSetStorage');
}

/**
 * 安全移除 localStorage
 *
 * @param key - 存储键名
 * @internal
 */
export function safeRemoveStorage(key: string): void {
  if (!isLocalStorageAvailable()) return;

  safeExecute(() => {
    localStorage.removeItem(key);
  }, undefined, 'safeRemoveStorage');
}

/**
 * 获取当前页面路径
 *
 * @returns 当前路径
 * @internal
 */
export function getCurrentPath(): string {
  if (!isBrowser()) return '';
  return window.location.pathname + window.location.search;
}

/**
 * 获取页面来源
 *
 * @returns referrer 或空字符串
 * @internal
 */
export function getReferrer(): string {
  if (!isBrowser()) return '';
  return document.referrer || '';
}

/**
 * 获取用户代理信息
 *
 * @returns userAgent 字符串
 * @internal
 */
export function getUserAgent(): string {
  if (!isBrowser()) return '';
  return navigator.userAgent;
}

/**
 * 检查 URL 是否匹配忽略规则
 *
 * @param url - 要检查的 URL
 * @param patterns - 忽略规则列表
 * @returns 是否匹配
 * @internal
 */
export function shouldIgnoreUrl(url: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(url));
}

/**
 * 截断字符串
 *
 * @param str - 原字符串
 * @param maxLength - 最大长度
 * @returns 截断后的字符串
 * @internal
 */
export function truncate(str: string, maxLength: number): string {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}

/**
 * 节流函数
 *
 * @param fn - 要节流的函数
 * @param delay - 节流间隔（毫秒）
 * @returns 节流后的函数
 *
 * @internal
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;

  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn.apply(this, args);
    }
  };
}

/**
 * 防抖函数
 *
 * @param fn - 要防抖的函数
 * @param delay - 防抖间隔（毫秒）
 * @returns 防抖后的函数
 *
 * @internal
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };
}
```

**Step 2: Commit**

```bash
git add src/core/utils.ts
git commit -m "feat: 添加工具函数模块，包含安全执行和 localStorage 操作"
```

---

## Task 3: 创建 UserTracker 用户追踪模块

**Files:**
- Create: `src/core/UserTracker.ts`

**Step 1: 创建 UserTracker 文件**

```typescript
// src/core/UserTracker.ts

/**
 * 用户追踪模块
 *
 * 管理用户身份和属性，自动关联到所有上报事件。
 * 用户信息存储在 localStorage 中，支持跨页面持久化。
 *
 * @example
 * ```ts
 * const userTracker = new UserTracker();
 *
 * // 登录时设置用户
 * userTracker.setUser('user-123', {
 *   role: 'admin',
 *   plan: 'pro',
 *   company: 'acme'
 * });
 *
 * // 获取当前用户 ID
 * const userId = userTracker.getUserId(); // 'user-123'
 *
 * // 登出时清除
 * userTracker.clearUser();
 * ```
 */

import type { UserTraits } from '../types';
import { safeExecute, safeGetStorage, safeSetStorage, safeRemoveStorage, isLocalStorageAvailable } from './utils';

/** localStorage 存储键名 */
const STORAGE_KEY = '__tracker_user__';

/** 内存存储（localStorage 不可用时的降级方案） */
let memoryStore: { userId: string | null; traits: UserTraits; updatedAt: string | null } = {
  userId: null,
  traits: {},
  updatedAt: null
};

/**
 * 用户追踪器
 */
export class UserTracker {
  private userId: string | null = null;
  private traits: UserTraits = {};

  constructor() {
    this.restore();
  }

  /**
   * 设置用户信息
   *
   * @param userId - 用户唯一标识
   * @param traits - 用户属性（角色、计划等）
   */
  setUser(userId: string, traits?: UserTraits): void {
    safeExecute(() => {
      this.userId = userId;
      this.traits = traits || {};

      const data = {
        userId,
        traits: this.traits,
        updatedAt: new Date().toISOString()
      };

      if (isLocalStorageAvailable()) {
        safeSetStorage(STORAGE_KEY, JSON.stringify(data));
      } else {
        memoryStore = data;
      }
    }, undefined, 'UserTracker.setUser');
  }

  /**
   * 获取当前用户 ID
   *
   * @returns 用户 ID，未设置返回 null
   */
  getUserId(): string | null {
    return this.userId;
  }

  /**
   * 获取用户属性
   *
   * @returns 用户属性副本
   */
  getTraits(): UserTraits {
    return { ...this.traits };
  }

  /**
   * 清除用户信息
   *
   * 登出时调用，清除所有用户相关数据。
   */
  clearUser(): void {
    safeExecute(() => {
      this.userId = null;
      this.traits = {};

      if (isLocalStorageAvailable()) {
        safeRemoveStorage(STORAGE_KEY);
      } else {
        memoryStore = { userId: null, traits: {}, updatedAt: null };
      }
    }, undefined, 'UserTracker.clearUser');
  }

  /**
   * 恢复用户信息
   *
   * 从 localStorage 恢复之前保存的用户信息。
   * @internal
   */
  restore(): void {
    safeExecute(() => {
      let data: { userId: string | null; traits: UserTraits; updatedAt: string | null } | null = null;

      if (isLocalStorageAvailable()) {
        const stored = safeGetStorage(STORAGE_KEY);
        if (stored) {
          data = JSON.parse(stored);
        }
      } else {
        data = memoryStore;
      }

      if (data && data.userId) {
        this.userId = data.userId;
        this.traits = data.traits || {};
      }
    }, undefined, 'UserTracker.restore');
  }

  /**
   * 生成用户上下文数据
   *
   * 用于合并到事件参数中，自动添加用户信息。
   *
   * @returns 包含 user_id 和用户属性的上下文对象
   * @internal
   */
  getContext(): { user_id: string | null; [key: string]: any } {
    const context: { user_id: string | null; [key: string]: any } = {
      user_id: this.userId
    };

    // 添加用户属性，前缀为 user_
    if (this.traits) {
      Object.keys(this.traits).forEach(key => {
        const value = this.traits[key];
        if (value !== undefined) {
          context[`user_${key}`] = value;
        }
      });
    }

    return context;
  }
}
```

**Step 2: Commit**

```bash
git add src/core/UserTracker.ts
git commit -m "feat: 添加 UserTracker 用户追踪模块，支持 localStorage 持久化"
```

---

## Task 4: 创建 OfflineQueue 离线缓存模块

**Files:**
- Create: `src/core/OfflineQueue.ts`

**Step 1: 创建 OfflineQueue 文件**

```typescript
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
 *   reportFn: (event) => sendToGtag(event.name, event.params)
 * });
 *
 * // 网络断开时入队
 * if (!navigator.onLine) {
 *   queue.enqueue(event);
 * }
 *
 * // 网络恢复时自动处理
 * window.addEventListener('online', () => queue.flush());
 * ```
 */

import type { OfflineQueueConfig, QueuedEvent, EventParams } from '../types';
import { safeExecute, safeGetStorage, safeSetStorage, isLocalStorageAvailable, generateId } from './utils';

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
    }, false, 'OfflineQueue.enqueue');
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

    return safeExecute(async () => {
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

      this.isFlushing = false;

      return successCount;
    }, 0, 'OfflineQueue.flush') as Promise<number>;
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
      window.addEventListener('online', () => {
        this.flush();
      });
    }, undefined, 'OfflineQueue.bindNetworkEvents');
  }
}
```

**Step 2: Commit**

```bash
git add src/core/OfflineQueue.ts
git commit -m "feat: 添加 OfflineQueue 离线缓存模块，支持指数退避重试"
```

---

## Task 5: 重构 Reporter 模块

**Files:**
- Create: `src/reporter/gtag.ts`
- Modify: `src/reporter.ts` → 删除

**Step 1: 创建新的 reporter 文件**

```typescript
// src/reporter/gtag.ts

/**
 * @packageDocumentation
 * Google Analytics 4 注入和上报模块
 */

import type { TrackerConfig, EventParams } from '../types';
import { safeExecute, isBrowser } from '../core/utils';

/** GA4 脚本 URL 前缀 */
const GTAG_SCRIPT_URL = 'https://www.googletagmanager.com/gtag/js';

/** 脚本元素 ID */
const SCRIPT_ID = 'smart-tracker-gtag';

/**
 * 注入 GA4 脚本
 *
 * 动态创建 script 标签加载 gtag.js，并初始化 dataLayer。
 * 支持重复调用，已注入时会跳过。
 *
 * @param measurementId - GA4 Measurement ID
 * @param config - 追踪器配置
 *
 * @example
 * ```ts
 * injectGtagScript('G-XXXXXXXXXX', { debug: true });
 * ```
 */
export function injectGtagScript(
  measurementId: string,
  config?: TrackerConfig
): void {
  if (!isBrowser()) return;

  safeExecute(() => {
    // 已注入则跳过
    if (document.getElementById(SCRIPT_ID)) {
      if (config?.debug) {
        console.log('[Tracker] gtag.js already injected');
      }
      return;
    }

    // 创建 script 标签加载 gtag.js
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `${GTAG_SCRIPT_URL}?id=${measurementId}`;

    // 加载错误处理
    script.onerror = () => {
      if (config?.debug) {
        console.warn('[Tracker] Failed to load gtag.js');
      }
    };

    // 插入到 head
    const firstScript = document.head.getElementsByTagName('script')[0];
    if (firstScript) {
      firstScript.parentNode?.insertBefore(script, firstScript);
    } else {
      document.head.appendChild(script);
    }

    // 初始化 dataLayer 和 gtag 函数
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag(...args: any[]) {
      window.dataLayer.push(args);
    };

    // 设置时间戳
    window.gtag('js', new Date());

    // 配置 Measurement ID
    window.gtag('config', measurementId, {
      send_page_view: true,
      debug_mode: config?.debug || false
    });

    if (config?.debug) {
      console.log('[Tracker] gtag.js injected successfully');
    }
  }, undefined, 'injectGtagScript');
}

/**
 * 移除 GA4 脚本
 *
 * 从页面移除 gtag.js script 标签。
 * 用于 SDK 销毁时调用。
 *
 * @param measurementId - GA4 Measurement ID
 */
export function removeGtagScript(measurementId: string): void {
  if (!isBrowser()) return;

  safeExecute(() => {
    // 移除 script 标签
    const script = document.getElementById(SCRIPT_ID);
    if (script) {
      script.remove();
    }

    // 清理 gtag 配置
    if (window.gtag) {
      window.gtag('config', measurementId, { send_page_view: false });
    }
  }, undefined, 'removeGtagScript');
}

/**
 * 发送事件到 GA4
 *
 * 将事件数据通过 gtag 发送到 Google Analytics。
 * 所有参数会自动转换为 GA4 要求的格式。
 *
 * @param eventName - 事件名称
 * @param params - 事件参数
 * @param config - 追踪器配置
 *
 * @example
 * ```ts
 * sendToGtag('button_click', {
 *   category: 'ui',
 *   label: 'submit',
 *   value: 1
 * }, { debug: true });
 * ```
 */
export function sendToGtag(
  eventName: string,
  params: EventParams,
  config?: TrackerConfig
): void {
  if (!isBrowser()) return;

  safeExecute(() => {
    // 检查 gtag 是否可用
    if (typeof window.gtag !== 'function') {
      if (config?.debug) {
        console.warn('[Tracker] gtag is not available');
      }
      return;
    }

    // 转换参数格式
    const {
      category,
      label,
      value,
      non_interaction = true,
      ...rest
    } = params;

    const payload: Record<string, any> = {
      event_category: category,
      event_label: label,
      value: value,
      non_interaction: non_interaction,
      ...rest
    };

    // 移除 undefined 值
    Object.keys(payload).forEach(key => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });

    // 发送事件
    window.gtag('event', eventName, payload);

    // 调试日志
    if (config?.debug) {
      console.log(
        `%c[Tracker] Event: ${eventName}`,
        'color: #2E7D32; font-weight: bold',
        payload
      );
    }
  }, undefined, 'sendToGtag');
}

/**
 * 发送页面浏览事件
 *
 * 手动上报页面访问，用于 SPA 路由切换场景。
 *
 * @param path - 页面路径
 * @param title - 页面标题
 * @param config - 追踪器配置
 */
export function sendPageView(
  path: string,
  title?: string,
  config?: TrackerConfig
): void {
  if (!isBrowser()) return;

  safeExecute(() => {
    if (typeof window.gtag !== 'function') {
      if (config?.debug) {
        console.warn('[Tracker] gtag is not available');
      }
      return;
    }

    window.gtag('event', 'page_view', {
      page_path: path,
      page_title: title || document.title,
      page_location: window.location.origin + path
    });

    if (config?.debug) {
      console.log(
        `%c[Tracker] PageView: ${path}`,
        'color: #1565C0; font-weight: bold'
      );
    }
  }, undefined, 'sendPageView');
}

/**
 * 设置用户属性
 *
 * 将用户信息发送到 GA4，用于关联用户行为。
 *
 * @param userId - 用户 ID
 * @param traits - 用户属性
 * @param config - 追踪器配置
 */
export function setUserProperties(
  userId: string,
  traits?: Record<string, any>,
  config?: TrackerConfig
): void {
  if (!isBrowser()) return;

  safeExecute(() => {
    if (typeof window.gtag !== 'function') {
      if (config?.debug) {
        console.warn('[Tracker] gtag is not available');
      }
      return;
    }

    // 设置用户 ID
    if (config?.measurementId) {
      window.gtag('config', config.measurementId, {
        user_id: userId
      });
    }

    // 设置用户属性
    if (traits && Object.keys(traits).length > 0) {
      window.gtag('set', 'user_properties', traits);
    }

    if (config?.debug) {
      console.log(
        `%c[Tracker] User: ${userId}`,
        'color: #7B1FA2; font-weight: bold',
        traits
      );
    }
  }, undefined, 'setUserProperties');
}

/**
 * 清除用户属性
 *
 * @param config - 追踪器配置
 */
export function clearUserProperties(config?: TrackerConfig): void {
  if (!isBrowser()) return;

  safeExecute(() => {
    if (typeof window.gtag !== 'function') return;

    if (config?.measurementId) {
      window.gtag('config', config.measurementId, {
        user_id: undefined
      });
    }

    window.gtag('set', 'user_properties', {});

    if (config?.debug) {
      console.log('%c[Tracker] User cleared', 'color: #7B1FA2; font-weight: bold');
    }
  }, undefined, 'clearUserProperties');
}
```

**Step 2: 删除旧的 reporter.ts**

```bash
rm src/reporter.ts
```

**Step 3: Commit**

```bash
git add src/reporter/gtag.ts
git commit -m "refactor: 重构 Reporter 模块，添加完整注释和错误隔离"
```

---

## Task 6: 重构 SmartTracker 主类

**Files:**
- Create: `src/core/SmartTracker.ts`
- Modify: `src/core.ts` → 删除

**Step 1: 创建新的 SmartTracker 文件**

```typescript
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
import { injectGtagScript, removeGtagScript, sendToGtag, sendPageView, setUserProperties, clearUserProperties } from '../reporter/gtag';
import { ErrorCollector } from '../collectors/ErrorCollector';
import { PerformanceCollector } from '../collectors/PerformanceCollector';
import { NetworkCollector } from '../collectors/NetworkCollector';
import { InteractionCollector } from '../collectors/InteractionCollector';

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
    error?: ErrorCollector;
    performance?: PerformanceCollector;
    network?: NetworkCollector;
    interaction?: InteractionCollector;
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
      const pagePath = path || window.location.pathname + window.location.search;
      sendPageView(pagePath, title, this.config);
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
   * SmartTracker.instance = null;
   * ```
   */
  destroy(): void {
    if (this.isDestroyed) return;

    safeExecute(() => {
      // 停止所有采集器
      if (this.collectors.error) {
        this.collectors.error.stop();
      }
      if (this.collectors.performance) {
        this.collectors.performance.stop();
      }
      if (this.collectors.network) {
        this.collectors.network.stop();
      }
      if (this.collectors.interaction) {
        this.collectors.interaction.stop();
      }

      // 停止离线队列定时器
      if (this.offlineQueue) {
        this.offlineQueue.stopRetryTimer();
      }

      // 移除 GA 脚本（可选）
      // removeGtagScript(this.config.measurementId);

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
    if (!navigator.onLine && this.offlineQueue) {
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

      // 初始化采集器
      if (this.config.enableError) {
        this.collectors.error = new ErrorCollector(this.report, { debug: this.config.debug });
        this.collectors.error.start();
      }

      if (this.config.enablePerformance) {
        this.collectors.performance = new PerformanceCollector(this.report, { debug: this.config.debug });
        this.collectors.performance.start();
      }

      if (this.config.enableNetwork) {
        this.collectors.network = new NetworkCollector(this.report, { debug: this.config.debug });
        this.collectors.network.start();
      }

      if (this.config.enableInteraction) {
        this.collectors.interaction = new InteractionCollector(this.report, { debug: this.config.debug });
        this.collectors.interaction.start();
      }

      this.isInitialized = true;

      if (this.config.debug) {
        console.log('[Tracker] Initialized successfully');
      }
    }, undefined, 'SmartTracker.init');
  }
}
```

**Step 2: 删除旧的 core.ts**

```bash
rm src/core.ts
```

**Step 3: Commit**

```bash
git add src/core/SmartTracker.ts
git commit -m "refactor: 重构 SmartTracker 主类，添加用户追踪和离线缓存支持"
```

---

## Task 7: 完善 ErrorCollector 错误采集器

**Files:**
- Modify: `src/collectors/error.ts` → 重命名为 `src/collectors/ErrorCollector.ts`

**Step 1: 重写错误采集器**

完整实现请参考设计文档中的 ErrorCollector 设计。

**Step 2: Commit**

```bash
git add src/collectors/ErrorCollector.ts
git commit -m "refactor: 完善 ErrorCollector，支持资源错误和 Promise 错误"
```

---

## Task 8: 完善 PerformanceCollector 性能采集器

**Files:**
- Modify: `src/collectors/performance.ts` → 重命名为 `src/collectors/PerformanceCollector.ts`

**Step 1: 重写性能采集器**

完整实现请参考设计文档中的 PerformanceCollector 设计。

**Step 2: Commit**

```bash
git add src/collectors/PerformanceCollector.ts
git commit -m "refactor: 完善 PerformanceCollector，添加 Web Vitals 支持"
```

---

## Task 9: 完善 NetworkCollector 网络采集器

**Files:**
- Modify: `src/collectors/network.ts` → 重命名为 `src/collectors/NetworkCollector.ts`

**Step 1: 重写网络采集器**

完整实现请参考设计文档中的 NetworkCollector 设计，添加 XHR 支持。

**Step 2: Commit**

```bash
git add src/collectors/NetworkCollector.ts
git commit -m "refactor: 完善 NetworkCollector，添加 XHR 拦截和慢请求检测"
```

---

## Task 10: 完善 InteractionCollector 交互采集器

**Files:**
- Modify: `src/collectors/interactions.ts` → 重命名为 `src/collectors/InteractionCollector.ts`

**Step 1: 重写交互采集器**

完整实现请参考设计文档中的 InteractionCollector 设计。

**Step 2: Commit**

```bash
git add src/collectors/InteractionCollector.ts
git commit -m "refactor: 完善 InteractionCollector，添加滚动深度和曝光追踪"
```

---

## Task 11: 添加构建配置

**Files:**
- Modify: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.build.json`
- Create: `tsup.config.ts`

**Step 1: 更新 package.json**

```json
{
  "name": "@my-org/tracker",
  "version": "1.0.1",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/types/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/types/index.d.ts"
    },
    "./src": "./src/index.ts"
  },
  "files": [
    "dist",
    "src"
  ],
  "scripts": {
    "dev": "tsup --watch",
    "build": "tsup && tsc -p tsconfig.build.json",
    "build:cdn": "tsup --config tsup.cdn.config.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "web-vitals": "^3.5.0"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.3.0"
  }
}
```

**Step 2: 创建 tsconfig.json**

**Step 3: 创建 tsup.config.ts**

**Step 4: Commit**

```bash
git add package.json tsconfig.json tsup.config.ts
git commit -m "feat: 添加构建配置，支持 ESM/CJS/UMD 输出"
```

---

## Task 12: 编写文档

**Files:**
- Create: `docs/README.md`
- Create: `docs/api.md`

**Step 1: 创建快速开始文档**

**Step 2: 创建 API 文档**

**Step 3: Commit**

```bash
git add docs/
git commit -m "docs: 添加快速开始和 API 文档"
```

---

## 执行顺序总结

| Task | 说明 | 依赖 |
|------|------|------|
| 1 | 类型定义和目录结构 | 无 |
| 2 | 工具函数模块 | Task 1 |
| 3 | UserTracker | Task 1, 2 |
| 4 | OfflineQueue | Task 1, 2 |
| 5 | Reporter 模块 | Task 1, 2 |
| 6 | SmartTracker 主类 | Task 2-5 |
| 7-10 | 四个采集器 | Task 1, 2, 6 |
| 11 | 构建配置 | Task 1-10 |
| 12 | 文档 | Task 11 |