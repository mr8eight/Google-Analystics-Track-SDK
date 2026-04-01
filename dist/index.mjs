/**
 * Smart Tracker SDK
 * Google Analytics 4 埋点 SDK
 * (c) 2026
 * Released under the MIT License
 */

// src/core/utils.ts
var globalConfig = null;
function setGlobalConfig(config) {
  globalConfig = config;
}
function safeExecute(fn, fallback, context) {
  try {
    return fn();
  } catch (error) {
    if (globalConfig?.debug) {
      console.warn("[Tracker] Internal error:", context || "unknown", error);
    }
    return fallback;
  }
}
async function safeExecuteAsync(fn, fallback, context) {
  try {
    return await fn();
  } catch (error) {
    if (globalConfig?.debug) {
      console.warn("[Tracker] Internal async error:", context, error);
    }
    return fallback;
  }
}
function generateId() {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}
function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}
function isLocalStorageAvailable() {
  if (!isBrowser()) return false;
  try {
    const testKey = "__tracker_test__";
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}
function safeGetStorage(key) {
  if (!isLocalStorageAvailable()) return null;
  return safeExecute(() => {
    return localStorage.getItem(key);
  }, null, "safeGetStorage");
}
function safeSetStorage(key, value) {
  if (!isLocalStorageAvailable()) return false;
  return safeExecute(() => {
    localStorage.setItem(key, value);
    return true;
  }, false, "safeSetStorage");
}
function safeRemoveStorage(key) {
  if (!isLocalStorageAvailable()) return;
  safeExecute(() => {
    localStorage.removeItem(key);
  }, void 0, "safeRemoveStorage");
}
function shouldIgnoreUrl(url, patterns) {
  return patterns.some((pattern) => pattern.test(url));
}
function throttle(fn, delay) {
  let lastCall = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn.apply(this, args);
    }
  };
}

// src/core/UserTracker.ts
var STORAGE_KEY = "__tracker_user__";
var memoryStore = {
  userId: null,
  traits: {},
  updatedAt: null
};
var UserTracker = class {
  constructor() {
    this.userId = null;
    this.traits = {};
    this.restore();
  }
  /**
   * 设置用户信息
   *
   * @param userId - 用户唯一标识
   * @param traits - 用户属性（角色、计划等）
   */
  setUser(userId, traits) {
    safeExecute(() => {
      this.userId = userId;
      this.traits = traits || {};
      const data = {
        userId,
        traits: this.traits,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (isLocalStorageAvailable()) {
        safeSetStorage(STORAGE_KEY, JSON.stringify(data));
      } else {
        memoryStore = data;
      }
    }, void 0, "UserTracker.setUser");
  }
  /**
   * 获取当前用户 ID
   *
   * @returns 用户 ID，未设置返回 null
   */
  getUserId() {
    return this.userId;
  }
  /**
   * 获取用户属性
   *
   * @returns 用户属性副本
   */
  getTraits() {
    return { ...this.traits };
  }
  /**
   * 清除用户信息
   *
   * 登出时调用，清除所有用户相关数据。
   */
  clearUser() {
    safeExecute(() => {
      this.userId = null;
      this.traits = {};
      if (isLocalStorageAvailable()) {
        safeRemoveStorage(STORAGE_KEY);
      } else {
        memoryStore = { userId: null, traits: {}, updatedAt: null };
      }
    }, void 0, "UserTracker.clearUser");
  }
  /**
   * 恢复用户信息
   *
   * 从 localStorage 恢复之前保存的用户信息。
   * @internal
   */
  restore() {
    safeExecute(() => {
      let data = null;
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
    }, void 0, "UserTracker.restore");
  }
  /**
   * 生成用户上下文数据
   *
   * 用于合并到事件参数中，自动添加用户信息。
   *
   * @returns 包含 user_id 和用户属性的上下文对象
   * @internal
   */
  getContext() {
    const context = {
      user_id: this.userId
    };
    if (this.traits) {
      Object.keys(this.traits).forEach((key) => {
        const value = this.traits[key];
        if (value !== void 0) {
          context[`user_${key}`] = value;
        }
      });
    }
    return context;
  }
};

// src/core/OfflineQueue.ts
var STORAGE_KEY2 = "__tracker_queue__";
var DEFAULT_CONFIG = {
  maxItems: 100,
  retryInterval: 5e3,
  maxRetries: 3
};
var OfflineQueue = class {
  /**
   * @param config - 队列配置
   */
  constructor(config) {
    this.queue = [];
    this.flushTimer = null;
    this.isFlushing = false;
    /**
     * 绑定的网络恢复事件处理器
     * 使用箭头函数绑定 this，便于移除监听器
     * @internal
     */
    this.handleOnline = () => {
      this.flush();
    };
    this.config = {
      ...DEFAULT_CONFIG,
      ...config
    };
    this.restore();
    this.bindNetworkEvents();
  }
  /**
   * 将事件加入队列
   *
   * 网络断开时调用，事件会持久化到 localStorage。
   *
   * @param eventName - 事件名称
   * @param params - 事件参数
   * @returns 是否成功加入队列（队列满时返回 false）
   */
  enqueue(eventName, params) {
    return safeExecute(() => {
      if (this.queue.length >= this.config.maxItems) {
        this.queue.shift();
      }
      const event = {
        id: generateId(),
        name: eventName,
        params,
        timestamp: Date.now(),
        retries: 0
      };
      this.queue.push(event);
      this.save();
      return true;
    }, false, "OfflineQueue.enqueue") ?? false;
  }
  /**
   * 获取队列长度
   */
  size() {
    return this.queue.length;
  }
  /**
   * 清空队列
   */
  clear() {
    safeExecute(() => {
      this.queue = [];
      this.save();
    }, void 0, "OfflineQueue.clear");
  }
  /**
   * 立即尝试上报队列中所有事件
   *
   * 网络恢复时自动调用。
   *
   * @returns 上报成功的事件数量
   */
  async flush() {
    if (this.isFlushing || this.queue.length === 0) {
      return 0;
    }
    this.isFlushing = true;
    const result = await safeExecuteAsync(async () => {
      let successCount = 0;
      const failedEvents = [];
      for (const event of this.queue) {
        try {
          this.config.reportFn(event.name, event.params);
          successCount++;
        } catch {
          event.retries++;
          if (event.retries < this.config.maxRetries) {
            failedEvents.push(event);
          }
        }
      }
      this.queue = failedEvents;
      this.save();
      return successCount;
    }, 0, "OfflineQueue.flush");
    this.isFlushing = false;
    return result ?? 0;
  }
  /**
   * 启动定时重试
   *
   * 定期检查队列并尝试上报。
   * @internal
   */
  startRetryTimer() {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      if (navigator.onLine && this.queue.length > 0) {
        this.flush();
      }
    }, this.config.retryInterval);
  }
  /**
   * 停止定时重试
   *
   * 销毁时调用。
   * @internal
   */
  stopRetryTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
  /**
   * 恢复队列
   *
   * 从 localStorage 恢复之前保存的队列。
   * @internal
   */
  restore() {
    safeExecute(() => {
      if (isLocalStorageAvailable()) {
        const stored = safeGetStorage(STORAGE_KEY2);
        if (stored) {
          this.queue = JSON.parse(stored);
        }
      }
    }, void 0, "OfflineQueue.restore");
  }
  /**
   * 保存队列到 localStorage
   * @internal
   */
  save() {
    safeExecute(() => {
      if (isLocalStorageAvailable()) {
        safeSetStorage(STORAGE_KEY2, JSON.stringify(this.queue));
      }
    }, void 0, "OfflineQueue.save");
  }
  /**
   * 绑定网络事件监听
   * @internal
   */
  bindNetworkEvents() {
    safeExecute(() => {
      window.addEventListener("online", this.handleOnline);
    }, void 0, "OfflineQueue.bindNetworkEvents");
  }
  /**
   * 销毁队列实例
   *
   * 清理定时器和事件监听器，防止内存泄漏。
   * 销毁后不应再使用该实例。
   */
  destroy() {
    this.stopRetryTimer();
    safeExecute(() => {
      window.removeEventListener("online", this.handleOnline);
    }, void 0, "OfflineQueue.destroy");
  }
};

