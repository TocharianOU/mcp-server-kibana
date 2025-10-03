import { z } from 'zod';
import { ServerBase, KibanaClient, ToolResponse } from './types.js';

/**
 * Data Views Tools (dataview_*) - Kibana Data Views Management Tools
 * 
 * This module provides comprehensive tools for managing Data Views (formerly Index Patterns) in Kibana.
 * Data Views are the fundamental data abstraction layer that defines how Kibana accesses Elasticsearch data.
 * 
 * Key features:
 * - Define index patterns (e.g., logs-*, metrics-*)
 * - Configure time fields for time-series data
 * - Manage field formatting (dates, numbers, strings)
 * - Create runtime fields (computed on-the-fly)
 * - Field capabilities (searchable, aggregatable)
 * 
 * Data Views are used by ALL Kibana data features:
 * - Discover (data exploration)
 * - Dashboard (visualizations)
 * - Lens (visual builder)
 * - Maps (geospatial data)
 * - Canvas (custom layouts)
 * 
 * All tools are based on the official Kibana Data Views API specification.
 */

// ============================================================================
// DATA VIEWS CORE MANAGEMENT TOOLS
// ============================================================================

/**
 * Get all data views
 */
async function dataview_get_all_impl(
  kibanaClient: KibanaClient,
  space?: string
): Promise<ToolResponse> {
  try {
    const response = await kibanaClient.get('/api/data_views', { space });

    return {
      content: [{
        type: "text",
        text: `Data views retrieved successfully:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error retrieving data views: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Get data view by ID
 */
async function dataview_get_impl(
  kibanaClient: KibanaClient,
  viewId: string,
  space?: string
): Promise<ToolResponse> {
  try {
    const url = `/api/data_views/data_view/${viewId}`;
    const response = await kibanaClient.get(url, { space });

    return {
      content: [{
        type: "text",
        text: `Data view retrieved successfully:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error retrieving data view: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}



/**
 * Get data view fields
 */
async function dataview_get_fields_impl(
  kibanaClient: KibanaClient,
  viewId: string,
  space?: string
): Promise<ToolResponse> {
  try {
    const url = `/api/data_views/data_view/${viewId}/fields`;
    const response = await kibanaClient.get(url, { space });

    return {
      content: [{
        type: "text",
        text: `Data view fields retrieved successfully:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error retrieving data view fields: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Get default data view
 */
async function dataview_get_default_impl(
  kibanaClient: KibanaClient,
  space?: string
): Promise<ToolResponse> {
  try {
    const response = await kibanaClient.get('/api/data_views/default', { space });

    return {
      content: [{
        type: "text",
        text: `Default data view retrieved successfully:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error retrieving default data view: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}



/**
 * Set default data view
 */
async function dataview_set_default_impl(
  kibanaClient: KibanaClient,
  id: string | null,
  force?: boolean,
  space?: string
): Promise<ToolResponse> {
  try {
    const body: any = {
      data_view_id: id
    };

    if (force !== undefined) {
      body.force = force;
    }

    const response = await kibanaClient.post('/api/data_views/default', body, { space });

    return {
      content: [{
        type: "text",
        text: `Default data view ${id ? 'set' : 'cleared'} successfully:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error setting default data view: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Swap data view references
 */
async function dataview_swap_references_impl(
  kibanaClient: KibanaClient,
  fromId: string,
  toId: string,
  forceDelete?: boolean,
  space?: string
): Promise<ToolResponse> {
  try {
    const body: any = {
      fromId,
      toId
    };

    if (forceDelete !== undefined) {
      body.forceDelete = forceDelete;
    }

    const response = await kibanaClient.post('/api/data_views/swap_references', body, { space });

    return {
      content: [{
        type: "text",
        text: `Data view references swapped successfully:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error swapping data view references: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Preview swap data view references
 */
async function dataview_preview_swap_references_impl(
  kibanaClient: KibanaClient,
  fromId: string,
  toId: string,
  space?: string
): Promise<ToolResponse> {
  try {
    const body = {
      fromId,
      toId
    };

    const response = await kibanaClient.post('/api/data_views/swap_references/_preview', body, { space });

    return {
      content: [{
        type: "text",
        text: `Swap references preview:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error previewing swap references: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

// ============================================================================
// TOOL REGISTRATION
// ============================================================================

/**
 * Register all Data Views tools with the MCP server
 */
export async function registerDataViewTools(
  server: ServerBase,
  kibanaClient: KibanaClient,
  defaultSpace: string
): Promise<void> {
  server.tool(
    "dataview_get_all",
    "Get all Data Views in the current Kibana space. Data Views (formerly Index Patterns) define how Kibana accesses Elasticsearch data. Returns a list of all data views with their IDs, names, titles, and namespaces. Use Cases: Discovering available data views, auditing data view configuration, checking which data sources are configured.",
    z.object({
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await dataview_get_all_impl(
        kibanaClient,
        params.space || defaultSpace
      );
    }
  );

  server.tool(
    "dataview_get",
    "Get details of a specific Data View by ID. Returns complete data view configuration including index pattern, time field, field list, runtime fields, and field formatters. IMPORTANT: Provide the data view 'viewId' (UUID). Use Cases: Inspecting data view configuration, viewing field mappings, checking runtime fields, understanding data structure.",
    z.object({
      viewId: z.string().describe("REQUIRED: Data view UUID. Example: '90943e30-9a47-11e8-b64d-95841ca0b247'. Get IDs from dataview_get_all."),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await dataview_get_impl(
        kibanaClient,
        params.viewId,
        params.space || defaultSpace
      );
    }
  );


  server.tool(
    "dataview_get_fields",
    "Get all fields from a Data View. Returns detailed field information including field types, capabilities (searchable/aggregatable), and metadata. IMPORTANT: Provide the 'viewId' (UUID). Fields are discovered from the matching Elasticsearch indices. Use Cases: Exploring available fields, checking field types, understanding field capabilities, building field selectors.",
    z.object({
      viewId: z.string().describe("REQUIRED: Data view UUID. Example: '90943e30-9a47-11e8-b64d-95841ca0b247'"),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await dataview_get_fields_impl(
        kibanaClient,
        params.viewId,
        params.space || defaultSpace
      );
    }
  );

  server.tool(
    "dataview_get_default",
    "Get the current default Data View for the Kibana space. The default data view is automatically used when creating new visualizations or opening Discover without specifying a data view. Returns the data view ID if set, or empty if no default is configured. Use Cases: Checking current default data view, verifying space configuration, understanding default behavior.",
    z.object({
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await dataview_get_default_impl(
        kibanaClient,
        params.space || defaultSpace
      );
    }
  );

  // Removed tools (complex configuration or dangerous operations):
  // - dataview_set_default (use execute_kb_api if needed)
  // - dataview_swap_references (complex operation, use execute_kb_api)
  // - dataview_preview_swap_references (use execute_kb_api)
}

