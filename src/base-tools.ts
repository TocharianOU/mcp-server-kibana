import { z } from "zod";
import type { ServerBase, KibanaClient, ToolResponse } from "./types";
import { simplifyEndpointDetail, formatEndpointToMarkdown } from "./openapi-simplifier.js";

// Import API index and search logic
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import { dirname } from 'path';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


interface ApiEndpoint {
  path: string;
  method: string;
  description?: string;
  summary?: string;
  parameters?: any[];
  requestBody?: any;
  responses?: any;
  deprecated?: boolean;
  tags?: string[];
}

let apiEndpointIndex: ApiEndpoint[] = [];
let isIndexBuilt = false;
let YAML_FILE_PATH = '';
let openApiDoc: any = null; 

async function buildApiIndex(): Promise<void> {
  if (isIndexBuilt) return;
  
  // Enhanced path resolution for both compiled JS and direct TS execution
  const possiblePaths = [
    // Environment variable takes highest priority
    process.env.KIBANA_OPENAPI_YAML_PATH,
    // Current working directory
    path.join(process.cwd(), 'kibana-openapi-source.yaml'),
    // Relative to the source file
    path.join(__dirname, 'kibana-openapi-source.yaml'),
    // One level up from source file (for ts-node execution)
    path.resolve(__dirname, '..', 'kibana-openapi-source.yaml'),
    // dist directory for compiled JS
    path.join(process.cwd(), 'dist', 'src', 'kibana-openapi-source.yaml')
  ].filter((p): p is string => typeof p === 'string' && p.length > 0);

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      YAML_FILE_PATH = p;
      break;
    }
  }

  if (!YAML_FILE_PATH) {
    isIndexBuilt = true;
    return;
  }

  try {
    const yamlContent = fs.readFileSync(YAML_FILE_PATH, 'utf8');
    openApiDoc = yaml.load(yamlContent);
    
    if (!openApiDoc || !openApiDoc.paths) {
      throw new Error('Invalid YAML file structure: missing paths');
    }

    for (const [pathStr, pathObj] of Object.entries(openApiDoc.paths)) {
      for (const [method, methodObj] of Object.entries(pathObj as Record<string, any>)) {
        if (["get", "post", "put", "delete", "patch"].includes(method)) {
          apiEndpointIndex.push({
            path: pathStr as string,
            method: method.toUpperCase(),
            description: (methodObj as any).description,
            summary: (methodObj as any).summary,
            parameters: (methodObj as any).parameters,
            requestBody: (methodObj as any).requestBody,
            responses: (methodObj as any).responses,
            deprecated: (methodObj as any).deprecated,
            tags: (methodObj as any).tags
          });
        }
      }
    }
    isIndexBuilt = true;
  } catch (error) {
    throw error;
  }
}

/**
 * Smart API endpoint search (with simple relevance ranking)
 */
