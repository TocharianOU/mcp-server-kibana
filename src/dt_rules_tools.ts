import { z } from 'zod';
import { ServerBase, KibanaClient, ToolResponse } from './types.js';

/**
 * Detection Rules Tools (dt_*) - Kibana Detection Engine Rules Management Tools
 * 
 * This module provides comprehensive tools for managing Kibana detection rules,
 * including CRUD operations, search, and prepackaged rules management.
 * All tools are based on the official Kibana Detection Engine API specification.
 */

// ============================================================================
// DETECTION RULES CORE MANAGEMENT TOOLS (dt_rules_*)
// ============================================================================

/**
 * Get detection rules by rule_id or id
 * @param kibanaClient - Kibana client instance
 * @param ruleId - The rule's rule_id value (optional)
 * @param id - The rule's id value (optional)
 * @param space - Target Kibana space (optional)
 * @returns Promise<ToolResponse> - MCP tool response
 */
async function dt_get_detection_rules_impl(
  kibanaClient: KibanaClient,
  ruleId?: string,
  id?: string,
  space?: string
): Promise<ToolResponse> {
  try {
    // Validate that at least one identifier is provided
    if (!ruleId && !id) {
      return {
        content: [{
          type: "text",
          text: "Error: Either 'ruleId' or 'id' parameter is required to identify the detection rule."
        }],
        isError: true
      };
    }

    // Build query parameters
    const params = new URLSearchParams();
    if (ruleId) {
      params.append('rule_id', ruleId);
    }
    if (id) {
      params.append('id', id);
    }

    const url = `/api/detection_engine/rules?${params.toString()}`;
    const response = await kibanaClient.get(url, { space });

    return {
      content: [{
        type: "text",
        text: `Detection rule retrieved successfully:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error retrieving detection rule: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

// Removed: dt_create_detection_rule_impl - use execute_kb_api or VL tools for complex configurations
// Removed: dt_update_detection_rule_impl - use execute_kb_api for precise updates
// Removed: dt_delete_detection_rule_impl - dangerous operation, use execute_kb_api if needed

/**
 * Find/search detection rules
 * @param kibanaClient - Kibana client instance
 * @param query - Search query object (optional)
 * @param filters - Filter criteria (optional)
 * @param sort - Sort criteria (optional)
 * @param page - Page number (optional)
 * @param perPage - Number of results per page (optional)
 * @param space - Target Kibana space (optional)
 * @returns Promise<ToolResponse> - MCP tool response
 */
async function dt_find_detection_rules_impl(
  kibanaClient: KibanaClient,
  query?: Record<string, any>,
  filters?: Record<string, any>,
  sort?: Record<string, any>,
  page?: number,
  perPage?: number,
  space?: string
): Promise<ToolResponse> {
  try {
    // Build query parameters
    const params = new URLSearchParams();
    if (page !== undefined) {
      params.append('page', page.toString());
    }
    if (perPage !== undefined) {
      params.append('per_page', perPage.toString());
    }

    const url = `/api/detection_engine/rules/_find?${params.toString()}`;
    
    // Prepare request body
    const requestBody: Record<string, any> = {};
    if (query) {
      requestBody.query = query;
    }
    if (filters) {
      requestBody.filters = filters;
    }
    if (sort) {
      requestBody.sort = sort;
    }

    const response = await kibanaClient.post(url, requestBody, { space });

    return {
      content: [{
        type: "text",
        text: `Found ${response.total || 0} detection rules:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error finding detection rules: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Get prepackaged detection rules
 * @param kibanaClient - Kibana client instance
 * @param page - Page number (optional)
 * @param perPage - Number of results per page (optional)
 * @param space - Target Kibana space (optional)
 * @returns Promise<ToolResponse> - MCP tool response
 */
async function dt_get_prepackaged_rules_impl(
  kibanaClient: KibanaClient,
  page?: number,
  perPage?: number,
  space?: string
): Promise<ToolResponse> {
  try {
    // Build query parameters
    const params = new URLSearchParams();
    if (page !== undefined) {
      params.append('page', page.toString());
    }
    if (perPage !== undefined) {
      params.append('per_page', perPage.toString());
    }

    const url = `/api/detection_engine/rules/prepackaged?${params.toString()}`;
    const response = await kibanaClient.get(url, { space });

    return {
      content: [{
        type: "text",
        text: `Prepackaged detection rules retrieved successfully:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error retrieving prepackaged rules: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Get prepackaged detection rules status
 * @param kibanaClient - Kibana client instance
 * @param space - Target Kibana space (optional)
 * @returns Promise<ToolResponse> - MCP tool response
 */
async function dt_get_prepackaged_rules_status_impl(
  kibanaClient: KibanaClient,
  space?: string
): Promise<ToolResponse> {
  try {
    const url = `/api/detection_engine/rules/prepackaged/_status`;
    const response = await kibanaClient.get(url, { space });

    return {
      content: [{
        type: "text",
        text: `Prepackaged rules status:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error retrieving prepackaged rules status: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

// Removed: dt_get_rule_exceptions_impl - use sc_find_exception_* tools instead for exception management

// ============================================================================
// TOOL REGISTRATION
// ============================================================================

/**
 * Register all detection rules tools
 * @param serverBase - Server base interface
 * @param kibanaClient - Kibana client instance
 * @param defaultSpace - Default Kibana space
 */
export async function registerDTRulesTools(
  serverBase: ServerBase,
  kibanaClient: KibanaClient,
  defaultSpace: string
): Promise<void> {
  // dt_get_rule (renamed from dt_get_detection_rules for brevity)
  serverBase.tool(
    "dt_get_rule",
    "Get detection rules by rule_id or id. IMPORTANT: You must provide either 'ruleId' or 'id' parameter to identify the rule. The 'rule_id' is a stable identifier that can be set during creation, while 'id' is a unique auto-generated identifier.",
    z.object({
      ruleId: z.string().optional().describe("The rule's rule_id value (stable identifier that can be set during creation)"),
      id: z.string().optional().describe("The rule's id value (unique auto-generated identifier)"),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (args) => {
      return dt_get_detection_rules_impl(
        kibanaClient,
        args.ruleId,
        args.id,
        args.space || defaultSpace
      );
    }
  );

  // Removed: dt_create_detection_rule - complex configuration, use execute_kb_api
  // Removed: dt_update_detection_rule - precise updates, use execute_kb_api
  // Removed: dt_delete_detection_rule - dangerous operation, use execute_kb_api

  // dt_find_rules (renamed from dt_find_detection_rules for brevity)
  serverBase.tool(
    "dt_find_rules",
    "Find/search detection rules with advanced filtering and pagination. Use this tool to search for rules by name, description, tags, or other criteria. Supports Elasticsearch query syntax.",
    z.object({
      query: z.record(z.any()).optional().describe("Search query object using Elasticsearch query syntax (e.g., {match: {name: 'rule_name'}})"),
      filters: z.record(z.any()).optional().describe("Filter criteria to narrow down results (e.g., {enabled: true, tags: ['security']})"),
      sort: z.record(z.any()).optional().describe("Sort criteria (e.g., {created_at: {order: 'desc'}})"),
      page: z.number().optional().describe("Page number (starts from 1, default: 1)"),
      perPage: z.number().optional().describe("Number of results per page (default: 20, recommended: 5-50)"),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (args) => {
      return dt_find_detection_rules_impl(
        kibanaClient,
        args.query,
        args.filters,
        args.sort,
        args.page,
        args.perPage,
        args.space || defaultSpace
      );
    }
  );

  // dt_get_prepackaged_rules
  serverBase.tool(
    "dt_get_prepackaged_rules",
    "Get Elastic prebuilt detection rules. These are security rules provided by Elastic that can be installed and used immediately. Use this to discover available prebuilt rules before installing them.",
    z.object({
      page: z.number().optional().describe("Page number (starts from 1, default: 1)"),
      perPage: z.number().optional().describe("Number of results per page (default: 20, recommended: 5-50)"),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (args) => {
      return dt_get_prepackaged_rules_impl(
        kibanaClient,
        args.page,
        args.perPage,
        args.space || defaultSpace
      );
    }
  );

  // dt_install_prebuilt_rules (renamed from dt_get_prepackaged_rules_status for clarity)
  serverBase.tool(
    "dt_install_prebuilt_rules",
    "Install or update Elastic prebuilt detection rules and timelines. This endpoint installs all available prebuilt rules. Use dt_get_prepackaged_rules to see what rules will be installed first.",
    z.object({
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (args) => {
      return dt_get_prepackaged_rules_status_impl(
        kibanaClient,
        args.space || defaultSpace
      );
    }
  );

  // Removed: dt_get_rule_exceptions - use sc_find_exception_* tools for exception management
}
