#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import axios, { AxiosError } from "axios";
import fs from "fs";
import { z } from "zod";
import { 
  ServerBase, 
  RequestHandlerExtra, 
  ToolResponse,
  ResourceResponse,
  PromptResponse,
  KibanaConfig, 
  KibanaClient,
  KibanaConfigSchema,
  KibanaError,
  ServerCreationOptions
} from "./src/types.js";

// Import all tool modules
import { registerBaseTools } from "./src/base-tools.js";
import { registerPrompts } from "./src/prompts.js";
import { registerResources } from "./src/resources.js";


// Create Kibana client
function createKibanaClient(config: KibanaConfig): KibanaClient {
  const axiosConfig: any = {
    baseURL: config.url,
    timeout: 60000, // 60 seconds
    headers: {
      'Content-Type': 'application/json',
      'kbn-xsrf': 'true'
    },
  };

  // Add authentication
  if (config.username && config.password) {
    axiosConfig.auth = {
      username: config.username,
      password: config.password,
    };
  }

  // Add CA certificate
  if (config.caCert) {
    try {
      axiosConfig.httpsAgent = new (require("https").Agent)({
        ca: fs.readFileSync(config.caCert),
      });
    } catch (error) {
      console.error("Error loading CA certificate:", error);
      throw new KibanaError("Failed to load CA certificate", undefined, error);
    }
  }

  // 动态的 URL 转换逻辑 - 支持每次调用时指定空间
  const buildSpaceAwareUrl = (url: string, space?: string): string => {
    const targetSpace = space || config.defaultSpace;
    if (targetSpace && targetSpace !== 'default' && url.startsWith('/api/')) {
      return `/s/${targetSpace}${url}`;
    }
    return url;
  };

  const axiosInstance = axios.create(axiosConfig);
  

  axiosInstance.interceptors.response.use(
    (response) => {

      return response.data;
    },
    (error) => {

      console.error('API request failed:', error.message);
      return Promise.reject(error);
    }
  );

  return {
    get: async (url: string, options?: { params?: any; headers?: any; space?: string }) => {
      const spaceAwareUrl = buildSpaceAwareUrl(url, options?.space);
      try {
        const response = await axiosInstance.get(spaceAwareUrl, { 
          params: options?.params,
          headers: { ...axiosConfig.headers, ...options?.headers }
        });
        return response;
      } catch (error) {
        const axiosError = error as AxiosError;
        throw new KibanaError(
          `GET request failed: ${axiosError.message}`,
          axiosError.response?.status,
          axiosError.response?.data
        );
      }
    },
    post: async (url: string, data?: any, options?: { headers?: any; space?: string }) => {
      const spaceAwareUrl = buildSpaceAwareUrl(url, options?.space);
      try {
        const response = await axiosInstance.post(spaceAwareUrl, data, { 
          headers: { ...axiosConfig.headers, ...options?.headers }
        });
        return response;
      } catch (error) {
        const axiosError = error as AxiosError;
        throw new KibanaError(
          `POST request failed: ${axiosError.message}`,
          axiosError.response?.status,
          axiosError.response?.data
        );
      }
    },
    put: async (url: string, data?: any, options?: { headers?: any; space?: string }) => {
      const spaceAwareUrl = buildSpaceAwareUrl(url, options?.space);
      try {
        const response = await axiosInstance.put(spaceAwareUrl, data, { 
          headers: { ...axiosConfig.headers, ...options?.headers }
        });
        return response;
      } catch (error) {
        const axiosError = error as AxiosError;
        throw new KibanaError(
          `PUT request failed: ${axiosError.message}`,
          axiosError.response?.status,
          axiosError.response?.data
        );
      }
    },
    delete: async (url: string, options?: { headers?: any; space?: string }) => {
      const spaceAwareUrl = buildSpaceAwareUrl(url, options?.space);
      try {
        const response = await axiosInstance.delete(spaceAwareUrl, { 
          headers: { ...axiosConfig.headers, ...options?.headers }
        });
        return response;
      } catch (error) {
        const axiosError = error as AxiosError;
        throw new KibanaError(
          `DELETE request failed: ${axiosError.message}`,
          axiosError.response?.status,
          axiosError.response?.data
        );
      }
    },
    patch: async (url: string, data?: any, options?: { headers?: any; space?: string }) => {
      const spaceAwareUrl = buildSpaceAwareUrl(url, options?.space);
      try {
        const response = await axiosInstance.patch(spaceAwareUrl, data, { 
          headers: { ...axiosConfig.headers, ...options?.headers }
        });
        return response;
      } catch (error) {
        const axiosError = error as AxiosError;
        throw new KibanaError(
          `PATCH request failed: ${axiosError.message}`,
          axiosError.response?.status,
          axiosError.response?.data
        );
      }
    },
  };
}

