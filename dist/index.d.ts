/**
 * @packageDocumentation
 * Smart Tracker SDK 类型定义
 */
/**
 * 追踪器配置
 */
interface TrackerConfig {
    /** GA4 Measurement ID，必填 */
    measurementId: string;
    /** 是否启用性能监控，默认 true */
    enablePerformance?: boolean;
    /** 是否启用错误监控，默认 true */
    enableError?: boolean;
    /** 是否启用网络监控，默认 true */
    enableNetwork?: boolean;
    /** 是否启用交互追踪，默认 false */
    enableInteraction?: boolean;
    /** 是否启用离线缓存，默认 false */
    enableOffline?: boolean;
    /** 调试模式，控制台输出日志，默认 false */
    debug?: boolean;
}
/**
 * 用户属性
 */
interface UserTraits {
    /** 用户角色 */
    role?: string;
    /** 用户等级/计划 */
    plan?: string;
    /** 公司名称 */
    company?: string;
    /** 其他自定义属性 */
    [key: string]: string | number | boolean | undefined;
}
/**
 * 事件参数
 *
 * 索引签名类型说明：
 * - string: 字符串类型参数（如 label、category）
 * - number: 数值类型参数（如 value、duration）
 * - boolean: 布尔类型参数（如 non_interaction）
 * - undefined: 可选参数未定义时的类型
 * - null: 显式设置为 null 的参数
 * - object: 嵌套对象参数（如 item_list、items 数组等）
 */
interface EventParams {
    /** 事件类别 */
    category?: string;
    /** 事件标签 */
    label?: string;
    /** 事件值 */
    value?: number;
    /** 是否非交互事件 */
    non_interaction?: boolean;
    /** 其他自定义参数 */
    [key: string]: string | number | boolean | undefined | null | object;
}
type ReportParams = EventParams;
/**
 * 采集器接口
 */
interface Collector {
    /** 启动采集 */
    start(): void;
    /** 停止采集 */
    stop(): void;
}
/**
 * 上报函数类型
 */
type ReportFunction = (eventName: string, params: EventParams) => void;
/**
 * 错误采集器配置
 */
interface ErrorCollectorConfig {
    /** 调试模式 */
    debug?: boolean;
    /** 是否捕获资源加载错误，默认 true */
    captureResourceError?: boolean;
    /** 是否捕获 Promise 错误，默认 true */
    capturePromiseError?: boolean;
    /** 忽略的错误类型（正则匹配错误消息） */
    ignoreErrors?: RegExp[];
}
/**
 * 性能采集器配置
 */
interface PerformanceCollectorConfig {
    /** 调试模式 */
    debug?: boolean;
    /** 是否采集资源加载性能，默认 true */
    collectResourceTiming?: boolean;
    /** 资源采样率 (0-1)，默认 0.1 */
    resourceSampleRate?: number;
}
/**
 * 网络采集器配置
 */
interface NetworkCollectorConfig {
    /** 调试模式 */
    debug?: boolean;
    /** 慢请求阈值（毫秒），默认 3000 */
    slowThreshold?: number;
    /** 忽略的 URL 正则列表 */
    ignoreUrls?: RegExp[];
    /** 是否上报成功请求，默认 false */
    reportSuccess?: boolean;
    /** 请求采样率 (0-1)，默认 0.1 */
    sampleRate?: number;
}
/**
 * 交互采集器配置
 */
interface InteractionCollectorConfig {
    /** 调试模式 */
    debug?: boolean;
    /** 是否追踪点击，默认 true */
    trackClicks?: boolean;
    /** 是否追踪表单提交，默认 true */
    trackForms?: boolean;
    /** 是否追踪滚动深度，默认 true */
    trackScrollDepth?: boolean;
    /** 是否追踪元素曝光，默认 false */
    trackExposure?: boolean;
    /** 曝光阈值，默认 0.5 */
    exposureThreshold?: number;
    /** 滚动深度阈值，默认 [25, 50, 75, 100] */
    scrollThresholds?: number[];
    /** 忽略的元素选择器 */
    ignoreSelectors?: string[];
}
/**
 * 离线队列配置
 */
interface OfflineQueueConfig {
    /** 最大缓存数量，默认 100 */
    maxItems?: number;
    /** 重试间隔（毫秒），默认 5000 */
    retryInterval?: number;
    /** 最大重试次数，默认 3 */
    maxRetries?: number;
    /** 上报函数 */
    reportFn: ReportFunction;
}
/**
 * 队列中的事件
 */
interface QueuedEvent {
    /** 事件 ID */
    id: string;
    /** 事件名称 */
    name: string;
    /** 事件参数 */
    params: EventParams;
    /** 入队时间戳 */
    timestamp: number;
    /** 已重试次数 */
    retries: number;
}
/**
 * Window 接口扩展
 *
 * 注意：dataLayer 和 gtag 使用 any 类型是因为这些是第三方库（Google Analytics / Google Tag Manager）
 * 提供的接口，其类型定义由 Google 官方维护。我们无法完全控制其类型，因此使用 any 来确保兼容性。
 *
 * 参考：https://developers.google.com/analytics/devguides/collection/ga4
 */
