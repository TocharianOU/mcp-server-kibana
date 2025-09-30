import { z } from 'zod';
import { ServerBase, KibanaClient, ToolResponse } from './types.js';

/**
 * Implementation function for bulk deleting Kibana saved objects.
 * 
 * @param kibanaClient - The Kibana client instance
 * @param objects - Array of objects to delete, each containing type and id
 * @param force - Force deletion of objects that exist in multiple namespaces
 * @param space - The Kibana space (optional)
 * @returns Promise<ToolResponse> - The tool response containing the bulk delete results
 */
async function vl_bulk_delete_saved_objects_impl(
  kibanaClient: KibanaClient,
  objects: Array<{ type: string; id: string }>,
  force?: boolean,
  space?: string
): Promise<ToolResponse> {
  try {
    // Validate input
    if (!objects || objects.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "Error: No objects specified for deletion. Please provide at least one object with type and id."
          }
        ],
        isError: true
      };
    }

    // Validate each object has required fields
    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i];
      if (!obj.type || !obj.id) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Object at index ${i} is missing required 'type' or 'id' field. Each object must have both 'type' and 'id'.`
            }
          ],
          isError: true
        };
      }
    }

    // Prepare request body
    const requestBody = objects.map(obj => ({
      type: obj.type,
      id: obj.id
    }));

    // Prepare URL with query parameters
    const params = new URLSearchParams();
    if (force) {
      params.append('force', 'true');
    }
    
    const url = `/api/saved_objects/_bulk_delete${params.toString() ? '?' + params.toString() : ''}`;

    // Make the API call
    const response = await kibanaClient.post(url, requestBody, { space });
    
    // Process the response
    const statuses = response.statuses || [];
    
    // Count results
    const successCount = statuses.filter((status: any) => status.success).length;
    const errorCount = statuses.filter((status: any) => !status.success).length;
    
    // Format detailed results
    const results = statuses.map((status: any) => {
      const result: any = {
        type: status.type,
        id: status.id,
        success: status.success
      };
      
      if (status.error) {
        result.error = {
          statusCode: status.error.statusCode,
          error: status.error.error,
          message: status.error.message
        };
      }
      
      return result;
    });

    // Create summary
    const summary = `Bulk delete operation completed. ${successCount} objects deleted successfully, ${errorCount} errors occurred.`;
    
    const responseText = [
      summary,
      '',
      'Detailed Results:',
      JSON.stringify(results, null, 2)
    ].join('\n');

    return {
      content: [
        {
          type: "text",
          text: responseText
        }
      ],
      isError: errorCount > 0
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Handle common error cases
    if (errorMessage.includes('400')) {
      return {
        content: [
          {
            type: "text",
            text: `Bad request error during bulk delete: ${errorMessage}\n\nPossible causes:\n- Invalid object type or ID format\n- Objects exist in multiple namespaces (try using force=true)\n- Missing required parameters`
          }
        ],
        isError: true
      };
    }

    if (errorMessage.includes('404')) {
      return {
        content: [
          {
            type: "text",
            text: `Some objects not found during bulk delete: ${errorMessage}\n\nThis may indicate that one or more objects have already been deleted or never existed.`
          }
        ],
        isError: true
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Failed to bulk delete saved objects: ${errorMessage}`
        }
      ],
      isError: true
    };
  }
}

/**
 * Register VL (Visualization Layer) delete tools with the MCP server
 */
export function registerVLDeleteTools(server: ServerBase, kibanaClient: KibanaClient) {
  // Tool: Bulk delete Kibana saved objects
  server.tool(
    "vl_bulk_delete_saved_objects",
    "Bulk delete multiple Kibana saved objects by type and ID. This is a destructive operation that permanently removes saved objects (dashboard, visualization, index-pattern, search, config, lens, map, tag, canvas-workpad, canvas-element, etc.). WARNING: Deleted objects cannot be recovered. Use with caution. IMPORTANT: Objects that exist in multiple namespaces require the 'force' parameter to be deleted.",
    z.object({
      objects: z.array(z.object({
        type: z.union([z.string(), z.array(z.string())]).transform(val => {
          if (Array.isArray(val)) return val[0]; // Take first type for single object deletion
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
        }).describe("REQUIRED: The saved object type. Common types: 'dashboard', 'visualization', 'index-pattern', 'search', 'config', 'lens', 'map', 'tag', 'canvas-workpad', 'canvas-element'. Supports multiple formats: single string 'dashboard', array ['dashboard'], JSON string '[\"dashboard\"]', or comma-separated 'dashboard,visualization' (will use first type for single object deletion)."),
        id: z.string().describe("REQUIRED: The saved object ID. This is the unique identifier for the specific object you want to delete.")
      })).min(1).describe("REQUIRED: Array of objects to delete. Each object must have 'type' and 'id' fields. Minimum 1 object required."),
      force: z.boolean().optional().describe("Force deletion of objects that exist in multiple namespaces. Set to true if you get an error about objects existing in multiple namespaces. WARNING: This also deletes legacy URL aliases and can place heavy load on Kibana. Default: false."),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params: { objects: Array<{ type: string; id: string }>; force?: boolean; space?: string }): Promise<ToolResponse> => {
      return await vl_bulk_delete_saved_objects_impl(
        kibanaClient,
        params.objects,
        params.force,
        params.space
      );
    }
  );
}
