import { z } from "zod";
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { ServerBase, KibanaClient, ResourceResponse } from "./types";

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- API index and search logic ---
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

// Build the API index from the OpenAPI YAML file
async function buildApiIndex(): Promise<void> {
  if (isIndexBuilt) return;
  // Only search for YAML file in the main directory
  const possiblePaths = [
    path.join(process.cwd(), 'kibana-openapi-source.yaml')
  ];
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
  const yamlContent = fs.readFileSync(YAML_FILE_PATH, 'utf8');
  const openApiDoc: any = yaml.load(yamlContent);
  if (!openApiDoc || !openApiDoc.paths) {
    isIndexBuilt = true;
    return;
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

export function registerResources(server: ServerBase, kibanaClient: KibanaClient) {
  // 1. API path list resource
  server.resource(
    "kibana-api-paths",
    "kibana-api://paths",
    async (uri: URL, params: Record<string, string>): Promise<ResourceResponse> => {
      await buildApiIndex();
      const search = params.search || "";
      const endpoints = search ? searchApiEndpoints(search) : apiEndpointIndex;
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
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

  // 2. Single API endpoint detail resource
  server.resource(
    "kibana-api-path-detail",
    "kibana-api://path/{method}/{encoded_path}",
    async (uri: URL, params: Record<string, string>): Promise<ResourceResponse> => {
      await buildApiIndex();
      const method = params.method?.toUpperCase();
      const path = decodeURIComponent(params.encoded_path);
      const endpoint = apiEndpointIndex.find(e => e.method === method && e.path === path);
      if (!endpoint) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: "API endpoint not found"
            }
          ]
        };
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(endpoint, null, 2)
          }
        ]
      };
    }
  );
} 