declare global {
    interface Window {
        /** Google Tag Manager 数据层 */
        dataLayer: any[];
        /** Google Tag 函数 */
        gtag: (...args: any[]) => void;
        /** 自动初始化配置（CDN 使用） */
        __TRACKER_CONFIG__?: TrackerConfig;
    }
}

/**
 * 智能埋点追踪器
 *
 * 单例模式实现，提供统一的事件采集和上报能力。
 * 支持性能监控、错误监控、网络监控、交互追踪。
 *
 * @example
 * ```ts
 * // 初始化
 * SmartTracker.init({
 *   measurementId: 'G-XXXXXXXXXX',
 *   enablePerformance: true,
 *   enableError: true,
 *   enableOffline: true
 * });
 *
 * // 用户追踪
 * SmartTracker.getInstance()?.setUser('user-123', { role: 'admin', plan: 'pro' });
 *
 * // 手动埋点
 * SmartTracker.getInstance()?.trackEvent('button_click', { category: 'ui', label: 'submit' });
 *
 * // 销毁
 * SmartTracker.getInstance()?.destroy();
 * ```
 */

/**
 * 智能追踪器主类
 */
declare class SmartTracker {
    private static instance;
    private config;
    private userTracker;
    private offlineQueue;
    private collectors;
    private isInitialized;
    private isDestroyed;
    /**
     * 私有构造函数，使用 init() 方法初始化
     */
    private constructor();
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
    static init(config: TrackerConfig): SmartTracker;
    /**
     * 获取单例实例
     *
     * @returns SmartTracker 实例，未初始化时返回 null
     */
    static getInstance(): SmartTracker | null;
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
    setUser(userId: string, traits?: UserTraits): void;
    /**
     * 清除用户信息
     *
     * 登出时调用。
     */
    clearUser(): void;
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
    trackEvent(name: string, params?: EventParams): void;
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
    trackPageView(path?: string, title?: string): void;
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
    destroy(): void;
    /**
     * 内部上报函数
     * @internal
     */
    private report;
    /**
     * 初始化内部逻辑
     * @internal
     */
    private init;
}

/**
 * 错误采集器
 *
 * 自动采集以下类型的错误：
 * - JS 运行时错误 (window.onerror)
 * - Promise 未捕获异常 (unhandledrejection)
 * - 资源加载错误 (script, link, img, audio, video)
 *
 * @example
 * ```ts
 * const collector = new ErrorCollector(reportFn, { debug: true });
 * collector.start();
 *
 * // 手动捕获错误
 * collector.captureError(new Error('manual error'), { context: 'checkout' });
 *
 * // 停止采集
 * collector.stop();
 * ```
 */

/**
 * 错误采集器
 */
declare class ErrorCollector {
    private reportFn;
    private config;
    private isRunning;
    /** 绑定的事件处理器，用于移除监听 */
    private boundHandlers;
    /**
     * @param reportFn - 上报函数
     * @param config - 采集器配置
     */
    constructor(reportFn: ReportFunction, config?: ErrorCollectorConfig);
    /**
     * 启动错误采集
     */
    start(): void;
    /**
     * 停止错误采集
     */
    stop(): void;
    /**
     * 手动捕获错误
     *
     * @param error - 错误对象
     * @param context - 附加上下文信息
     */
    captureError(error: Error, context?: Record<string, any>): void;
    /**
     * 处理 JS 运行时错误
     * @internal
     */
    private handleError;
    /**
     * 处理 Promise 未捕获异常
     * @internal
     */
    private handleRejection;
    /**
     * 处理资源加载错误
     * @internal
     */
    private handleResourceError;
    /**
     * 上报格式化后的错误
     * @internal
     */
    private reportFormattedError;
    /**
     * 检查是否应该忽略该错误
     * @internal
     */
    private shouldIgnore;
    /**
     * 获取资源 URL
     * @internal
     */
    private getResourceUrl;
    /**
     * 获取资源类型
     * @internal
     */
    private getResourceType;
    /**
     * 截断堆栈信息
     * @internal
     */
    private truncateStack;
}

/**
 * 性能采集器
 *
 * 自动采集页面性能指标：
 * - 页面加载性能 (DNS, TCP, SSL, TTFB, DOM, Load)
 * - Web Vitals 核心指标 (LCP, FID, CLS)
 * - 资源加载性能
 *
 * @example
 * ```ts
 * const collector = new PerformanceCollector(reportFn, { debug: true });
 * collector.start();
 *
 * // 获取当前性能指标
 * const metrics = collector.getMetrics();
 *
 * // 停止采集
 * collector.stop();
 * ```
 */

/** 页面加载性能数据 */
interface PageTiming {
    dns: number;
    tcp: number;
    ssl: number;
    ttfb: number;
    dom_parse: number;
    dom_ready: number;
    load: number;
    fp: number | null;
    fcp: number | null;
}
/** Web Vitals 数据 */
interface WebVitals {
    lcp: number | null;
    fid: number | null;
    cls: number | null;
}
/**
 * 性能采集器
 */
