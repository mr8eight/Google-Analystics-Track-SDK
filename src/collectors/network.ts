import { ReportFunction } from '../types';

export function initNetwork(report: ReportFunction) {
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = args[0] as string;
    const startTime = performance.now();
    try {
      const response = await originalFetch.apply(this, args);
      if (!response.ok) {
        report('api_error', {
          category: 'API',
          label: url,
          value: response.status,
          duration: Math.round(performance.now() - startTime)
        });
      }
      return response;
    } catch (error: any) {
      report('api_error', {
        category: 'API',
        label: url,
        value: 0,
        error_msg: error.message
      });
      throw error;
    }
  };
}