interface DashboardPanelParams {
  dashboard_id: string;
  panel_type: string;
  panel_id: string;
  position: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

// Create Kibana MCP server
export async function createKibanaMcpServer(options: ServerCreationOptions): Promise<McpServer> {
  const { name, version, transport, config, description } = options;

  // Validate configuration
  const validatedConfig = KibanaConfigSchema.parse(config);
  const kibanaClient = createKibanaClient(validatedConfig);
  const defaultSpace = validatedConfig.defaultSpace || 'default';

  const server = new McpServer({
    name,
    version,
    transport: transport || new StdioServerTransport(),
    capabilities: {
      tools: {},
      prompts: { listChanged: false },
      resources: {}
    },
    description
  });

  // Create an adapter to convert McpServer to ServerBase
  const serverBase: ServerBase = {
    tool: (name: string, ...args: any[]) => {
      if (args.length === 1) {
        const [cb] = args;
        server.tool(name, async (extra: RequestHandlerExtra) => {
          try {
            const result = await Promise.resolve(cb(extra));
            return result;
          } catch (error) {
            return {
              content: [{
                type: "text",
                text: `Error: ${error instanceof Error ? error.message : String(error)}`
              }],
              isError: true
            };
          }
        });
      } else {
        const [description, schema, handler] = args;
        server.tool(name, description, schema.shape, async (args: any, extra: RequestHandlerExtra) => {
          try {
            const result = await Promise.resolve(handler(args, extra));
            return result;
          } catch (error) {
            if (error instanceof KibanaError) {
              return {
                content: [{
                  type: "text",
                  text: `Error: ${error.message}${error.details ? `\nDetails: ${JSON.stringify(error.details)}` : ''}`
                }],
                isError: true
              };
            }
            return {
              content: [{
                type: "text",
                text: `Error: ${error instanceof Error ? error.message : String(error)}`
              }],
              isError: true
            };
          }
        });
      }
    },
    
    prompt: (name: string, schema: any, handler: any) => {
      server.prompt(name, schema.shape, async (args: any, extra?: RequestHandlerExtra) => {
        try {
          const result = await Promise.resolve(handler(args, extra));
          return result;
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Error in prompt '${name}': ${error instanceof Error ? error.message : String(error)}`
            }],
            isError: true
          };
        }
      });
    },
    
    resource: (name: string, uriOrTemplate: any, handler: any) => {
      server.resource(name, uriOrTemplate, async (...args: any[]) => {
        try {
          const result = await Promise.resolve(handler(...args));
          return result;
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Error in resource '${name}': ${error instanceof Error ? error.message : String(error)}`
            }],
            isError: true
          };
        }
      });
    }
  };

  // Register all tool modules
  const registrations = [
    registerBaseTools(serverBase, kibanaClient, defaultSpace),
    registerPrompts(serverBase, defaultSpace),
    registerResources(serverBase, kibanaClient, defaultSpace)
  ];

  await Promise.all(registrations);

  return server;
}

// Main function
async function main() {
  try {
    // Create configuration from environment variables
    const config: KibanaConfig = {
      url: process.env.KIBANA_URL || "http://localhost:5601",
      username: process.env.KIBANA_USERNAME || "",
      password: process.env.KIBANA_PASSWORD || "",
      caCert: process.env.KIBANA_CA_CERT,
      timeout: parseInt(process.env.KIBANA_TIMEOUT || "30000", 10),
      maxRetries: parseInt(process.env.KIBANA_MAX_RETRIES || "3", 10),
      defaultSpace: process.env.KIBANA_DEFAULT_SPACE || 'default'
    };

   
    const defaultSpace = config.defaultSpace || 'default';
    const serverName = "kibana-mcp-server";
    const serverDescription = defaultSpace === 'default' 
      ? "Kibana MCP Server with multi-space support"
      : `Kibana MCP Server with multi-space support (default: '${defaultSpace}')`;

   
    process.stderr.write(`Starting Kibana MCP Server for space: ${defaultSpace}\n`);
    
    // Create and connect server
    const server = await createKibanaMcpServer({
      name: serverName,
      version: "0.1.6",
      config,

      description: serverDescription
    });

    // Connect transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    // Handle process termination
    process.on("SIGINT", async () => {
      await server.close();
      process.exit(0);
    });
    
  } catch (error) {
    process.exit(1);
  }
}

// Start server
main();
