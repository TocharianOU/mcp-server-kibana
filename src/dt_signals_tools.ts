import { z } from 'zod';
import { ServerBase, KibanaClient, ToolResponse } from './types.js';

/**
 * Detection Signals Tools (dt_signals_*) - Kibana Detection Engine Signals/Alerts Management
 * 
 * This module provides tools for managing detection alerts (signals).
 * Simplified to focus on query and simple status operations.
 * All tools are based on the official Kibana Detection Engine API specification.
 */

// ============================================================================
// SIGNALS/ALERTS MANAGEMENT TOOLS (dt_signals_*)
// ============================================================================

/**
 * Search detection alerts/signals
 * @param kibanaClient - Kibana client instance
 * @param query - Elasticsearch query to search alerts
 * @param aggs - Elasticsearch aggregations
 * @param size - Number of results to return
 * @param from - Starting position for results
 * @param sort - Sort criteria
 * @param space - Target Kibana space (optional)
 * @returns Promise<ToolResponse> - MCP tool response
 */
async function dt_search_signals_impl(
  kibanaClient: KibanaClient,
  query?: Record<string, any>,
  aggs?: Record<string, any>,
  size?: number,
  from?: number,
  sort?: Array<Record<string, any>>,
  space?: string
): Promise<ToolResponse> {
  try {
    // Prepare request body
    const requestBody: Record<string, any> = {};
    
    if (query) {
      requestBody.query = query;
    }
    
    if (aggs) {
      requestBody.aggs = aggs;
    }
    
    if (size !== undefined) {
      requestBody.size = size;
    }
    
    if (from !== undefined) {
      requestBody.from = from;
    }
    
    if (sort) {
      requestBody.sort = sort;
    }

    const url = `/api/detection_engine/signals/search`;
    const response = await kibanaClient.post(url, requestBody, { space });

    return {
      content: [{
        type: "text",
        text: `Found ${response.hits?.total?.value || 0} alerts:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error searching alerts: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Get or update alert status
 * @param kibanaClient - Kibana client instance
 * @param status - New status to set (open, acknowledged, closed)
 * @param signalIds - Array of alert IDs to update
 * @param query - Query to match alerts for status update
 * @param space - Target Kibana space (optional)
 * @returns Promise<ToolResponse> - MCP tool response
 */
async function dt_update_signal_status_impl(
  kibanaClient: KibanaClient,
  status: string,
  signalIds?: string[],
  query?: Record<string, any>,
  space?: string
): Promise<ToolResponse> {
  try {
    if (!status) {
      return {
        content: [{
          type: "text",
          text: "Error: 'status' parameter is required. Valid values: 'open', 'acknowledged', 'closed'."
        }],
        isError: true
      };
    }

    if (!signalIds && !query) {
      return {
        content: [{
          type: "text",
          text: "Error: Either 'signalIds' or 'query' parameter is required to identify alerts to update."
        }],
        isError: true
      };
    }

    // Prepare request body
    const requestBody: Record<string, any> = {
      status
    };

    if (signalIds && signalIds.length > 0) {
      requestBody.signal_ids = signalIds;
    }

    if (query) {
      requestBody.query = query;
    }

    const url = `/api/detection_engine/signals/status`;
    const response = await kibanaClient.post(url, requestBody, { space });

    return {
      content: [{
        type: "text",
        text: `Alert status updated to '${status}':\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error updating alert status: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Assign or unassign users to/from detection alerts
 * @param kibanaClient - Kibana client instance
 * @param ids - Array of alert IDs
 * @param assigneesToAdd - Array of user IDs to add as assignees
 * @param assigneesToRemove - Array of user IDs to remove as assignees
 * @param space - Target Kibana space (optional)
 * @returns Promise<ToolResponse> - MCP tool response
 */
async function dt_set_alert_assignees_impl(
  kibanaClient: KibanaClient,
  ids: string[],
  assigneesToAdd?: string[],
  assigneesToRemove?: string[],
  space?: string
): Promise<ToolResponse> {
  try {
    if (!ids || ids.length === 0) {
      return {
        content: [{
          type: "text",
          text: "Error: 'ids' parameter is required and must be a non-empty array of alert IDs."
        }],
        isError: true
      };
    }

    if ((!assigneesToAdd || assigneesToAdd.length === 0) && (!assigneesToRemove || assigneesToRemove.length === 0)) {
      return {
        content: [{
          type: "text",
          text: "Error: At least one of 'assigneesToAdd' or 'assigneesToRemove' must be provided."
        }],
        isError: true
      };
    }

    // Check for overlapping assignees
    if (assigneesToAdd && assigneesToRemove) {
      const overlap = assigneesToAdd.filter(id => assigneesToRemove.includes(id));
      if (overlap.length > 0) {
        return {
          content: [{
            type: "text",
            text: `Error: Cannot add and remove the same assignee(s): ${overlap.join(', ')}`
          }],
          isError: true
        };
      }
    }

    // Prepare request body
    const requestBody: Record<string, any> = {
      ids,
      assignees: {
        add: assigneesToAdd || [],
        remove: assigneesToRemove || []
      }
    };

    const url = `/api/detection_engine/signals/assignees`;
    const response = await kibanaClient.post(url, requestBody, { space });

    return {
      content: [{
        type: "text",
        text: `Alert assignees updated:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error updating alert assignees: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Get all unique tags from detection rules
 * @param kibanaClient - Kibana client instance
 * @param space - Target Kibana space (optional)
 * @returns Promise<ToolResponse> - MCP tool response
 */
async function dt_get_detection_tags_impl(
  kibanaClient: KibanaClient,
  space?: string
): Promise<ToolResponse> {
  try {
    const url = `/api/detection_engine/tags`;
    const response = await kibanaClient.get(url, { space });

    return {
      content: [{
        type: "text",
        text: `Detection rule tags:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error retrieving detection tags: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

// ============================================================================
// TOOL REGISTRATION
// ============================================================================

/**
 * Register all detection signals/alerts management tools
 * @param serverBase - Server base interface
 * @param kibanaClient - Kibana client instance
 * @param defaultSpace - Default Kibana space
 */
export async function registerDTSignalsTools(
  serverBase: ServerBase,
  kibanaClient: KibanaClient,
  defaultSpace: string
): Promise<void> {
  // dt_search_signals
  serverBase.tool(
    "dt_search_signals",
    "Search and aggregate detection alerts/signals using Elasticsearch query syntax. Returns alerts matching the given query and optional aggregations. Use this to find alerts by status, rule, severity, host, user, etc.",
    z.object({
      query: z.record(z.any()).optional().describe("Elasticsearch query object to filter alerts (e.g., {bool: {filter: [{match_phrase: {'kibana.alert.workflow_status': 'open'}}]}})"),
      aggs: z.record(z.any()).optional().describe("Elasticsearch aggregations to analyze alerts (e.g., {alertsByHost: {terms: {field: 'host.name', size: 10}}})"),
      size: z.number().optional().describe("Number of results to return (default: 10, max recommended: 10000)"),
      from: z.number().optional().describe("Starting position for pagination (default: 0)"),
      sort: z.array(z.record(z.any())).optional().describe("Sort criteria array (e.g., [{'@timestamp': {order: 'desc'}}])"),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (args) => {
      return dt_search_signals_impl(
        kibanaClient,
        args.query,
        args.aggs,
        args.size,
        args.from,
        args.sort,
        args.space || defaultSpace
      );
    }
  );

  // dt_update_signal_status
  serverBase.tool(
    "dt_update_signal_status",
    "Update the status of detection alerts. IMPORTANT: You must provide either 'signalIds' or 'query' to identify alerts. Valid status values: 'open', 'acknowledged', 'closed'.",
    z.object({
      status: z.string().describe("New status for the alerts: 'open' (new/unhandled), 'acknowledged' (in progress), or 'closed' (resolved)"),
      signalIds: z.array(z.string()).optional().describe("Array of alert IDs to update"),
      query: z.record(z.any()).optional().describe("Elasticsearch query to match alerts for status update"),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (args) => {
      return dt_update_signal_status_impl(
        kibanaClient,
        args.status,
        args.signalIds,
        args.query,
        args.space || defaultSpace
      );
    }
  );

  // dt_set_alert_assignees
  serverBase.tool(
    "dt_set_alert_assignees",
    "Assign users to detection alerts or unassign them. IMPORTANT: You cannot add and remove the same assignee in the same request. Use user UIDs for assignee identifiers.",
    z.object({
      ids: z.array(z.string()).describe("Array of alert IDs to update assignees for"),
      assigneesToAdd: z.array(z.string()).optional().describe("Array of user UIDs to add as assignees"),
      assigneesToRemove: z.array(z.string()).optional().describe("Array of user UIDs to remove as assignees"),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (args) => {
      return dt_set_alert_assignees_impl(
        kibanaClient,
        args.ids,
        args.assigneesToAdd,
        args.assigneesToRemove,
        args.space || defaultSpace
      );
    }
  );

  // dt_get_detection_tags
  serverBase.tool(
    "dt_get_detection_tags",
    "Get all unique tags from detection rules (not from alerts). Returns a list of all tags used across detection rules in the space. Useful for rule categorization, filtering, and organizing detection rules by tags. Tags are custom labels like 'critical', 'network', 'malware', 'apt', etc. Use Cases: Discovering available tags, filtering rules by tags, understanding rule organization.",
    z.object({
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (args) => {
      return dt_get_detection_tags_impl(
        kibanaClient,
        args.space || defaultSpace
      );
    }
  );
}
