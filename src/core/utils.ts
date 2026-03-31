// src/core/utils.ts

/**
 * @packageDocumentation
 * SDK 内部工具函数
 */

import type { TrackerConfig } from '../types';

/**
 * 追踪器全局配置（内部使用）
 * @internal
 */
let globalConfig: TrackerConfig | null = null;

/**
 * 设置全局配置
 * @internal
 */
export function setGlobalConfig(config: TrackerConfig): void {
  globalConfig = config;
}

/**
 * 获取全局配置
 * @internal
 */
export function getGlobalConfig(): TrackerConfig | null {
  return globalConfig;
}

/**
 * 安全执行同步函数
 *
 * 所有 SDK 内部逻辑都通过此函数执行，确保不会抛出异常到外部。
 *
 * @param fn - 要执行的函数
 * @param fallback - 失败时的返回值
 * @param context - 上下文描述（用于调试日志）
 * @returns 函数执行结果或 fallback
 *
 * @example
 * ```ts
 * const result = safeExecute(() => {
 *   return JSON.parse(data);
 * }, null, 'parseData');
 * ```
 *
 * @internal
 */
export function safeExecute<T>(
  fn: () => T,
  fallback?: T,
  context?: string
): T | undefined {
  try {
    return fn();
  } catch (error) {
    if (globalConfig?.debug) {
      console.warn('[Tracker] Internal error:', context || 'unknown', error);
    }
    return fallback;
  }
}

/**
 * 安全执行异步函数
 *
 * @param fn - 要执行的异步函数
 * @param fallback - 失败时的返回值
 * @param context - 上下文描述
 * @returns Promise 包裹的执行结果
 *
 * @internal
 */
export async function safeExecuteAsync<T>(
  fn: () => Promise<T>,
  fallback?: T,
  context?: string
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    if (globalConfig?.debug) {
      console.warn('[Tracker] Internal async error:', context || 'unknown', error);
    }
    return fallback;
  }
}

/**
 * 生成唯一 ID
 *
 * @returns 唯一标识符
 * @internal
 */
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * 检查是否在浏览器环境
 *
 * @returns 是否在浏览器环境
 * @internal
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * 检查 localStorage 是否可用
 *
 * @returns localStorage 是否可用
 * @internal
 */
export function isLocalStorageAvailable(): boolean {
  if (!isBrowser()) return false;

  try {
    const testKey = '__tracker_test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * 安全读取 localStorage
 *
 * @param key - 存储键名
 * @returns 存储值或 null
 * @internal
 */
export function safeGetStorage(key: string): string | null {
  if (!isLocalStorageAvailable()) return null;

  return safeExecute(() => {
    return localStorage.getItem(key);
  }, null, 'safeGetStorage');
}

/**
 * 安全写入 localStorage
 *
 * @param key - 存储键名
 * @param value - 存储值
 * @returns 是否写入成功
 * @internal
 */
export function safeSetStorage(key: string, value: string): boolean {
  if (!isLocalStorageAvailable()) return false;

  return safeExecute(() => {
    localStorage.setItem(key, value);
    return true;
  }, false, 'safeSetStorage');
}

/**
 * 安全移除 localStorage
 *
 * @param key - 存储键名
 * @internal
 */
export function safeRemoveStorage(key: string): void {
  if (!isLocalStorageAvailable()) return;

  safeExecute(() => {
    localStorage.removeItem(key);
  }, undefined, 'safeRemoveStorage');
}

/**
 * 获取当前页面路径
 *
 * @returns 当前路径
 * @internal
 */
export function getCurrentPath(): string {
  if (!isBrowser()) return '';
  return window.location.pathname + window.location.search;
}

/**
 * 获取页面来源
 *
 * @returns referrer 或空字符串
 * @internal
 */
export function getReferrer(): string {
  if (!isBrowser()) return '';
  return document.referrer || '';
}

/**
 * 获取用户代理信息
 *
 * @returns userAgent 字符串
 * @internal
 */
export function getUserAgent(): string {
  if (!isBrowser()) return '';
  return navigator.userAgent;
}

/**
 * 检查 URL 是否匹配忽略规则
 *
 * @param url - 要检查的 URL
 * @param patterns - 忽略规则列表
 * @returns 是否匹配
 * @internal
 */
export function shouldIgnoreUrl(url: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(url));
}

/**
 * 截断字符串
 *
 * @param str - 原字符串
 * @param maxLength - 最大长度
 * @returns 截断后的字符串
 * @internal
 */
export function truncate(str: string, maxLength: number): string {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}

/**
 * 节流函数
 *
 * @param fn - 要节流的函数
 * @param delay - 节流间隔（毫秒）
 * @returns 节流后的函数
 *
 * @internal
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;

  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn.apply(this, args);
    }
  };
}

/**
 * 防抖函数
 *
 * @param fn - 要防抖的函数
 * @param delay - 防抖间隔（毫秒）
 * @returns 防抖后的函数
 *
 * @internal
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };
}