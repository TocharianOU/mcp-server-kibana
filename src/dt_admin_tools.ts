import { z } from 'zod';
import { ServerBase, KibanaClient, ToolResponse } from './types.js';

/**
 * Detection Admin Tools (dt_admin_*) - Kibana Detection Engine Administration
 * 
 * This module provides administrative tools for the detection engine.
 * Simplified to focus on read-only privilege checking.
 * All tools are based on the official Kibana Detection Engine API specification.
 */

// ============================================================================
// DETECTION ENGINE ADMINISTRATION TOOLS (dt_admin_*)
// ============================================================================

/**
 * Get detection engine privileges
 * @param kibanaClient - Kibana client instance
 * @param space - Target Kibana space (optional)
 * @returns Promise<ToolResponse> - MCP tool response
 */
async function dt_get_detection_privileges_impl(
  kibanaClient: KibanaClient,
  space?: string
): Promise<ToolResponse> {
  try {
    const url = `/api/detection_engine/privileges`;
    const response = await kibanaClient.get(url, { space });

    return {
      content: [{
        type: "text",
        text: `Detection engine privileges:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error retrieving detection privileges: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

// ============================================================================
// TOOL REGISTRATION
// ============================================================================

/**
 * Register all detection engine administration tools
 * @param serverBase - Server base interface
 * @param kibanaClient - Kibana client instance
 * @param defaultSpace - Default Kibana space
 */
export async function registerDTAdminTools(
  serverBase: ServerBase,
  kibanaClient: KibanaClient,
  defaultSpace: string
): Promise<void> {
  // dt_get_detection_privileges
  serverBase.tool(
    "dt_get_detection_privileges",
    "Get detection engine privileges for the current user. This shows whether the user is authenticated and has the necessary Kibana space and index privileges to create indices for detection engine alerts. Use this to check if a user can manage detection rules and alerts.",
    z.object({
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (args) => {
      return dt_get_detection_privileges_impl(
        kibanaClient,
        args.space || defaultSpace
      );
    }
  );

}
