# @mr8eight/ga-tracker

企业级前端埋点监控 SDK。基于 Google Analytics 4 (`gtag.js`) 封装，提供事件上报、性能监控、错误捕获、网络监控、交互追踪、用户身份关联和离线缓存能力。

## 特性

- 自动采集页面性能与 Web Vitals
- 自动捕获 JS 错误、Promise 异常和资源加载错误
- 自动监控 `fetch` / `XMLHttpRequest`
- 支持点击、滚动深度、元素曝光追踪
- 支持用户 ID 与用户属性绑定
- 支持断网缓存与恢复后重试
- 兼容 SSR，SDK 内部异常不会影响业务代码

## 安装

```bash
pnpm add @mr8eight/ga-tracker
```

在 monorepo 中也可以直接依赖工作区包：

```json
{
  "dependencies": {
    "@mr8eight/ga-tracker": "workspace:*"
  }
}
```

## 快速开始

```ts
import { SmartTracker } from '@mr8eight/ga-tracker';

SmartTracker.init({
  measurementId: 'G-XXXXXXXXXX',
  enablePerformance: true,
  enableError: true,
  enableNetwork: true,
  enableInteraction: true,
  enableOffline: true,
  debug: process.env.NODE_ENV === 'development'
});
```

初始化后会按开关自动启动对应采集器。

## 常见用法

```ts
const tracker = SmartTracker.getInstance();

tracker?.setUser('user-123', {
  role: 'admin',
  plan: 'pro'
});

tracker?.trackEvent('purchase', {
  category: 'ecommerce',
  transaction_id: 'T-1001',
  value: 99,
  currency: 'CNY'
});

tracker?.trackPageView('/products/123', '产品详情');

tracker?.clearUser();
```

## HTML 自动追踪

```html
<button data-track-name="submit_order">提交订单</button>
<div data-track-exposure data-track-name="promo_banner">促销横幅</div>
<button data-track-ignore>不需要追踪</button>
```

启用 `enableInteraction: true` 后，SDK 会自动采集：

- 带 `data-track-name` 的元素点击
- 常见可交互元素的点击
- 页面滚动深度
- 带 `data-track-exposure` 的元素曝光

## 配置项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `measurementId` | `string` | 必填 | GA4 Measurement ID |
| `enablePerformance` | `boolean` | `true` | 启用性能采集 |
| `enableError` | `boolean` | `true` | 启用错误采集 |
| `enableNetwork` | `boolean` | `true` | 启用网络采集 |
| `enableInteraction` | `boolean` | `false` | 启用交互采集 |
| `enableOffline` | `boolean` | `false` | 启用离线缓存 |
| `debug` | `boolean` | `false` | 输出调试日志 |

## 构建输出

```text
dist/
  index.js      CommonJS
  index.mjs     ESM
  index.d.ts    类型声明
```

## 注意事项

- 自定义事件参数会直接透传给 GA4，推荐使用 GA4 规范字段名
- 自定义维度需要在 GA 后台注册后才能在报表中查看
- 不要上报手机号、邮箱等 PII 敏感信息
