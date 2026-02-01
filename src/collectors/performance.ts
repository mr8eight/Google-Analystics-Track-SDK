import { onCLS, onFCP, onFID, onLCP, onINP, Metric } from 'web-vitals';
import { ReportFunction } from '../types';

export function initPerformance(report: ReportFunction) {
  const handleMetric = (metric: Metric) => {
    // CLS * 1000 转换为整数
    const value = metric.name === 'CLS' ? Math.round(metric.value * 1000) : Math.round(metric.value);
    report(metric.name, {
      category: 'Web Vitals',
      label: metric.id,
      value: value,
      metric_rating: metric.rating
    });
  };
  onCLS(handleMetric);
  onFCP(handleMetric);
  onFID(handleMetric);
  onLCP(handleMetric);
  onINP(handleMetric);
}