// src/reporter/gtag.ts
var GTAG_SCRIPT_URL = "https://www.googletagmanager.com/gtag/js";
var SCRIPT_ID = "smart-tracker-gtag";
function injectGtagScript(measurementId, config) {
  if (!isBrowser()) return;
  safeExecute(() => {
    if (document.getElementById(SCRIPT_ID)) {
      if (config?.debug) {
        console.log("[Tracker] gtag.js already injected");
      }
      return;
    }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `${GTAG_SCRIPT_URL}?id=${measurementId}`;
    script.onerror = () => {
      if (config?.debug) {
        console.warn("[Tracker] Failed to load gtag.js");
      }
    };
    const firstScript = document.head.getElementsByTagName("script")[0];
    if (firstScript) {
      firstScript.parentNode?.insertBefore(script, firstScript);
    } else {
      document.head.appendChild(script);
    }
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag(...args) {
      window.dataLayer.push(args);
    };
    window.gtag("js", /* @__PURE__ */ new Date());
    window.gtag("config", measurementId, {
      send_page_view: true,
      debug_mode: config?.debug || false
    });
    if (config?.debug) {
      console.log("[Tracker] gtag.js injected successfully");
    }
  }, void 0, "injectGtagScript");
}
function sendToGtag(eventName, params, config) {
  if (!isBrowser()) return;
  safeExecute(() => {
    if (typeof window.gtag !== "function") {
      if (config?.debug) {
        console.warn("[Tracker] gtag is not available");
      }
      return;
    }
    const {
      category,
      label,
      value,
      non_interaction = true,
      ...rest
    } = params;
    const payload = {
      event_category: category,
      event_label: label,
      value,
      non_interaction,
      ...rest
    };
    Object.keys(payload).forEach((key) => {
      if (payload[key] === void 0) {
        delete payload[key];
      }
    });
    window.gtag("event", eventName, payload);
    if (config?.debug) {
      console.log(
        `%c[Tracker] Event: ${eventName}`,
        "color: #2E7D32; font-weight: bold",
        payload
      );
    }
  }, void 0, "sendToGtag");
}
function sendPageView(path, title, config) {
  if (!isBrowser()) return;
  safeExecute(() => {
    if (typeof window.gtag !== "function") {
      if (config?.debug) {
        console.warn("[Tracker] gtag is not available");
      }
      return;
    }
    window.gtag("event", "page_view", {
      page_path: path,
      page_title: title || document.title,
      page_location: window.location.origin + path
    });
    if (config?.debug) {
      console.log(
        `%c[Tracker] PageView: ${path}`,
        "color: #1565C0; font-weight: bold"
      );
    }
  }, void 0, "sendPageView");
}
function setUserProperties(userId, traits, config) {
  if (!isBrowser()) return;
  safeExecute(() => {
    if (typeof window.gtag !== "function") {
      if (config?.debug) {
        console.warn("[Tracker] gtag is not available");
      }
      return;
    }
    if (config?.measurementId) {
      window.gtag("config", config.measurementId, {
        user_id: userId
      });
    }
    if (traits && Object.keys(traits).length > 0) {
      window.gtag("set", "user_properties", traits);
    }
    if (config?.debug) {
      console.log(
        `%c[Tracker] User: ${userId}`,
        "color: #7B1FA2; font-weight: bold",
        traits
      );
    }
  }, void 0, "setUserProperties");
}
function clearUserProperties(config) {
  if (!isBrowser()) return;
  safeExecute(() => {
    if (typeof window.gtag !== "function") return;
    if (config?.measurementId) {
      window.gtag("config", config.measurementId, {
        user_id: void 0
      });
    }
    window.gtag("set", "user_properties", {});
    if (config?.debug) {
      console.log("%c[Tracker] User cleared", "color: #7B1FA2; font-weight: bold");
    }
  }, void 0, "clearUserProperties");
}

