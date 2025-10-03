import { z } from 'zod';
import { ServerBase, KibanaClient, ToolResponse } from './types.js';

/**
 * Observability Alerting Tools (ob_alert_*) - Kibana Alerting Rules Management Tools
 * 
 * This module provides comprehensive tools for managing Kibana alerting rules,
 * which are the core of Observability monitoring. Alerting enables you to define rules
 * that detect complex conditions within your data (metrics, logs, traces, uptime).
 * When a condition is met, the rule tracks it as an alert and runs actions.
 * 
 * Use Cases:
 * - APM performance alerts (response time, error rate, throughput)
 * - Infrastructure monitoring (CPU, memory, disk usage)
 * - Log pattern alerts (error logs, suspicious patterns)
 * - Business metric alerts (custom KPIs)
 * - Uptime monitoring (service availability)
 * 
 * All tools are based on the official Kibana Alerting API specification.
 */

// ============================================================================
// ALERTING RULES CORE MANAGEMENT TOOLS
// ============================================================================

/**
 * Find alerting rules with filtering and pagination
 */
async function ob_alert_find_rules_impl(
  kibanaClient: KibanaClient,
  page?: number,
  perPage?: number,
  searchFields?: string[],
  search?: string,
  defaultSearchOperator?: 'OR' | 'AND',
  sortField?: string,
  sortOrder?: 'asc' | 'desc',
  hasReference?: any,
  filter?: string,
  space?: string
): Promise<ToolResponse> {
  try {
    const params = new URLSearchParams();
    
    if (page !== undefined) {
      params.append('page', page.toString());
    }
    if (perPage !== undefined) {
      params.append('per_page', perPage.toString());
    }
    if (searchFields && searchFields.length > 0) {
      searchFields.forEach(field => params.append('search_fields', field));
    }
    if (search) {
      params.append('search', search);
    }
    if (defaultSearchOperator) {
      params.append('default_search_operator', defaultSearchOperator);
    }
    if (sortField) {
      params.append('sort_field', sortField);
    }
    if (sortOrder) {
      params.append('sort_order', sortOrder);
    }
    if (hasReference) {
      params.append('has_reference', JSON.stringify(hasReference));
    }
    if (filter) {
      params.append('filter', filter);
    }

    const url = `/api/alerting/rules/_find${params.toString() ? '?' + params.toString() : ''}`;
    const response = await kibanaClient.get(url, { space });

    return {
      content: [{
        type: "text",
        text: `Alerting rules found:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error finding alerting rules: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Get alerting rule by ID
 */
async function ob_alert_get_rule_impl(
  kibanaClient: KibanaClient,
  id: string,
  space?: string
): Promise<ToolResponse> {
  try {
    const url = `/api/alerting/rule/${id}`;
    const response = await kibanaClient.get(url, { space });

    return {
      content: [{
        type: "text",
        text: `Alerting rule retrieved successfully:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error retrieving alerting rule: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}


/**
 * Enable alerting rule
 */
async function ob_alert_enable_rule_impl(
  kibanaClient: KibanaClient,
  id: string,
  space?: string
): Promise<ToolResponse> {
  try {
    const url = `/api/alerting/rule/${id}/_enable`;
    const response = await kibanaClient.post(url, {}, { space });

    return {
      content: [{
        type: "text",
        text: `Alerting rule enabled successfully:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error enabling alerting rule: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Disable alerting rule
 */
async function ob_alert_disable_rule_impl(
  kibanaClient: KibanaClient,
  id: string,
  space?: string
): Promise<ToolResponse> {
  try {
    const url = `/api/alerting/rule/${id}/_disable`;
    const response = await kibanaClient.post(url, {}, { space });

    return {
      content: [{
        type: "text",
        text: `Alerting rule disabled successfully:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error disabling alerting rule: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Mute all alerts for a rule
 */
async function ob_alert_mute_all_impl(
  kibanaClient: KibanaClient,
  id: string,
  space?: string
): Promise<ToolResponse> {
  try {
    const url = `/api/alerting/rule/${id}/_mute_all`;
    const response = await kibanaClient.post(url, {}, { space });

    return {
      content: [{
        type: "text",
        text: `All alerts muted for rule successfully:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error muting all alerts: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Unmute all alerts for a rule
 */
async function ob_alert_unmute_all_impl(
  kibanaClient: KibanaClient,
  id: string,
  space?: string
): Promise<ToolResponse> {
  try {
    const url = `/api/alerting/rule/${id}/_unmute_all`;
    const response = await kibanaClient.post(url, {}, { space });

    return {
      content: [{
        type: "text",
        text: `All alerts unmuted for rule successfully:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error unmuting all alerts: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Mute specific alert instance
 */
async function ob_alert_mute_alert_impl(
  kibanaClient: KibanaClient,
  ruleId: string,
  alertId: string,
  space?: string
): Promise<ToolResponse> {
  try {
    const url = `/api/alerting/rule/${ruleId}/alert/${alertId}/_mute`;
    const response = await kibanaClient.post(url, {}, { space });

    return {
      content: [{
        type: "text",
        text: `Alert instance muted successfully:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error muting alert instance: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Unmute specific alert instance
 */
async function ob_alert_unmute_alert_impl(
  kibanaClient: KibanaClient,
  ruleId: string,
  alertId: string,
  space?: string
): Promise<ToolResponse> {
  try {
    const url = `/api/alerting/rule/${ruleId}/alert/${alertId}/_unmute`;
    const response = await kibanaClient.post(url, {}, { space });

    return {
      content: [{
        type: "text",
        text: `Alert instance unmuted successfully:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error unmuting alert instance: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}



/**
 * Get available rule types
 */
async function ob_alert_get_rule_types_impl(
  kibanaClient: KibanaClient,
  space?: string
): Promise<ToolResponse> {
  try {
    const response = await kibanaClient.get('/api/alerting/rule_types', { space });

    return {
      content: [{
        type: "text",
        text: `Available rule types:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error retrieving rule types: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Get alerting health status
 */
async function ob_alert_health_check_impl(
  kibanaClient: KibanaClient,
  space?: string
): Promise<ToolResponse> {
  try {
    const response = await kibanaClient.get('/api/alerting/_health', { space });

    return {
      content: [{
        type: "text",
        text: `Alerting health status:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error checking alerting health: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

// ============================================================================
// TOOL REGISTRATION
// ============================================================================

/**
 * Register all Observability Alerting tools with the MCP server
 */
export async function registerOBAlertTools(
  server: ServerBase,
  kibanaClient: KibanaClient,
  defaultSpace: string
): Promise<void> {
  
  server.tool(
    "ob_alert_find_rules",
    "Search and find alerting rules with filtering, sorting, and pagination. Alerting rules detect conditions in your observability data (metrics, logs, traces, uptime) and trigger actions. IMPORTANT: Use 'filter' for KQL-based filtering, 'page' and 'perPage' for pagination. Returns rule configurations including triggers, actions, and execution status. Use Cases: Listing all rules, finding high-frequency alerts, searching by tags, auditing rule configurations.",
    z.object({
      page: z.number().optional().describe("Page number (starts from 1, default: 1). Use with perPage for pagination."),
      perPage: z.number().optional().describe("Items per page (default: 10). PERFORMANCE TIP: Use 10-50 for optimal speed."),
      searchFields: z.array(z.string()).optional().describe("Fields to search in. Example: ['name', 'tags']. Common fields: 'name', 'tags', 'alertTypeId'"),
      search: z.string().optional().describe("Search query string. Searches across searchFields. Example: 'CPU' to find all CPU-related rules"),
      defaultSearchOperator: z.enum(['OR', 'AND']).optional().describe("Default search operator. 'OR' = match any term, 'AND' = match all terms (default: 'OR')"),
      sortField: z.string().optional().describe("Field to sort by. Common: 'name', 'createdAt', 'updatedAt', 'executionStatus.lastExecutionDate'"),
      sortOrder: z.enum(['asc', 'desc']).optional().describe("Sort order. 'asc' = ascending, 'desc' = descending (default: 'desc')"),
      hasReference: z.any().optional().describe("Filter rules that reference specific saved objects. Example: {type: 'index-pattern', id: 'my-pattern'}"),
      filter: z.string().optional().describe("KQL filter query. Example: 'alert.attributes.enabled: true' to find enabled rules"),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await ob_alert_find_rules_impl(
        kibanaClient,
        params.page,
        params.perPage,
        params.searchFields,
        params.search,
        params.defaultSearchOperator,
        params.sortField,
        params.sortOrder,
        params.hasReference,
        params.filter,
        params.space || defaultSpace
      );
    }
  );

  server.tool(
    "ob_alert_get_rule",
    "Get detailed information about a specific alerting rule by ID. Returns complete rule configuration including triggers, conditions, actions, schedule, execution status, and history. IMPORTANT: Provide the rule 'id' (UUID). Use Cases: Inspecting rule configuration, checking execution status, troubleshooting alert issues, viewing rule history.",
    z.object({
      id: z.string().describe("REQUIRED: Alerting rule UUID. Example: '5f6c5d90-8b51-11ec-b909-0242ac120002'. Get IDs from ob_alert_find_rules."),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await ob_alert_get_rule_impl(
        kibanaClient,
        params.id,
        params.space || defaultSpace
      );
    }
  );


  server.tool(
    "ob_alert_enable_rule",
    "Enable a disabled alerting rule. Starts rule execution and monitoring. The rule will begin checking conditions according to its schedule and trigger actions when thresholds are met. IMPORTANT: Provide the rule 'id' (UUID). Use Cases: Re-enabling rules after maintenance, activating rules after configuration, resuming monitoring after incidents.",
    z.object({
      id: z.string().describe("REQUIRED: Alerting rule UUID to enable. Example: '5f6c5d90-8b51-11ec-b909-0242ac120002'. Rule will start monitoring immediately."),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await ob_alert_enable_rule_impl(
        kibanaClient,
        params.id,
        params.space || defaultSpace
      );
    }
  );

  server.tool(
    "ob_alert_disable_rule",
    "Disable an alerting rule. Stops rule execution and monitoring. The rule will not check conditions or trigger actions until re-enabled. Existing alert instances remain but no new alerts will be generated. IMPORTANT: Provide the rule 'id' (UUID). Use Cases: Temporary maintenance windows, troubleshooting, preventing alerts during known issues, pausing monitoring during deployments.",
    z.object({
      id: z.string().describe("REQUIRED: Alerting rule UUID to disable. Example: '5f6c5d90-8b51-11ec-b909-0242ac120002'. Rule will stop monitoring immediately."),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await ob_alert_disable_rule_impl(
        kibanaClient,
        params.id,
        params.space || defaultSpace
      );
    }
  );

  server.tool(
    "ob_alert_mute_all",
    "Mute ALL alert instances for a rule. The rule continues to run and track alerts, but will not execute any actions (no notifications sent). Useful for silencing noisy rules without disabling monitoring. IMPORTANT: Provide the rule 'id' (UUID). Use ob_alert_unmute_all to restore notifications. Use Cases: Silencing alerts during maintenance, known issues, planned downtime, or while investigating root cause.",
    z.object({
      id: z.string().describe("REQUIRED: Alerting rule UUID to mute all alerts for. Example: '5f6c5d90-8b51-11ec-b909-0242ac120002'. All current and future alerts will be muted until unmuted."),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await ob_alert_mute_all_impl(
        kibanaClient,
        params.id,
        params.space || defaultSpace
      );
    }
  );

  server.tool(
    "ob_alert_unmute_all",
    "Unmute ALL alert instances for a rule. Restores action execution (notifications). The rule will resume sending notifications when alert conditions are met. IMPORTANT: Provide the rule 'id' (UUID). Use Cases: Restoring notifications after maintenance, ending maintenance windows, resuming normal alerting after issue resolution.",
    z.object({
      id: z.string().describe("REQUIRED: Alerting rule UUID to unmute all alerts for. Example: '5f6c5d90-8b51-11ec-b909-0242ac120002'. Notifications will resume immediately."),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await ob_alert_unmute_all_impl(
        kibanaClient,
        params.id,
        params.space || defaultSpace
      );
    }
  );

  server.tool(
    "ob_alert_mute_alert",
    "Mute a SPECIFIC alert instance. The rule continues to run, but this particular alert instance will not trigger actions. Useful for silencing known issues while keeping other alerts active. IMPORTANT: Provide both 'ruleId' (rule UUID) and 'alertId' (specific alert instance ID). Use Cases: Silencing alerts for specific hosts, services, or metrics while monitoring others, suppressing known false positives.",
    z.object({
      ruleId: z.string().describe("REQUIRED: Alerting rule UUID. Example: '5f6c5d90-8b51-11ec-b909-0242ac120002'"),
      alertId: z.string().describe("REQUIRED: Specific alert instance ID to mute. Example: 'us-west-2-server-01'. Get alert IDs from rule execution history or alert details."),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await ob_alert_mute_alert_impl(
        kibanaClient,
        params.ruleId,
        params.alertId,
        params.space || defaultSpace
      );
    }
  );

  server.tool(
    "ob_alert_unmute_alert",
    "Unmute a SPECIFIC alert instance. Restores action execution for this particular alert. Other muted alerts remain muted. IMPORTANT: Provide both 'ruleId' (rule UUID) and 'alertId' (specific alert instance ID). Use Cases: Restoring notifications for specific hosts/services after resolution, ending suppression of false positives.",
    z.object({
      ruleId: z.string().describe("REQUIRED: Alerting rule UUID. Example: '5f6c5d90-8b51-11ec-b909-0242ac120002'"),
      alertId: z.string().describe("REQUIRED: Specific alert instance ID to unmute. Example: 'us-west-2-server-01'"),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await ob_alert_unmute_alert_impl(
        kibanaClient,
        params.ruleId,
        params.alertId,
        params.space || defaultSpace
      );
    }
  );


  server.tool(
    "ob_alert_get_rule_types",
    "Get all available alerting rule types and their configurations. Returns rule type metadata including supported parameters, action groups, and required fields. IMPORTANT: No parameters required. Use Cases: Discovering available alert types before creating rules, understanding rule capabilities, checking parameter requirements, finding rule types for specific use cases (metrics, logs, APM, uptime).",
    z.object({
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await ob_alert_get_rule_types_impl(
        kibanaClient,
        params.space || defaultSpace
      );
    }
  );

  server.tool(
    "ob_alert_health_check",
    "Check the health status of the Kibana Alerting framework. Returns information about alerting service status, execution capacity, task manager status, and potential issues. IMPORTANT: No parameters required. Use Cases: Troubleshooting alerting issues, monitoring alerting infrastructure health, checking execution capacity, verifying alerting service availability.",
    z.object({
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await ob_alert_health_check_impl(
        kibanaClient,
        params.space || defaultSpace
      );
    }
  );
}

