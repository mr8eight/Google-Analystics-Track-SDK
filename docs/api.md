# API 文档

## SmartTracker

主类，单例模式实现。

### 静态方法

#### `SmartTracker.init(config: TrackerConfig): SmartTracker`

初始化追踪器并按配置自动启动采集器。

```ts
SmartTracker.init({
  measurementId: 'G-XXXXXXXXXX',
  enablePerformance: true,
  enableError: true,
  enableNetwork: true,
  enableInteraction: false,
  enableOffline: false,
  debug: false
});
```

#### `SmartTracker.getInstance(): SmartTracker | null`

获取追踪器实例。

### 实例方法

#### `setUser(userId: string, traits?: UserTraits): void`

设置用户信息并同步到 GA4。

#### `clearUser(): void`

清除用户信息。

#### `trackEvent(name: string, params?: EventParams): void`

发送自定义事件。

#### `trackPageView(path?: string, title?: string): void`

手动发送页面浏览事件，适用于 SPA 路由切换。

#### `destroy(): void`

销毁实例，停止采集器、移除监听器并清理脚本引用。

## TrackerConfig

```ts
interface TrackerConfig {
  measurementId: string;
  enablePerformance?: boolean;
  enableError?: boolean;
  enableNetwork?: boolean;
  enableInteraction?: boolean;
  enableOffline?: boolean;
  debug?: boolean;
}
```

## 自动采集事件

| 事件名 | 说明 |
|--------|------|
| `error` | JS、Promise、资源加载错误 |
| `performance_page_load` | 页面加载性能 |
| `performance_web_vital` | Web Vitals 指标 |
| `performance_resource` | 资源加载性能 |
| `network_error` | 网络请求失败 |
| `network_slow` | 慢请求 |
| `network_request` | 成功请求上报启用时的网络请求 |
| `interaction_click` | 点击事件 |
| `interaction_scroll` | 滚动深度 |
| `interaction_exposure` | 元素曝光 |
