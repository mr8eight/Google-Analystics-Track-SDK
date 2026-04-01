# Smart Tracker SDK

一个轻量级、功能完整的 Google Analytics 4 埋点 SDK。

## 特性

- ✅ **自动性能采集** - 页面加载性能、Web Vitals (LCP/FID/CLS)
- ✅ **完整错误监控** - JS 错误、Promise 异常、资源加载错误
- ✅ **网络请求监控** - Fetch/XHR 拦截、慢请求检测
- ✅ **用户交互追踪** - 点击、滚动深度、元素曝光
- ✅ **用户身份追踪** - 支持用户 ID 和属性追踪
- ✅ **离线缓存** - 网络断开时缓存事件，恢复后自动上报
- ✅ **完全隔离** - SDK 出错不影响业务代码
- ✅ **TypeScript 原生** - 完整的类型定义

## 安装

```bash
# 直接引用源码（monorepo）
import { SmartTracker } from '@your-org/tracker/src';
```

## 快速开始

### 1. 初始化

```typescript
import { SmartTracker } from '@your-org/tracker/src';

// 在应用入口初始化
SmartTracker.init({
  measurementId: 'G-XXXXXXXXXX',  // 你的 GA4 Measurement ID
  enablePerformance: true,        // 启用性能监控
  enableError: true,              // 启用错误监控
  enableNetwork: true,            // 启用网络监控
  enableOffline: true,            // 启用离线缓存
  debug: process.env.NODE_ENV === 'development'
});
```

### 2. 用户追踪

```typescript
// 登录成功后设置用户信息
SmartTracker.getInstance()?.setUser('user-123', {
  role: 'admin',
  plan: 'pro'
});

// 登出时清除
SmartTracker.getInstance()?.clearUser();
```

### 3. 手动埋点

```typescript
// 自定义事件
SmartTracker.getInstance()?.trackEvent('button_click', {
  category: 'ui',
  label: 'submit_order',
  value: 1
});

// 页面浏览（SPA 路由切换）
SmartTracker.getInstance()?.trackPageView('/products/123', '产品详情');
```

### 4. HTML 自动追踪

```html
<!-- 点击追踪 -->
<button data-track-name="submit_order">提交订单</button>

<!-- 曝光追踪 -->
<div data-track-exposure data-track-name="promo_banner">促销横幅</div>

<!-- 忽略追踪 -->
<button data-track-ignore>不需要追踪</button>
```

## 配置项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `measurementId` | `string` | 必填 | GA4 Measurement ID |
| `enablePerformance` | `boolean` | `true` | 启用性能采集 |
| `enableError` | `boolean` | `true` | 启用错误采集 |
| `enableNetwork` | `boolean` | `true` | 启用网络采集 |
| `enableInteraction` | `boolean` | `false` | 启用交互追踪 |
| `enableOffline` | `boolean` | `false` | 启用离线缓存 |
| `debug` | `boolean` | `false` | 调试模式 |

## 构建输出

```
dist/
├── index.js        # ESM 格式
├── index.cjs       # CommonJS 格式
└── index.d.ts      # 类型声明
```

## License

MIT