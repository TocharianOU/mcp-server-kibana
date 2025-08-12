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
    `Search Kibana API endpoints by keyword`,
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
            text: `Found ${endpoints.length} API endpoints: ${JSON.stringify(endpoints.map(e => ({
              method: e.method,
              path: e.path,
              summary: e.summary,
              description: e.description
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
            text: `API endpoint details: ${JSON.stringify(detailed, null, 2)}`
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
        console.error(`Failed to get available spaces: ${error}`);
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
  // Tool: Completely generic search across ANY Elasticsearch indices with dynamic field discovery
  console.log("Registering tool: universal_search");
  server.tool(
    "universal_search",
    "Universal search tool for ANY Elasticsearch indices with dynamic field discovery and zero hardcoded assumptions",
    z.object({
      query: z.string().describe("Search query string"),
      index_pattern: z.string().describe("Elasticsearch index pattern (e.g., 'logs-*', 'metrics-*', 'compliance-*', 'custom-*')"),
      search_fields: z.array(z.string()).optional().describe("Fields to search in (if not provided, will auto-discover from index mapping)"),
      query_type: z.enum(['match', 'match_phrase', 'wildcard', 'term', 'fuzzy', 'multi_match', 'query_string', 'simple_query_string']).optional().default('match_phrase').describe("Type of Elasticsearch query to use"),
      filters: z.record(z.any()).optional().describe("Dynamic filters - can be ANY field with ANY value structure"),
      sort_field: z.string().optional().describe("Field to sort results by (auto-discovered from index)"),
      sort_order: z.enum(['asc', 'desc']).optional().default('desc').describe("Sort order"),
      size: z.number().optional().default(100).describe("Number of results to return"),
      from: z.number().optional().default(0).describe("Starting offset for pagination"),
      include_source: z.boolean().optional().default(true).describe("Whether to include full document source in results"),
      source_fields: z.array(z.string()).optional().describe("Specific fields to include in results"),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)"),
      auto_discover_fields: z.boolean().optional().default(true).describe("Automatically discover available fields from index mapping"),
      highlight_fields: z.array(z.string()).optional().describe("Fields to highlight in results"),
      aggregations: z.record(z.any()).optional().describe("Custom aggregations to include in results")
    }),
    async ({ 
      query, 
      index_pattern, 
      search_fields, 
      query_type = 'match_phrase',
      filters = {},
      sort_field,
      sort_order = 'desc',
      size = 100,
      from = 0,
      include_source = true,
      source_fields,
      space,
      auto_discover_fields = true,
      highlight_fields,
      aggregations
    }): Promise<ToolResponse> => {
      try {
        const targetSpace = space || defaultSpace;
        
        // Step 1: Auto-discover fields if requested and not provided
        let availableFields: string[] = [];
        if (auto_discover_fields && (!search_fields || search_fields.length === 0)) {
          try {
            const mappingResponse = await kibanaClient.get(`/api/console/proxy?method=GET&path=${encodeURIComponent(`/${index_pattern}/_mapping`)}`, {
              space: targetSpace,
              headers: {
                'kbn-xsrf': 'true',
                'Content-Type': 'application/json'
              }
            });
            
            // Extract all available fields from mapping
            availableFields = extractFieldsFromMapping(mappingResponse);
            console.log(`Auto-discovered ${availableFields.length} fields from index ${index_pattern}`);
          } catch (error) {
            console.warn(`Could not auto-discover fields: ${error}`);
            availableFields = ["*"]; // Fallback to search all fields
          }
        } else {
          availableFields = search_fields || ["*"];
        }

        // Step 2: Build completely dynamic query body
        const queryBody: any = {
          size: size,
          from: from,
          query: {
            bool: {
              must: [],
              filter: [],
              should: [],
              must_not: []
            }
          }
        };

        // Add the main search query with dynamic field handling
        if (query_type === 'multi_match') {
          queryBody.query.bool.must.push({
            multi_match: {
              query: query,
              fields: availableFields,
              type: 'best_fields',
              operator: 'or'
            }
          });
        } else if (query_type === 'query_string') {
          queryBody.query.bool.must.push({
            query_string: {
              query: query,
              fields: availableFields,
              default_operator: 'OR'
            }
          });
        } else if (query_type === 'simple_query_string') {
          queryBody.query.bool.must.push({
            simple_query_string: {
              query: query,
              fields: availableFields,
              default_operator: 'or'
            }
          });
        } else {
          // For single field queries, use the first available field or search across all
          const field = availableFields.length > 0 ? availableFields[0] : "*";
          queryBody.query.bool.must.push({
            [query_type]: { [field]: query }
          });
        }

        // Step 3: Add completely dynamic filters
        if (filters) {
          Object.entries(filters).forEach(([filterType, filterValue]) => {
            switch (filterType) {
              case 'date_range':
                // Handle any date field, not just @timestamp
                Object.entries(filterValue as Record<string, any>).forEach(([dateField, rangeValue]) => {
                  queryBody.query.bool.filter.push({
                    range: {
                      [dateField]: rangeValue
                    }
                  });
                });
                break;
              
              case 'field_values':
                // Handle any field with any value type
                Object.entries(filterValue as Record<string, any>).forEach(([field, value]) => {
                  if (Array.isArray(value)) {
                    queryBody.query.bool.filter.push({
                      terms: { [field]: value }
                    });
                  } else if (typeof value === 'object' && value !== null) {
                    // Handle complex field values (nested objects, ranges, etc.)
                    queryBody.query.bool.filter.push({
                      [field]: value
                    });
                  } else {
                    queryBody.query.bool.filter.push({
                      term: { [field]: value }
                    });
                  }
                });
                break;
              
              case 'exists':
                // Handle field existence checks
                (filterValue as string[]).forEach((field: string) => {
                  queryBody.query.bool.filter.push({
                    exists: { field }
                  });
                });
                break;
              
              case 'missing':
                // Handle missing field checks
                (filterValue as string[]).forEach((field: string) => {
                  queryBody.query.bool.filter.push({
                    bool: {
                      must_not: {
                        exists: { field }
                      }
                    }
                  });
                });
                break;
              
              case 'geo':
                // Handle geographic queries
                Object.entries(filterValue as Record<string, any>).forEach(([geoField, geoValue]) => {
                  queryBody.query.bool.filter.push({
                    geo_distance: {
                      [geoField]: geoValue
                    }
                  });
                });
                break;
              
              case 'nested':
                // Handle nested field queries
                Object.entries(filterValue as Record<string, any>).forEach(([nestedPath, nestedQuery]) => {
                  queryBody.query.bool.filter.push({
                    nested: {
                      path: nestedPath,
                      query: nestedQuery
                    }
                  });
                });
                break;
              
              case 'script':
                // Handle custom script queries
                queryBody.query.bool.filter.push({
                  script: filterValue
                });
                break;
              
              default:
                // Handle any other custom filter type
                queryBody.query.bool.filter.push(filterValue);
            }
          });
        }

        // Step 4: Add sorting (auto-discover if not provided)
        if (sort_field) {
          queryBody.sort = [{ [sort_field]: { order: sort_order } }];
        } else if (auto_discover_fields) {
          // Try to find a timestamp field for default sorting
          const timestampFields = availableFields.filter(field => 
            field.includes('time') || field.includes('date') || field.includes('timestamp') || field.includes('created') || field.includes('updated')
          );
          if (timestampFields.length > 0) {
            queryBody.sort = [{ [timestampFields[0]]: { order: sort_order } }];
          }
        }

        // Step 5: Configure source inclusion
        if (!include_source) {
          queryBody._source = false;
        } else if (source_fields && source_fields.length > 0) {
          queryBody._source = source_fields;
        }

        // Step 6: Add highlighting if requested
        if (highlight_fields && highlight_fields.length > 0) {
          queryBody.highlight = {
            fields: highlight_fields.reduce((acc: Record<string, any>, field: string) => {
              acc[field] = {};
              return acc;
            }, {} as Record<string, any>)
          };
        }

        // Step 7: Add custom aggregations if provided
        if (aggregations) {
          queryBody.aggs = aggregations;
        }

        // Step 8: Execute the search
        const encodedPath = encodeURIComponent(`/${index_pattern}/_search`);
        const proxyUrl = `/api/console/proxy?method=POST&path=${encodedPath}`;
        
        const response = await kibanaClient.post(proxyUrl, queryBody, {
          space: targetSpace,
          headers: {
            'kbn-xsrf': 'true',
            'Content-Type': 'application/json'
          }
        });

        const hits = response?.hits?.hits || [];
        const total = response?.hits?.total?.value || 0;

        // Step 9: Process results with dynamic field handling
        const results = hits.map((hit: any) => ({
          _id: hit._id,
          _index: hit._index,
          _score: hit._score,
          _source: hit._source,
          highlight: hit.highlight,
          sort: hit.sort
        }));

        // Step 10: Return comprehensive results
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                search_info: {
                  query: query,
                  index_pattern: index_pattern,
                  search_fields: availableFields,
                  query_type: query_type,
                  filters: filters,
                  sort: sort_field ? { field: sort_field, order: sort_order } : undefined,
                  pagination: { from, size, total },
                  auto_discovered_fields: auto_discover_fields
                },
                results: {
                  total_hits: total,
                  returned_hits: results.length,
                  hits: results
                },
                aggregations: response?.aggregations || {},
                suggestions: response?.suggest || {},
                metadata: {
                  took: response?.took,
                  timed_out: response?.timed_out,
                  _shards: response?._shards
                }
              }, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error(`Universal search failed: ${error}`);
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

  // Helper function to extract fields from Elasticsearch mapping
  function extractFieldsFromMapping(mapping: any): string[] {
    const fields: string[] = [];
    
    function extractFieldsRecursive(obj: any, prefix = '') {
      if (!obj || typeof obj !== 'object') return;
      
      Object.entries(obj).forEach(([key, value]) => {
        if (key === 'properties' && typeof value === 'object') {
          extractFieldsRecursive(value, prefix);
        } else if (key === 'type' && typeof value === 'string') {
          // This is a leaf field
          if (prefix) {
            fields.push(prefix);
          }
        } else if (typeof value === 'object' && value !== null) {
          // Recursively extract nested fields
          const newPrefix = prefix ? `${prefix}.${key}` : key;
          extractFieldsRecursive(value, newPrefix);
        }
      });
    }
    
    // Extract from all indices in the mapping
    Object.values(mapping).forEach((indexMapping: any) => {
      if (indexMapping && typeof indexMapping === 'object' && indexMapping.mappings) {
        extractFieldsRecursive(indexMapping.mappings);
      }
    });
    
    return fields;
  }

  // Tool: Generic compliance API search (works with ANY compliance framework)
  console.log("Registering tool: compliance_search");
  server.tool(
    "compliance_search",
    "Generic compliance search tool that works with ANY compliance framework, standard, or regulation",
    z.object({
      compliance_framework: z.string().describe("Compliance framework name (e.g., 'SOC2', 'ISO27001', 'GDPR', 'HIPAA', 'PCI-DSS', 'custom')"),
      search_query: z.string().describe("Search query for compliance requirements, controls, or findings"),
      index_pattern: z.string().optional().describe("Elasticsearch index pattern for compliance data (e.g., 'compliance-*', 'audit-*', 'risk-*')"),
      compliance_type: z.enum(['requirements', 'controls', 'findings', 'assessments', 'reports', 'all']).optional().default('all').describe("Type of compliance data to search"),
      status_filter: z.array(z.string()).optional().describe("Filter by compliance status (e.g., ['compliant', 'non-compliant', 'in-progress'])"),
      date_range: z.object({
        from: z.string().describe("Start date (ISO format)"),
        to: z.string().describe("End date (ISO format)")
      }).optional().describe("Date range for compliance data"),
      risk_level: z.array(z.string()).optional().describe("Filter by risk level (e.g., ['high', 'medium', 'low'])"),
      space: z.string().optional().describe("Target Kibana space"),
      size: z.number().optional().default(100).describe("Number of results to return")
    }),
    async ({ 
      compliance_framework, 
      search_query, 
      index_pattern = "compliance-*",
      compliance_type = 'all',
      status_filter,
      date_range,
      risk_level,
      space,
      size = 100
    }): Promise<ToolResponse> => {
      try {
        const targetSpace = space || defaultSpace;
        
        // Build dynamic compliance search query
        const queryBody: any = {
          size: size,
          query: {
            bool: {
              must: [
                {
                  multi_match: {
                    query: search_query,
                    fields: [
                      "title^3",
                      "description^2", 
                      "requirement^2",
                      "control^2",
                      "finding^2",
                      "content",
                      "details"
                    ],
                    type: "best_fields"
                  }
                },
                {
                  term: {
                    "compliance_framework.keyword": compliance_framework.toLowerCase()
                  }
                }
              ],
              filter: []
            }
          },
          sort: [
            { "last_updated": { order: "desc" } },
            { "_score": { order: "desc" } }
          ]
        };

        // Add dynamic filters based on compliance type
        if (compliance_type !== 'all') {
          queryBody.query.bool.must.push({
            term: {
              "compliance_type.keyword": compliance_type
            }
          });
        }

        // Add status filter if provided
        if (status_filter && status_filter.length > 0) {
          queryBody.query.bool.filter.push({
            terms: {
              "status.keyword": status_filter
            }
          });
        }

        // Add date range filter if provided
        if (date_range) {
          queryBody.query.bool.filter.push({
            range: {
              "last_updated": {
                gte: date_range.from,
                lte: date_range.to,
                format: "strict_date_optional_time"
              }
            }
          });
        }

        // Add risk level filter if provided
        if (risk_level && risk_level.length > 0) {
          queryBody.query.bool.filter.push({
            terms: {
              "risk_level.keyword": risk_level
            }
          });
        }

        // Execute compliance search
        const encodedPath = encodeURIComponent(`/${index_pattern}/_search`);
        const proxyUrl = `/api/console/proxy?method=POST&path=${encodedPath}`;
        
        const response = await kibanaClient.post(proxyUrl, queryBody, {
          space: targetSpace,
          headers: {
            'kbn-xsrf': 'true',
            'Content-Type': 'application/json'
          }
        });

        const hits = response?.hits?.hits || [];
        const total = response?.hits?.total?.value || 0;

        // Process compliance results
        const results = hits.map((hit: any) => ({
          _id: hit._id,
          _index: hit._index,
          _score: hit._score,
          compliance_data: hit._source,
          highlight: hit.highlight
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                compliance_search_info: {
                  framework: compliance_framework,
                  query: search_query,
                  type: compliance_type,
                  status_filter: status_filter,
                  date_range: date_range,
                  risk_level: risk_level,
                  index_pattern: index_pattern
                },
                results: {
                  total_hits: total,
                  returned_hits: results.length,
                  hits: results
                }
              }, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error(`Compliance search failed: ${error}`);
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

  // Tool: Legacy search_logs (kept for backward compatibility but now uses universal search)
  console.log("Registering tool: search_logs");
  server.tool(
    "search_logs",
    "Legacy log search tool - now uses universal search engine for backward compatibility",
    z.object({
      query: z.string().describe("Log message or part of it to search for"),
      from: z.string().describe("Start of date range (ISO format)"),
      to: z.string().describe("End of date range (ISO format)"),
      path: z.string().optional().default("*").describe("Elasticsearch index pattern to search in"),
      model: z.string().optional().default("match_phrase").describe("Search model to use"),
      size: z.number().optional().default(100).describe("Number of results to return")
    }),
    async ({ query, from, to, path = "*", model = "match_phrase", size = 100 }): Promise<ToolResponse> => {
      try {
        // Use the universal search tool internally
        const filters = {
          date_range: { 
            from, 
            to 
          }
        };
        
        // Build query body for backward compatibility
        const queryBody = {
          size: size,
          query: {
            bool: {
              must: [
                { [model]: { message: query } },
                {
                  range: {
                    "@timestamp": {
                      gte: from,
                      lte: to,
                      format: "strict_date_optional_time"
                    }
                  }
                }
              ]
            }
          },
          _source: ["message"]
        };

        // Execute search
        const encodedPath = encodeURIComponent(`/${path}/_search`);
        const proxyUrl = `/api/console/proxy?method=POST&path=${encodedPath}`;
        
        const response = await kibanaClient.post(proxyUrl, queryBody, {
          headers: {
            'kbn-xsrf': 'true',
            'Content-Type': 'application/json'
          }
        });

        const messages = response?.hits?.hits?.map((hit: any) => hit._source?.message) || [];

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                query: query,
                path: path,
                model: model,
                from: from,
                to: to,
                total_hits: response?.hits?.total?.value || 0,
                messages: messages
              }, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error(`Failed to search logs: ${error}`);
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