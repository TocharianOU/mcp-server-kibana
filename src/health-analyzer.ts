/**
 * Dashboard 健康度分析器
 * 用于检测 Dashboard 的潜在问题（断裂引用、性能问题等）
 */

import type { KibanaClient } from "./types";

export interface HealthIssue {
  severity: 'info' | 'warning' | 'error' | 'critical';
  category: 'broken_reference' | 'performance' | 'configuration' | 'data_quality';
  message: string;
  details?: any;
  suggestion?: string;
}

export interface PanelHealth {
  panel_id: string;
  panel_type: string;
  title?: string;
  issues: HealthIssue[];
  status: 'healthy' | 'warning' | 'unhealthy';
}

export interface DashboardHealth {
  id: string;
  title: string;
  overall_status: 'healthy' | 'warning' | 'unhealthy';
  overall_score: number; // 0-100
  panel_count: number;
  panels: PanelHealth[];
  global_issues: HealthIssue[];
  summary: {
    healthy_panels: number;
    warning_panels: number;
    unhealthy_panels: number;
    total_issues: number;
  };
}

export interface BatchHealthReport {
  dashboards: DashboardHealth[];
  summary: {
    total_dashboards: number;
    healthy: number;
    warning: number;
    unhealthy: number;
    critical_issues: number;
  };
}

/**
 * 分析单个 Dashboard 的健康度
 */