declare class PerformanceCollector {
    private reportFn;
    private config;
    private isRunning;
    private performanceObserver;
    private reportedResources;
    /**
     * @param reportFn - 上报函数
     * @param config - 采集器配置
     */
    constructor(reportFn: ReportFunction, config?: PerformanceCollectorConfig);
    /**
     * 启动性能采集
     */
    start(): void;
    /**
     * 停止性能采集
     */
    stop(): void;
    /**
     * 获取当前性能指标
     */
    getMetrics(): {
        pageTiming: PageTiming | null;
        webVitals: WebVitals;
    };
    /**
     * 采集页面加载性能
     * @internal
     */
    private collectPageTiming;
    /**
     * 同步采集页面加载性能（不自动上报）
     * @internal
     */
    private collectPageTimingSync;
    /**
     * 获取页面加载性能数据
     * @internal
     */
    private getPageTiming;
    /**
     * 初始化 Web Vitals 观察器
     * @internal
     */
    private initWebVitalsObserver;
    /**
     * 获取 Web Vitals 同步数据
     * @internal
     */
    private getWebVitalsSync;
    /**
     * 上报 Web Vital 指标
     * @internal
     */
    private reportWebVital;
    /**
     * 初始化资源加载观察器
     * @internal
     */
    private initResourceObserver;
    /**
     * 上报资源加载性能
     * @internal
     */
    private reportResource;
    /**
     * 获取资源类型
     * @internal
     */
    private getResourceType;
    /**
     * 截断 URL
     * @internal
     */
    private truncateUrl;
}

/**
 * 网络采集器
 *
 * 拦截并监控所有网络请求：
 * - fetch API
 * - XMLHttpRequest
 *
 * 自动上报请求错误、慢请求。
 *
 * @example
 * ```ts
 * const collector = new NetworkCollector(reportFn, {
 *   slowThreshold: 3000,
 *   ignoreUrls: [/\/api\/health/]
 * });
 * collector.start();
 * ```
 */

/**
 * 网络采集器
 */
declare class NetworkCollector {
    private reportFn;
    private config;
    private isRunning;
    /** 保存的原始方法 */
    private originalFetch;
    private originalXHROpen;
    private originalXHRSend;
    /**
     * @param reportFn - 上报函数
     * @param config - 采集器配置
     */
    constructor(reportFn: ReportFunction, config?: NetworkCollectorConfig);
    /**
     * 启动网络采集
     */
    start(): void;
    /**
     * 停止网络采集
     */
    stop(): void;
    /**
     * 拦截 fetch API
     * @internal
     */
    private interceptFetch;
    /**
     * 拦截 XMLHttpRequest
     * @internal
     */
    private interceptXHR;
    /**
     * 上报网络事件
     * @internal
     */
    private reportNetworkEvent;
    /**
     * 截断 URL
     * @internal
     */
    private truncateUrl;
}

/**
 * 交互采集器
 *
 * 自动追踪用户交互行为：
 * - 点击事件
 * - 滚动深度
 * - 元素曝光
 *
 * @example
 * ```ts
 * const collector = new InteractionCollector(reportFn, {
 *   trackClicks: true,
 *   trackScrollDepth: true,
 *   trackExposure: false
 * });
 * collector.start();
 * ```
 */

/**
 * 交互采集器
 */
declare class InteractionCollector {
    private reportFn;
    private config;
    private isRunning;
    /** 绑定的事件处理器 */
    private boundHandlers;
    /** 滚动状态 */
    private lastScrollTop;
    private reportedScrollDepths;
    /** 曝光观察器 */
    private intersectionObserver;
    /**
     * @param reportFn - 上报函数
     * @param config - 采集器配置
     */
    constructor(reportFn: ReportFunction, config?: InteractionCollectorConfig);
    /**
     * 启动交互采集
     */
    start(): void;
    /**
     * 停止交互采集
     */
    stop(): void;
    /**
     * 处理点击事件
     * @internal
     */
    private handleClick;
    /**
     * 处理滚动事件
     * @internal
     */
    private handleScroll;
    /**
     * 初始化曝光观察器
     * @internal
     */
    private initExposureObserver;
    /**
     * 获取元素信息
     * @internal
     */
    private getElementInfo;
    /**
     * 检查是否应该忽略元素
     * @internal
     */
    private shouldIgnoreElement;
    /**
     * 检查是否是值得追踪的元素
     * @internal
     */
    private isInterestingElement;
}

/**
 * @packageDocumentation
 * Google Analytics 4 注入和上报模块
 */

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
declare function injectGtagScript(measurementId: string, config?: TrackerConfig): void;
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
declare function sendToGtag(eventName: string, params: EventParams, config?: TrackerConfig): void;

export { type Collector, ErrorCollector, type ErrorCollectorConfig, type EventParams, InteractionCollector, type InteractionCollectorConfig, NetworkCollector, type NetworkCollectorConfig, type OfflineQueueConfig, PerformanceCollector, type PerformanceCollectorConfig, type QueuedEvent, type ReportFunction, type ReportParams, SmartTracker, type TrackerConfig, type UserTraits, injectGtagScript, sendToGtag };
