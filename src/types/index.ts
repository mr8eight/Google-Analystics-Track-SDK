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