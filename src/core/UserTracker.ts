// src/core/UserTracker.ts

/**
 * 用户追踪模块
 *
 * 管理用户身份和属性，自动关联到所有上报事件。
 * 用户信息存储在 localStorage 中，支持跨页面持久化。
 *
 * @example
 * ```ts
 * const userTracker = new UserTracker();
 *
 * // 登录时设置用户
 * userTracker.setUser('user-123', {
 *   role: 'admin',
 *   plan: 'pro',
 *   company: 'acme'
 * });
 *
 * // 获取当前用户 ID
 * const userId = userTracker.getUserId(); // 'user-123'
 *
 * // 登出时清除
 * userTracker.clearUser();
 * ```
 */

import type { UserTraits } from '../types';
import { safeExecute, safeGetStorage, safeSetStorage, safeRemoveStorage, isLocalStorageAvailable } from './utils';

/** localStorage 存储键名 */
const STORAGE_KEY = '__tracker_user__';

/** 内存存储（localStorage 不可用时的降级方案） */
let memoryStore: { userId: string | null; traits: UserTraits; updatedAt: string | null } = {
  userId: null,
  traits: {},
  updatedAt: null
};

/**
 * 用户追踪器
 */
export class UserTracker {
  private userId: string | null = null;
  private traits: UserTraits = {};

  constructor() {
    this.restore();
  }

  /**
   * 设置用户信息
   *
   * @param userId - 用户唯一标识
   * @param traits - 用户属性（角色、计划等）
   */
  setUser(userId: string, traits?: UserTraits): void {
    safeExecute(() => {
      this.userId = userId;
      this.traits = traits || {};

      const data = {
        userId,
        traits: this.traits,
        updatedAt: new Date().toISOString()
      };

      if (isLocalStorageAvailable()) {
        safeSetStorage(STORAGE_KEY, JSON.stringify(data));
      } else {
        memoryStore = data;
      }
    }, undefined, 'UserTracker.setUser');
  }

  /**
   * 获取当前用户 ID
   *
   * @returns 用户 ID，未设置返回 null
   */
  getUserId(): string | null {
    return this.userId;
  }

  /**
   * 获取用户属性
   *
   * @returns 用户属性副本
   */
  getTraits(): UserTraits {
    return { ...this.traits };
  }

  /**
   * 清除用户信息
   *
   * 登出时调用，清除所有用户相关数据。
   */
  clearUser(): void {
    safeExecute(() => {
      this.userId = null;
      this.traits = {};

      if (isLocalStorageAvailable()) {
        safeRemoveStorage(STORAGE_KEY);
      } else {
        memoryStore = { userId: null, traits: {}, updatedAt: null };
      }
    }, undefined, 'UserTracker.clearUser');
  }

  /**
   * 恢复用户信息
   *
   * 从 localStorage 恢复之前保存的用户信息。
   * @internal
   */
  restore(): void {
    safeExecute(() => {
      let data: { userId: string | null; traits: UserTraits; updatedAt: string | null } | null = null;

      if (isLocalStorageAvailable()) {
        const stored = safeGetStorage(STORAGE_KEY);
        if (stored) {
          data = JSON.parse(stored);
        }
      } else {
        data = memoryStore;
      }

      if (data && data.userId) {
        this.userId = data.userId;
        this.traits = data.traits || {};
      }
    }, undefined, 'UserTracker.restore');
  }

  /**
   * 生成用户上下文数据
   *
   * 用于合并到事件参数中，自动添加用户信息。
   *
   * @returns 包含 user_id 和用户属性的上下文对象
   * @internal
   */
  getContext(): { user_id: string | null; [key: string]: any } {
    const context: { user_id: string | null; [key: string]: any } = {
      user_id: this.userId
    };

    // 添加用户属性，前缀为 user_
    if (this.traits) {
      Object.keys(this.traits).forEach(key => {
        const value = this.traits[key];
        if (value !== undefined) {
          context[`user_${key}`] = value;
        }
      });
    }

    return context;
  }
}