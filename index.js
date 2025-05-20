import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import axios from "axios";
import fs from "fs";
import { KibanaConfigSchema, KibanaError } from "./src/types.js";
// Import all tool modules
import { registerBaseTools } from "./src/base-tools.js";
import { registerPrompts } from "./src/prompts.js";
import { registerResources } from "./src/resources.js";
// Create Kibana client
function createKibanaClient(config) {
    const axiosConfig = {
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
        }
        catch (error) {
            console.error("Error loading CA certificate:", error);
            throw new KibanaError("Failed to load CA certificate", undefined, error);
        }
    }
    const axiosInstance = axios.create(axiosConfig);
    axiosInstance.interceptors.response.use((response) => {
        return response.data;
    }, (error) => {
        console.error('API request failed:', error.message);
        return Promise.reject(error);
    });
    return {
        get: async (url, options) => {
            try {
                const response = await axiosInstance.get(url, {
                    params: options?.params,
                    headers: { ...axiosConfig.headers, ...options?.headers }
                });
                return response;
            }
            catch (error) {
                const axiosError = error;
                throw new KibanaError(`GET request failed: ${axiosError.message}`, axiosError.response?.status, axiosError.response?.data);
            }
        },
        post: async (url, data, options) => {
            try {
                const response = await axiosInstance.post(url, data, {
                    headers: { ...axiosConfig.headers, ...options?.headers }
                });
                return response;
            }
            catch (error) {
                const axiosError = error;
                throw new KibanaError(`POST request failed: ${axiosError.message}`, axiosError.response?.status, axiosError.response?.data);
            }
        },
        put: async (url, data, options) => {
            try {
                const response = await axiosInstance.put(url, data, {
                    headers: { ...axiosConfig.headers, ...options?.headers }
                });
                return response;
            }
            catch (error) {
                const axiosError = error;
                throw new KibanaError(`PUT request failed: ${axiosError.message}`, axiosError.response?.status, axiosError.response?.data);
            }
        },
        delete: async (url, options) => {
            try {
                const response = await axiosInstance.delete(url, {
                    headers: { ...axiosConfig.headers, ...options?.headers }
                });
                return response;
            }
            catch (error) {
                const axiosError = error;
                throw new KibanaError(`DELETE request failed: ${axiosError.message}`, axiosError.response?.status, axiosError.response?.data);
            }
        },
        patch: async (url, data, options) => {
            try {
                const response = await axiosInstance.patch(url, data, {
                    headers: { ...axiosConfig.headers, ...options?.headers }
                });
                return response;
            }
            catch (error) {
                const axiosError = error;
                throw new KibanaError(`PATCH request failed: ${axiosError.message}`, axiosError.response?.status, axiosError.response?.data);
            }
        },
    };
}
// Create Kibana MCP server
export async function createKibanaMcpServer(options) {
    const { name, version, transport, config } = options;
    // Validate configuration
    const validatedConfig = KibanaConfigSchema.parse(config);
    const kibanaClient = createKibanaClient(validatedConfig);
    // 初始化MCP服务器
    const server = new McpServer({
        name,
        version,
        transport: transport || new StdioServerTransport(),
        capabilities: {
            tools: {},
            prompts: { listChanged: false }, // Enable prompts capability
            resources: {} // Enable resources capability
        }
    });
    // Create an adapter to convert McpServer to ServerBase
    const serverBase = {
        tool: (name, ...args) => {
            if (args.length === 1) {
                const [cb] = args;
                server.tool(name, async (extra) => {
                    try {
                        const result = await Promise.resolve(cb(extra));
                        return result;
                    }
                    catch (error) {
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
            else {
                const [description, schema, handler] = args;
                server.tool(name, description, schema.shape, async (args, extra) => {
                    try {
                        const result = await Promise.resolve(handler(args, extra));
                        return result;
                    }
                    catch (error) {
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
        prompt: (name, schema, handler) => {
            server.prompt(name, schema.shape, async (args, extra) => {
                try {
                    const result = await Promise.resolve(handler(args, extra));
                    return result;
                }
                catch (error) {
                    console.error(`Error in prompt '${name}':`, error);
                    throw error; // Let MCP server handle prompt errors
                }
            });
        },
        resource: (name, uriOrTemplate, handler) => {
            // For the MCP SDK, we need to simplify our implementation because the actual types
            // of ResourceTemplate and other specifics may be internal to the SDK
            server.resource(name, uriOrTemplate, async (...args) => {
                try {
                    // Pass all arguments through to the handler
                    const result = await Promise.resolve(handler(...args));
                    return result;
                }
                catch (error) {
                    console.error(`Error in resource '${name}':`, error);
                    throw error; // Let MCP server handle resource errors
                }
            });
        }
    };
    // Register all tool modules
    const registrations = [
        registerBaseTools(serverBase, kibanaClient),
        registerPrompts(serverBase),
        registerResources(serverBase, kibanaClient)
    ];
    await Promise.all(registrations);
    // Register resource handlers
    // TODO: Add more resource handlers if needed
    return server;
}
// Main function
async function main() {
    try {
        console.log("Starting MCP server...");
        // Create configuration from environment variables
        const config = {
            url: process.env.KIBANA_URL || "http://localhost:5601",
            username: process.env.KIBANA_USERNAME || "",
            password: process.env.KIBANA_PASSWORD || "",
            caCert: process.env.KIBANA_CA_CERT,
            timeout: parseInt(process.env.KIBANA_TIMEOUT || "30000", 10),
            maxRetries: parseInt(process.env.KIBANA_MAX_RETRIES || "3", 10),
        };
        console.log("Config loaded:", { ...config, password: "***" });
        // Create and connect server
        console.log("Creating MCP server...");
        const server = await createKibanaMcpServer({
            name: "kibana-mcp-server",
            version: "1.0.0",
            config,
        });
        console.log("MCP server created successfully");
        console.log("Connecting transport...");
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.log("Transport connected successfully");
        // Handle process termination
        process.on("SIGINT", async () => {
            console.log("Shutting down...");
            await server.close();
            process.exit(0);
        });
        console.log("Server setup complete, ready to handle requests");
    }
    catch (error) {
        console.error("Error starting server:", error);
        process.exit(1);
    }
}
// Start server
console.log("Initializing application...");
main();
//# sourceMappingURL=index.js.map