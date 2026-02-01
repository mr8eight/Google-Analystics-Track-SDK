// packages/tracker/src/collectors/interaction.ts
import { ReportFunction, ReportParams } from '../types';

/**
 * 逻辑封装：处理按钮点击
 * 将业务语义 (Button Name) 转换为 GA4 语义 (Event Category/Label)
 */
export function handleTrackClick(
  report: ReportFunction, 
  buttonName: string, 
  moduleName: string = 'global', 
  extra: Record<string, any> = {}
) {
  report('click', {
    category: 'Interaction',
    label: `${moduleName}:${buttonName}`, // 标准化 Label 格式
    value: 1,
    non_interaction: false, // 标记为主动交互
    // 自定义维度数据
    module_name: moduleName,
    button_name: buttonName,
    ...extra
  });
}

/**
 * 逻辑封装：处理通用业务事件
 */
export function handleTrackEvent(
  report: ReportFunction,
  eventName: string,
  params: Omit<ReportParams, 'non_interaction'> = { category: 'General' }
) {
  report(eventName, {
    ...params,
    non_interaction: false // 标记为主动交互
  } as ReportParams );
}

/**
 * 逻辑封装：处理 PV (虽然 GA4 自动采集，但 SPA 有时需要手动修正)
 */
export function handleTrackPageView(
  report: ReportFunction,
  pagePath: string,
  pageTitle?: string
) {
  report('page_view', {
    category: 'Page',
    page_path: pagePath,
    page_title: pageTitle,
    non_interaction: true // PV 不算交互
  });
}