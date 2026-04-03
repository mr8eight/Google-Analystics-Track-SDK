# GA4 gtag.js 完整配置指南（2026 版）

## 1. 概述

`gtag.js` 是 Google 提供的前端埋点方式，可用于：

- 部署 Google Analytics 4（GA4）
- Google Ads 转化追踪
- Floodlight
- 多平台事件共享
- 自定义事件与参数采集

标准安装方式通常放在网站 `<head>` 中。

---

# 2. 基础安装

## 2.1 引入 gtag.js

将以下代码放入所有页面的 `<head>`：

```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}

  gtag('js', new Date());

  gtag('config', 'G-XXXXXXXXXX');
</script>
```

其中：

- `G-XXXXXXXXXX` 为 GA4 Measurement ID
- 每个网站 / App Data Stream 都有独立的 Measurement ID

---

# 3. 常见配置项

## 3.1 关闭自动 page_view

如果你是单页应用（SPA）或要手动控制页面浏览事件：

```html
gtag('config', 'G-XXXXXXXXXX', {
  send_page_view: false
});
```

然后手动发送：

```html
gtag('event', 'page_view', {
  page_title: document.title,
  page_location: window.location.href,
  page_path: window.location.pathname
});
```

---

## 3.2 指定 Cookie 域名

```html
gtag('config', 'G-XXXXXXXXXX', {
  cookie_domain: 'example.com'
});
```

可选值：

- `auto`
- 一级域名
- 指定子域名

---

## 3.3 修改 Cookie 过期时间

```html
gtag('config', 'G-XXXXXXXXXX', {
  cookie_expires: 60 * 60 * 24 * 365
});
```

单位为秒。

示例：

- 1 天：`86400`
- 30 天：`2592000`
- 1 年：`31536000`

---

## 3.4 设置用户 ID

```html
gtag('config', 'G-XXXXXXXXXX', {
  user_id: '123456'
});
```

注意：

- 不允许发送邮箱、手机号、真实姓名
- user_id 应为匿名内部 ID
- 登录后设置，退出登录后应清空

退出登录时：

```html
gtag('config', 'G-XXXXXXXXXX', {
  user_id: null
});
```

---

## 3.5 设置用户属性

```html
gtag('set', 'user_properties', {
  plan_type: 'premium',
  customer_tier: 'gold',
  login_status: 'logged_in'
});
```

用户属性可用于：

- Audience
- Exploration
- Segmentation
- Remarketing

---

# 4. 页面浏览追踪

## 4.1 手动发送页面浏览

```html
gtag('event', 'page_view', {
  page_title: 'Pricing',
  page_location: 'https://example.com/pricing',
  page_path: '/pricing'
});
```

推荐在以下场景手动发送：

- SPA 路由切换
- 弹窗页面
- 虚拟页面
- Tab 页面切换

---

## 4.2 单页应用（SPA）追踪

示例：

```html
window.addEventListener('popstate', function() {
  gtag('event', 'page_view', {
    page_title: document.title,
    page_location: window.location.href,
    page_path: window.location.pathname
  });
});
```

React Router、Vue Router、Next.js Router 等框架通常需要在路由变化后手动触发 page_view。

---

# 5. 事件追踪

## 5.1 基础事件格式

```html
gtag('event', 'login', {
  method: 'email'
});
```

格式：

```html
gtag('event', '事件名', {
  参数1: '值',
  参数2: '值'
});
```

---

## 5.2 推荐事件

常见推荐事件包括：

- login
- sign_up
- search
- generate_lead
- purchase
- add_to_cart
- begin_checkout
- add_payment_info
- add_shipping_info
- refund
- view_item
- view_item_list
- select_item
- view_cart
- remove_from_cart
- share
- file_download
- video_start
- video_progress
- video_complete

---

## 5.3 自定义事件

```html
gtag('event', 'submit_contact_form', {
  form_name: 'homepage_form',
  page_section: 'hero_banner'
});
```

建议命名规则：

- 小写
- 使用下划线
- 不要包含空格
- 不要使用中文
- 避免参数名和系统保留字段冲突

---

# 6. 电商追踪

## 6.1 浏览商品

```html
gtag('event', 'view_item', {
  currency: 'USD',
  value: 59.99,
  items: [{
    item_id: 'SKU_12345',
    item_name: 'Running Shoes',
    item_brand: 'Nike',
    item_category: 'Shoes',
    item_variant: 'Black',
    price: 59.99,
    quantity: 1
  }]
});
```

---

## 6.2 加入购物车

```html
gtag('event', 'add_to_cart', {
  currency: 'USD',
  value: 59.99,
  items: [{
    item_id: 'SKU_12345',
    item_name: 'Running Shoes',
    price: 59.99,
    quantity: 1
  }]
});
```

---

## 6.3 发起结账

```html
gtag('event', 'begin_checkout', {
  currency: 'USD',
  value: 129.99,
  coupon: 'SPRING10',
  items: [
    {
      item_id: 'SKU_12345',
      item_name: 'Running Shoes',
      price: 59.99,
      quantity: 1
    },
    {
      item_id: 'SKU_67890',
      item_name: 'T-Shirt',
      price: 70.00,
      quantity: 1
    }
  ]
});
```

