import { z } from 'zod';
import { ServerBase, KibanaClient, ToolResponse } from './types.js';

/**
 * Implementation function for updating a single Kibana saved object.
 * 
 * @param kibanaClient - The Kibana client instance
 * @param type - The saved object type
 * @param id - The saved object ID
 * @param attributes - The attributes to update (partial update)
 * @param references - Optional: array of references to other saved objects
 * @param version - Optional: version for optimistic concurrency control
 * @param upsert - Optional: attributes to use if object doesn't exist (create if not found)
 * @param space - The Kibana space (optional)
 * @returns Promise<ToolResponse> - The tool response containing the updated object data
 */
async function vl_update_saved_object_impl(
  kibanaClient: KibanaClient,
  type: string,
  id: string,
  attributes: Record<string, any>,
  references?: Array<{ id: string; type: string; name: string }>,
  version?: string,
  upsert?: Record<string, any>,
  space?: string
): Promise<ToolResponse> {
  try {
    // Validate required parameters
    if (!type) {
      return {
        content: [
          {
            type: "text",
            text: "Error: 'type' parameter is required. Please specify the saved object type."
          }
        ],
        isError: true
      };
    }

    if (!id) {
      return {
        content: [
          {
            type: "text",
            text: "Error: 'id' parameter is required. Please specify the saved object ID to update."
          }
        ],
        isError: true
      };
    }

    if (!attributes || typeof attributes !== 'object') {
      return {
        content: [
          {
            type: "text",
            text: "Error: 'attributes' parameter is required and must be an object containing the properties to update."
          }
        ],
        isError: true
      };
    }

    // Prepare request body
    const requestBody: any = {
      attributes
    };

    if (references && references.length > 0) {
      requestBody.references = references;
    }

    if (version) {
      requestBody.version = version;
    }

    if (upsert) {
      requestBody.upsert = upsert;
    }

    // Make the API call
    const url = `/api/saved_objects/${encodeURIComponent(type)}/${encodeURIComponent(id)}`;
    const response = await kibanaClient.put(url, requestBody, { space });
    
    // Format the response
    const result: any = {
      id: response.id,
      type: response.type,
      version: response.version,
      updated_at: response.updated_at,
      namespaces: response.namespaces || [],
    };

    // Add attributes information
    if (response.attributes) {
      result.attributes = response.attributes;
      
      // Add common fields for easier access
      if (response.attributes.title) {
        result.title = response.attributes.title;
      }
      if (response.attributes.description) {
        result.description = response.attributes.description;
      }
    }

    // Add references if present
    if (response.references && response.references.length > 0) {
      result.references = response.references;
    }

    return {
      content: [
        {
          type: "text",
          text: `Successfully updated ${type} saved object '${id}':\n\n${JSON.stringify(result, null, 2)}`
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
            text: `Object not found: No saved object with type '${type}' and id '${id}' exists. Please verify the type and ID are correct, or use the create tool to create a new object.`
          }
        ],
        isError: true
      };
    }

    if (errorMessage.includes('409') || errorMessage.includes('conflict')) {
      return {
        content: [
          {
            type: "text",
            text: `Version conflict: The object '${id}' has been modified by another process. Please retrieve the latest version and retry with the current version number.`
          }
        ],
        isError: true
      };
    }

    if (errorMessage.includes('400')) {
      return {
        content: [
          {
            type: "text",
            text: `Bad request error: ${errorMessage}\n\nPossible causes:\n- Invalid attributes structure\n- Invalid references format\n- Invalid version format`
          }
        ],
        isError: true
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Failed to update saved object: ${errorMessage}`
        }
      ],
      isError: true
    };
  }
}

/**
 * Implementation function for bulk updating multiple Kibana saved objects.
 * 
 * @param kibanaClient - The Kibana client instance
 * @param objects - Array of objects to update
 * @param space - The Kibana space (optional)
 * @returns Promise<ToolResponse> - The tool response containing the bulk update results
 */
async function vl_bulk_update_saved_objects_impl(
  kibanaClient: KibanaClient,
  objects: Array<{
    type: string;
    id: string;
    attributes: Record<string, any>;
    references?: Array<{ id: string; type: string; name: string }>;
    version?: string;
    namespace?: string;
  }>,
  space?: string
): Promise<ToolResponse> {
  try {
    // Validate input
    if (!objects || objects.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "Error: No objects specified for update. Please provide at least one object with type, id, and attributes."
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
              text: `Error: Object at index ${i} is missing required 'type' or 'id' field. Each object must have type, id, and attributes.`
            }
          ],
          isError: true
        };
      }
      if (!obj.attributes || typeof obj.attributes !== 'object') {
        return {
          content: [
            {
              type: "text",
              text: `Error: Object at index ${i} is missing required 'attributes' field or it's not an object.`
            }
          ],
          isError: true
        };
      }
    }

    // Apply type transformation to each object
    const processedObjects = objects.map(obj => {
      let processedType = obj.type;
      
      // Apply the same type transformation as other tools
      if (Array.isArray(obj.type)) {
        processedType = obj.type[0]; // Take first type
      } else if (typeof obj.type === 'string') {
        try {
          const parsed = JSON.parse(obj.type);
          processedType = Array.isArray(parsed) ? parsed[0] : parsed;
        } catch {
          const types = obj.type.split(',').map(s => s.trim()).filter(s => s);
          processedType = types[0]; // Take first type
        }
      }

      return {
        ...obj,
        type: processedType
      };
    });

    // Make the API call
    const url = `/api/saved_objects/_bulk_update`;
    const response = await kibanaClient.post(url, processedObjects, { space });
    
    // Process the response
    const savedObjects = response.saved_objects || [];
    
    // Count results
    const successCount = savedObjects.filter((obj: any) => !obj.error).length;
    const errorCount = savedObjects.filter((obj: any) => obj.error).length;
    
    // Format detailed results
    const results = savedObjects.map((savedObject: any) => {
      if (savedObject.error) {
        return {
          type: savedObject.type,
          id: savedObject.id,
          success: false,
          error: {
            statusCode: savedObject.error.statusCode,
            error: savedObject.error.error,
            message: savedObject.error.message
          }
        };
      }

      const result: any = {
        type: savedObject.type,
        id: savedObject.id,
        version: savedObject.version,
        updated_at: savedObject.updated_at,
        success: true,
        namespaces: savedObject.namespaces || []
      };

      // Add attributes information
      if (savedObject.attributes) {
        if (savedObject.attributes.title) {
          result.title = savedObject.attributes.title;
        }
        if (savedObject.attributes.description) {
          result.description = savedObject.attributes.description;
        }
        result.attributes = savedObject.attributes;
      }

      // Add references if present
      if (savedObject.references && savedObject.references.length > 0) {
        result.references = savedObject.references;
      }

      return result;
    });

    // Create summary
    const summary = `Bulk update operation completed. ${successCount} objects updated successfully, ${errorCount} errors occurred.`;
    
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
            text: `Bad request error during bulk update: ${errorMessage}\n\nPossible causes:\n- Invalid object type or ID format\n- Invalid attributes structure\n- Invalid references format\n- Missing required parameters`
          }
        ],
        isError: true
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Failed to bulk update saved objects: ${errorMessage}`
        }
      ],
      isError: true
    };
  }
}

/**
 * Register VL (Visualization Layer) update tools with the MCP server
 */
export function registerVLUpdateTools(server: ServerBase, kibanaClient: KibanaClient) {
  // Tool: Update a single Kibana saved object
  server.tool(
    "vl_update_saved_object",
    "Update a single Kibana saved object by type and ID. This performs a partial update - only the specified attributes will be changed, other attributes remain unchanged. Supports all saved object types (dashboard, visualization, index-pattern, search, config, lens, map, tag, canvas-workpad, canvas-element, etc.). IMPORTANT: Use version parameter for optimistic concurrency control to prevent conflicts.",
    z.object({
      type: z.union([z.string(), z.array(z.string())]).transform(val => {
        if (Array.isArray(val)) return val[0]; // Take first type for single object update
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
      }).describe("REQUIRED: The saved object type. Common types: 'dashboard', 'visualization', 'index-pattern', 'search', 'config', 'lens', 'map', 'tag', 'canvas-workpad', 'canvas-element'. Supports multiple formats but will use first type for single object update."),
      id: z.string().describe("REQUIRED: The saved object ID. This is the unique identifier for the object you want to update."),
      attributes: z.record(z.any()).describe("REQUIRED: Object containing the attributes to update. Only specified attributes will be changed (partial update). Common fields: 'title', 'description'. Type-specific fields: Dashboard: 'panelsJSON', 'timeRestore'. Visualization: 'visState', 'uiStateJSON'. All JSON fields should be strings."),
      references: z.array(z.object({
        id: z.string().describe("ID of the referenced object"),
        type: z.string().describe("Type of the referenced object"),
        name: z.string().describe("Reference name used in the object")
      })).optional().describe("OPTIONAL: Array of references to other saved objects. Updates the object's references. Each reference needs id, type, and name."),
      version: z.string().optional().describe("OPTIONAL: Version string for optimistic concurrency control. Use this to prevent conflicts when multiple processes update the same object. Get the version from a previous get/search operation."),
      upsert: z.record(z.any()).optional().describe("OPTIONAL: Attributes to use if the object doesn't exist (will create object if not found). Useful for create-or-update scenarios."),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params: { 
      type: string; 
      id: string; 
      attributes: Record<string, any>; 
      references?: Array<{ id: string; type: string; name: string }>; 
      version?: string; 
      upsert?: Record<string, any>; 
      space?: string 
    }): Promise<ToolResponse> => {
      return await vl_update_saved_object_impl(
        kibanaClient,
        params.type,
        params.id,
        params.attributes,
        params.references,
        params.version,
        params.upsert,
        params.space
      );
    }
  );

  // Tool: Bulk update multiple Kibana saved objects
  server.tool(
    "vl_bulk_update_saved_objects",
    "Update multiple Kibana saved objects in a single operation. Each object can be of different types and will be partially updated (only specified attributes changed). Supports all saved object types (dashboard, visualization, index-pattern, search, config, lens, map, tag, canvas-workpad, canvas-element, etc.). PERFORMANCE: More efficient than multiple single updates. Each object can have individual version control.",
    z.object({
      objects: z.array(z.object({
        type: z.union([z.string(), z.array(z.string())]).transform(val => {
          if (Array.isArray(val)) return val[0]; // Take first type for single object update
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
        }).describe("REQUIRED: The saved object type. Common types: 'dashboard', 'visualization', 'index-pattern', 'search', 'config', 'lens', 'map', 'tag', 'canvas-workpad', 'canvas-element'. Supports multiple formats but will use first type."),
        id: z.string().describe("REQUIRED: The saved object ID. This is the unique identifier for the object you want to update."),
        attributes: z.record(z.any()).describe("REQUIRED: Object containing the attributes to update. Only specified attributes will be changed (partial update)."),
        references: z.array(z.object({
          id: z.string().describe("ID of the referenced object"),
          type: z.string().describe("Type of the referenced object"),
          name: z.string().describe("Reference name used in the object")
        })).optional().describe("OPTIONAL: Array of references to other saved objects for this specific object."),
        version: z.string().optional().describe("OPTIONAL: Version string for optimistic concurrency control for this specific object."),
        namespace: z.string().optional().describe("OPTIONAL: Specific namespace for this object (overrides space parameter).")
      })).min(1).describe("REQUIRED: Array of objects to update. Each object must have 'type', 'id', and 'attributes' fields. Minimum 1 object required."),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params: { 
      objects: Array<{
        type: string;
        id: string;
        attributes: Record<string, any>;
        references?: Array<{ id: string; type: string; name: string }>;
        version?: string;
        namespace?: string;
      }>; 
      space?: string 
    }): Promise<ToolResponse> => {
      return await vl_bulk_update_saved_objects_impl(
        kibanaClient,
        params.objects,
        params.space
      );
    }
  );
}
