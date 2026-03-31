// src/reporter/gtag.ts

/**
 * @packageDocumentation
 * Google Analytics 4 注入和上报模块
 */

import type { TrackerConfig, EventParams } from '../types';
import { safeExecute, isBrowser } from '../core/utils';

/** GA4 脚本 URL 前缀 */
const GTAG_SCRIPT_URL = 'https://www.googletagmanager.com/gtag/js';

/** 脚本元素 ID */
const SCRIPT_ID = 'smart-tracker-gtag';

/**
 * 注入 GA4 脚本
 *
 * 动态创建 script 标签加载 gtag.js，并初始化 dataLayer。
 * 支持重复调用，已注入时会跳过。
 *
 * @param measurementId - GA4 Measurement ID
 * @param config - 追踪器配置
 *
 * @example
 * ```ts
 * injectGtagScript('G-XXXXXXXXXX', { debug: true });
 * ```
 */
export function injectGtagScript(
  measurementId: string,
  config?: TrackerConfig
): void {
  if (!isBrowser()) return;

  safeExecute(() => {
    // 已注入则跳过
    if (document.getElementById(SCRIPT_ID)) {
      if (config?.debug) {
        console.log('[Tracker] gtag.js already injected');
      }
      return;
    }

    // 创建 script 标签加载 gtag.js
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `${GTAG_SCRIPT_URL}?id=${measurementId}`;

    // 加载错误处理
    script.onerror = () => {
      if (config?.debug) {
        console.warn('[Tracker] Failed to load gtag.js');
      }
    };

    // 插入到 head
    const firstScript = document.head.getElementsByTagName('script')[0];
    if (firstScript) {
      firstScript.parentNode?.insertBefore(script, firstScript);
    } else {
      document.head.appendChild(script);
    }

    // 初始化 dataLayer 和 gtag 函数
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag(...args: any[]) {
      window.dataLayer.push(args);
    };

    // 设置时间戳
    window.gtag('js', new Date());

    // 配置 Measurement ID
    window.gtag('config', measurementId, {
      send_page_view: true,
      debug_mode: config?.debug || false
    });

    if (config?.debug) {
      console.log('[Tracker] gtag.js injected successfully');
    }
  }, undefined, 'injectGtagScript');
}

/**
 * 移除 GA4 脚本
 *
 * 从页面移除 gtag.js script 标签。
 * 用于 SDK 销毁时调用。
 *
 * @param measurementId - GA4 Measurement ID
 */
export function removeGtagScript(measurementId: string): void {
  if (!isBrowser()) return;

  safeExecute(() => {
    // 移除 script 标签
    const script = document.getElementById(SCRIPT_ID);
    if (script) {
      script.remove();
    }

    // 清理 gtag 配置
    if (window.gtag) {
      window.gtag('config', measurementId, { send_page_view: false });
    }
  }, undefined, 'removeGtagScript');
}

/**
 * 发送事件到 GA4
 *
 * 将事件数据通过 gtag 发送到 Google Analytics。
 * 所有参数会自动转换为 GA4 要求的格式。
 *
 * @param eventName - 事件名称
 * @param params - 事件参数
 * @param config - 追踪器配置
 *
 * @example
 * ```ts
 * sendToGtag('button_click', {
 *   category: 'ui',
 *   label: 'submit',
 *   value: 1
 * }, { debug: true });
 * ```
 */
export function sendToGtag(
  eventName: string,
  params: EventParams,
  config?: TrackerConfig
): void {
  if (!isBrowser()) return;

  safeExecute(() => {
    // 检查 gtag 是否可用
    if (typeof window.gtag !== 'function') {
      if (config?.debug) {
        console.warn('[Tracker] gtag is not available');
      }
      return;
    }

    // 转换参数格式
    const {
      category,
      label,
      value,
      non_interaction = true,
      ...rest
    } = params;

    const payload: Record<string, any> = {
      event_category: category,
      event_label: label,
      value: value,
      non_interaction: non_interaction,
      ...rest
    };

    // 移除 undefined 值
    Object.keys(payload).forEach(key => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });

    // 发送事件
    window.gtag('event', eventName, payload);

    // 调试日志
    if (config?.debug) {
      console.log(
        `%c[Tracker] Event: ${eventName}`,
        'color: #2E7D32; font-weight: bold',
        payload
      );
    }
  }, undefined, 'sendToGtag');
}

/**
 * 发送页面浏览事件
 *
 * 手动上报页面访问，用于 SPA 路由切换场景。
 *
 * @param path - 页面路径
 * @param title - 页面标题
 * @param config - 追踪器配置
 */
export function sendPageView(
  path: string,
  title?: string,
  config?: TrackerConfig
): void {
  if (!isBrowser()) return;

  safeExecute(() => {
    if (typeof window.gtag !== 'function') {
      if (config?.debug) {
        console.warn('[Tracker] gtag is not available');
      }
      return;
    }

    window.gtag('event', 'page_view', {
      page_path: path,
      page_title: title || document.title,
      page_location: window.location.origin + path
    });

    if (config?.debug) {
      console.log(
        `%c[Tracker] PageView: ${path}`,
        'color: #1565C0; font-weight: bold'
      );
    }
  }, undefined, 'sendPageView');
}

/**
 * 设置用户属性
 *
 * 将用户信息发送到 GA4，用于关联用户行为。
 *
 * @param userId - 用户 ID
 * @param traits - 用户属性
 * @param config - 追踪器配置
 */
export function setUserProperties(
  userId: string,
  traits?: Record<string, any>,
  config?: TrackerConfig
): void {
  if (!isBrowser()) return;

  safeExecute(() => {
    if (typeof window.gtag !== 'function') {
      if (config?.debug) {
        console.warn('[Tracker] gtag is not available');
      }
      return;
    }

    // 设置用户 ID
    if (config?.measurementId) {
      window.gtag('config', config.measurementId, {
        user_id: userId
      });
    }

    // 设置用户属性
    if (traits && Object.keys(traits).length > 0) {
      window.gtag('set', 'user_properties', traits);
    }

    if (config?.debug) {
      console.log(
        `%c[Tracker] User: ${userId}`,
        'color: #7B1FA2; font-weight: bold',
        traits
      );
    }
  }, undefined, 'setUserProperties');
}

/**
 * 清除用户属性
 *
 * @param config - 追踪器配置
 */
export function clearUserProperties(config?: TrackerConfig): void {
  if (!isBrowser()) return;

  safeExecute(() => {
    if (typeof window.gtag !== 'function') return;

    if (config?.measurementId) {
      window.gtag('config', config.measurementId, {
        user_id: undefined
      });
    }

    window.gtag('set', 'user_properties', {});

    if (config?.debug) {
      console.log('%c[Tracker] User cleared', 'color: #7B1FA2; font-weight: bold');
    }
  }, undefined, 'clearUserProperties');
}