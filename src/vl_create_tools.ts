import { z } from 'zod';
import { ServerBase, KibanaClient, ToolResponse } from './types.js';

/**
 * Implementation function for creating a Kibana saved object.
 * 
 * @param kibanaClient - The Kibana client instance
 * @param type - The saved object type
 * @param attributes - The object attributes
 * @param id - Optional: specific ID for the object (if not provided, auto-generated)
 * @param overwrite - Whether to overwrite existing object with same ID
 * @param references - Array of references to other saved objects
 * @param initialNamespaces - Array of initial namespaces for the object
 * @param space - The Kibana space (optional)
 * @returns Promise<ToolResponse> - The tool response containing the created object data
 */
async function vl_create_saved_object_impl(
  kibanaClient: KibanaClient,
  type: string,
  attributes: Record<string, any>,
  id?: string,
  overwrite?: boolean,
  references?: Array<{ id: string; type: string; name: string }>,
  initialNamespaces?: string[],
  space?: string
): Promise<ToolResponse> {
  try {
    // Validate required parameters
    if (!type) {
      return {
        content: [
          {
            type: "text",
            text: "Error: 'type' parameter is required. Please specify the saved object type (e.g., 'dashboard', 'visualization', 'index-pattern')."
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
            text: "Error: 'attributes' parameter is required and must be an object containing the saved object properties."
          }
        ],
        isError: true
      };
    }

    // Validate attributes based on type
    const validationResult = validateAttributesByType(type, attributes);
    if (!validationResult.valid) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Invalid attributes for type '${type}': ${validationResult.error}`
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

    if (initialNamespaces && initialNamespaces.length > 0) {
      requestBody.initialNamespaces = initialNamespaces;
    }

    // Prepare URL and query parameters
    const params = new URLSearchParams();
    if (overwrite) {
      params.append('overwrite', 'true');
    }

    // Choose API endpoint based on whether ID is specified
    let url: string;
    if (id) {
      // Create with specific ID
      url = `/api/saved_objects/${encodeURIComponent(type)}/${encodeURIComponent(id)}${params.toString() ? '?' + params.toString() : ''}`;
    } else {
      // Create with auto-generated ID
      url = `/api/saved_objects/${encodeURIComponent(type)}${params.toString() ? '?' + params.toString() : ''}`;
    }

    // Make the API call
    const response = await kibanaClient.post(url, requestBody, { space });
    
    // Format the response
    const result: any = {
      id: response.id,
      type: response.type,
      version: response.version,
      updated_at: response.updated_at,
      created_at: response.created_at,
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

    // Add migration information if present
    if (response.migrationVersion) {
      result.migrationVersion = response.migrationVersion;
    }
    if (response.coreMigrationVersion) {
      result.coreMigrationVersion = response.coreMigrationVersion;
    }

    return {
      content: [
        {
          type: "text",
          text: `Successfully created ${type} saved object:\n\n${JSON.stringify(result, null, 2)}`
        }
      ]
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Handle common error cases
    if (errorMessage.includes('409') || errorMessage.includes('conflict')) {
      return {
        content: [
          {
            type: "text",
            text: `Conflict error: A saved object with type '${type}' and id '${id}' already exists. Use 'overwrite: true' to replace it, or omit the 'id' parameter to create with auto-generated ID.`
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
            text: `Bad request error: ${errorMessage}\n\nPossible causes:\n- Invalid object type '${type}'\n- Invalid attributes structure\n- Missing required fields\n- Invalid references format`
          }
        ],
        isError: true
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Failed to create saved object: ${errorMessage}`
        }
      ],
      isError: true
    };
  }
}

/**
 * Validate attributes based on saved object type
 */
