// packages/tracker/src/core.ts
import { TrackerConfig, ReportParams } from './types';
import { injectGtagScript, sendToGtag } from './reporter';

// 引入采集器
import { initPerformance } from './collectors/performance';
import { initError } from './collectors/error';
import { initNetwork } from './collectors/network';
// 引入新的交互逻辑处理器
import { handleTrackClick, handleTrackEvent, handleTrackPageView } from './collectors/interactions';

export class SmartTracker {
  private static instance: SmartTracker;
  private config: TrackerConfig;
  private isInitialized = false;

  private constructor(config: TrackerConfig) {
    this.config = {
      enablePerformance: true,
      enableError: true,
      debug: false,
      ...config
    };
    this.init();
  }

  public static getInstance(config?: TrackerConfig): SmartTracker {
    if (!SmartTracker.instance) {
      if (!config) throw new Error("Tracker needs config for first init.");
      SmartTracker.instance = new SmartTracker(config);
    }
    return SmartTracker.instance;
  }

  /**
   * 手动上报点击
   */
  public trackClick(buttonName: string, moduleName?: string, extra?: Record<string, any>) {
    handleTrackClick(this.report, buttonName, moduleName, extra);
  }

  /**
   * 手动上报自定义事件
   */
  public trackEvent(eventName: string, params?: Omit<ReportParams, 'non_interaction'>) {
    handleTrackEvent(this.report, eventName, params);
  }

  /**
   * 手动上报 PV
   */
  public trackPageView(path: string, title?: string) {
    handleTrackPageView(this.report, path, title);
  }

  // ============================================
  // Internal Logic
  // ============================================

  // 这里的箭头函数是为了绑定 this，同时符合 ReportFunction 签名
  private report = (eventName: string, params: ReportParams) => {
    sendToGtag(eventName, params, this.config);
  };

  private init() {
    // SSR Check
    if (typeof window === 'undefined') return;
    if (this.isInitialized) return;

    injectGtagScript(this.config.measurementId);

    // 初始化被动采集器
    if (this.config.enablePerformance) {
      initPerformance(this.report);
    }

    if (this.config.enableError) {
      initError(this.report);
      initNetwork(this.report);
    }

    this.isInitialized = true;
  }
}