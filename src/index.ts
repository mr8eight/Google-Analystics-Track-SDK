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