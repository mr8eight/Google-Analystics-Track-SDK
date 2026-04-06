---
name: tracker-sdk-guide
description: Guide for using the Google Analytics 4 tracking SDK (@my-org/tracker). Use when integrating analytics/tracking in React/SPA projects, setting up user tracking, performance monitoring, error collection, or when user mentions "埋点", "analytics", "tracking", "GA4", "gtag", or this SDK package.
---

# Tracker SDK 使用指南

Google Analytics 4 (GA4) 埋点 SDK，用于 React/SPA 项目的事件追踪、性能监控和错误采集。

## 快速开始

### 1. 初始化（入口文件）

在项目入口文件 (`src/main.tsx` 或 `src/App.tsx`) 初始化 SDK：

```typescript
import { SmartTracker } from '@my-org/tracker';

// 初始化 - 只需执行一次
SmartTracker.init({
  measurementId: 'G-XXXXXXXXXX',  // 必填：GA4 Measurement ID
  enablePerformance: true,        // 自动采集 Web Vitals
  enableError: true,              // 自动采集错误
  enableNetwork: true,            // 自动监控网络请求
  enableOffline: true,            // 离线缓存（断网时缓存事件）
  debug: process.env.NODE_ENV === 'development'
});
```

### 2. 用户追踪（登录后）

```typescript
// 登录成功后设置用户
SmartTracker.getInstance()?.setUser('user-123', {
  role: 'admin',
  plan: 'pro',
  company: 'MyCompany'
});

// 登出时清除
SmartTracker.getInstance()?.clearUser();
```

### 3. 常用埋点方式

```typescript
const tracker = SmartTracker.getInstance();

// 点击事件
tracker?.trackEvent('button_click', {
  category: 'Navigation',
  label: 'submit_order',
  button_text: '提交订单'
});

// 业务事件
tracker?.trackEvent('login_success', {
  category: 'UserAccount',
  method: 'wechat'
});

// SPA 页面切换（路由钩子）
tracker?.trackPageView('/products/123', '产品详情');
```

## React 组件示例

```tsx
import { SmartTracker } from '@my-org/tracker';

function CheckoutButton({ orderId, price }) {
  const handleClick = () => {
    // 埋点上报
    SmartTracker.getInstance()?.trackEvent('checkout_submit', {
      category: 'ECommerce',
      label: `order_${orderId}`,
      value: price,
      currency: 'CNY'
    });

    // 业务逻辑...
  };

  return <button onClick={handleClick}>提交订单</button>;
}
```

## 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `measurementId` | string | - | GA4 ID，必填 |
| `enablePerformance` | boolean | true | Web Vitals 采集 |
| `enableError` | boolean | true | 错误监控 |
| `enableNetwork` | boolean | true | 网络请求监控 |
| `enableInteraction` | boolean | false | 交互追踪（滚动、曝光） |
| `enableOffline` | boolean | false | 离线缓存 |
| `debug` | boolean | false | 控制台日志 |

## 自动采集数据

SDK 初始化后自动采集以下数据：

### 性能指标 (Web Vitals)
- `LCP` - 最大内容绘制
- `FCP` - 首次内容绘制
- `CLS` - 累积布局偏移
- `INP` - 下次交互延迟

### 错误类型
- `exception` - JS 运行时错误
- `resource_error` - 资源加载失败 (404)
- `api_error` - 接口异常

## GA4 事件参数规范

所有事件参数直接透传给 gtag.js，遵循 GA4 标准：

```typescript
// 正确：直接使用 GA4 参数名
tracker?.trackEvent('purchase', {
  transaction_id: 'T12345',
  value: 99.00,
  currency: 'CNY',
  items: [{ item_id: 'SKU_123', item_name: 'Product' }]
});

// 不要使用 UA 旧参数名
// ❌ event_category, event_label (已废弃)
```

## 注意事项

1. **SSR 兼容**: SDK 内部有 `window` 检测，可在 Next.js 中安全使用
2. **错误隔离**: SDK 错误不会影响业务代码
3. **自定义维度**: 自定义参数需在 GA 后台注册为 Custom Definitions
4. **用户隐私**: 不要上传 PII 敏感信息（手机号、邮箱等）

## 参考文档

详细 GA4 配置指南见：`ga_4_gtagjs_complete_configuration_guide_cn_2026.md`

API 类型定义见：`src/types/index.ts`