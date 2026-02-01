# @my-org/tracker

企业级前端埋点监控 SDK。基于 Google Analytics 4 (gtag) 封装，提供性能监控、错误捕获及用户行为追踪功能。支持 Monorepo 架构与 TypeScript。

## ✨ 特性

* **⚡️ 性能监控**: 自动采集 Web Vitals (FCP, LCP, CLS, INP) 指标。
* **🚨 错误监控**: 自动捕获 JS 运行时错误、资源加载错误 (404) 及 Promise 异常。
* **🌐 接口监控**: 自动拦截 Fetch 请求，上报接口异常状态码。
* **🖱 交互追踪**: 提供语义化的 API 用于上报按钮点击与业务事件。
* **🛡 隔离性**: 采集层与上报层解耦，支持 SSR 环境（Next.js/Nuxt）不报错。

---

## 📦 安装 (Monorepo)

在你的业务项目（如 `apps/web-app`）中引入：

```bash
# pnpm
pnpm add @my-org/tracker --filter web-app
```

或者在 `package.json` 中添加：

```json
"dependencies": {
  "@my-org/tracker": "workspace:*"
}
```

---

## 🚀 初始化

建议在项目的入口文件（如 `src/main.tsx` 或 `src/App.tsx`）进行初始化。**配置仅需执行一次**。

```typescript
import { SmartTracker } from '@my-org/tracker';

SmartTracker.getInstance({
  // 必填：GA4 Measurement ID
  measurementId: 'G-XXXXXXXXXX',
  
  // 选填：功能开关
  enablePerformance: true, // 开启性能监控 (默认 true)
  enableError: true,       // 开启错误监控 (默认 true)
  
  // 选填：调试模式 (开发环境建议开启，会在控制台打印日志)
  debug: process.env.NODE_ENV === 'development'
});
```

---

## 🛠 使用指南

### 1. 上报普通点击事件 (`trackClick`)

用于追踪按钮、链接等明确的点击行为。

```tsx
import { SmartTracker } from '@my-org/tracker';

const Button = () => {
  const handleClick = () => {
    // 格式: trackClick(按钮名, 模块名, 额外参数)
    SmartTracker.getInstance().trackClick('submit_order', 'CheckoutPage', {
      price: 99.00
    });
  };

  return <button onClick={handleClick}>提交订单</button>;
};
```
* **生成的 GA 事件**: `click`
* **Category**: `Interaction`
* **Label**: `CheckoutPage:submit_order`

### 2. 上报自定义业务事件 (`trackEvent`)

用于追踪非点击类的业务行为，如“登录成功”、“表单验证失败”、“视频播放完成”。

```typescript
SmartTracker.getInstance().trackEvent('login_success', {
  category: 'UserAccount',
  method: 'wechat', // 登录方式
  user_id: '10086'  // 注意：不要上传 PII 敏感信息(如手机号)
});
```

### 3. 手动上报 PV (`trackPageView`)

通常 GA4 会自动采集 PV，但在某些复杂的 SPA 场景下，你可能需要手动触发。

```typescript
// 在路由切换钩子中调用
SmartTracker.getInstance().trackPageView('/home', '首页');
```

---

## 📊 自动采集的数据说明

初始化后，SDK 会自动静默采集以下数据，无需手动干预：

### 性能指标 (Category: `Web Vitals`)
| 事件名 | 说明 | Value 单位 |
| :--- | :--- | :--- |
| `LCP` | 最大内容绘制 | 毫秒 (ms) |
| `FCP` | 首次内容绘制 | 毫秒 (ms) |
| `CLS` | 累积布局偏移 | 原始值 * 1000 (整数) |
| `INP` | 下次交互延迟 | 毫秒 (ms) |

### 异常监控 (Category: `Error` / `API`)
| 事件名 | 说明 | 关键参数 |
| :--- | :--- | :--- |
| `resource_error` | 图片/脚本加载 404 | `error_url`, `label` (标签名) |
| `exception` | JS 报错 / Promise 拒收 | `description` (错误堆栈) |
| `api_error` | 接口非 200 或网络断开 | `label` (API URL), `value` (状态码) |

---

## ⚙️ 类型定义

```typescript
interface TrackerConfig {
  measurementId: string;
  enablePerformance?: boolean; // Default: true
  enableError?: boolean;       // Default: true
  debug?: boolean;             // Default: false
}
```

## ⚠️ 注意事项

1.  **SSR 兼容性**: 本 SDK 内部已做 `typeof window` 判断，可以在 Next.js 等服务端渲染框架中安全引入，不会导致构建失败。
2.  **GA 后台配置**: 自定义参数（如 `module_name`, `error_url`）需要在 Google Analytics 后台的 **"自定义定义 (Custom Definitions)"** 中注册为自定义维度，否则报表中无法查看详细数据。