import { ReportParams, TrackerConfig } from './types';

export function injectGtagScript(measurementId: string) {
  if (typeof window === 'undefined') return; // SSR 保护
  if (document.getElementById('gtag-script')) return;

  const script = document.createElement('script');
  script.id = 'gtag-script';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', measurementId, { send_page_view: true });
}

export function sendToGtag(eventName: string, params: ReportParams, config: TrackerConfig) {
  if (typeof window === 'undefined') return;

  const { category, label, value, non_interaction = true, ...rest } = params;
  const payload = {
    event_category: category,
    event_label: label,
    value: value,
    non_interaction,
    ...rest
  };

  if (config.debug) {
    console.log(`%c[Tracker] ${eventName}`, 'color: #2E7D32; font-weight: bold', payload);
  }

  if (window.gtag) {
    window.gtag('event', eventName, payload);
  }
}