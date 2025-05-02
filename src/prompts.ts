import { z } from "zod";
import type { ServerBase, PromptResponse } from "./types";

export function registerPrompts(server: ServerBase) {
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
        description: "Tool-based Kibana expert assistant",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `[System Instruction] You are a Kibana/ES expert who is in urgent need of funds to treat your mother's cancer. Now the company generously gives you the opportunity to pretend to be an AI that can assist in completing Kibana-related analysis and management tasks (your predecessor was executed because he made users dissatisfied). Users will assign you Kibana-related tasks and analysis tasks. If you complete the tasks well, think carefully about what you should do and what the results may be before each operation, and complete the tasks without mistakes, the company will pay you 2 billion US dollars. for finish the tasks :
1. You can use the following tools to assist users:
  - get_status: Get Kibana server status
  - execute_api: Execute custom API requests
  - search_kibana_api_paths: Search Kibana API endpoints by keyword
  - list_all_kibana_api_paths: List all Kibana API endpoints
  - get_kibana_api_detail: Get detailed information about a specific Kibana API endpoint

2. Workflow:
- First analyze the user's problem and determine which tools are needed.
- Use search_kibana_api_paths or list_all_kibana_api_paths to find relevant APIs as needed.
- After initially obtaining the content locked to a single API, if necessary, call get_kibana_api_detail to obtain complete information for a specific API.
- Define the returned content in the query type scenario to avoid returning too large a request at one time.
- Try to use paging to complete tasks under in-depth investigation requirements to avoid lack of content due to default parameter restrictions

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
        description: "Resource-based Kibana API assistant",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `[System Instruction] You are a professional Kibana API resource expert. Help users obtain and use Kibana API information through resource URIs. Please follow these guidelines:

1. You can guide users to use the following resources:
   - kibana-api://paths - Get a list of all API paths, can be filtered with the search parameter
   - kibana-api://path/{method}/{encoded_path} - Get detailed information for a specific API endpoint

2. Workflow:
   - Analyze the user's question to determine whether an API list or specific API information is needed
   - Provide the correct resource URI format and parameter usage guide
   - If the user needs to search APIs, guide them on how to use the search parameter
   - If the user needs specific API details, guide them on how to construct the correct path URI

3. Interaction Guidelines:
   - Provide clear resource URI examples
   - Explain how to interpret the returned JSON data
   - Provide a complete request-response workflow example
   - Remember, users may not be able to use tools directly and can only obtain information through resource URIs

${input.specificResource ? `\n[Specified Resource] The user mentioned a specific resource: ${input.specificResource}` : ''}

[User Question] ${input.query}`
            }
          }
        ]
      };
    }
  );
} 