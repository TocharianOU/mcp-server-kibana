import { z } from "zod";
import { ServerBase, KibanaClient, ToolResponse } from "./types";

/**
 * Visualization Tools (vl_*) - Kibana Data Visualization Tools
 * 
 * This module provides comprehensive tools for managing Kibana visualizations,
 * dashboards, and saved objects. All tools are based on the official Kibana
 * OpenAPI specification and follow strict type safety.
 */

// ============================================================================
// SEARCH AND DISCOVERY TOOLS (vl_search_*)
// ============================================================================

/**
 * Search for Kibana saved objects using the saved objects API
 * @param kibanaClient - Kibana client instance
 * @param search - Search query string (optional)
 * @param types - Saved object types to include (optional, defaults to all types)
 * @param perPage - Number of results per page (optional)
 * @param page - Page number (optional)
 * @param fields - Fields to return (optional)
 * @param filter - KQL filter (optional)
 * @param sortField - Field to sort by (optional)
 * @param sortOrder - Sort order: 'asc' for ascending, 'desc' for descending (optional)
 * @param defaultSearchOperator - Default operator for simple_query_string (optional)
 * @param searchFields - Fields to perform the search query against (optional)
 * @param hasReference - Filter to objects that have a relationship with the type and ID combination (optional)
 * @param hasNoReference - Filter to objects that do not have a relationship with the type and identifier combination (optional)
 * @param hasReferenceOperator - Operator for has_reference parameter (optional)
 * @param hasNoReferenceOperator - Operator for has_no_reference parameter (optional)
 * @param aggs - Aggregation structure (optional)
 * @param space - Target Kibana space (optional, defaults to configured space)
 * @returns Promise<ToolResponse> - MCP tool response
 */