function searchApiEndpoints(query: string): ApiEndpoint[] {
  if (!isIndexBuilt) throw new Error('API index not built yet');
  const q = query.toLowerCase();
  
  return apiEndpointIndex
    .map(e => {
      let score = 0;
      const pathLower = e.path.toLowerCase();
      const summaryLower = (e.summary || '').toLowerCase();
      const descLower = (e.description || '').toLowerCase();
      
      // Path match has highest weight
      if (pathLower === q) score += 100;
      else if (pathLower.includes(q)) score += 20;
      
      // Summary match has secondary weight
      if (summaryLower.includes(q)) score += 10;
      
      // Tag match
      if (e.tags && e.tags.some(tag => tag.toLowerCase().includes(q))) score += 5;
      
      // Description match has lowest weight
      if (descLower.includes(q)) score += 1;
      
      return { endpoint: e, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score) // Sort by score descending
    .map(item => item.endpoint);
}

// Recursively resolve $ref references
function resolveRef(obj: any, doc: any, seen = new Set()): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => resolveRef(item, doc, seen));
  if (obj.$ref) {
    const ref = obj.$ref;
    if (seen.has(ref)) return { circularRef: ref };
    seen.add(ref);

    const parts = ref.replace(/^#\//, '').split('/');
    let target = doc;
    for (const p of parts) {
      if (target && typeof target === 'object') target = target[p];
      else return { invalidRef: ref };
    }
    return resolveRef(target, doc, seen);
  }

  const result: any = {};
  for (const k of Object.keys(obj)) {
    result[k] = resolveRef(obj[k], doc, seen);
  }
  return result;
}

export function registerBaseTools(server: ServerBase, kibanaClient: KibanaClient, defaultSpace: string) {
  // Tool: Get Kibana server status
  server.tool(
    "get_status",
    `Get Kibana server status with multi-space support`,
    z.object({
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async ({ space }): Promise<ToolResponse> => {
      try {
        const targetSpace = space || defaultSpace;
        const response = await kibanaClient.get('/api/status', { space });
        return {
          content: [
            {
              type: "text",
              text: `[Space: ${targetSpace}] Kibana server status: ${JSON.stringify(response, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Tool: Execute custom API request
  server.tool(
    "execute_kb_api",
    `Execute a custom API request for Kibana with multi-space support`,
    z.object({
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
      path: z.string(),
      body: z.any().optional(),
      params: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async ({ method, path, body, params, space }): Promise<ToolResponse> => {
      try {
        const targetSpace = space || defaultSpace;
        let url = path;
        if (params) {
          const queryString = new URLSearchParams(
            Object.entries(params).map(([key, value]) => [key, String(value)])
          ).toString();
          url += `?${queryString}`;
        }

        let response;
        switch (method.toLowerCase()) {
          case 'get':
            response = await kibanaClient.get(url, { space });
            break;
          case 'post':
            response = await kibanaClient.post(url, body, { space });
            break;
          case 'put':
            response = await kibanaClient.put(url, body, { space });
            break;
          case 'delete':
            response = await kibanaClient.delete(url, { space });
            break;
          default:
            throw new Error(`Unsupported HTTP method: ${method}`);
        }

        return {
          content: [
            {
              type: "text",
              text: `[Space: ${targetSpace}] API response: ${JSON.stringify(response, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Tool: Search Kibana API endpoints (by keyword)
  server.tool(
    "search_kibana_api_paths",
    `Search Kibana API endpoints by keyword`,
    z.object({
      search: z.string().describe('Search keyword for filtering API endpoints')
    }),
    async ({ search }): Promise<ToolResponse> => {
      await buildApiIndex();
      const endpoints = searchApiEndpoints(search);
      
      // Limit results to avoid token overflow
      const limitedEndpoints = endpoints.slice(0, 15);
      
      return {
        content: [
          {
            type: "text",
            text: `Found ${endpoints.length} API endpoints (showing top ${limitedEndpoints.length}): ${JSON.stringify(limitedEndpoints.map(e => ({
              method: e.method,
              path: e.path,
              summary: e.summary,
              description: e.description ? (e.description.length > 100 ? e.description.substring(0, 100) + '...' : e.description) : undefined
            })), null, 2)}`
          }
        ]
      };
    }
  );

  // Tool: List all Kibana API endpoints (no filter, full list, resource style)
  server.tool(
    "list_all_kibana_api_paths",
    `List all Kibana API endpoints as a resource list`,
    z.object({}),
    async (): Promise<ToolResponse> => {
      await buildApiIndex();
      const endpoints = apiEndpointIndex.map(e => ({
        method: e.method,
        path: e.path,
        summary: e.summary,
        description: e.description
      }));
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              contents: [
                {
                  uri: "kibana-api://paths",
                  mimeType: "application/json",
                  text: JSON.stringify(endpoints, null, 2)
                }
              ]
            }, null, 2)
          }
        ]
      };
    }
  );

  // Tool: Get details for a specific Kibana API endpoint
  server.tool(
    "get_kibana_api_detail",
    `Get details for a specific Kibana API endpoint`,
    z.object({
      method: z.string().describe("HTTP method, e.g. GET, POST, PUT, DELETE"),
      path: z.string().describe("API path, e.g. /api/actions/connector_types"),
      raw: z.boolean().optional().describe("If true, return raw JSON schema instead of simplified TypeScript interface")
    }),
    async ({ method, path, raw }): Promise<ToolResponse> => {
      await buildApiIndex();
      const endpoint = apiEndpointIndex.find(
        e => e.method === method.toUpperCase() && e.path === path
      );
      if (!endpoint) {
        return {
          content: [
            {
              type: "text",
              text: `API endpoint not found: ${method} ${path}`
            }
          ],
          isError: true
        };
      }
      // Recursively resolve parameters, requestBody, and responses references
      const detailed = {
        ...endpoint,
        parameters: resolveRef(endpoint.parameters, openApiDoc),
        requestBody: resolveRef(endpoint.requestBody, openApiDoc),
        responses: resolveRef(endpoint.responses, openApiDoc)
      };
      
      if (raw) {
        return {
          content: [
            {
              type: "text",
              text: `API endpoint details (Raw): ${JSON.stringify(detailed, null, 2)}`
            }
          ]
        };
      }
      
      // Use smart simplifier
      const simplified = simplifyEndpointDetail(detailed);
      const markdown = formatEndpointToMarkdown(simplified);

      return {
        content: [
          {
            type: "text",
            text: markdown
          }
        ]
      };
    }
  );


  server.tool(
    "get_available_spaces",
    "Get all available Kibana spaces with current context",
    z.object({
      include_details: z.boolean().optional().default(true).describe("Include detailed space information (name, description, etc.)")
    }),
    async ({ include_details = true }): Promise<ToolResponse> => {
      try {
        const response = await kibanaClient.get('/api/spaces/space');
        
        const result = {
          current_default_space: defaultSpace,
          total_count: response.length,
          available_spaces: include_details ? response : response.map((space: any) => ({
            id: space.id,
            name: space.name
          }))
        };
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );
} 
