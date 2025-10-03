import { z } from 'zod';
import { ServerBase, KibanaClient, ToolResponse } from './types.js';

/**
 * Security Lists Tools (sc_list_*) - Kibana Security Value Lists Management Tools
 * 
 * This module provides comprehensive tools for managing Value Lists in Kibana Security.
 * Value Lists (also called Lists) store large sets of values (IPs, domains, hashes, etc.)
 * that can be referenced by detection rules and exception lists to efficiently filter events.
 * 
 * Common use cases:
 * - IP whitelist/blacklist (trusted internal IPs, known malicious IPs)
 * - Domain whitelist/blacklist (corporate domains, malicious domains)
 * - File hash whitelist (approved software hashes)
 * - User/keyword lists (privileged users, monitored entities)
 * 
 * All tools are based on the official Kibana Security Lists API specification.
 */

// ============================================================================
// VALUE LISTS CORE MANAGEMENT TOOLS
// ============================================================================

/**
 * Get value list by ID
 */
async function sc_get_list_impl(
  kibanaClient: KibanaClient,
  id: string,
  space?: string
): Promise<ToolResponse> {
  try {
    const params = new URLSearchParams();
    params.append('id', id);

    const url = `/api/lists?${params.toString()}`;
    const response = await kibanaClient.get(url, { space });

    return {
      content: [{
        type: "text",
        text: `Value list retrieved successfully:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error retrieving value list: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}



/**
 * Find value lists
 */
async function sc_find_lists_impl(
  kibanaClient: KibanaClient,
  page?: number,
  perPage?: number,
  sortField?: string,
  sortOrder?: 'asc' | 'desc',
  filter?: string,
  cursor?: string,
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
    if (sortField) {
      params.append('sort_field', sortField);
    }
    if (sortOrder) {
      params.append('sort_order', sortOrder);
    }
    if (filter) {
      params.append('filter', filter);
    }
    if (cursor) {
      params.append('cursor', cursor);
    }

    const url = `/api/lists/_find${params.toString() ? '?' + params.toString() : ''}`;
    const response = await kibanaClient.get(url, { space });

    return {
      content: [{
        type: "text",
        text: `Value lists found:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error finding value lists: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Get list index privileges
 */
async function sc_get_list_privileges_impl(
  kibanaClient: KibanaClient,
  space?: string
): Promise<ToolResponse> {
  try {
    const response = await kibanaClient.get('/api/lists/privileges', { space });

    return {
      content: [{
        type: "text",
        text: `List privileges:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error getting list privileges: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}


/**
 * Get list item
 */
async function sc_get_list_item_impl(
  kibanaClient: KibanaClient,
  id?: string,
  listId?: string,
  value?: string,
  space?: string
): Promise<ToolResponse> {
  try {
    const params = new URLSearchParams();
    
    if (id) {
      params.append('id', id);
    }
    if (listId) {
      params.append('list_id', listId);
    }
    if (value) {
      params.append('value', value);
    }

    const url = `/api/lists/items?${params.toString()}`;
    const response = await kibanaClient.get(url, { space });

    return {
      content: [{
        type: "text",
        text: `List item retrieved successfully:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error retrieving list item: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}



/**
 * Find list items
 */
async function sc_find_list_items_impl(
  kibanaClient: KibanaClient,
  listId: string,
  page?: number,
  perPage?: number,
  sortField?: string,
  sortOrder?: 'asc' | 'desc',
  filter?: string,
  cursor?: string,
  space?: string
): Promise<ToolResponse> {
  try {
    const params = new URLSearchParams();
    params.append('list_id', listId);
    
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
    if (filter) {
      params.append('filter', filter);
    }
    if (cursor) {
      params.append('cursor', cursor);
    }

    const url = `/api/lists/items/_find?${params.toString()}`;
    const response = await kibanaClient.get(url, { space });

    return {
      content: [{
        type: "text",
        text: `List items found:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error finding list items: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}



// ============================================================================
// TOOL REGISTRATION
// ============================================================================

/**
 * Register all Security Lists tools with the MCP server
 */
export async function registerSCListTools(
  server: ServerBase,
  kibanaClient: KibanaClient,
  defaultSpace: string
): Promise<void> {
  // ========== Value Lists Core Management ==========

  server.tool(
    "sc_get_list",
    "Get details of a Security Value List. Value lists store large sets of values (IPs, domains, hashes) that can be efficiently referenced by detection rules and exception lists. IMPORTANT: Provide the list 'id' (UUID). Returns list metadata including type (ip/keyword/text), item count, and references. Use Cases: Checking list configuration, viewing list metadata, auditing list usage.",
    z.object({
      id: z.string().describe("REQUIRED: Value list UUID to retrieve. Example: '21b01cfb-058d-44b9-838c-282be16c91cd'"),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await sc_get_list_impl(
        kibanaClient,
        params.id,
        params.space || defaultSpace
      );
    }
  );


  server.tool(
    "sc_find_lists",
    "Search and find Security Value Lists. Supports filtering, pagination, sorting, and cursor-based navigation. IMPORTANT: Use 'filter' for KQL-based filtering. Use 'page' and 'perPage' for pagination, or 'cursor' for cursor-based navigation. Returns list metadata and item counts. Use Cases: Listing all value lists, searching for specific lists, auditing list configurations.",
    z.object({
      page: z.number().optional().describe("OPTIONAL: Page number (starts from 1, default: 1)"),
      perPage: z.number().optional().describe("OPTIONAL: Items per page (default: 20)"),
      sortField: z.string().optional().describe("OPTIONAL: Field to sort by. Example: 'created_at', 'name', 'updated_at'"),
      sortOrder: z.enum(['asc', 'desc']).optional().describe("OPTIONAL: Sort order. 'asc' = ascending, 'desc' = descending (default)"),
      filter: z.string().optional().describe("OPTIONAL: KQL filter query. Example: 'name: \"*ip*\"' to find IP lists"),
      cursor: z.string().optional().describe("OPTIONAL: Cursor for pagination. Use the cursor from previous response for next page."),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await sc_find_lists_impl(
        kibanaClient,
        params.page,
        params.perPage,
        params.sortField,
        params.sortOrder,
        params.filter,
        params.cursor,
        params.space || defaultSpace
      );
    }
  );

  server.tool(
    "sc_get_list_privileges",
    "Get current user's privileges for Security Value Lists. Returns information about list management permissions. IMPORTANT: No parameters required. Returns whether user can read, write, and manage value lists. Use Cases: Checking permissions before operations, troubleshooting access issues, auditing user capabilities.",
    z.object({
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await sc_get_list_privileges_impl(
        kibanaClient,
        params.space || defaultSpace
      );
    }
  );

  // ========== List Items Management ==========

  server.tool(
    "sc_get_list_item",
    "Get a specific item from a Security Value List. IMPORTANT: Provide either 'id' (item UUID), or both 'listId' and 'value' to find item by value. Returns the item value and metadata. Use Cases: Checking if specific value exists in list, retrieving item details, verifying item metadata.",
    z.object({
      id: z.string().optional().describe("OPTIONAL: List item UUID. Either 'id' or ('listId' and 'value') must be specified."),
      listId: z.string().optional().describe("OPTIONAL: Value list ID to search in. Required if using 'value'. Example: 'internal-ips-production'"),
      value: z.string().optional().describe("OPTIONAL: Item value to search for. Required if using 'listId'. Example: '192.168.1.1'"),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await sc_get_list_item_impl(
        kibanaClient,
        params.id,
        params.listId,
        params.value,
        params.space || defaultSpace
      );
    }
  );


  server.tool(
    "sc_find_list_items",
    "Search and find items in a specific Security Value List. Supports filtering, pagination, sorting, and cursor-based navigation. IMPORTANT: Provide 'listId' to specify which list to search. Use 'filter' for KQL filtering, 'cursor' for efficient pagination of large lists. Use Cases: Listing all items in a list, searching for specific values, auditing list contents, paginating through large lists.",
    z.object({
      listId: z.string().describe("REQUIRED: Value list ID to search items in. Example: 'internal-ips-production'"),
      page: z.number().optional().describe("OPTIONAL: Page number (starts from 1, default: 1)"),
      perPage: z.number().optional().describe("OPTIONAL: Items per page (default: 20, recommended max: 100 for performance)"),
      sortField: z.string().optional().describe("OPTIONAL: Field to sort by. Example: 'created_at', 'value'"),
      sortOrder: z.enum(['asc', 'desc']).optional().describe("OPTIONAL: Sort order. 'asc' = ascending, 'desc' = descending (default)"),
      filter: z.string().optional().describe("OPTIONAL: KQL filter query for items. Example: 'value: \"192.168.*\"'"),
      cursor: z.string().optional().describe("OPTIONAL: Cursor for pagination. Use cursor from previous response for next page. Recommended for large lists."),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await sc_find_list_items_impl(
        kibanaClient,
        params.listId,
        params.page,
        params.perPage,
        params.sortField,
        params.sortOrder,
        params.filter,
        params.cursor,
        params.space || defaultSpace
      );
    }
  );

}