async function vl_search_saved_objects_impl(
  kibanaClient: KibanaClient,
  search?: string,
  types?: string | string[],
  perPage?: number,
  page?: number,
  fields?: string | string[],
  filter?: string,
  sortField?: string,
  sortOrder?: 'asc' | 'desc',
  defaultSearchOperator?: string,
  searchFields?: string | string[],
  hasReference?: any,
  hasNoReference?: any,
  hasReferenceOperator?: string,
  hasNoReferenceOperator?: string,
  aggs?: string,
  space?: string
): Promise<ToolResponse> {
  const params = new URLSearchParams();
  
  // Core search parameters
  if (search) {
    params.append('search', search);
  }
  
  // Type filtering - support both single type and multiple types (REQUIRED)
  if (types) {
    // Apply the same transform logic as in Zod schema
    let typesArray: string[];
    if (Array.isArray(types)) {
      typesArray = types;
    } else if (typeof types === 'string') {
      try {
        const parsed = JSON.parse(types);
        typesArray = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        typesArray = types.split(',').map(s => s.trim()).filter(s => s);
      }
    } else {
      typesArray = [types];
    }
    typesArray.forEach(type => params.append('type', type));
  }
  
  // Pagination
  if (perPage !== undefined) {
    params.append('per_page', perPage.toString());
  }
  
  if (page !== undefined) {
    params.append('page', page.toString());
  }
  
  // Response filtering
  if (fields) {
    // Apply the same transform logic as in Zod schema
    let fieldsArray: string[];
    if (Array.isArray(fields)) {
      fieldsArray = fields;
    } else if (typeof fields === 'string') {
      try {
        const parsed = JSON.parse(fields);
        fieldsArray = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        fieldsArray = fields.split(',').map(s => s.trim()).filter(s => s);
      }
    } else {
      fieldsArray = [fields];
    }
    fieldsArray.forEach(field => params.append('fields', field));
  }
  
  // Advanced filtering
  if (filter) {
    params.append('filter', filter);
  }
  
  // Sorting
  if (sortField) {
    params.append('sort_field', sortField);
  }
  
  if (sortOrder) {
    params.append('sort_order', sortOrder);
  }
  
  // Search behavior
  if (defaultSearchOperator) {
    params.append('default_search_operator', defaultSearchOperator);
  }
  
  // if (searchFields) {
  //   // Apply the same transform logic as in Zod schema
  //   let searchFieldsArray: string[];
  //   if (Array.isArray(searchFields)) {
  //     searchFieldsArray = searchFields;
  //   } else if (typeof searchFields === 'string') {
  //     try {
  //       const parsed = JSON.parse(searchFields);
  //       searchFieldsArray = Array.isArray(parsed) ? parsed : [parsed];
  //     } catch {
  //       searchFieldsArray = searchFields.split(',').map(s => s.trim()).filter(s => s);
  //     }
  //   } else {
  //     searchFieldsArray = [searchFields];
  //   }
  //   searchFieldsArray.forEach(field => params.append('search_fields', field));
  // }
  
  // Reference filtering
  if (hasReference) {
    params.append('has_reference', JSON.stringify(hasReference));
  }
  
  if (hasNoReference) {
    params.append('has_no_reference', JSON.stringify(hasNoReference));
  }
  
  if (hasReferenceOperator) {
    params.append('has_reference_operator', hasReferenceOperator);
  }
  
  if (hasNoReferenceOperator) {
    params.append('has_no_reference_operator', hasNoReferenceOperator);
  }
  
  // Aggregations
  if (aggs) {
    params.append('aggs', aggs);
  }
  
  try {
    const url = `/api/saved_objects/_find?${params.toString()}`;
    const response = await kibanaClient.get(url, { space });
    const savedObjects = response.saved_objects || [];
    
    // Format the response to be more user-friendly
    const formattedSavedObjects = savedObjects.map((savedObject: any) => {
      const result: any = {
        id: savedObject.id,
        type: savedObject.type,
        updated_at: savedObject.updated_at,
        created_at: savedObject.created_at,
        managed: savedObject.managed || false,
        namespaces: savedObject.namespaces || [],
      };
      
      // Only include attributes if they exist (handles fields parameter)
      if (savedObject.attributes) {
        // Include common attributes that are likely to be useful
        if (savedObject.attributes.title !== undefined) {
          result.title = savedObject.attributes.title;
        }
        if (savedObject.attributes.description !== undefined) {
          result.description = savedObject.attributes.description;
        }
        if (savedObject.attributes.version !== undefined) {
          result.version = savedObject.attributes.version;
        }
        
        // Include type-specific attributes
        if (savedObject.type === 'index-pattern' && savedObject.attributes.timeFieldName !== undefined) {
          result.timeFieldName = savedObject.attributes.timeFieldName;
        }
        if (savedObject.type === 'visualization' && savedObject.attributes.visState !== undefined) {
          try {
            const visState = JSON.parse(savedObject.attributes.visState);
            if (visState.type) {
              result.visualizationType = visState.type;
            }
          } catch {
            // Ignore parsing errors
          }
        }
      }
      
      // Include references if they exist
      if (savedObject.references && savedObject.references.length > 0) {
        result.references = savedObject.references.map((ref: any) => ({
          id: ref.id,
          type: ref.type,
          name: ref.name
        }));
      }
      
      // Only include score and sort if they exist (for debugging)
      if (savedObject.score) {
        result.score = savedObject.score;
      }
      if (savedObject.sort) {
        result.sort = savedObject.sort;
      }
      
      return result;
    });
    
    return {
      content: [
        {
          type: "text",
          text: `Found ${savedObjects.length} saved object(s):\n\n${JSON.stringify(formattedSavedObjects, null, 2)}`
        }
      ]
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Failed to search saved objects: ${errorMessage}`
        }
      ],
      isError: true
    };
  }
}

// ============================================================================
// REGISTRATION FUNCTION
// ============================================================================

/**
 * Register all visualization tools with the MCP server
 * 
 * @param server - MCP server instance
 * @param kibanaClient - Kibana client instance
 * @param defaultSpace - Default Kibana space
 */
export function registerVlTools(server: ServerBase, kibanaClient: KibanaClient, defaultSpace: string) {
  // Tool: Search for Kibana dashboards - Optimized for dashboard search
 

  // Tool: Search for Kibana saved objects - Universal saved objects search
  server.tool(
    "vl_search_saved_objects",
    "Search for Kibana saved objects using Elasticsearch query syntax. This is a universal tool that can search across all saved object types (dashboard, visualization, index-pattern, search, config, lens, map, tag, canvas-workpad, canvas-element, etc.). IMPORTANT: You must specify the 'types' parameter - it is required by the Kibana API. PERFORMANCE TIPS: Always use 'fields' parameter to specify only needed fields (e.g., ['title', 'description']) for faster responses. Use 'perPage' 5-20 for optimal speed. PAGINATION: To get all results, make multiple requests with incrementing 'page' numbers (page=1, page=2, etc.) until you receive fewer results than 'perPage'. Don't stop at the first page - iterate through all pages for complete data. Returns formatted saved object information including type, title, description, and timestamps.",
    z.object({
      search: z.string().optional().describe("Search query to filter saved objects. Supports boolean operators (AND, OR), wildcards (*), and phrases in quotes. Example: 'nginx AND logs' or 'web*'."),
      types: z.union([z.string(), z.array(z.string())]).transform(val => {
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') {
          try {
            const parsed = JSON.parse(val);
            return Array.isArray(parsed) ? parsed : [parsed];
          } catch {
            return val.split(',').map(s => s.trim()).filter(s => s);
          }
        }
        return [val];
      }).describe("REQUIRED: Saved object types to include. Common types: 'dashboard', 'visualization', 'index-pattern', 'search', 'config', 'lens', 'map', 'tag', 'canvas-workpad', 'canvas-element'. Use ['dashboard', 'visualization'] to search both types. You must specify at least one type."),
      perPage: z.number().optional().describe("Number of saved objects per page (default: 20). PERFORMANCE TIP: Use 5-20 for faster responses. Large values (>50) can be slow and may timeout. Always combine with 'fields' parameter to limit data when using large perPage values."),
      page: z.number().optional().describe("Page number to return (starts from 1). Use with perPage for pagination. Example: page=1 gets first 20 results, page=2 gets results 21-40, etc. IMPORTANT: To get all results, you need to make multiple requests with incrementing page numbers until you receive fewer results than perPage. Don't stop at page 1 - iterate through all pages to get complete data."),
      fields: z.union([z.string(), z.array(z.string())]).transform(val => {
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') {
          try {
            const parsed = JSON.parse(val);
            return Array.isArray(parsed) ? parsed : [parsed];
          } catch {
            return val.split(',').map(s => s.trim()).filter(s => s);
          }
        }
        return [val];
      }).optional().describe("PERFORMANCE OPTIMIZATION: Specify which fields to return in the attributes key. Examples: ['title', 'description'] for basic info, ['title', 'description', 'updated_at'] for metadata. IMPORTANT: Using this parameter dramatically improves response speed and reduces data size. Without it, all object data is returned which can be very slow for large objects."),
      filter: z.string().optional().describe("KQL string filter (e.g., 'dashboard.attributes.title: \"My Dashboard\"')"),
      sortField: z.string().optional().describe("Field to sort by (e.g., 'updated_at', 'created_at', 'type', 'dashboard.attributes.title')"),
      sortOrder: z.enum(['asc', 'desc']).optional().describe("Sort order: 'asc' for ascending, 'desc' for descending (default: 'desc')"),
      defaultSearchOperator: z.string().optional().describe("Default operator for simple_query_string (OR/AND, default: OR)"),
      // searchFields: z.union([z.string(), z.array(z.string())]).transform(val => {
      //   if (Array.isArray(val)) return val;
      //   if (typeof val === 'string') {
      //     try {
      //       const parsed = JSON.parse(val);
      //       return Array.isArray(parsed) ? parsed : [parsed];
      //     } catch {
      //       return val.split(',').map(s => s.trim()).filter(s => s);
      //     }
      //   }
      //   return [val];
      // }).optional().describe("Fields to perform the search query against. Default: searches in title and description. Use ['dashboard.attributes.title'] to search only titles."),
      hasReference: z.any().optional().describe("Filter to objects that have a relationship with the type and ID combination. Example: {type: 'index-pattern', id: 'my-pattern-id'}"),
      hasNoReference: z.any().optional().describe("Filter to objects that do not have a relationship with the type and identifier combination. Example: {type: 'index-pattern', id: 'my-pattern-id'}"),
      hasReferenceOperator: z.string().optional().describe("Operator for has_reference parameter (OR/AND, default: OR)"),
      hasNoReferenceOperator: z.string().optional().describe("Operator for has_no_reference parameter (OR/AND, default: OR)"),
      aggs: z.string().optional().describe("Aggregation structure, serialized as a string. Use for advanced analytics on saved objects."),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await vl_search_saved_objects_impl(
        kibanaClient,
        params.search,
        params.types,
        params.perPage,
        params.page,
        params.fields,
        params.filter,
        params.sortField,
        params.sortOrder,
        params.defaultSearchOperator,
        undefined, // params.searchFields - commented out
        params.hasReference,
        params.hasNoReference,
        params.hasReferenceOperator,
        params.hasNoReferenceOperator,
        params.aggs,
        params.space
      );
    }
  );
}


