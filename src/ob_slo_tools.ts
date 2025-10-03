import { z } from 'zod';
import { ServerBase, KibanaClient, ToolResponse } from './types.js';

/**
 * Observability SLO Tools (ob_slo_*) - Kibana Service Level Objectives Management
 * 
 * This module provides comprehensive tools for managing Service Level Objectives (SLOs),
 * which are critical for Site Reliability Engineering (SRE) practices. SLOs define
 * measurable targets for service reliability and help teams track error budgets,
 * maintain service quality, and make data-driven decisions about reliability investments.
 * 
 * Key Concepts:
 * - SLO: Service Level Objective - A target value for a service level indicator (e.g., 99.9% uptime)
 * - SLI: Service Level Indicator - A quantitative measure (e.g., availability, latency, error rate)
 * - Error Budget: The allowed amount of unreliability (100% - SLO target)
 * - Burn Rate: How quickly the error budget is being consumed
 * 
 * Use Cases:
 * - Define reliability targets for services (availability, latency, error rates)
 * - Track error budget consumption and remaining budget
 * - Implement SRE best practices (error budget-based decision making)
 * - Monitor SLA compliance for business agreements
 * - Set up burn rate alerts to detect accelerating reliability degradation
 * - Report on service quality over time
 * 
 * All tools are based on the official Kibana Observability SLO API specification.
 */

// ============================================================================
// SLO MANAGEMENT TOOLS
// ============================================================================

/**
 * Find/List SLOs with filtering and pagination
 */