---

## 6.4 购买成功

```html
gtag('event', 'purchase', {
  transaction_id: 'T12345',
  affiliation: 'Online Store',
  value: 129.99,
  tax: 10.00,
  shipping: 5.00,
  currency: 'USD',
  coupon: 'SPRING10',
  items: [
    {
      item_id: 'SKU_12345',
      item_name: 'Running Shoes',
      price: 59.99,
      quantity: 1
    }
  ]
});
```

注意：

- `transaction_id` 必须唯一
- 不可重复发送 purchase
- 退款需发送 refund

---

# 7. Conversion 配置

前端发送事件后，需要在 GA4 后台把对应事件标记为 Key Event（原 Conversion）。

例如：

- purchase
- generate_lead
- sign_up
- submit_contact_form

否则不会进入转化统计。

---

# 8. Cross-domain Tracking 跨域追踪

例如：

- 主站：example.com
- 支付站：checkout.example-pay.com

配置方式：

```html
gtag('config', 'G-XXXXXXXXXX', {
  linker: {
    domains: ['example.com', 'example-pay.com']
  }
});
```

如果不配置跨域：

- 用户 session 会断开
- 来源会被识别成 referral
- 转化归因会丢失

---

# 9. Referral Exclusion 推荐排除

需要在 GA4 后台排除：

- paypal.com
- stripe.com
- shop.app
- checkout.shopify.com
- 支付网关域名
- 内部系统域名

否则支付后返回网站会被算成新的来源。

---

# 10. Google Ads 转化追踪

如果同时需要 Google Ads：

```html
gtag('config', 'AW-123456789');
```

发送转化：

```html
gtag('event', 'conversion', {
  send_to: 'AW-123456789/AbCdEfGhIjKlMnOpQr',
  value: 129.99,
  currency: 'USD',
  transaction_id: 'T12345'
});
```

---

# 11. Consent Mode

适用于 GDPR、CMP、Cookie Banner 场景。

默认拒绝：

```html
gtag('consent', 'default', {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied'
});
```

用户同意后：

```html
gtag('consent', 'update', {
  analytics_storage: 'granted',
  ad_storage: 'granted',
  ad_user_data: 'granted',
  ad_personalization: 'granted'
});
```

---

# 12. Debug 调试

## 12.1 开启 Debug Mode

```html
gtag('config', 'G-XXXXXXXXXX', {
  debug_mode: true
});
```

或者：

```html
gtag('event', 'purchase', {
  value: 99,
  currency: 'USD',
  debug_mode: true
});
```

---

## 12.2 调试工具

建议同时使用：

- GA4 DebugView
- Chrome DevTools Network
- Google Tag Assistant
- GTM Preview
- 浏览器 Console

重点检查：

- Measurement ID 是否正确
- 事件是否重复触发
- transaction_id 是否重复
- 参数名是否拼写错误
- 自定义参数是否已注册

---

# 13. 常见错误

## 13.1 重复安装

常见现象：

- 页面浏览翻倍
- purchase 翻倍
- session 异常增高

原因：

- 同时装了 gtag.js 与 GTM
- 同一个事件被发送两次
- SPA 路由重复触发

---

## 13.2 参数未注册

GA4 自定义参数不会自动出现在报表里。

例如发送：

```html
gtag('event', 'submit_contact_form', {
  form_name: 'homepage_form'
});
```

还需要在后台创建：

- Custom Dimension: `form_name`

否则只能在 BigQuery 中看到。

---

## 13.3 PII 问题

禁止发送：

- 邮箱
- 手机号
- 姓名
- 身份证
- 地址
- 精确个人身份信息

例如以下是错误写法：

```html
gtag('config', 'G-XXXXXXXXXX', {
  user_id: 'tom@example.com'
});
```

---

# 14. 推荐部署顺序

1. 安装 gtag.js
2. 配置 page_view
3. 配置核心事件
4. 配置 purchase
5. 配置 user_id
6. 配置自定义参数
7. 配置跨域
8. 配置 referral exclusion
9. 配置 consent mode
10. 配置 Google Ads
11. 验证 DebugView
12. 创建 Custom Dimensions
13. 标记 Key Events
14. 联通 BigQuery

---

# 15. 建议的命名规范

## 事件命名

- add_to_cart
- submit_contact_form
- click_pricing_cta
- view_case_study

## 参数命名

- form_name
- plan_type
- button_text
- page_section
- product_type

避免：

- CamelCase
- 中文
- 空格
- 特殊字符
- 与系统字段重名

---

# 16. 建议的文档模板

建议为每个事件建立配置文档：

| Event Name | Trigger | Parameters | Conversion | Notes |
|------------|----------|------------|------------|-------|
| purchase | Payment success page | transaction_id, value, currency | Yes | Unique transaction ID |
| sign_up | Registration success | method | Yes | Exclude test accounts |
| submit_contact_form | Form submit success | form_name, page_section | Yes | Use AJAX success callback |

这样可以方便开发、测试、运营、BI 团队统一管理。

