/**
 * Intelligent Analysis Tools Registration Module
 * Register dependency analysis and health check features as MCP Tools
 */

import { z } from "zod";
import type { ServerBase, KibanaClient, ToolResponse } from "./types.js";
import {
  buildDependencyTree,
  analyzeImpact,
  formatDependencyTreeToMarkdown,
  formatImpactAnalysisToMarkdown
} from "./dependency-analyzer.js";
import {
  analyzeDashboardHealth,
  batchAnalyzeDashboards,
  formatHealthReportToMarkdown,
  formatBatchHealthReportToMarkdown
} from "./health-analyzer.js";

export function registerAnalysisTools(server: ServerBase, kibanaClient: KibanaClient, defaultSpace: string) {
  
  // Tool 1: Analyze Saved Object dependency tree
  server.tool(
    "analyze_object_dependencies",
    "Analyze dependency tree for a Kibana saved object (Dashboard, Visualization, etc.)",
    z.object({
      id: z.string().describe("Saved object ID"),
      type: z.string().describe("Saved object type (e.g., dashboard, visualization, lens, index-pattern)"),
      space: z.string().optional().describe("Kibana space (optional)"),
      max_depth: z.number().optional().default(5).describe("Maximum depth to traverse (default: 5)")
    }),
    async ({ id, type, space, max_depth }): Promise<ToolResponse> => {
      try {
        const targetSpace = space || defaultSpace;
        const tree = await buildDependencyTree(kibanaClient, id, type, targetSpace, max_depth);
        const markdown = formatDependencyTreeToMarkdown(tree);

        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error analyzing dependencies: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Tool 2: Impact scope analysis
  server.tool(
    "analyze_deletion_impact",
    "Analyze the impact of deleting or modifying a saved object (what will be affected)",
    z.object({
      id: z.string().describe("Saved object ID to analyze"),
      type: z.string().describe("Saved object type (e.g., visualization, lens, index-pattern)"),
      space: z.string().optional().describe("Kibana space (optional)")
    }),
    async ({ id, type, space }): Promise<ToolResponse> => {
      try {
        const targetSpace = space || defaultSpace;
        const impact = await analyzeImpact(kibanaClient, id, type, targetSpace);
        const markdown = formatImpactAnalysisToMarkdown(impact);

        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error analyzing impact: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Tool 3: Dashboard health check
  server.tool(
    "check_dashboard_health",
    "Perform health check on a Dashboard to detect broken references, performance issues, etc.",
    z.object({
      dashboard_id: z.string().describe("Dashboard ID to check"),
      space: z.string().optional().describe("Kibana space (optional)"),
      check_indices: z.boolean().optional().default(false).describe("Also check if referenced Elasticsearch indices exist (requires additional permissions)")
    }),
    async ({ dashboard_id, space, check_indices }): Promise<ToolResponse> => {
      try {
        const targetSpace = space || defaultSpace;
        const health = await analyzeDashboardHealth(kibanaClient, dashboard_id, targetSpace, check_indices);
        const markdown = formatHealthReportToMarkdown(health);

        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error checking dashboard health: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Tool 4: Batch Dashboard health scan
  server.tool(
    "scan_all_dashboards_health",
    "Scan health status of all Dashboards in a space (returns summary report)",
    z.object({
      space: z.string().optional().describe("Kibana space (optional)"),
      max_dashboards: z.number().optional().default(50).describe("Maximum number of dashboards to scan (default: 50)")
    }),
    async ({ space, max_dashboards }): Promise<ToolResponse> => {
      try {
        const targetSpace = space || defaultSpace;
        const report = await batchAnalyzeDashboards(kibanaClient, targetSpace, max_dashboards);
        const markdown = formatBatchHealthReportToMarkdown(report);

        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error scanning dashboards: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );
}
