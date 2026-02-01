/**
 * Dashboard Health Analyzer
 * Detects potential issues in Dashboards (broken references, performance issues, etc.)
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
 * Analyze health status of a single Dashboard
 */
export async function analyzeDashboardHealth(
  kibanaClient: KibanaClient,
  dashboardId: string,
  space?: string,
  checkESIndices: boolean = false
): Promise<DashboardHealth> {
  try {
    // Get Dashboard details
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
          message: 'Dashboard has no panels configured',
          suggestion: 'Add at least one visualization panel'
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

    // Check each Panel
    for (const panel of panels) {
      const panelIssues: HealthIssue[] = [];
      
      // 1. Check if Panel reference exists
      const panelRefId = panel.panelRefName || panel.id;
      const reference = references.find((ref: any) => ref.name === panelRefId);
      
      if (!reference) {
        panelIssues.push({
          severity: 'error',
          category: 'broken_reference',
          message: `Panel missing reference definition`,
          details: { panelId: panel.id },
          suggestion: 'This Panel may have been deleted, recommend removing it from Dashboard'
        });
      } else {
        // 2. Check if referenced object exists
        try {
          await kibanaClient.get(`/api/saved_objects/${reference.type}/${reference.id}`, { space });
        } catch (error: any) {
          if (error.response?.status === 404) {
            panelIssues.push({
              severity: 'critical',
              category: 'broken_reference',
              message: `Referenced ${reference.type} object does not exist`,
              details: { referenceId: reference.id, referenceType: reference.type },
              suggestion: `Restore deleted object or remove this Panel from Dashboard`
            });
          }
        }
      }

      // 3. Performance check (Panel size)
      const gridData = panel.gridData || {};
      const panelArea = (gridData.w || 0) * (gridData.h || 0);
      if (panelArea > 48) {
        panelIssues.push({
          severity: 'warning',
          category: 'performance',
          message: 'Panel size too large may affect performance',
          details: { width: gridData.w, height: gridData.h },
          suggestion: 'Consider splitting into multiple smaller Panels'
        });
      }

      // 4. Check Panel type
      const panelType = panel.type;
      if (!panelType) {
        panelIssues.push({
          severity: 'error',
          category: 'configuration',
          message: 'Panel missing type definition',
          suggestion: 'Reconfigure Panel'
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

    // Global checks
    
    // 1. Check if Dashboard is too complex
    if (panels.length > 20) {
      globalIssues.push({
        severity: 'warning',
        category: 'performance',
        message: `Dashboard contains ${panels.length} Panels, may cause slow loading`,
        suggestion: 'Consider splitting into multiple themed Dashboards'
      });
    }

    // 2. Check index pattern references
    if (checkESIndices) {
      const indexPatternRefs = references.filter((ref: any) => ref.type === 'index-pattern');
      for (const indexPatternRef of indexPatternRefs) {
        try {
          const indexPattern = await kibanaClient.get(
            `/api/saved_objects/index-pattern/${indexPatternRef.id}`,
            { space }
          );
          
          // Could further call ES API to check if index exists
          // Skipped for now as it requires ES Client
          
        } catch (error: any) {
          if (error.response?.status === 404) {
            globalIssues.push({
              severity: 'critical',
              category: 'broken_reference',
              message: `Referenced index pattern does not exist: ${indexPatternRef.id}`,
              suggestion: 'Recreate index pattern or update Dashboard reference'
            });
          }
        }
      }
    }

    // Calculate overall health
    const healthyCount = panelHealths.filter(p => p.status === 'healthy').length;
    const warningCount = panelHealths.filter(p => p.status === 'warning').length;
    const unhealthyCount = panelHealths.filter(p => p.status === 'unhealthy').length;
    const totalIssues = panelHealths.reduce((sum, p) => sum + p.issues.length, 0) + globalIssues.length;

    // Health scoring algorithm
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
 * Batch analyze health of multiple Dashboards
 */
export async function batchAnalyzeDashboards(
  kibanaClient: KibanaClient,
  space?: string,
  maxDashboards: number = 50
): Promise<BatchHealthReport> {
  try {
    // Search all Dashboards
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
        // Continue analyzing other Dashboards
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
 * Format health report to Markdown
 */
export function formatHealthReportToMarkdown(health: DashboardHealth): string {
  const statusEmoji = {
    'healthy': '✅',
    'warning': '⚠️',
    'unhealthy': '🔴'
  };

  let md = `# Dashboard Health Report\n\n`;
  md += `## ${statusEmoji[health.overall_status]} Overall Status: ${health.overall_status.toUpperCase()}\n`;
  md += `- **Dashboard**: ${health.title}\n`;
  md += `- **Health Score**: ${health.overall_score}/100\n`;
  md += `- **Total Panels**: ${health.panel_count}\n\n`;

  md += `## 📊 Panel Statistics\n`;
  md += `- ✅ Healthy: ${health.summary.healthy_panels}\n`;
  md += `- ⚠️ Warning: ${health.summary.warning_panels}\n`;
  md += `- 🔴 Unhealthy: ${health.summary.unhealthy_panels}\n`;
  md += `- 🐛 Total Issues: ${health.summary.total_issues}\n\n`;

  if (health.global_issues.length > 0) {
    md += `## 🚨 Global Issues\n`;
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
    md += `## 🔴 Unhealthy Panel Details\n`;
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
    md += `## ⚠️ Warning Panels (top 5)\n`;
    warningPanels.slice(0, 5).forEach(panel => {
      md += `- **${panel.title || panel.panel_id}**: ${panel.issues[0]?.message}\n`;
    });
  }

  return md;
}

/**
 * Format batch health report to Markdown
 */
export function formatBatchHealthReportToMarkdown(report: BatchHealthReport): string {
  let md = `# Dashboard Batch Health Report\n\n`;
  md += `## 📊 Overall Summary\n`;
  md += `- Total Dashboards: ${report.summary.total_dashboards}\n`;
  md += `- ✅ Healthy: ${report.summary.healthy} (${Math.round(report.summary.healthy / report.summary.total_dashboards * 100)}%)\n`;
  md += `- ⚠️ Warning: ${report.summary.warning} (${Math.round(report.summary.warning / report.summary.total_dashboards * 100)}%)\n`;
  md += `- 🔴 Unhealthy: ${report.summary.unhealthy} (${Math.round(report.summary.unhealthy / report.summary.total_dashboards * 100)}%)\n`;
  md += `- 🚨 Critical Issues: ${report.summary.critical_issues}\n\n`;

  // Sort by health score, show most problematic first
  const sortedDashboards = [...report.dashboards].sort((a, b) => a.overall_score - b.overall_score);

  if (report.summary.unhealthy > 0) {
    md += `## 🔴 Dashboards Requiring Urgent Fix\n`;
    sortedDashboards
      .filter(d => d.overall_status === 'unhealthy')
      .slice(0, 10)
      .forEach((dashboard, index) => {
        md += `${index + 1}. **${dashboard.title}** (Score: ${dashboard.overall_score}/100)\n`;
        md += `   - Unhealthy Panels: ${dashboard.summary.unhealthy_panels}/${dashboard.panel_count}\n`;
        md += `   - Total Issues: ${dashboard.summary.total_issues}\n`;
      });
    md += '\n';
  }

  if (report.summary.warning > 0) {
    md += `## ⚠️ Dashboards Recommended for Optimization (top 5)\n`;
    sortedDashboards
      .filter(d => d.overall_status === 'warning')
      .slice(0, 5)
      .forEach((dashboard, index) => {
        md += `${index + 1}. **${dashboard.title}** (Score: ${dashboard.overall_score}/100)\n`;
      });
  }

  return md;
}