function validateAttributesByType(type: string, attributes: Record<string, any>): { valid: boolean; error?: string } {
  // Common validation: title is usually required
  if (!attributes.title || typeof attributes.title !== 'string') {
    return { valid: false, error: "Missing required field 'title' (must be a non-empty string)" };
  }

  // Type-specific validation
  switch (type) {
    case 'dashboard':
      // Dashboard-specific validation
      if (attributes.panelsJSON && typeof attributes.panelsJSON !== 'string') {
        return { valid: false, error: "Field 'panelsJSON' must be a JSON string" };
      }
      if (attributes.optionsJSON && typeof attributes.optionsJSON !== 'string') {
        return { valid: false, error: "Field 'optionsJSON' must be a JSON string" };
      }
      if (attributes.timeRestore !== undefined && typeof attributes.timeRestore !== 'boolean') {
        return { valid: false, error: "Field 'timeRestore' must be a boolean" };
      }
      break;

    case 'visualization':
      // Visualization-specific validation
      if (attributes.visState && typeof attributes.visState !== 'string') {
        return { valid: false, error: "Field 'visState' must be a JSON string" };
      }
      if (attributes.uiStateJSON && typeof attributes.uiStateJSON !== 'string') {
        return { valid: false, error: "Field 'uiStateJSON' must be a JSON string" };
      }
      break;

    case 'index-pattern':
      // Index pattern specific validation
      if (!attributes.title) {
        return { valid: false, error: "Index pattern requires 'title' field (index pattern string)" };
      }
      if (attributes.timeFieldName && typeof attributes.timeFieldName !== 'string') {
        return { valid: false, error: "Field 'timeFieldName' must be a string" };
      }
      break;

    case 'search':
      // Saved search validation
      if (attributes.columns && !Array.isArray(attributes.columns)) {
        return { valid: false, error: "Field 'columns' must be an array" };
      }
      break;

    case 'lens':
      // Lens visualization validation
      if (!attributes.state && !attributes.expression) {
        return { valid: false, error: "Lens visualization requires either 'state' or 'expression' field" };
      }
      break;

    case 'map':
      // Map validation
      if (attributes.layerListJSON && typeof attributes.layerListJSON !== 'string') {
        return { valid: false, error: "Field 'layerListJSON' must be a JSON string" };
      }
      break;

    case 'canvas-workpad':
      // Canvas workpad validation
      if (!attributes.name) {
        return { valid: false, error: "Canvas workpad requires 'name' field" };
      }
      if (attributes.pages && !Array.isArray(attributes.pages)) {
        return { valid: false, error: "Field 'pages' must be an array" };
      }
      break;

    default:
      // For unknown types, just check basic structure
      break;
  }

  return { valid: true };
}

/**
 * Register VL (Visualization Layer) create tools with the MCP server
 */
export function registerVLCreateTools(server: ServerBase, kibanaClient: KibanaClient) {
  // Tool: Create a Kibana saved object
  server.tool(
    "vl_create_saved_object",
    "Create a new Kibana saved object (dashboard, visualization, index-pattern, search, config, lens, map, tag, canvas-workpad, canvas-element, etc.). This is a universal tool that can create any type of saved object by specifying the type and attributes. Each object type has specific attribute requirements. IMPORTANT: The 'title' field is required for most object types. Complex fields like panelsJSON, visState should be JSON strings.",
    z.object({
      type: z.union([z.string(), z.array(z.string())]).transform(val => {
        if (Array.isArray(val)) return val[0]; // Take first type for single object creation
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
      }).describe("REQUIRED: The saved object type. Common types: 'dashboard', 'visualization', 'index-pattern', 'search', 'config', 'lens', 'map', 'tag', 'canvas-workpad', 'canvas-element'. Supports multiple formats but will use first type for single object creation."),
      attributes: z.record(z.any()).describe("REQUIRED: Object containing the saved object attributes. Structure varies by type. Common fields: 'title' (required for most types), 'description'. Dashboard: 'panelsJSON', 'timeRestore'. Visualization: 'visState', 'uiStateJSON'. Index-pattern: 'timeFieldName'. All JSON fields should be strings."),
      id: z.string().optional().describe("OPTIONAL: Specific ID for the saved object. If not provided, Kibana will auto-generate a unique ID. Use this when you need a predictable ID or when recreating objects."),
      overwrite: z.boolean().optional().describe("OPTIONAL: Whether to overwrite an existing object with the same ID. Only relevant when 'id' is specified. Default: false. Set to true to replace existing objects."),
      references: z.array(z.object({
        id: z.string().describe("ID of the referenced object"),
        type: z.string().describe("Type of the referenced object"),
        name: z.string().describe("Reference name used in the object")
      })).optional().describe("OPTIONAL: Array of references to other saved objects. Used to link objects together (e.g., dashboard panels referencing visualizations). Each reference needs id, type, and name."),
      initialNamespaces: z.array(z.string()).optional().describe("OPTIONAL: Array of initial namespaces for the object. Used for multi-tenant setups. If not specified, object will be created in the default namespace."),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params: { 
      type: string; 
      attributes: Record<string, any>; 
      id?: string; 
      overwrite?: boolean; 
      references?: Array<{ id: string; type: string; name: string }>; 
      initialNamespaces?: string[]; 
      space?: string 
    }): Promise<ToolResponse> => {
      return await vl_create_saved_object_impl(
        kibanaClient,
        params.type,
        params.attributes,
        params.id,
        params.overwrite,
        params.references,
        params.initialNamespaces,
        params.space
      );
    }
  );
}
