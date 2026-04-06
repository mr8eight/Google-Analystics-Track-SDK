# Smart Tracker SDK

一个轻量且完整的 Google Analytics 4 埋点 SDK。

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

## 用户追踪

```ts
SmartTracker.getInstance()?.setUser('user-123', {
  role: 'admin',
  plan: 'pro'
});

SmartTracker.getInstance()?.clearUser();
```

## 手动埋点

```ts
SmartTracker.getInstance()?.trackEvent('button_click', {
  category: 'ui',
  label: 'submit_order',
  value: 1
});

SmartTracker.getInstance()?.trackPageView('/products/123', '产品详情');
```

## 自动交互追踪

```html
<button data-track-name="submit_order">提交订单</button>
<div data-track-exposure data-track-name="promo_banner">促销横幅</div>
<button data-track-ignore>忽略追踪</button>
```

当 `enableInteraction` 开启后，SDK 会自动采集点击、滚动深度和曝光事件。
