#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { randomUUID } from "crypto";
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
import { registerVlTools } from "./src/vl_search_tools.js";
import { registerVLGetTools } from "./src/vl_get_tools.js";
import { registerVLDeleteTools } from "./src/vl_delete_tools.js";
import { registerVLCreateTools } from "./src/vl_create_tools.js";
import { registerVLUpdateTools } from "./src/vl_update_tools.js";


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

  // Add authentication - prioritize basic auth over cookies
  if (config.username && config.password) {
    axiosConfig.auth = {
      username: config.username,
      password: config.password,
    };
  } else if (config.cookies) {
    axiosConfig.headers['Cookie'] = config.cookies;
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
    registerResources(serverBase, kibanaClient, defaultSpace),
    registerVlTools(serverBase, kibanaClient, defaultSpace),
    registerVLGetTools(serverBase, kibanaClient),
    registerVLDeleteTools(serverBase, kibanaClient),
    registerVLCreateTools(serverBase, kibanaClient),
    registerVLUpdateTools(serverBase, kibanaClient)
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
      cookies: process.env.KIBANA_COOKIES,
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

    // Check if HTTP mode is enabled
    const useHttp = process.env.MCP_TRANSPORT === 'http';
    const httpPort = parseInt(process.env.MCP_HTTP_PORT || '3000', 10);
    const httpHost = process.env.MCP_HTTP_HOST || 'localhost';

    if (useHttp) {
      // HTTP Mode - Use Streamable HTTP Transport
      process.stderr.write(`Starting Kibana MCP Server in HTTP mode on ${httpHost}:${httpPort}\n`);
      process.stderr.write(`Default Kibana space: ${defaultSpace}\n`);
      
      const app = express();
      app.use(express.json());
      
      // Store active transports by session ID
      const transports = new Map<string, StreamableHTTPServerTransport>();

      // Health check endpoint
      app.get('/health', (req, res) => {
        res.json({ status: 'ok', transport: 'streamable-http' });
      });

      // MCP endpoint
      app.post('/mcp', async (req, res) => {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        
        try {
          let transport: StreamableHTTPServerTransport;

          // Check if we have an existing session
          if (sessionId && transports.has(sessionId)) {
            transport = transports.get(sessionId)!;
          } else {
            // Create new transport for new session
            transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => randomUUID(),
              onsessioninitialized: async (newSessionId: string) => {
                transports.set(newSessionId, transport);
                process.stderr.write(`New MCP session initialized: ${newSessionId}\n`);
              },
              onsessionclosed: async (closedSessionId: string) => {
                transports.delete(closedSessionId);
                process.stderr.write(`MCP session closed: ${closedSessionId}\n`);
              }
            });

            // Create server for this transport
            const server = await createKibanaMcpServer({
              name: serverName,
              version: "0.4.0",
              config,
              description: serverDescription
            });

            await server.connect(transport);
          }

          // Handle the request
          await transport.handleRequest(req, res, req.body);
        } catch (error) {
          process.stderr.write(`Error handling MCP request: ${error}\n`);
          if (!res.headersSent) {
            res.status(500).json({
              jsonrpc: '2.0',
              error: {
                code: -32603,
                message: 'Internal server error',
              },
              id: null,
            });
          }
        }
      });

      // GET endpoint for SSE streams
      app.get('/mcp', async (req, res) => {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        
        if (!sessionId || !transports.has(sessionId)) {
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Invalid or missing session ID',
            },
            id: null,
          });
          return;
        }

        try {
          const transport = transports.get(sessionId)!;
          await transport.handleRequest(req, res);
        } catch (error) {
          process.stderr.write(`Error handling SSE stream: ${error}\n`);
          if (!res.headersSent) {
            res.status(500).json({
              jsonrpc: '2.0',
              error: {
                code: -32603,
                message: 'Failed to establish SSE stream',
              },
              id: null,
            });
          }
        }
      });

      // Start HTTP server
      app.listen(httpPort, httpHost, () => {
        console.log(`\n✓ Kibana MCP Server (HTTP Mode) is running`);
        console.log(`  Endpoint: http://${httpHost}:${httpPort}/mcp`);
        console.log(`  Health: http://${httpHost}:${httpPort}/health`);
        console.log(`  Transport: Streamable HTTP`);
        console.log(`  Default Space: ${defaultSpace}\n`);
      });

      // Handle process termination
      process.on("SIGINT", async () => {
        console.log("\nShutting down server...");
        for (const [sessionId, transport] of transports.entries()) {
          await transport.close();
        }
        process.exit(0);
      });

    } else {
      // Stdio Mode (Default) - Use Stdio Transport
      process.stderr.write(`Starting Kibana MCP Server in Stdio mode for space: ${defaultSpace}\n`);
      
      const server = await createKibanaMcpServer({
        name: serverName,
        version: "0.4.0",
        config,
        description: serverDescription
      });

      const transport = new StdioServerTransport();
      await server.connect(transport);

      // Handle process termination
      process.on("SIGINT", async () => {
        await server.close();
        process.exit(0);
      });
    }
    
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

// Start server
main();
