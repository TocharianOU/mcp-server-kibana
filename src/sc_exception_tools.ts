import { z } from 'zod';
import { ServerBase, KibanaClient, ToolResponse } from './types.js';

/**
 * Security Exception Lists Tools (sc_exception_*) - Kibana Security Exception Lists Management Tools
 * 
 * This module provides comprehensive tools for managing Exception Lists in Kibana Security.
 * Exception Lists are used to prevent detection rules from generating alerts for known benign activities,
 * significantly reducing false positives and improving detection accuracy.
 * 
 * Exception lists can be associated with:
 * - Detection rules (to filter out known good behavior)
 * - Endpoint protection (to allow trusted applications)
 * 
 * All tools are based on the official Kibana Security Exceptions API specification.
 */

// ============================================================================
// EXCEPTION LIST CORE MANAGEMENT TOOLS
// ============================================================================

/**
 * Get exception list by ID or list_id
 */
async function sc_get_exception_list_impl(
  kibanaClient: KibanaClient,
  id?: string,
  listId?: string,
  namespaceType?: 'agnostic' | 'single',
  space?: string
): Promise<ToolResponse> {
  try {
    if (!id && !listId) {
      return {
        content: [{
          type: "text",
          text: "Error: Either 'id' or 'listId' parameter is required to identify the exception list."
        }],
        isError: true
      };
    }

    const params = new URLSearchParams();
    if (id) {
      params.append('id', id);
    }
    if (listId) {
      params.append('list_id', listId);
    }
    if (namespaceType) {
      params.append('namespace_type', namespaceType);
    }

    const url = `/api/exception_lists?${params.toString()}`;
    const response = await kibanaClient.get(url, { space });

    return {
      content: [{
        type: "text",
        text: `Exception list retrieved successfully:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error retrieving exception list: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}



/**
 * Find exception lists
 */
async function sc_find_exception_lists_impl(
  kibanaClient: KibanaClient,
  filter?: string,
  page?: number,
  perPage?: number,
  sortField?: string,
  sortOrder?: 'asc' | 'desc',
  namespaceType?: string,
  space?: string
): Promise<ToolResponse> {
  try {
    const params = new URLSearchParams();
    
    if (filter) {
      params.append('filter', filter);
    }
    if (page !== undefined) {
      params.append('page', page.toString());
    }
    if (perPage !== undefined) {
      params.append('per_page', perPage.toString());
    }
    if (sortField) {
      params.append('sort_field', sortField);
    }
    if (sortOrder) {
      params.append('sort_order', sortOrder);
    }
    if (namespaceType) {
      params.append('namespace_type', namespaceType);
    }

    const url = `/api/exception_lists/_find${params.toString() ? '?' + params.toString() : ''}`;
    const response = await kibanaClient.get(url, { space });

    return {
      content: [{
        type: "text",
        text: `Exception lists found:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error finding exception lists: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Duplicate exception list
 */
async function sc_duplicate_exception_list_impl(
  kibanaClient: KibanaClient,
  listId: string,
  namespaceType?: 'agnostic' | 'single',
  includeExpiredExceptions?: boolean,
  space?: string
): Promise<ToolResponse> {
  try {
    const params = new URLSearchParams();
    params.append('list_id', listId);
    
    if (namespaceType) {
      params.append('namespace_type', namespaceType);
    }
    if (includeExpiredExceptions !== undefined) {
      params.append('include_expired_exceptions', includeExpiredExceptions.toString());
    }

    const url = `/api/exception_lists/_duplicate?${params.toString()}`;
    const response = await kibanaClient.post(url, {}, { space });

    return {
      content: [{
        type: "text",
        text: `Exception list duplicated successfully:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error duplicating exception list: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}



// ============================================================================
// EXCEPTION LIST ITEMS MANAGEMENT TOOLS
// ============================================================================

/**
 * Get exception list item
 */
async function sc_get_exception_item_impl(
  kibanaClient: KibanaClient,
  id?: string,
  itemId?: string,
  namespaceType?: 'agnostic' | 'single',
  space?: string
): Promise<ToolResponse> {
  try {
    if (!id && !itemId) {
      return {
        content: [{
          type: "text",
          text: "Error: Either 'id' or 'itemId' parameter is required to identify the exception item."
        }],
        isError: true
      };
    }

    const params = new URLSearchParams();
    if (id) {
      params.append('id', id);
    }
    if (itemId) {
      params.append('item_id', itemId);
    }
    if (namespaceType) {
      params.append('namespace_type', namespaceType);
    }

    const url = `/api/exception_lists/items?${params.toString()}`;
    const response = await kibanaClient.get(url, { space });

    return {
      content: [{
        type: "text",
        text: `Exception item retrieved successfully:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error retrieving exception item: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}



/**
 * Find exception list items
 */
async function sc_find_exception_items_impl(
  kibanaClient: KibanaClient,
  listId: string,
  filter?: string,
  page?: number,
  perPage?: number,
  sortField?: string,
  sortOrder?: 'asc' | 'desc',
  namespaceType?: string,
  space?: string
): Promise<ToolResponse> {
  try {
    const params = new URLSearchParams();
    params.append('list_id', listId);
    
    if (filter) {
      params.append('filter', filter);
    }
    if (page !== undefined) {
      params.append('page', page.toString());
    }
    if (perPage !== undefined) {
      params.append('per_page', perPage.toString());
    }
    if (sortField) {
      params.append('sort_field', sortField);
    }
    if (sortOrder) {
      params.append('sort_order', sortOrder);
    }
    if (namespaceType) {
      params.append('namespace_type', namespaceType);
    }

    const url = `/api/exception_lists/items/_find?${params.toString()}`;
    const response = await kibanaClient.get(url, { space });

    return {
      content: [{
        type: "text",
        text: `Exception items found:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error finding exception items: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Get exception list summary
 */
async function sc_get_exception_summary_impl(
  kibanaClient: KibanaClient,
  id: string,
  listId: string,
  namespaceType?: 'agnostic' | 'single',
  filter?: string,
  space?: string
): Promise<ToolResponse> {
  try {
    const params = new URLSearchParams();
    params.append('id', id);
    params.append('list_id', listId);
    
    if (namespaceType) {
      params.append('namespace_type', namespaceType);
    }
    if (filter) {
      params.append('filter', filter);
    }

    const url = `/api/exception_lists/summary?${params.toString()}`;
    const response = await kibanaClient.get(url, { space });

    return {
      content: [{
        type: "text",
        text: `Exception list summary:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error getting exception list summary: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

// ============================================================================
// TOOL REGISTRATION
// ============================================================================

/**
 * Register all Security Exception Lists tools with the MCP server
 */
export async function registerSCExceptionTools(
  server: ServerBase,
  kibanaClient: KibanaClient,
  defaultSpace: string
): Promise<void> {
  // ========== Exception List Core Management ==========

  server.tool(
    "sc_get_exception_list",
    "Get details of a Security Exception List. Exception lists are used to prevent detection rules from generating alerts for known benign activities, reducing false positives. IMPORTANT: Specify either 'id' (UUID) or 'listId' (human-readable ID). Also specify 'namespaceType' to indicate if it's a single-space or agnostic list. Returns list metadata, type (detection/endpoint/rule_default), tags, and associated rules.",
    z.object({
      id: z.string().optional().describe("OPTIONAL: Exception list UUID. Either 'id' or 'listId' must be specified. Example: '9e5fc75a-a3da-46c5-96e3-a2ec59c6bb85'"),
      listId: z.string().optional().describe("OPTIONAL: Human-readable exception list ID. Either 'id' or 'listId' must be specified. Example: 'trusted-linux-processes'"),
      namespaceType: z.enum(['agnostic', 'single']).optional().describe("OPTIONAL: Namespace type. 'single' = space-specific (default), 'agnostic' = shared across all spaces"),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await sc_get_exception_list_impl(
        kibanaClient,
        params.id,
        params.listId,
        params.namespaceType,
        params.space || defaultSpace
      );
    }
  );



  server.tool(
    "sc_find_exception_lists",
    "Search and find Security Exception Lists. Supports filtering, pagination, and sorting. IMPORTANT: Use 'filter' for KQL-based filtering (e.g., 'exception-list.attributes.name: \"trusted*\"'). Use 'page' and 'perPage' for pagination. Results include list metadata and item counts. Use Cases: Listing all exception lists, searching for specific lists, auditing exception configurations.",
    z.object({
      filter: z.string().optional().describe("OPTIONAL: KQL filter query. Example: 'exception-list.attributes.type: detection'"),
      page: z.number().optional().describe("OPTIONAL: Page number (starts from 1, default: 1)"),
      perPage: z.number().optional().describe("OPTIONAL: Items per page (default: 20, max: 10000)"),
      sortField: z.string().optional().describe("OPTIONAL: Field to sort by. Example: 'created_at', 'name'"),
      sortOrder: z.enum(['asc', 'desc']).optional().describe("OPTIONAL: Sort order. 'asc' = ascending, 'desc' = descending (default)"),
      namespaceType: z.string().optional().describe("OPTIONAL: Filter by namespace type. 'single', 'agnostic', or 'single,agnostic' for both"),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await sc_find_exception_lists_impl(
        kibanaClient,
        params.filter,
        params.page,
        params.perPage,
        params.sortField,
        params.sortOrder,
        params.namespaceType,
        params.space || defaultSpace
      );
    }
  );

  server.tool(
    "sc_duplicate_exception_list",
    "Duplicate an existing Security Exception List. Creates a copy with a new ID and all exception items. IMPORTANT: Provide 'listId' of the list to copy. Optionally set 'includeExpiredExceptions' to include expired items in the copy. The duplicated list will have a new auto-generated ID. Use Cases: Creating environment-specific copies, testing exception changes, backup before modifications.",
    z.object({
      listId: z.string().describe("REQUIRED: Human-readable ID of the exception list to duplicate. Example: 'trusted-linux-processes'"),
      namespaceType: z.enum(['agnostic', 'single']).optional().describe("OPTIONAL: Namespace type of the source list. 'single' = space-specific (default), 'agnostic' = shared across all spaces"),
      includeExpiredExceptions: z.boolean().optional().describe("OPTIONAL: Include expired exception items in the duplicate (default: true)"),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await sc_duplicate_exception_list_impl(
        kibanaClient,
        params.listId,
        params.namespaceType,
        params.includeExpiredExceptions,
        params.space || defaultSpace
      );
    }
  );


  // ========== Exception List Items Management ==========

  server.tool(
    "sc_get_exception_item",
    "Get details of a specific Exception Item. Exception items define the actual conditions for exceptions (e.g., 'process.name is powershell.exe'). IMPORTANT: Specify either 'id' (UUID) or 'itemId' (human-readable ID) to identify the item. Returns item entries, operators, and expiration time if set. Use Cases: Reviewing exception conditions, auditing exception items, checking expiration status.",
    z.object({
      id: z.string().optional().describe("OPTIONAL: Exception item UUID. Either 'id' or 'itemId' must be specified. Example: '71a9f4b2-c85c-49b4-866f-c71eb9e67da2'"),
      itemId: z.string().optional().describe("OPTIONAL: Human-readable exception item ID. Either 'id' or 'itemId' must be specified. Example: 'powershell-exception-1'"),
      namespaceType: z.enum(['agnostic', 'single']).optional().describe("OPTIONAL: Namespace type. 'single' = space-specific (default), 'agnostic' = shared across all spaces"),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await sc_get_exception_item_impl(
        kibanaClient,
        params.id,
        params.itemId,
        params.namespaceType,
        params.space || defaultSpace
      );
    }
  );


  server.tool(
    "sc_find_exception_items",
    "Search and find Exception Items within a specific exception list. Supports filtering, pagination, and sorting. IMPORTANT: Provide 'listId' to specify which list to search in. Use 'filter' for KQL-based filtering. Use 'page' and 'perPage' for pagination. Use Cases: Listing all items in an exception list, searching for specific exceptions, auditing exception conditions.",
    z.object({
      listId: z.string().describe("REQUIRED: Human-readable ID of the exception list to search items in. Example: 'trusted-linux-processes'"),
      filter: z.string().optional().describe("OPTIONAL: KQL filter query for exception items. Example: 'exception-list-agnostic.attributes.entries.field: \"process.name\"'"),
      page: z.number().optional().describe("OPTIONAL: Page number (starts from 1, default: 1)"),
      perPage: z.number().optional().describe("OPTIONAL: Items per page (default: 20, max: 10000)"),
      sortField: z.string().optional().describe("OPTIONAL: Field to sort by. Example: 'created_at', 'name'"),
      sortOrder: z.enum(['asc', 'desc']).optional().describe("OPTIONAL: Sort order. 'asc' = ascending, 'desc' = descending (default)"),
      namespaceType: z.string().optional().describe("OPTIONAL: Filter by namespace type. 'single', 'agnostic', or 'single,agnostic' for both"),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await sc_find_exception_items_impl(
        kibanaClient,
        params.listId,
        params.filter,
        params.page,
        params.perPage,
        params.sortField,
        params.sortOrder,
        params.namespaceType,
        params.space || defaultSpace
      );
    }
  );

  server.tool(
    "sc_get_exception_summary",
    "Get a summary of an Exception List including statistics about exception items. IMPORTANT: Provide both 'id' (UUID) and 'listId' (human-readable ID) of the list. Optionally provide 'filter' to get filtered statistics. Returns total item count, counts by OS type, and other metrics. Use Cases: Auditing exception list usage, monitoring list size, generating reports.",
    z.object({
      id: z.string().describe("REQUIRED: Exception list UUID. Example: '9e5fc75a-a3da-46c5-96e3-a2ec59c6bb85'"),
      listId: z.string().describe("REQUIRED: Human-readable exception list ID. Example: 'trusted-linux-processes'"),
      namespaceType: z.enum(['agnostic', 'single']).optional().describe("OPTIONAL: Namespace type. 'single' = space-specific (default), 'agnostic' = shared across all spaces"),
      filter: z.string().optional().describe("OPTIONAL: KQL filter for counting specific items. Example: 'exception-list-agnostic.attributes.tags: \"critical\"'"),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await sc_get_exception_summary_impl(
        kibanaClient,
        params.id,
        params.listId,
        params.namespaceType,
        params.filter,
        params.space || defaultSpace
      );
    }
  );
}

