import { ReportFunction } from '../types';

export function initError(report: ReportFunction) {
  window.addEventListener('error', (event) => {
    const target = event.target as HTMLElement;
    if (target && (target instanceof HTMLImageElement || target instanceof HTMLScriptElement)) {
      report('resource_error', {
        category: 'Error',
        label: target.tagName,
        error_url: (target as any).src || (target as any).href
      });
    } else {
      report('exception', {
        category: 'Error',
        label: `${event.message} at ${event.filename}:${event.lineno}`,
        fatal: false
      });
    }
  }, true); // capture: true

  window.addEventListener('unhandledrejection', (event) => {
    report('exception', {
      category: 'Error',
      label: `Promise: ${event.reason}`,
      fatal: false
    });
  });
}