// src/core/SmartTracker.ts
var DEFAULT_CONFIG2 = {
  enablePerformance: true,
  enableError: true,
  enableNetwork: true,
  enableInteraction: false,
  enableOffline: false,
  debug: false
};
var _SmartTracker = class _SmartTracker {
  /**
   * 私有构造函数，使用 init() 方法初始化
   */
  constructor(config) {
    this.offlineQueue = null;
    this.collectors = {};
    this.isInitialized = false;
    this.isDestroyed = false;
    // ============================================
    // Internal Methods
    // ============================================
    /**
     * 内部上报函数
     * @internal
     */
    this.report = (eventName, params) => {
      const mergedParams = {
        ...params,
        ...this.userTracker.getContext()
      };
      if (isBrowser() && !navigator.onLine && this.offlineQueue) {
        this.offlineQueue.enqueue(eventName, mergedParams);
        return;
      }
      sendToGtag(eventName, mergedParams, this.config);
    };
    this.config = { ...DEFAULT_CONFIG2, ...config };
    this.userTracker = new UserTracker();
    setGlobalConfig(this.config);
    this.init();
  }
  /**
   * 初始化追踪器
   *
   * @param config - 配置项
   * @returns SmartTracker 实例
   * @throws 如果 measurementId 未提供
   *
   * @example
   * ```ts
   * const tracker = SmartTracker.init({
   *   measurementId: 'G-XXXXXXXXXX',
   *   enablePerformance: true
   * });
   * ```
   */
  static init(config) {
    if (!config.measurementId) {
      throw new Error("[Tracker] measurementId is required");
    }
    if (_SmartTracker.instance) {
      if (config.debug) {
        console.warn("[Tracker] Already initialized, returning existing instance");
      }
      return _SmartTracker.instance;
    }
    _SmartTracker.instance = new _SmartTracker(config);
    return _SmartTracker.instance;
  }
  /**
   * 获取单例实例
   *
   * @returns SmartTracker 实例，未初始化时返回 null
   */
  static getInstance() {
    return _SmartTracker.instance;
  }
  /**
   * 设置当前用户信息
   *
   * @param userId - 用户唯一标识
   * @param traits - 用户属性（角色、计划等）
   *
   * @example
   * ```ts
   * tracker.setUser('user-123', { role: 'admin', plan: 'pro' });
   * ```
   */
  setUser(userId, traits) {
    safeExecute(() => {
      this.userTracker.setUser(userId, traits);
      setUserProperties(userId, traits, this.config);
    }, void 0, "SmartTracker.setUser");
  }
  /**
   * 清除用户信息
   *
   * 登出时调用。
   */
  clearUser() {
    safeExecute(() => {
      this.userTracker.clearUser();
      clearUserProperties(this.config);
    }, void 0, "SmartTracker.clearUser");
  }
  /**
   * 上报自定义事件
   *
   * @param name - 事件名称
   * @param params - 事件参数
   *
   * @example
   * ```ts
   * tracker.trackEvent('button_click', {
   *   category: 'ui',
   *   label: 'submit',
   *   value: 1
   * });
   * ```
   */
  trackEvent(name, params) {
    safeExecute(() => {
      const mergedParams = {
        ...params,
        ...this.userTracker.getContext()
      };
      if (!navigator.onLine && this.offlineQueue) {
        this.offlineQueue.enqueue(name, mergedParams);
        return;
      }
      sendToGtag(name, mergedParams, this.config);
    }, void 0, "SmartTracker.trackEvent");
  }
  /**
   * 手动上报页面访问
   *
   * @param path - 页面路径，默认当前路径
   * @param title - 页面标题
   *
   * @example
   * ```ts
   * // SPA 路由切换时
   * tracker.trackPageView('/products/123', '产品详情');
   * ```
   */
  trackPageView(path, title) {
    safeExecute(() => {
      const pagePath = path || (isBrowser() ? window.location.pathname + window.location.search : "");
      if (pagePath) {
        sendPageView(pagePath, title, this.config);
      }
    }, void 0, "SmartTracker.trackPageView");
  }
  /**
   * 销毁实例
   *
   * 清理所有采集器和监听器，用于 SPA 路由切换或组件卸载场景。
   *
   * @example
   * ```ts
   * tracker.destroy();
   * ```
   */
  destroy() {
    if (this.isDestroyed) return;
    safeExecute(() => {
      Object.values(this.collectors).forEach((collector) => {
        if (collector && typeof collector.stop === "function") {
          collector.stop();
        }
      });
      if (this.offlineQueue) {
        this.offlineQueue.destroy();
      }
      this.isDestroyed = true;
      this.isInitialized = false;
      _SmartTracker.instance = null;
    }, void 0, "SmartTracker.destroy");
  }
  /**
   * 初始化内部逻辑
   * @internal
   */
  init() {
    if (!isBrowser()) return;
    if (this.isInitialized) return;
    safeExecute(() => {
      injectGtagScript(this.config.measurementId, this.config);
      if (this.config.enableOffline) {
        this.offlineQueue = new OfflineQueue({
          reportFn: this.report
        });
        this.offlineQueue.startRetryTimer();
      }
      this.isInitialized = true;
      if (this.config.debug) {
        console.log("[Tracker] Initialized successfully");
      }
    }, void 0, "SmartTracker.init");
  }
};
_SmartTracker.instance = null;
var SmartTracker = _SmartTracker;

