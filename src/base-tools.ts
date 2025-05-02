import { z } from "zod";
import type { ServerBase, KibanaClient, ToolResponse } from "./types";
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
      console.warn(`Using YAML file from: ${p}`);
      break;
    }
  }

  if (!YAML_FILE_PATH) {
    console.error('Could not find kibana-openapi-source.yaml file');
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
    console.error('Error loading or parsing YAML file:', error);
    throw error;
  }
}

function searchApiEndpoints(query: string): ApiEndpoint[] {
  if (!isIndexBuilt) throw new Error('API index not built yet');
  const q = query.toLowerCase();
  return apiEndpointIndex.filter(e =>
    e.path.toLowerCase().includes(q) ||
    (e.description && e.description.toLowerCase().includes(q)) ||
    (e.summary && e.summary.toLowerCase().includes(q)) ||
    (e.tags && e.tags.some(tag => tag.toLowerCase().includes(q)))
  );
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

export function registerBaseTools(server: ServerBase, kibanaClient: KibanaClient) {
  // Tool: Get Kibana server status
  server.tool(
    "get_status",
    "Get Kibana server status",
    z.object({}),
    async (): Promise<ToolResponse> => {
      try {
        const response = await kibanaClient.get('/api/status');
        return {
          content: [
            {
              type: "text",
              text: `Kibana server status: ${JSON.stringify(response, null, 2)}`
            }
          ]
        };
      } catch (error) {
        console.error(`Failed to get server status: ${error}`);
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
    "execute_api",
    "Execute a custom API request for Kibana",
    z.object({
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
      path: z.string(),
      body: z.any().optional(),
      params: z.record(z.string()).optional()
    }),
    async ({ method, path, body, params }): Promise<ToolResponse> => {
      try {
        let url = path;
        if (params) {
          const queryString = new URLSearchParams(params).toString();
          url += `?${queryString}`;
        }

        let response;
        switch (method.toLowerCase()) {
          case 'get':
            response = await kibanaClient.get(url);
            break;
          case 'post':
            response = await kibanaClient.post(url, body);
            break;
          case 'put':
            response = await kibanaClient.put(url, body);
            break;
          case 'delete':
            response = await kibanaClient.delete(url);
            break;
          default:
            throw new Error(`Unsupported HTTP method: ${method}`);
        }

        return {
          content: [
            {
              type: "text",
              text: `API response: ${JSON.stringify(response, null, 2)}`
            }
          ]
        };
      } catch (error) {
        console.error(`API request failed: ${error}`);
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
    "Search Kibana API endpoints by keyword",
    z.object({
      search: z.string().describe('Search keyword for filtering API endpoints')
    }),
    async ({ search }): Promise<ToolResponse> => {
      await buildApiIndex();
      const endpoints = searchApiEndpoints(search);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(endpoints.map(e => ({
              method: e.method,
              path: e.path,
              summary: e.summary,
              description: e.description
            })), null, 2)
          }
        ]
      };
    }
  );

  // Tool: List all Kibana API endpoints (no filter, full list, resource style)
  server.tool(
    "list_all_kibana_api_paths",
    "List all Kibana API endpoints as a resource list (no filter)",
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
    "Get details for a specific Kibana API endpoint",
    z.object({
      method: z.string().describe("HTTP method, e.g. GET, POST, PUT, DELETE"),
      path: z.string().describe("API path, e.g. /api/actions/connector_types")
    }),
    async ({ method, path }): Promise<ToolResponse> => {
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
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(detailed, null, 2)
          }
        ]
      };
    }
  );
} 