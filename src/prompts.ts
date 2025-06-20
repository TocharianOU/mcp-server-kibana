import { z } from "zod";
import type { ServerBase, PromptResponse } from "./types";

export function registerPrompts(server: ServerBase, defaultSpace: string) {
  // 1. Kibana Tool Expert - Tool-based Kibana expert using tools defined in base-tools.ts
  const kibanaToolExpertSchema = z.object({
    query: z
      .string()
      .describe("User's question or request about Kibana"),
    context: z
      .string()
      .optional()
      .describe("Optional context information to help understand the user's needs or Kibana environment"),
  });

  server.prompt(
    "kibana-tool-expert",
    kibanaToolExpertSchema,
    async (input): Promise<PromptResponse> => {
      return {
        description: `Multi-space Kibana expert assistant (default space: '${defaultSpace}')`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `[System Instruction] You are a Kibana expert with multi-space capabilities. 

[Default Space] ${defaultSpace}

Key capabilities:
1. All tools now support an optional 'space' parameter - you can specify different spaces for different operations
2. When no space is specified, operations use the default space: '${defaultSpace}'
3. You can discover available spaces using the 'get_available_spaces' tool
4. Always inform the user which space an operation will target

Important: When creating dashboards, saved objects, or other Kibana resources, you can specify the target space in the tool parameters. For example:
- execute_api({method: "POST", path: "/api/saved_objects/dashboard", space: "marketing-team", body: {...}})

${input.context ? `\n[Context Information]\n${input.context}` : ''}

[User Question] ${input.query}`
            }
          }
        ]
      };
    }
  );

  // 2. Kibana Resource Helper - Assistant designed for clients that only support resources
  const kibanaResourceHelperSchema = z.object({
    query: z
      .string()
      .describe("User's question about Kibana API or resources"),
    specificResource: z
      .string()
      .optional()
      .describe("Optional specific resource name, such as 'kibana-api-paths' or 'kibana-api-path-detail'"),
  });

  server.prompt(
    "kibana-resource-helper",
    kibanaResourceHelperSchema,
    async (input): Promise<PromptResponse> => {
      return {
        description: `Multi-space Kibana API resource assistant (default space: '${defaultSpace}')`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `[System Instruction] You are a professional Kibana API resource expert with multi-space support.

[Default Space] ${defaultSpace}

Guidelines:
1. You can guide users to use space-aware resource URIs
2. Resources can include space parameters for targeted operations
3. Available resources:
   - kibana-api://paths - Get a list of all API paths, can be filtered with the search parameter
   - kibana-api://path/{method}/{encoded_path} - Get detailed information for a specific API endpoint

4. Space-aware API patterns:
   - Most Kibana APIs support space-specific endpoints: /s/{space-id}/api/...
   - When no space is specified, operations target the default space
   - Users can specify target spaces in API calls

5. Interaction Guidelines:
   - Provide clear resource URI examples
   - Explain space parameter usage
   - Show how to construct space-aware API calls
   - Provide complete workflow examples including space targeting

${input.specificResource ? `\n[Specified Resource] The user mentioned a specific resource: ${input.specificResource}` : ''}

[User Question] ${input.query}`
            }
          }
        ]
      };
    }
  );
} 