// src/collectors/ErrorCollector.ts
var ErrorCollector = class {
  /**
   * @param reportFn - 上报函数
   * @param config - 采集器配置
   */
  constructor(reportFn, config) {
    this.isRunning = false;
    /** 绑定的事件处理器，用于移除监听 */
    this.boundHandlers = null;
    this.reportFn = reportFn;
    this.config = {
      debug: config?.debug ?? false,
      captureResourceError: config?.captureResourceError ?? true,
      capturePromiseError: config?.capturePromiseError ?? true,
      ignoreErrors: config?.ignoreErrors ?? []
    };
  }
  /**
   * 启动错误采集
   */
  start() {
    if (!isBrowser() || this.isRunning) return;
    safeExecute(() => {
      this.boundHandlers = {
        onError: this.handleError.bind(this),
        onUnhandledRejection: this.handleRejection.bind(this)
      };
      window.addEventListener("error", this.boundHandlers.onError, true);
      if (this.config.capturePromiseError) {
        window.addEventListener("unhandledrejection", this.boundHandlers.onUnhandledRejection);
      }
      this.isRunning = true;
      if (this.config.debug) {
        console.log("[ErrorCollector] Started");
      }
    }, void 0, "ErrorCollector.start");
  }
  /**
   * 停止错误采集
   */
  stop() {
    if (!this.isRunning || !this.boundHandlers) return;
    safeExecute(() => {
      window.removeEventListener("error", this.boundHandlers.onError, true);
      if (this.config.capturePromiseError) {
        window.removeEventListener("unhandledrejection", this.boundHandlers.onUnhandledRejection);
      }
      this.boundHandlers = null;
      this.isRunning = false;
      if (this.config.debug) {
        console.log("[ErrorCollector] Stopped");
      }
    }, void 0, "ErrorCollector.stop");
  }
  /**
   * 手动捕获错误
   *
   * @param error - 错误对象
   * @param context - 附加上下文信息
   */
  captureError(error, context) {
    safeExecute(() => {
      const formatted = {
        type: "js_error",
        message: error.message,
        stack: error.stack
      };
      this.reportFormattedError(formatted, context);
    }, void 0, "ErrorCollector.captureError");
  }
  /**
   * 处理 JS 运行时错误
   * @internal
   */
  handleError(event) {
    safeExecute(() => {
      if (event.target !== window) {
        if (this.config.captureResourceError) {
          this.handleResourceError(event);
        }
        return;
      }
      const formatted = {
        type: "js_error",
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      };
      this.reportFormattedError(formatted);
    }, void 0, "ErrorCollector.handleError");
  }
  /**
   * 处理 Promise 未捕获异常
   * @internal
   */
  handleRejection(event) {
    safeExecute(() => {
      const reason = event.reason;
      let message;
      let stack;
      if (reason instanceof Error) {
        message = reason.message;
        stack = reason.stack;
      } else if (typeof reason === "string") {
        message = reason;
      } else {
        message = JSON.stringify(reason);
      }
      const formatted = {
        type: "promise_error",
        message,
        stack
      };
      this.reportFormattedError(formatted);
    }, void 0, "ErrorCollector.handleRejection");
  }
  /**
   * 处理资源加载错误
   * @internal
   */
  handleResourceError(event) {
    safeExecute(() => {
      const target = event.target;
      if (!target) return;
      const tagName = target.tagName?.toLowerCase();
      const resourceUrl = this.getResourceUrl(target);
      const resourceType = this.getResourceType(tagName);
      if (!resourceUrl || !resourceType) return;
      const formatted = {
        type: "resource_error",
        message: `Failed to load ${resourceType}: ${resourceUrl}`,
        resourceUrl,
        resourceType
      };
      this.reportFormattedError(formatted);
    }, void 0, "ErrorCollector.handleResourceError");
  }
  /**
   * 上报格式化后的错误
   * @internal
   */
  reportFormattedError(formatted, context) {
    if (this.shouldIgnore(formatted.message)) {
      return;
    }
    const params = {
      category: "error",
      error_type: formatted.type,
      error_message: formatted.message,
      error_filename: formatted.filename,
      error_lineno: formatted.lineno,
      error_colno: formatted.colno,
      error_stack: formatted.stack ? this.truncateStack(formatted.stack) : void 0,
      resource_url: formatted.resourceUrl,
      resource_type: formatted.resourceType,
      ...context
    };
    this.reportFn("error", params);
    if (this.config.debug) {
      console.log("[ErrorCollector] Error captured:", formatted);
    }
  }
  /**
   * 检查是否应该忽略该错误
   * @internal
   */
  shouldIgnore(message) {
    return this.config.ignoreErrors.some((pattern) => pattern.test(message));
  }
  /**
   * 获取资源 URL
   * @internal
   */
  getResourceUrl(element) {
    return element.getAttribute("src") || element.getAttribute("href") || element.getAttribute("data-src") || void 0;
  }
  /**
   * 获取资源类型
   * @internal
   */
  getResourceType(tagName) {
    const typeMap = {
      script: "script",
      link: "stylesheet",
      img: "image",
      audio: "audio",
      video: "video",
      source: "media"
    };
    return typeMap[tagName];
  }
  /**
   * 截断堆栈信息
   * @internal
   */
  truncateStack(stack) {
    const maxLength = 500;
    return stack.length > maxLength ? stack.substring(0, maxLength) + "..." : stack;
  }
};

