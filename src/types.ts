import { z } from "zod";

// Base schema types
export const BaseSearchSchema = z.object({
  search: z.string().optional(),
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(20)
});

export const BaseIdSchema = z.object({
  id: z.string()
});

export const BaseNameSchema = z.object({
  name: z.string()
});

export const BaseDescriptionSchema = z.object({
  description: z.string().optional()
});

// Configuration schema
export const KibanaConfigSchema = z.object({
  url: z.string().trim().min(1, "Kibana URL cannot be empty").url("Invalid Kibana URL format"),
  username: z.string().optional(),
  password: z.string().optional(),
  caCert: z.string().optional(),
  timeout: z.number().optional().default(30000),
  maxRetries: z.number().optional().default(3),
  defaultSpace: z.string().optional().default('default'),
});

export type KibanaConfig = z.infer<typeof KibanaConfigSchema>;

// Tool response types
export interface ToolResponse {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
}

// Resource response
export interface ResourceResponse {
  contents: Array<{
    uri: string;
    mimeType: string;
    text?: string;
    binary?: Uint8Array;
    size?: number;
  }>;
}

// Prompt response
export interface PromptResponse {
  description?: string;
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: {
      type: "text";
      text: string;
    };
  }>;
}

// Kibana client interface
export interface KibanaClient {
  get: (url: string, options?: { params?: any; headers?: any; space?: string }) => Promise<any>;
  post: (url: string, data?: any, options?: { headers?: any; space?: string }) => Promise<any>;
  put: (url: string, data?: any, options?: { headers?: any; space?: string }) => Promise<any>;
  delete: (url: string, options?: { headers?: any; space?: string }) => Promise<any>;
  patch?: (url: string, data?: any, options?: { headers?: any; space?: string }) => Promise<any>;
}

// Server base interface for tools, prompts, and resources registration
export interface ServerBase {
  tool: {
    (name: string, cb: (extra: RequestHandlerExtra) => Promise<ToolResponse> | ToolResponse): void;
    (name: string, description: string, schema: any, handler: (args: any, extra: RequestHandlerExtra) => Promise<ToolResponse> | ToolResponse): void;
  };
  
  prompt: {
    (name: string, schema: any, handler: (args: any, extra?: RequestHandlerExtra) => Promise<PromptResponse> | PromptResponse): void;
  };
  
  resource: {
    (name: string, uri: string, handler: (uri: URL, params: Record<string, string>, extra?: RequestHandlerExtra) => Promise<ResourceResponse> | ResourceResponse): void;
    (name: string, template: any, handler: (uri: URL, params: Record<string, string>, extra?: RequestHandlerExtra) => Promise<ResourceResponse> | ResourceResponse): void;
  };
}

// Request handler extra information
export interface RequestHandlerExtra {
  [key: string]: unknown;
  signal: AbortSignal;
}

// Error types
export class KibanaError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = "KibanaError";
  }
}

// Tool registration result
export interface ToolRegistrationResult {
  name: string;
  success: boolean;
  error?: string;
}

// Server creation options
export interface ServerCreationOptions {
  name: string;
  version: string;
  transport?: any;
  config: KibanaConfig;
  description?: string;
} 