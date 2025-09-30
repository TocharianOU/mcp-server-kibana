import { z } from 'zod';
import { ServerBase, KibanaClient, ToolResponse } from './types.js';

/**
 * Implementation function for getting a single Kibana saved object by type and ID.
 * 
 * @param kibanaClient - The Kibana client instance
 * @param type - The saved object type (e.g., 'dashboard', 'visualization', 'index-pattern')
 * @param id - The saved object ID
 * @param useResolve - Whether to use resolve API (handles legacy URL aliases)
 * @param space - The Kibana space (optional)
 * @returns Promise<ToolResponse> - The tool response containing the saved object data
 */
async function vl_get_saved_object_impl(
  kibanaClient: KibanaClient,
  type: string,
  id: string,
  useResolve?: boolean,
  space?: string
): Promise<ToolResponse> {
  try {
    // Choose API endpoint based on useResolve flag
    const endpoint = useResolve 
      ? `/api/saved_objects/resolve/${encodeURIComponent(type)}/${encodeURIComponent(id)}`
      : `/api/saved_objects/${encodeURIComponent(type)}/${encodeURIComponent(id)}`;

    const response = await kibanaClient.get(endpoint, { space });
    
    // Format the response data
    const savedObject = response;
    
    if (!savedObject) {
      return {
        content: [
          {
            type: "text",
            text: `No saved object found with type '${type}' and id '${id}'`
          }
        ],
        isError: true
      };
    }

    // Create formatted result with essential information
    const result: any = {
      id: savedObject.id,
      type: savedObject.type,
      updated_at: savedObject.updated_at,
      created_at: savedObject.created_at,
      version: savedObject.version,
      managed: savedObject.managed || false,
      namespaces: savedObject.namespaces || [],
    };

    // Add attributes if they exist
    if (savedObject.attributes) {
      if (savedObject.attributes.title !== undefined) {
        result.title = savedObject.attributes.title;
      }
      if (savedObject.attributes.description !== undefined) {
        result.description = savedObject.attributes.description;
      }

      // Type-specific attributes
      if (savedObject.type === 'dashboard') {
        if (savedObject.attributes.panelsJSON !== undefined) {
          try {
            const panels = JSON.parse(savedObject.attributes.panelsJSON);
            result.panelCount = panels.length;
            result.panels = panels.map((panel: any) => ({
              id: panel.panelIndex,
              type: panel.type,
              title: panel.title || 'Untitled Panel'
            }));
          } catch {
            // Ignore parsing errors
          }
        }
        if (savedObject.attributes.timeRestore !== undefined) {
          result.timeRestore = savedObject.attributes.timeRestore;
        }
        if (savedObject.attributes.timeTo !== undefined) {
          result.timeTo = savedObject.attributes.timeTo;
        }
        if (savedObject.attributes.timeFrom !== undefined) {
          result.timeFrom = savedObject.attributes.timeFrom;
        }
      }

      if (savedObject.type === 'visualization') {
        if (savedObject.attributes.visState !== undefined) {
          try {
            const visState = JSON.parse(savedObject.attributes.visState);
            result.visualizationType = visState.type;
            result.visualizationTitle = visState.title;
          } catch {
            // Ignore parsing errors
          }
        }
        if (savedObject.attributes.kibanaSavedObjectMeta !== undefined) {
          try {
            const meta = JSON.parse(savedObject.attributes.kibanaSavedObjectMeta.searchSourceJSON);
            if (meta.index) {
              result.indexPattern = meta.index;
            }
          } catch {
            // Ignore parsing errors
          }
        }
      }

      if (savedObject.type === 'index-pattern') {
        if (savedObject.attributes.title !== undefined) {
          result.indexPatternTitle = savedObject.attributes.title;
        }
        if (savedObject.attributes.timeFieldName !== undefined) {
          result.timeFieldName = savedObject.attributes.timeFieldName;
        }
        if (savedObject.attributes.fieldCount !== undefined) {
          result.fieldCount = savedObject.attributes.fieldCount;
        }
      }

      if (savedObject.type === 'search') {
        if (savedObject.attributes.columns !== undefined) {
          result.columns = savedObject.attributes.columns;
        }
        if (savedObject.attributes.sort !== undefined) {
          result.sort = savedObject.attributes.sort;
        }
      }

      // Include full attributes for completeness (can be large)
      result.attributes = savedObject.attributes;
    }

    // Add references if they exist
    if (savedObject.references && savedObject.references.length > 0) {
      result.references = savedObject.references.map((ref: any) => ({
        id: ref.id,
        type: ref.type,
        name: ref.name
      }));
    }

    // Add resolve-specific information if using resolve API
    if (useResolve && savedObject.outcome) {
      result.outcome = savedObject.outcome;
      if (savedObject.alias_target_id) {
        result.alias_target_id = savedObject.alias_target_id;
      }
      if (savedObject.alias_purpose) {
        result.alias_purpose = savedObject.alias_purpose;
      }
    }

    return {
      content: [
        {
          type: "text",
          text: `Successfully retrieved saved object:\n\n${JSON.stringify(result, null, 2)}`
        }
      ]
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Handle common error cases
    if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
      return {
        content: [
          {
            type: "text",
            text: `Saved object not found: type '${type}', id '${id}'. Please verify the type and ID are correct.`
          }
        ],
        isError: true
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Failed to retrieve saved object: ${errorMessage}`
        }
      ],
      isError: true
    };
  }
}

/**
 * Register VL (Visualization Layer) get tools with the MCP server
 */
export function registerVLGetTools(server: ServerBase, kibanaClient: KibanaClient) {
  // Tool: Get a single Kibana saved object by type and ID
  server.tool(
    "vl_get_saved_object",
    "Get a single Kibana saved object by type and ID. This is a universal tool that can retrieve any type of saved object (dashboard, visualization, index-pattern, search, config, lens, map, tag, canvas-workpad, canvas-element, etc.) by its exact type and ID. Use this when you know the specific object you want to retrieve. PERFORMANCE: This is much faster than searching when you have the exact type and ID.",
    z.object({
      type: z.union([z.string(), z.array(z.string())]).transform(val => {
        if (Array.isArray(val)) return val[0]; // Take first type for single object retrieval
        if (typeof val === 'string') {
          try {
            const parsed = JSON.parse(val);
            return Array.isArray(parsed) ? parsed[0] : parsed;
          } catch {
            const types = val.split(',').map(s => s.trim()).filter(s => s);
            return types[0]; // Take first type
          }
        }
        return val;
      }).describe("REQUIRED: The saved object type. Common types: 'dashboard', 'visualization', 'index-pattern', 'search', 'config', 'lens', 'map', 'tag', 'canvas-workpad', 'canvas-element'. Supports multiple formats: single string 'dashboard', array ['dashboard'], JSON string '[\"dashboard\"]', or comma-separated 'dashboard,visualization' (will use first type for single object retrieval)."),
      id: z.string().describe("REQUIRED: The saved object ID. This is the unique identifier for the specific object you want to retrieve."),
      useResolve: z.boolean().optional().describe("Use resolve API instead of get API. The resolve API can handle legacy URL aliases from object ID migrations. Use this if you're having trouble finding an object that may have had its ID changed during Kibana upgrades. Default: false."),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params: { type: string; id: string; useResolve?: boolean; space?: string }): Promise<ToolResponse> => {
      return await vl_get_saved_object_impl(
        kibanaClient,
        params.type,
        params.id,
        params.useResolve,
        params.space
      );
    }
  );
}
