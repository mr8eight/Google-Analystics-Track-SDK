export interface TrackerConfig {
  measurementId: string;
  enablePerformance?: boolean;
  enableError?: boolean;
  debug?: boolean;
}

export interface ReportParams {
  category: string;
  label?: string;
  value?: number;
  non_interaction?: boolean;
  [key: string]: any;
}

// 定义上报函数的类型签名
export type ReportFunction = (eventName: string, params: ReportParams) => void;

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}