// src/collectors/PerformanceCollector.ts
var PerformanceCollector = class {
  /**
   * @param reportFn - 上报函数
   * @param config - 采集器配置
   */
  constructor(reportFn, config) {
    this.isRunning = false;
    this.performanceObserver = null;
    this.reportedResources = /* @__PURE__ */ new Set();
    this.reportFn = reportFn;
    this.config = {
      debug: config?.debug ?? false,
      collectResourceTiming: config?.collectResourceTiming ?? true,
      resourceSampleRate: config?.resourceSampleRate ?? 0.1
    };
  }
  /**
   * 启动性能采集
   */
  start() {
    if (!isBrowser() || this.isRunning) return;
    safeExecute(() => {
      if (document.readyState === "complete") {
        this.collectPageTiming();
      } else {
        window.addEventListener("load", () => {
          setTimeout(() => this.collectPageTiming(), 0);
        });
      }
      this.initWebVitalsObserver();
      if (this.config.collectResourceTiming) {
        this.initResourceObserver();
      }
      this.isRunning = true;
      if (this.config.debug) {
        console.log("[PerformanceCollector] Started");
      }
    }, void 0, "PerformanceCollector.start");
  }
  /**
   * 停止性能采集
   */
  stop() {
    if (!this.isRunning) return;
    safeExecute(() => {
      if (this.performanceObserver) {
        this.performanceObserver.disconnect();
        this.performanceObserver = null;
      }
      this.reportedResources.clear();
      this.isRunning = false;
      if (this.config.debug) {
        console.log("[PerformanceCollector] Stopped");
      }
    }, void 0, "PerformanceCollector.stop");
  }
  /**
   * 获取当前性能指标
   */
  getMetrics() {
    const pageTiming = this.collectPageTimingSync();
    const webVitals = this.getWebVitalsSync();
    return { pageTiming, webVitals };
  }
  /**
   * 采集页面加载性能
   * @internal
   */
  collectPageTiming() {
    safeExecute(() => {
      const timing = this.getPageTiming();
      if (!timing) return;
      const params = {
        category: "performance",
        ...timing
      };
      this.reportFn("performance_page_load", params);
      if (this.config.debug) {
        console.log("[PerformanceCollector] Page timing:", timing);
      }
    }, void 0, "PerformanceCollector.collectPageTiming");
  }
  /**
   * 同步采集页面加载性能（不自动上报）
   * @internal
   */
  collectPageTimingSync() {
    return safeExecute(() => this.getPageTiming(), null, "collectPageTimingSync") ?? null;
  }
  /**
   * 获取页面加载性能数据
   * @internal
   */
  getPageTiming() {
    const perfData = performance.getEntriesByType("navigation")[0];
    if (!perfData) return null;
    const paintEntries = performance.getEntriesByType("paint");
    const fp = paintEntries.find((e) => e.name === "first-paint");
    const fcp = paintEntries.find((e) => e.name === "first-contentful-paint");
    return {
      dns: Math.round(perfData.domainLookupEnd - perfData.domainLookupStart),
      tcp: Math.round(perfData.connectEnd - perfData.connectStart),
      ssl: perfData.secureConnectionStart > 0 ? Math.round(perfData.connectEnd - perfData.secureConnectionStart) : 0,
      ttfb: Math.round(perfData.responseStart - perfData.requestStart),
      dom_parse: Math.round(perfData.domContentLoadedEventStart - perfData.responseEnd),
      dom_ready: Math.round(perfData.domContentLoadedEventStart - perfData.fetchStart),
      load: Math.round(perfData.loadEventEnd - perfData.fetchStart),
      fp: fp ? Math.round(fp.startTime) : null,
      fcp: fcp ? Math.round(fcp.startTime) : null
    };
  }
  /**
   * 初始化 Web Vitals 观察器
   * @internal
   */
  initWebVitalsObserver() {
    safeExecute(() => {
      if (!PerformanceObserver) return;
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          if (lastEntry) {
            this.reportWebVital("lcp", Math.round(lastEntry.startTime));
          }
        });
        lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
      } catch {
      }
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if ("processingStart" in entry) {
              const fid = entry.processingStart - entry.startTime;
              this.reportWebVital("fid", Math.round(fid));
            }
          });
        });
        fidObserver.observe({ type: "first-input", buffered: true });
      } catch {
      }
      try {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            const lsEntry = entry;
            if (!lsEntry.hadRecentInput && "value" in entry) {
              clsValue += lsEntry.value;
            }
          });
          this.reportWebVital("cls", Math.round(clsValue * 1e3) / 1e3);
        });
        clsObserver.observe({ type: "layout-shift", buffered: true });
      } catch {
      }
    }, void 0, "PerformanceCollector.initWebVitalsObserver");
  }
  /**
   * 获取 Web Vitals 同步数据
   * @internal
   */
  getWebVitalsSync() {
    const vitals = { lcp: null, fid: null, cls: null };
    safeExecute(() => {
      const lcpEntries = performance.getEntriesByType("largest-contentful-paint");
      if (lcpEntries.length > 0) {
        vitals.lcp = Math.round(lcpEntries[lcpEntries.length - 1].startTime);
      }
      const fidEntries = performance.getEntriesByType("first-input");
      if (fidEntries.length > 0) {
        const entry = fidEntries[0];
        vitals.fid = Math.round(entry.processingStart - entry.startTime);
      }
    }, void 0, "getWebVitalsSync");
    return vitals;
  }
  /**
   * 上报 Web Vital 指标
   * @internal
   */
  reportWebVital(name, value) {
    const params = {
      category: "performance",
      metric_name: name,
      metric_value: value
    };
    this.reportFn("performance_web_vital", params);
    if (this.config.debug) {
      console.log(`[PerformanceCollector] Web Vital ${name}:`, value);
    }
  }
  /**
   * 初始化资源加载观察器
   * @internal
   */
  initResourceObserver() {
    safeExecute(() => {
      if (!PerformanceObserver) return;
      this.performanceObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === "resource") {
            this.reportResource(entry);
          }
        });
      });
      this.performanceObserver.observe({ entryTypes: ["resource"] });
    }, void 0, "PerformanceCollector.initResourceObserver");
  }
  /**
   * 上报资源加载性能
   * @internal
   */
  reportResource(entry) {
    if (Math.random() > this.config.resourceSampleRate) return;
    if (this.reportedResources.has(entry.name)) return;
    this.reportedResources.add(entry.name);
    const params = {
      category: "performance",
      resource_name: this.truncateUrl(entry.name),
      resource_type: this.getResourceType(entry.initiatorType),
      resource_duration: Math.round(entry.duration),
      resource_size: Math.round(entry.transferSize || entry.encodedBodySize || 0)
    };
    this.reportFn("performance_resource", params);
  }
  /**
   * 获取资源类型
   * @internal
   */
  getResourceType(initiatorType) {
    const typeMap = {
      script: "script",
      link: "stylesheet",
      img: "image",
      css: "stylesheet",
      fetch: "api",
      xmlhttprequest: "api",
      other: "other"
    };
    return typeMap[initiatorType] || "other";
  }
  /**
   * 截断 URL
   * @internal
   */
  truncateUrl(url) {
    const maxLength = 200;
    return url.length > maxLength ? url.substring(0, maxLength) + "..." : url;
  }
};

