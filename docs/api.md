# API 文档

## SmartTracker

主类，单例模式实现。

### 静态方法

#### `SmartTracker.init(config: TrackerConfig): SmartTracker`

初始化追踪器。

```typescript
SmartTracker.init({
  measurementId: 'G-XXXXXXXXXX',
  enablePerformance: true,
  enableError: true,
  enableOffline: false,
  debug: false
});
```

#### `SmartTracker.getInstance(): SmartTracker | null`

获取追踪器实例。

```typescript
const tracker = SmartTracker.getInstance();
```

### 实例方法

#### `setUser(userId: string, traits?: UserTraits): void`

设置用户信息。

```typescript
tracker?.setUser('user-123', {
  role: 'admin',
  plan: 'pro',
  company: 'acme'
});
```

#### `clearUser(): void`

清除用户信息。

#### `trackEvent(name: string, params?: EventParams): void`

上报自定义事件。

```typescript
tracker?.trackEvent('purchase', {
  category: 'ecommerce',
  label: 'premium_plan',
  value: 99
});
```

#### `trackPageView(path?: string, title?: string): void`

上报页面浏览。

```typescript
// 手动指定路径
tracker?.trackPageView('/products/123', '产品详情');

// 使用当前路径
tracker?.trackPageView();
```

#### `destroy(): void`

销毁追踪器实例。

## 类型定义

### TrackerConfig

```typescript
interface TrackerConfig {
  measurementId: string;       // 必填
  enablePerformance?: boolean; // 默认 true
  enableError?: boolean;       // 默认 true
  enableNetwork?: boolean;     // 默认 true
  enableInteraction?: boolean; // 默认 false
  enableOffline?: boolean;     // 默认 false
  debug?: boolean;             // 默认 false
}
```

### UserTraits

```typescript
interface UserTraits {
  role?: string;
  plan?: string;
  company?: string;
  [key: string]: string | number | boolean | undefined;
}
```

### EventParams

```typescript
interface EventParams {
  category?: string;
  label?: string;
  value?: number;
  non_interaction?: boolean;
  [key: string]: any;
}
```

## 采集器

### ErrorCollector

自动采集：
- JS 运行时错误
- Promise 未捕获异常
- 资源加载错误

```typescript
const collector = new ErrorCollector(reportFn, {
  debug: true,
  captureResourceError: true,
  capturePromiseError: true,
  ignoreErrors: [/ResizeObserver loop/]
});
collector.start();
```

### PerformanceCollector

自动采集：
- 页面加载性能
- Web Vitals (LCP, FID, CLS)
- 资源加载性能

```typescript
const collector = new PerformanceCollector(reportFn, {
  debug: true,
  collectResourceTiming: true,
  resourceSampleRate: 0.1
});
collector.start();
```

### NetworkCollector

自动采集：
- Fetch 请求
- XMLHttpRequest

```typescript
const collector = new NetworkCollector(reportFn, {
  debug: true,
  slowThreshold: 3000,
  ignoreUrls: [/\/api\/health/]
});
collector.start();
```

### InteractionCollector

自动采集：
- 点击事件
- 滚动深度
- 元素曝光

```typescript
const collector = new InteractionCollector(reportFn, {
  debug: true,
  trackClicks: true,
  trackScrollDepth: true,
  trackExposure: false
});
collector.start();
```

## 上报事件列表

| 事件名 | 类别 | 触发时机 |
|--------|------|----------|
| `error` | error | 发生错误时 |
| `performance_page_load` | performance | 页面加载完成 |
| `performance_web_vital` | performance | Web Vital 指标采集 |
| `performance_resource` | performance | 资源加载 |
| `network_error` | network | 网络请求失败 |
| `network_slow` | network | 慢请求 |
| `interaction_click` | interaction | 用户点击 |
| `interaction_scroll` | interaction | 滚动深度阈值 |
| `interaction_exposure` | interaction | 元素曝光 |