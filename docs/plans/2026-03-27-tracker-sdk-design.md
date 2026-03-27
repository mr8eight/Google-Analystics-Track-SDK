# Smart Tracker SDK 设计文档

> 创建日期: 2026-03-27

## 概述

Google Analytics 4 埋点 SDK，支持自动性能采集、完整错误监控、网络请求监控、用户交互追踪、用户身份追踪和离线缓存。

## 设计目标

- **单一项目使用**：源码直接作为 monorepo 子项目导入
- **CDN 支持**：提供 UMD 格式用于 CDN 引入
- **完全隔离**：SDK 出错不影响业务代码
- **完整注释**：所有模块都有详细 JSDoc 注释
- **TypeScript 原生**：完整的类型定义

---

## 目录结构

```
smart-tracker-sdk/
├── src/
│   ├── index.ts                    # 入口导出
│   ├── core/
│   │   ├── SmartTracker.ts         # 主类
│   │   ├── UserTracker.ts          # 用户追踪
│   │   ├── OfflineQueue.ts         # 离线缓存
│   │   └── utils.ts                # 工具函数
│   ├── reporter/
│   │   ├── gtag.ts                 # GA 注入和上报
│   │   └── types.ts                # 上报类型
│   ├── collectors/
│   │   ├── Collector.ts            # 采集器接口
│   │   ├── ErrorCollector.ts       # 错误采集
│   │   ├── PerformanceCollector.ts # 性能采集
│   │   ├── NetworkCollector.ts     # 网络采集
│   │   └── InteractionCollector.ts # 交互采集
│   └── types/
│       └── index.ts                # 全局类型
├── dist/
│   ├── index.js                    # ESM 格式
│   ├── index.cjs                   # CJS 格式
│   ├── tracker.min.js              # CDN 精简版（UMD）
│   └── types/                      # 类型声明
├── docs/
│   ├── README.md                   # 快速开始
│   ├── api.md                      # API 文档
│   ├── integration/
│   │   ├── cdn.md                  # CDN 集成
│   │   └── monorepo.md             # Monorepo 集成
│   └── examples/
│       ├── basic-usage.md
│       ├── user-tracking.md
│       └── error-handling.md
├── package.json
├── tsconfig.json
├── tsconfig.build.json
└── build.config.ts
```

---

## 核心模块设计

### 1. SmartTracker 主类

单例模式实现，提供统一的事件采集和上报能力。

```typescript
class SmartTracker {
  private static instance: SmartTracker | null = null;

  // 生命周期
  static init(config: TrackerConfig): SmartTracker;
  static getInstance(): SmartTracker | null;
  destroy(): void;

  // 用户追踪
  setUser(userId: string, traits?: UserTraits): void;
  clearUser(): void;

  // 手动埋点
  trackEvent(name: string, params?: EventParams): void;
  trackPageView(path?: string): void;
}
```

### 2. UserTracker 用户追踪

管理用户身份和属性，自动关联到所有上报事件。

```typescript
class UserTracker {
  setUser(userId: string, traits?: UserTraits): void;
  getUserId(): string | null;
  getTraits(): UserTraits;
  clearUser(): void;
  getContext(): { user_id: string | null; [key: string]: any };
}
```

### 3. OfflineQueue 离线缓存

网络断开时缓存事件，恢复后自动重试上报。

```typescript
class OfflineQueue {
  constructor(config: OfflineQueueConfig);
  enqueue(event: QueuedEvent): boolean;
  size(): number;
  clear(): void;
  flush(): Promise<number>;
  startRetryTimer(): void;
  stopRetryTimer(): void;
}
```

### 4. ErrorCollector 错误采集

采集类型：
- JS 运行时错误 (`window.onerror`)
- Promise 未捕获异常 (`unhandledrejection`)
- 资源加载错误 (script, link, img, audio, video)

```typescript
class ErrorCollector implements Collector {
  constructor(reportFn: ReportFunction, config?: ErrorCollectorConfig);
  start(): void;
  stop(): void;
  captureError(error: Error, context?: ErrorContext): void;
}
```

### 5. PerformanceCollector 性能采集

采集指标：
- 页面加载性能 (DNS, TCP, SSL, TTFB, DOM, Load)
- Web Vitals (LCP, FID, CLS)
- 资源加载性能