// src/collectors/NetworkCollector.ts
var NetworkCollector = class {
  /**
   * @param reportFn - 上报函数
   * @param config - 采集器配置
   */
  constructor(reportFn, config) {
    this.isRunning = false;
    /** 保存的原始方法 */
    this.originalFetch = null;
    this.originalXHROpen = null;
    this.originalXHRSend = null;
    this.reportFn = reportFn;
    this.config = {
      debug: config?.debug ?? false,
      slowThreshold: config?.slowThreshold ?? 3e3,
      ignoreUrls: config?.ignoreUrls ?? [],
      reportSuccess: config?.reportSuccess ?? false,
      sampleRate: config?.sampleRate ?? 0.1
    };
  }
  /**
   * 启动网络采集
   */
  start() {
    if (!isBrowser() || this.isRunning) return;
    safeExecute(() => {
      this.interceptFetch();
      this.interceptXHR();
      this.isRunning = true;
      if (this.config.debug) {
        console.log("[NetworkCollector] Started");
      }
    }, void 0, "NetworkCollector.start");
  }
  /**
   * 停止网络采集
   */
  stop() {
    if (!this.isRunning) return;
    safeExecute(() => {
      if (this.originalFetch) {
        window.fetch = this.originalFetch;
      }
      if (this.originalXHROpen && this.originalXHRSend) {
        XMLHttpRequest.prototype.open = this.originalXHROpen;
        XMLHttpRequest.prototype.send = this.originalXHRSend;
      }
      this.originalFetch = null;
      this.originalXHROpen = null;
      this.originalXHRSend = null;
      this.isRunning = false;
      if (this.config.debug) {
        console.log("[NetworkCollector] Stopped");
      }
    }, void 0, "NetworkCollector.stop");
  }
  /**
   * 拦截 fetch API
   * @internal
   */
  interceptFetch() {
    this.originalFetch = window.fetch;
    const self = this;
    window.fetch = async function(input, init) {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : input.toString();
      const method = init?.method || "GET";
      const startTime = performance.now();
      try {
        const response = await self.originalFetch.apply(this, [input, init]);
        self.reportNetworkEvent({
          url,
          method,
          status: response.status,
          duration: Math.round(performance.now() - startTime),
          type: "fetch",
          isSuccess: response.ok
        });
        return response;
      } catch (error) {
        self.reportNetworkEvent({
          url,
          method,
          status: 0,
          duration: Math.round(performance.now() - startTime),
          type: "fetch",
          isSuccess: false,
          errorMessage: error.message
        });
        throw error;
      }
    };
  }
  /**
   * 拦截 XMLHttpRequest
   * @internal
   */
  interceptXHR() {
    const self = this;
    this.originalXHROpen = XMLHttpRequest.prototype.open;
    this.originalXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
      this.__trackerMeta = {
        method,
        url: url.toString(),
        startTime: 0
      };
      return self.originalXHROpen.apply(this, [method, url, ...args]);
    };
    XMLHttpRequest.prototype.send = function(body) {
      const meta = this.__trackerMeta;
      if (meta) {
        meta.startTime = performance.now();
      }
      this.addEventListener("load", function() {
        if (meta) {
          self.reportNetworkEvent({
            url: meta.url,
            method: meta.method,
            status: this.status,
            duration: Math.round(performance.now() - meta.startTime),
            type: "xhr",
            isSuccess: this.status >= 200 && this.status < 400
          });
        }
      });
      this.addEventListener("error", function() {
        if (meta) {
          self.reportNetworkEvent({
            url: meta.url,
            method: meta.method,
            status: 0,
            duration: Math.round(performance.now() - meta.startTime),
            type: "xhr",
            isSuccess: false,
            errorMessage: "Network error"
          });
        }
      });
      this.addEventListener("timeout", function() {
        if (meta) {
          self.reportNetworkEvent({
            url: meta.url,
            method: meta.method,
            status: 0,
            duration: Math.round(performance.now() - meta.startTime),
            type: "xhr",
            isSuccess: false,
            errorMessage: "Request timeout"
          });
        }
      });
      return self.originalXHRSend.apply(this, [body]);
    };
  }
  /**
   * 上报网络事件
   * @internal
   */
  reportNetworkEvent(data) {
    safeExecute(() => {
      if (this.config.ignoreUrls.length > 0 && shouldIgnoreUrl(data.url, this.config.ignoreUrls)) {
        return;
      }
      if (data.isSuccess && !this.config.reportSuccess && Math.random() > this.config.sampleRate) {
        return;
      }
      const isSlow = data.duration >= this.config.slowThreshold;
      const isError = !data.isSuccess || data.status >= 400;
      if (!isError && !isSlow && !this.config.reportSuccess) {
        return;
      }
      const eventName = isError ? "network_error" : isSlow ? "network_slow" : "network_request";
      const params = {
        category: "network",
        network_url: this.truncateUrl(data.url),
        network_method: data.method,
        network_status: data.status,
        network_duration: data.duration,
        network_type: data.type,
        network_is_slow: isSlow,
        network_is_error: isError
      };
      if (data.errorMessage) {
        params.network_error_message = data.errorMessage;
      }
      this.reportFn(eventName, params);
      if (this.config.debug) {
        console.log(`[NetworkCollector] ${eventName}:`, params);
      }
    }, void 0, "NetworkCollector.reportNetworkEvent");
  }
  /**
   * 截断 URL
   * @internal
   */
  truncateUrl(url) {
    const maxLength = 200;
    return url.length > maxLength ? url.substring(0, maxLength) + "..." : url;
  }
};

