import { z } from 'zod';
import { ServerBase, KibanaClient, ToolResponse } from './types.js';

/**
 * Detection Bulk Tools (dt_bulk_*) - Kibana Detection Engine Bulk Operations
 * 
 * This module provides tools for bulk operations on detection rules.
 * Simplified to only include the modern bulk_action endpoint.
 * All tools are based on the official Kibana Detection Engine API specification.
 */

// ============================================================================
// BULK OPERATIONS TOOLS (dt_bulk_*)
// ============================================================================

/**
 * Perform bulk action on detection rules
 * @param kibanaClient - Kibana client instance
 * @param action - The bulk action to perform (enable, disable, export, duplicate, delete, etc.)
 * @param query - Query to match rules for bulk action
 * @param ids - Array of rule IDs to perform action on
 * @param edit - Edit parameters for bulk edit actions
 * @param dryRun - Enable dry run mode to verify actions without applying them
 * @param space - Target Kibana space (optional)
 * @returns Promise<ToolResponse> - MCP tool response
 */
async function dt_bulk_action_rules_impl(
  kibanaClient: KibanaClient,
  action: string,
  query?: string,
  ids?: string[],
  edit?: Record<string, any>,
  dryRun?: boolean,
  space?: string
): Promise<ToolResponse> {
  try {
    if (!action) {
      return {
        content: [{
          type: "text",
          text: "Error: 'action' parameter is required. Valid actions: enable, disable, export, duplicate, delete, edit, add_tags, delete_tags, set_tags, etc."
        }],
        isError: true
      };
    }

    // Build query parameters
    const params = new URLSearchParams();
    if (dryRun) {
      params.append('dry_run', 'true');
    }

    // Prepare request body
    const requestBody: Record<string, any> = {
      action
    };

    if (query) {
      requestBody.query = query;
    }

    if (ids && ids.length > 0) {
      requestBody.ids = ids;
    }

    if (edit) {
      requestBody.edit = edit;
    }

    const url = `/api/detection_engine/rules/_bulk_action${params.toString() ? '?' + params.toString() : ''}`;
    const response = await kibanaClient.post(url, requestBody, { space });

    return {
      content: [{
        type: "text",
        text: `Bulk action '${action}' completed${dryRun ? ' (dry run)' : ''}:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error performing bulk action: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

// ============================================================================
// TOOL REGISTRATION
// ============================================================================

/**
 * Register all detection bulk operation tools
 * @param serverBase - Server base interface
 * @param kibanaClient - Kibana client instance
 * @param defaultSpace - Default Kibana space
 */
export async function registerDTBulkTools(
  serverBase: ServerBase,
  kibanaClient: KibanaClient,
  defaultSpace: string
): Promise<void> {
  // dt_bulk_action_rules
  serverBase.tool(
    "dt_bulk_action_rules",
    "Apply bulk actions to multiple detection rules. Supported actions: enable, disable, export, duplicate, delete, edit (add/delete/set tags, index patterns, rule actions, schedules). You can target rules by IDs or query. Use dry_run to verify actions before applying.",
    z.object({
      action: z.string().describe("The bulk action to perform: 'enable', 'disable', 'export', 'duplicate', 'delete', 'edit', 'add_tags', 'delete_tags', 'set_tags', 'add_index_patterns', 'delete_index_patterns', 'set_index_patterns', etc."),
      query: z.string().optional().describe("KQL query to match rules for bulk action (e.g., 'alert.attributes.enabled: false')"),
      ids: z.array(z.string()).optional().describe("Array of rule IDs to perform action on"),
      edit: z.record(z.any()).optional().describe("Edit parameters for bulk edit actions (required when action is 'edit')"),
      dryRun: z.boolean().optional().describe("Enable dry run mode to verify actions without applying them (default: false)"),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (args) => {
      return dt_bulk_action_rules_impl(
        kibanaClient,
        args.action,
        args.query,
        args.ids,
        args.edit,
        args.dryRun,
        args.space || defaultSpace
      );
    }
  );


}