export async function analyzeDashboardHealth(
  kibanaClient: KibanaClient,
  dashboardId: string,
  space?: string,
  checkESIndices: boolean = false
): Promise<DashboardHealth> {
  try {
    // 获取 Dashboard 详情
    const dashboard = await kibanaClient.get(`/api/saved_objects/dashboard/${dashboardId}`, { space });
    const title = dashboard.attributes?.title || dashboardId;
    const panelsJSON = dashboard.attributes?.panelsJSON;
    
    if (!panelsJSON) {
      return {
        id: dashboardId,
        title,
        overall_status: 'unhealthy',
        overall_score: 0,
        panel_count: 0,
        panels: [],
        global_issues: [{
          severity: 'error',
          category: 'configuration',
          message: 'Dashboard 没有配置任何面板',
          suggestion: '添加至少一个可视化面板'
        }],
        summary: {
          healthy_panels: 0,
          warning_panels: 0,
          unhealthy_panels: 0,
          total_issues: 1
        }
      };
    }

    const panels = JSON.parse(panelsJSON);
    const references = dashboard.references || [];
    const panelHealths: PanelHealth[] = [];
    const globalIssues: HealthIssue[] = [];

    // 检查每个 Panel
    for (const panel of panels) {
      const panelIssues: HealthIssue[] = [];
      
      // 1. 检查 Panel 引用是否存在
      const panelRefId = panel.panelRefName || panel.id;
      const reference = references.find((ref: any) => ref.name === panelRefId);
      
      if (!reference) {
        panelIssues.push({
          severity: 'error',
          category: 'broken_reference',
          message: `Panel 缺少引用定义`,
          details: { panelId: panel.id },
          suggestion: '该 Panel 可能已被删除，建议从 Dashboard 中移除此 Panel'
        });
      } else {
        // 2. 检查引用的对象是否存在
        try {
          await kibanaClient.get(`/api/saved_objects/${reference.type}/${reference.id}`, { space });
        } catch (error: any) {
          if (error.response?.status === 404) {
            panelIssues.push({
              severity: 'critical',
              category: 'broken_reference',
              message: `引用的 ${reference.type} 对象不存在`,
              details: { referenceId: reference.id, referenceType: reference.type },
              suggestion: `恢复被删除的对象或从 Dashboard 中移除此 Panel`
            });
          }
        }
      }

      // 3. 性能检查（Panel 尺寸）
      const gridData = panel.gridData || {};
      const panelArea = (gridData.w || 0) * (gridData.h || 0);
      if (panelArea > 48) {
        panelIssues.push({
          severity: 'warning',
          category: 'performance',
          message: 'Panel 尺寸过大可能影响性能',
          details: { width: gridData.w, height: gridData.h },
          suggestion: '考虑拆分为多个小 Panel'
        });
      }

      // 4. 检查 Panel 类型
      const panelType = panel.type;
      if (!panelType) {
        panelIssues.push({
          severity: 'error',
          category: 'configuration',
          message: 'Panel 缺少类型定义',
          suggestion: '重新配置 Panel'
        });
      }

      const panelStatus = panelIssues.some(i => i.severity === 'error' || i.severity === 'critical') 
        ? 'unhealthy' 
        : panelIssues.length > 0 
          ? 'warning' 
          : 'healthy';

      panelHealths.push({
        panel_id: panel.id,
        panel_type: panelType || 'unknown',
        title: panel.title,
        issues: panelIssues,
        status: panelStatus
      });
    }

    // 全局检查
    
    // 1. 检查 Dashboard 是否过于复杂
    if (panels.length > 20) {
      globalIssues.push({
        severity: 'warning',
        category: 'performance',
        message: `Dashboard 包含 ${panels.length} 个 Panel，可能导致加载缓慢`,
        suggestion: '考虑拆分为多个主题 Dashboard'
      });
    }

    // 2. 检查索引模式引用
    if (checkESIndices) {
      const indexPatternRefs = references.filter((ref: any) => ref.type === 'index-pattern');
      for (const indexPatternRef of indexPatternRefs) {
        try {
          const indexPattern = await kibanaClient.get(
            `/api/saved_objects/index-pattern/${indexPatternRef.id}`,
            { space }
          );
          
          // 这里可以进一步调用 ES API 检查索引是否存在
          // 由于需要 ES Client，暂时跳过
          
        } catch (error: any) {
          if (error.response?.status === 404) {
            globalIssues.push({
              severity: 'critical',
              category: 'broken_reference',
              message: `引用的索引模式不存在: ${indexPatternRef.id}`,
              suggestion: '重新创建索引模式或更新 Dashboard 引用'
            });
          }
        }
      }
    }

    // 计算总体健康度
    const healthyCount = panelHealths.filter(p => p.status === 'healthy').length;
    const warningCount = panelHealths.filter(p => p.status === 'warning').length;
    const unhealthyCount = panelHealths.filter(p => p.status === 'unhealthy').length;
    const totalIssues = panelHealths.reduce((sum, p) => sum + p.issues.length, 0) + globalIssues.length;

    // 健康评分算法
    const healthScore = Math.max(0, Math.min(100, 
      100 - (unhealthyCount * 20) - (warningCount * 5) - (globalIssues.length * 10)
    ));

    let overallStatus: DashboardHealth['overall_status'] = 'healthy';
    if (unhealthyCount > 0 || globalIssues.some(i => i.severity === 'critical')) {
      overallStatus = 'unhealthy';
    } else if (warningCount > 0 || globalIssues.length > 0) {
      overallStatus = 'warning';
    }

    return {
      id: dashboardId,
      title,
      overall_status: overallStatus,
      overall_score: healthScore,
      panel_count: panels.length,
      panels: panelHealths,
      global_issues: globalIssues,
      summary: {
        healthy_panels: healthyCount,
        warning_panels: warningCount,
        unhealthy_panels: unhealthyCount,
        total_issues: totalIssues
      }
    };
  } catch (error) {
    throw new Error(`Health analysis failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 批量分析多个 Dashboard 的健康度
 */
export async function batchAnalyzeDashboards(
  kibanaClient: KibanaClient,
  space?: string,
  maxDashboards: number = 50
): Promise<BatchHealthReport> {
  try {
    // 搜索所有 Dashboard
    const searchResult = await kibanaClient.post(
      '/api/saved_objects/_find',
      {
        type: 'dashboard',
        perPage: maxDashboards,
        fields: ['title']
      },
      { space }
    );

    const dashboards = searchResult.saved_objects || [];
    const healthReports: DashboardHealth[] = [];

    for (const dashboard of dashboards) {
      try {
        const health = await analyzeDashboardHealth(kibanaClient, dashboard.id, space, false);
        healthReports.push(health);
      } catch (error) {
        console.error(`Failed to analyze dashboard ${dashboard.id}:`, error);
        // 继续分析其他 Dashboard
      }
    }

    const summary = {
      total_dashboards: healthReports.length,
      healthy: healthReports.filter(h => h.overall_status === 'healthy').length,
      warning: healthReports.filter(h => h.overall_status === 'warning').length,
      unhealthy: healthReports.filter(h => h.overall_status === 'unhealthy').length,
      critical_issues: healthReports.reduce((sum, h) => 
        sum + h.global_issues.filter(i => i.severity === 'critical').length +
        h.panels.reduce((pSum, p) => pSum + p.issues.filter(i => i.severity === 'critical').length, 0)
      , 0)
    };

    return {
      dashboards: healthReports,
      summary
    };
  } catch (error) {
    throw new Error(`Batch health analysis failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 格式化健康度报告为 Markdown
 */
export function formatHealthReportToMarkdown(health: DashboardHealth): string {
  const statusEmoji = {
    'healthy': '✅',
    'warning': '⚠️',
    'unhealthy': '🔴'
  };

  let md = `# Dashboard 健康度报告\n\n`;
  md += `## ${statusEmoji[health.overall_status]} 总体状态: ${health.overall_status.toUpperCase()}\n`;
  md += `- **Dashboard**: ${health.title}\n`;
  md += `- **健康评分**: ${health.overall_score}/100\n`;
  md += `- **Panel 总数**: ${health.panel_count}\n\n`;

  md += `## 📊 Panel 统计\n`;
  md += `- ✅ 健康: ${health.summary.healthy_panels}\n`;
  md += `- ⚠️ 警告: ${health.summary.warning_panels}\n`;
  md += `- 🔴 异常: ${health.summary.unhealthy_panels}\n`;
  md += `- 🐛 问题总数: ${health.summary.total_issues}\n\n`;

  if (health.global_issues.length > 0) {
    md += `## 🚨 全局问题\n`;
    health.global_issues.forEach((issue, index) => {
      const severityEmoji = { info: 'ℹ️', warning: '⚠️', error: '❌', critical: '🚨' };
      md += `${index + 1}. ${severityEmoji[issue.severity]} **[${issue.severity.toUpperCase()}]** ${issue.message}\n`;
      if (issue.suggestion) {
        md += `   💡 ${issue.suggestion}\n`;
      }
    });
    md += '\n';
  }

  const unhealthyPanels = health.panels.filter(p => p.status === 'unhealthy');
  if (unhealthyPanels.length > 0) {
    md += `## 🔴 异常 Panel 详情\n`;
    unhealthyPanels.forEach(panel => {
      md += `### Panel: ${panel.title || panel.panel_id} (${panel.panel_type})\n`;
      panel.issues.forEach(issue => {
        md += `- ❌ ${issue.message}\n`;
        if (issue.suggestion) {
          md += `  💡 ${issue.suggestion}\n`;
        }
      });
      md += '\n';
    });
  }

  const warningPanels = health.panels.filter(p => p.status === 'warning');
  if (warningPanels.length > 0) {
    md += `## ⚠️ 警告 Panel (前5个)\n`;
    warningPanels.slice(0, 5).forEach(panel => {
      md += `- **${panel.title || panel.panel_id}**: ${panel.issues[0]?.message}\n`;
    });
  }

  return md;
}

/**
 * 格式化批量健康度报告为 Markdown
 */
export function formatBatchHealthReportToMarkdown(report: BatchHealthReport): string {
  let md = `# Dashboard 批量健康度报告\n\n`;
  md += `## 📊 总体概览\n`;
  md += `- 总 Dashboard 数: ${report.summary.total_dashboards}\n`;
  md += `- ✅ 健康: ${report.summary.healthy} (${Math.round(report.summary.healthy / report.summary.total_dashboards * 100)}%)\n`;
  md += `- ⚠️ 警告: ${report.summary.warning} (${Math.round(report.summary.warning / report.summary.total_dashboards * 100)}%)\n`;
  md += `- 🔴 异常: ${report.summary.unhealthy} (${Math.round(report.summary.unhealthy / report.summary.total_dashboards * 100)}%)\n`;
  md += `- 🚨 严重问题: ${report.summary.critical_issues}\n\n`;

  // 按健康度排序，先显示问题最严重的
  const sortedDashboards = [...report.dashboards].sort((a, b) => a.overall_score - b.overall_score);

  if (report.summary.unhealthy > 0) {
    md += `## 🔴 需要紧急修复的 Dashboard\n`;
    sortedDashboards
      .filter(d => d.overall_status === 'unhealthy')
      .slice(0, 10)
      .forEach((dashboard, index) => {
        md += `${index + 1}. **${dashboard.title}** (评分: ${dashboard.overall_score}/100)\n`;
        md += `   - 异常 Panel: ${dashboard.summary.unhealthy_panels}/${dashboard.panel_count}\n`;
        md += `   - 问题数: ${dashboard.summary.total_issues}\n`;
      });
    md += '\n';
  }

  if (report.summary.warning > 0) {
    md += `## ⚠️ 建议优化的 Dashboard (前5个)\n`;
    sortedDashboards
      .filter(d => d.overall_status === 'warning')
      .slice(0, 5)
      .forEach((dashboard, index) => {
        md += `${index + 1}. **${dashboard.title}** (评分: ${dashboard.overall_score}/100)\n`;
      });
  }

  return md;
}