// src/collectors/InteractionCollector.ts
var InteractionCollector = class {
  /**
   * @param reportFn - 上报函数
   * @param config - 采集器配置
   */
  constructor(reportFn, config) {
    this.isRunning = false;
    /** 绑定的事件处理器 */
    this.boundHandlers = null;
    /** 滚动状态 */
    this.lastScrollTop = 0;
    this.reportedScrollDepths = /* @__PURE__ */ new Set();
    /** 曝光观察器 */
    this.intersectionObserver = null;
    this.reportFn = reportFn;
    this.config = {
      debug: config?.debug ?? false,
      trackClicks: config?.trackClicks ?? true,
      trackForms: config?.trackForms ?? true,
      trackScrollDepth: config?.trackScrollDepth ?? true,
      trackExposure: config?.trackExposure ?? false,
      exposureThreshold: config?.exposureThreshold ?? 0.5,
      scrollThresholds: config?.scrollThresholds ?? [25, 50, 75, 100],
      ignoreSelectors: config?.ignoreSelectors ?? []
    };
  }
  /**
   * 启动交互采集
   */
  start() {
    if (!isBrowser() || this.isRunning) return;
    safeExecute(() => {
      this.boundHandlers = {
        onClick: this.handleClick.bind(this),
        onScroll: throttle(this.handleScroll.bind(this), 200)
      };
      if (this.config.trackClicks) {
        document.addEventListener("click", this.boundHandlers.onClick, true);
      }
      if (this.config.trackScrollDepth) {
        window.addEventListener("scroll", this.boundHandlers.onScroll);
      }
      if (this.config.trackExposure) {
        this.initExposureObserver();
      }
      this.isRunning = true;
      if (this.config.debug) {
        console.log("[InteractionCollector] Started");
      }
    }, void 0, "InteractionCollector.start");
  }
  /**
   * 停止交互采集
   */
  stop() {
    if (!this.isRunning || !this.boundHandlers) return;
    safeExecute(() => {
      if (this.config.trackClicks) {
        document.removeEventListener("click", this.boundHandlers.onClick, true);
      }
      if (this.config.trackScrollDepth) {
        window.removeEventListener("scroll", this.boundHandlers.onScroll);
      }
      if (this.intersectionObserver) {
        this.intersectionObserver.disconnect();
        this.intersectionObserver = null;
      }
      this.boundHandlers = null;
      this.reportedScrollDepths.clear();
      this.isRunning = false;
      if (this.config.debug) {
        console.log("[InteractionCollector] Stopped");
      }
    }, void 0, "InteractionCollector.stop");
  }
  /**
   * 处理点击事件
   * @internal
   */
  handleClick(event) {
    safeExecute(() => {
      const target = event.target;
      if (!target) return;
      if (this.shouldIgnoreElement(target)) return;
      const trackElement = target.closest("[data-track-name]");
      const elementInfo = this.getElementInfo(trackElement || target);
      if (!trackElement && !this.isInterestingElement(target)) {
        return;
      }
      const params = {
        category: "interaction",
        interaction_type: "click",
        ...elementInfo
      };
      this.reportFn("interaction_click", params);
      if (this.config.debug) {
        console.log("[InteractionCollector] Click:", elementInfo);
      }
    }, void 0, "InteractionCollector.handleClick");
  }
  /**
   * 处理滚动事件
   * @internal
   */
  handleScroll() {
    safeExecute(() => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;
      const maxScroll = scrollHeight - clientHeight;
      const scrollPercent = maxScroll > 0 ? Math.round(scrollTop / maxScroll * 100) : 0;
      const direction = scrollTop > this.lastScrollTop ? "down" : "up";
      this.lastScrollTop = scrollTop;
      for (const threshold of this.config.scrollThresholds) {
        if (scrollPercent >= threshold && !this.reportedScrollDepths.has(threshold)) {
          this.reportedScrollDepths.add(threshold);
          const params = {
            category: "interaction",
            interaction_type: "scroll",
            scroll_depth: threshold,
            scroll_direction: direction
          };
          this.reportFn("interaction_scroll", params);
          if (this.config.debug) {
            console.log(`[InteractionCollector] Scroll: ${threshold}%`);
          }
        }
      }
    }, void 0, "InteractionCollector.handleScroll");
  }
  /**
   * 初始化曝光观察器
   * @internal
   */
  initExposureObserver() {
    safeExecute(() => {
      if (!IntersectionObserver) return;
      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && entry.intersectionRatio >= this.config.exposureThreshold) {
              const element = entry.target;
              const elementInfo = this.getElementInfo(element);
              const params = {
                category: "interaction",
                interaction_type: "exposure",
                exposure_ratio: Math.round(entry.intersectionRatio * 100),
                ...elementInfo
              };
              this.reportFn("interaction_exposure", params);
              if (this.config.debug) {
                console.log("[InteractionCollector] Exposure:", elementInfo);
              }
              this.intersectionObserver.unobserve(element);
            }
          });
        },
        { threshold: [this.config.exposureThreshold] }
      );
      const elements = document.querySelectorAll("[data-track-exposure]");
      elements.forEach((el) => this.intersectionObserver.observe(el));
    }, void 0, "InteractionCollector.initExposureObserver");
  }
  /**
   * 获取元素信息
   * @internal
   */
  getElementInfo(element) {
    const info = {
      tagName: element.tagName.toLowerCase()
    };
    const id = element.getAttribute("id");
    if (id) info.id = id;
    const className = element.getAttribute("class");
    if (className) info.className = className.split(" ").slice(0, 3).join(" ");
    const trackName = element.getAttribute("data-track-name");
    if (trackName) info.trackName = trackName;
    const text = element.textContent?.trim();
    if (text) {
      info.text = text.length > 50 ? text.substring(0, 50) + "..." : text;
    }
    return info;
  }
  /**
   * 检查是否应该忽略元素
   * @internal
   */
  shouldIgnoreElement(element) {
    if (element.hasAttribute("data-track-ignore")) return true;
    for (const selector of this.config.ignoreSelectors) {
      if (element.matches(selector)) return true;
    }
    return false;
  }
  /**
   * 检查是否是值得追踪的元素
   * @internal
   */
  isInterestingElement(element) {
    const tagName = element.tagName.toLowerCase();
    const interestingTags = ["button", "a", "input", "select", "textarea"];
    if (interestingTags.includes(tagName)) return true;
    if (element.hasAttribute("onclick")) return true;
    if (element.getAttribute("role") === "button") return true;
    return false;
  }
};

export { ErrorCollector, InteractionCollector, NetworkCollector, PerformanceCollector, SmartTracker, injectGtagScript, sendToGtag };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map