async function ob_slo_find_impl(
  kibanaClient: KibanaClient,
  kqlQuery?: string,
  page?: number,
  perPage?: number,
  sortBy?: string,
  sortDirection?: 'asc' | 'desc',
  hideStale?: boolean,
  space?: string
): Promise<ToolResponse> {
  try {
    const params = new URLSearchParams();
    
    if (kqlQuery) {
      params.append('kqlQuery', kqlQuery);
    }
    if (page !== undefined) {
      params.append('page', page.toString());
    }
    if (perPage !== undefined) {
      params.append('perPage', perPage.toString());
    }
    if (sortBy) {
      params.append('sortBy', sortBy);
    }
    if (sortDirection) {
      params.append('sortDirection', sortDirection);
    }
    if (hideStale !== undefined) {
      params.append('hideStale', hideStale.toString());
    }

    const url = `/api/observability/slos${params.toString() ? '?' + params.toString() : ''}`;
    const response = await kibanaClient.get(url, { space });

    return {
      content: [{
        type: "text",
        text: `SLOs found:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error finding SLOs: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Get SLO by ID
 */
async function ob_slo_get_impl(
  kibanaClient: KibanaClient,
  sloId: string,
  space?: string
): Promise<ToolResponse> {
  try {
    const url = `/api/observability/slos/${sloId}`;
    const response = await kibanaClient.get(url, { space });

    return {
      content: [{
        type: "text",
        text: `SLO retrieved successfully:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error retrieving SLO: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}


/**
 * Enable SLO
 */
async function ob_slo_enable_impl(
  kibanaClient: KibanaClient,
  sloId: string,
  space?: string
): Promise<ToolResponse> {
  try {
    const url = `/api/observability/slos/${sloId}/enable`;
    const response = await kibanaClient.post(url, {}, { space });

    return {
      content: [{
        type: "text",
        text: `SLO enabled successfully:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error enabling SLO: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Disable SLO
 */
async function ob_slo_disable_impl(
  kibanaClient: KibanaClient,
  sloId: string,
  space?: string
): Promise<ToolResponse> {
  try {
    const url = `/api/observability/slos/${sloId}/disable`;
    const response = await kibanaClient.post(url, {}, { space });

    return {
      content: [{
        type: "text",
        text: `SLO disabled successfully:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error disabling SLO: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

// ============================================================================
// TOOL REGISTRATION
// ============================================================================

/**
 * Register all Observability SLO tools with the MCP server
 */
export async function registerOBSLOTools(
  server: ServerBase,
  kibanaClient: KibanaClient,
  defaultSpace: string
): Promise<void> {
  
  server.tool(
    "ob_slo_find",
    "Search and find Service Level Objectives (SLOs) with filtering, sorting, and pagination. SLOs define reliability targets for your services and track error budget consumption. IMPORTANT: Use 'kqlQuery' for KQL-based filtering (e.g., 'slo.name:latency* and slo.tags:prod'), 'page' and 'perPage' for pagination, 'sortBy' to sort by status/budget/SLI value. Returns SLO configurations, current SLI values, error budget status, and burn rates. Use Cases: Listing all SLOs, finding SLOs by service, monitoring error budget status, tracking reliability targets.",
    z.object({
      kqlQuery: z.string().optional().describe("KQL query to filter SLOs. Example: 'slo.name:latency* and slo.tags:prod' to find latency SLOs in production, 'slo.tags:critical' for critical services only. Search across name, description, and tags."),
      page: z.number().optional().describe("Page number (starts from 1, default: 1). Use with perPage for pagination."),
      perPage: z.number().optional().describe("Items per page (default: 25, max: 5000). PERFORMANCE TIP: Use 25-100 for optimal speed."),
      sortBy: z.enum(['sli_value', 'status', 'error_budget_consumed', 'error_budget_remaining']).optional().describe("Field to sort by. 'sli_value' = current SLI value (e.g., 99.8%), 'status' = SLO status (healthy/degraded/violated), 'error_budget_consumed' = % of error budget used, 'error_budget_remaining' = % of error budget left (default: 'status')"),
      sortDirection: z.enum(['asc', 'desc']).optional().describe("Sort order. 'asc' = ascending, 'desc' = descending (default: 'asc')"),
      hideStale: z.boolean().optional().describe("Hide stale SLOs (no recent data) from results. Set true to show only actively monitored SLOs. Staleness threshold defined in SLO settings."),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await ob_slo_find_impl(
        kibanaClient,
        params.kqlQuery,
        params.page,
        params.perPage,
        params.sortBy,
        params.sortDirection,
        params.hideStale,
        params.space || defaultSpace
      );
    }
  );

  server.tool(
    "ob_slo_get",
    "Get detailed information about a specific Service Level Objective (SLO) by ID. Returns complete SLO configuration, current SLI value, error budget status (consumed/remaining), burn rate, historical data, and objective targets. IMPORTANT: Provide the SLO 'id' (UUID or custom ID). Use Cases: Inspecting SLO configuration, checking current reliability status, monitoring error budget consumption, viewing SLI history, troubleshooting reliability issues.",
    z.object({
      sloId: z.string().describe("REQUIRED: SLO identifier (UUID or custom ID). Example: '8853b850-9a3c-11ec-b909-0242ac120002' or 'api-availability-prod'. Get SLO IDs from ob_slo_find."),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await ob_slo_get_impl(
        kibanaClient,
        params.sloId,
        params.space || defaultSpace
      );
    }
  );


  server.tool(
    "ob_slo_enable",
    "Enable a disabled Service Level Objective (SLO). Resumes SLI calculation, error budget tracking, and burn rate monitoring. The SLO will continue from its previous state, preserving error budget. IMPORTANT: Provide the SLO 'id' (UUID or custom ID). Use Cases: Re-enabling SLOs after maintenance, activating SLOs after configuration, resuming monitoring after incidents.",
    z.object({
      sloId: z.string().describe("REQUIRED: SLO identifier (UUID or custom ID) to enable. Example: '8853b850-9a3c-11ec-b909-0242ac120002'. SLO will resume tracking immediately."),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await ob_slo_enable_impl(
        kibanaClient,
        params.sloId,
        params.space || defaultSpace
      );
    }
  );

  server.tool(
    "ob_slo_disable",
    "Disable a Service Level Objective (SLO). Pauses SLI calculation and error budget tracking. Historical data is preserved but no new data is collected. Burn rate alerts will not trigger. IMPORTANT: Provide the SLO 'id' (UUID or custom ID). Use Cases: Temporary maintenance windows, pausing monitoring during known issues, disabling SLOs for decommissioned features while preserving historical data.",
    z.object({
      sloId: z.string().describe("REQUIRED: SLO identifier (UUID or custom ID) to disable. Example: '8853b850-9a3c-11ec-b909-0242ac120002'. SLO will stop tracking immediately."),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await ob_slo_disable_impl(
        kibanaClient,
        params.sloId,
        params.space || defaultSpace
      );
    }
  );
}