```typescript
class PerformanceCollector implements Collector {
  constructor(reportFn: ReportFunction, config?: PerformanceCollectorConfig);
  start(): void;
  stop(): void;
  getMetrics(): PerformanceMetrics;
}
```

### 6. NetworkCollector 网络采集

拦截并监控：
- fetch API
- XMLHttpRequest

```typescript
class NetworkCollector implements Collector {
  constructor(reportFn: ReportFunction, config?: NetworkCollectorConfig);
  start(): void;
  stop(): void;
}
```

### 7. InteractionCollector 交互采集

追踪用户交互：
- 点击事件
- 表单提交
- 页面滚动深度
- 元素曝光

```typescript
class InteractionCollector implements Collector {
  constructor(reportFn: ReportFunction, config?: InteractionCollectorConfig);
  start(): void;
  stop(): void;
}
```

---

## 错误隔离机制

所有 SDK 内部逻辑都通过 `safeExecute` 执行，确保不会抛出异常到外部。

```typescript
function safeExecute<T>(fn: () => T, fallback?: T, context?: string): T | undefined {
  try {
    return fn();
  } catch (error) {
    if (config.debug) {
      console.warn('[Tracker] Internal error:', context, error);
    }
    return fallback;
  }
}
```

隔离保障：

| 场景 | 隔离措施 |
|------|----------|
| 脚本加载失败 | 不阻塞页面，静默失败 |
| gtag 未定义 | 上报前检查，跳过 |
| localStorage 不可用 | 降级为内存存储 |
| 网络拦截出错 | 立即恢复原始方法 |
| 用户代码调用出错 | 返回 undefined 或默认值 |

---

## 配置类型

```typescript
interface TrackerConfig {
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

  /** 调试模式，默认 false */
  debug?: boolean;
}

interface UserTraits {
  role?: string;
  plan?: string;
  company?: string;
  [key: string]: string | number | boolean | undefined;
}

interface EventParams {
  category?: string;
  label?: string;
  value?: number;
  non_interaction?: boolean;
  [key: string]: any;
}
```

---

## 构建输出

```
dist/
├── index.js          # ESM 格式（monorepo 内部引用）
├── index.cjs         # CJS 格式
├── tracker.min.js    # CDN 精简版（UMD）
└── types/            # 类型声明
```

---

## 使用方式

### Monorepo 内部引用

```typescript
// 直接引用源码
import { SmartTracker } from '@your-org/tracker/src';

SmartTracker.init({
  measurementId: 'G-XXXXXXXXXX',
  enablePerformance: true,
  enableError: true,
  enableOffline: true
});

// 用户追踪
SmartTracker.getInstance()?.setUser('user-123', { role: 'admin' });

// 手动埋点
SmartTracker.getInstance()?.trackEvent('button_click', { category: 'ui' });
```

### CDN 引入

```html
<script src="/assets/tracker.min.js"></script>
<script>
  SmartTracker.SmartTracker.init({
    measurementId: 'G-XXXXXXXXXX'
  });
</script>
```

---

## 事件上报示例

```typescript
// 页面加载性能
{
  event_name: 'performance_page_load',
  event_category: 'performance',
  dns: 12,
  tcp: 45,
  ttfb: 156,
  load: 892,
  lcp: 678,
  fid: 12,
  cls: 0.05
}

// 错误事件
{
  event_name: 'error_js',
  event_category: 'error',
  error_type: 'js_error',
  message: 'Uncaught TypeError: ...',
  filename: 'https://example.com/main.js',
  lineno: 123,
  colno: 45
}

// 网络请求
{
  event_name: 'network_error',
  event_category: 'network',
  url: '/api/users',
  method: 'GET',
  status: 500,
  duration: 234
}

// 用户交互
{
  event_name: 'interaction_click',
  event_category: 'interaction',
  track_name: 'submit_order',
  element_text: '提交订单'
}
```

---

## 实施计划

1. **基础搭建** - 目录结构、类型定义、工具函数
2. **核心模块** - SmartTracker、UserTracker、OfflineQueue
3. **Reporter 模块** - GA4 注入和上报
4. **采集器模块** - Error、Performance、Network、Interaction
5. **构建配置** - tsup 配置、CDN 构建
6. **文档编写** - API 文档、集成指南、示例代码