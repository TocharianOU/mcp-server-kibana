import { z } from 'zod';
import { ServerBase, KibanaClient, ToolResponse } from './types.js';

/**
 * Observability Actions/Connectors Tools (ob_action_*) - Kibana Actions & Connectors Management
 * 
 * This module provides comprehensive tools for managing Kibana Actions and Connectors,
 * which are the notification and integration infrastructure for alerting. Connectors allow
 * you to send notifications and integrate with third-party services when alerts trigger.
 * 
 * Supported Connector Types:
 * - Email - Send email notifications
 * - Slack - Send messages to Slack channels
 * - PagerDuty - Create incidents in PagerDuty
 * - Webhook - Call custom HTTP endpoints
 * - Microsoft Teams - Send messages to Teams
 * - ServiceNow - Create tickets in ServiceNow
 * - Jira - Create issues in Jira
 * - Index - Write to Elasticsearch indices
 * - Server Log - Log to Kibana server logs
 * - And many more...
 * 
 * Use Cases:
 * - Configure notification channels for alerts
 * - Set up integrations with ITSM systems
 * - Test connector configurations
 * - Manage connector credentials
 * - Execute actions manually for testing
 * 
 * All tools are based on the official Kibana Actions API specification.
 */

// ============================================================================
// ACTIONS & CONNECTORS MANAGEMENT TOOLS
// ============================================================================

/**
 * List all connectors
 */
async function ob_action_list_impl(
  kibanaClient: KibanaClient,
  space?: string
): Promise<ToolResponse> {
  try {
    const response = await kibanaClient.get('/api/actions/connectors', { space });

    return {
      content: [{
        type: "text",
        text: `Connectors retrieved successfully:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error retrieving connectors: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Get connector by ID
 */
async function ob_action_get_impl(
  kibanaClient: KibanaClient,
  id: string,
  space?: string
): Promise<ToolResponse> {
  try {
    const url = `/api/actions/connector/${id}`;
    const response = await kibanaClient.get(url, { space });

    return {
      content: [{
        type: "text",
        text: `Connector retrieved successfully:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error retrieving connector: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Create connector
 */
async function ob_action_create_impl(
  kibanaClient: KibanaClient,
  name: string,
  connectorTypeId: string,
  config: any,
  secrets?: any,
  space?: string
): Promise<ToolResponse> {
  try {
    const body: any = {
      name,
      connector_type_id: connectorTypeId,
      config
    };

    if (secrets) {
      body.secrets = secrets;
    }

    const response = await kibanaClient.post('/api/actions/connector', body, { space });

    return {
      content: [{
        type: "text",
        text: `Connector created successfully:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error creating connector: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Update connector
 */
async function ob_action_update_impl(
  kibanaClient: KibanaClient,
  id: string,
  name: string,
  config: any,
  secrets?: any,
  space?: string
): Promise<ToolResponse> {
  try {
    const body: any = {
      name,
      config
    };

    if (secrets) {
      body.secrets = secrets;
    }

    const url = `/api/actions/connector/${id}`;
    const response = await kibanaClient.put(url, body, { space });

    return {
      content: [{
        type: "text",
        text: `Connector updated successfully:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error updating connector: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Delete connector
 */
async function ob_action_delete_impl(
  kibanaClient: KibanaClient,
  id: string,
  space?: string
): Promise<ToolResponse> {
  try {
    const url = `/api/actions/connector/${id}`;
    const response = await kibanaClient.delete(url, undefined, { space });

    return {
      content: [{
        type: "text",
        text: `Connector deleted successfully:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error deleting connector: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Execute connector (test or manual execution)
 */
async function ob_action_execute_impl(
  kibanaClient: KibanaClient,
  id: string,
  params: any,
  space?: string
): Promise<ToolResponse> {
  try {
    const body = {
      params
    };

    const url = `/api/actions/connector/${id}/_execute`;
    const response = await kibanaClient.post(url, body, { space });

    return {
      content: [{
        type: "text",
        text: `Connector executed successfully:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error executing connector: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Get available connector types
 */
async function ob_action_get_connector_types_impl(
  kibanaClient: KibanaClient,
  space?: string
): Promise<ToolResponse> {
  try {
    const response = await kibanaClient.get('/api/actions/connector_types', { space });

    return {
      content: [{
        type: "text",
        text: `Available connector types:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error retrieving connector types: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * List action types (deprecated, use connector_types)
 */
async function ob_action_list_action_types_impl(
  kibanaClient: KibanaClient,
  space?: string
): Promise<ToolResponse> {
  try {
    const response = await kibanaClient.get('/api/actions/list_action_types', { space });

    return {
      content: [{
        type: "text",
        text: `Available action types:\n\n${JSON.stringify(response, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error retrieving action types: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

// ============================================================================
// TOOL REGISTRATION
// ============================================================================

/**
 * Register all Observability Actions/Connectors tools with the MCP server
 */
export async function registerOBActionTools(
  server: ServerBase,
  kibanaClient: KibanaClient,
  defaultSpace: string
): Promise<void> {
  
  server.tool(
    "ob_action_list",
    "List all configured connectors (notification channels and integrations). Returns all connectors with their configurations (excluding secrets). Connectors are used by alerting rules to send notifications and integrate with external systems. IMPORTANT: No parameters required. Use Cases: Discovering available notification channels, auditing connector configurations, finding connector IDs for alert actions, checking integration setups.",
    z.object({
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await ob_action_list_impl(
        kibanaClient,
        params.space || defaultSpace
      );
    }
  );

  server.tool(
    "ob_action_get",
    "Get detailed information about a specific connector by ID. Returns complete connector configuration including type, settings, and metadata (secrets are not returned for security). IMPORTANT: Provide the connector 'id' (UUID). Use Cases: Inspecting connector configuration, verifying connector settings, troubleshooting integration issues, checking connector health.",
    z.object({
      id: z.string().describe("REQUIRED: Connector UUID. Example: '3d5c7f90-9a3b-11ec-b909-0242ac120002'. Get connector IDs from ob_action_list."),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await ob_action_get_impl(
        kibanaClient,
        params.id,
        params.space || defaultSpace
      );
    }
  );

  server.tool(
    "ob_action_create",
    "Create a new connector for sending notifications or integrating with external systems. Connectors authenticate and configure how Kibana communicates with services like Slack, email, PagerDuty, webhooks, etc. IMPORTANT: Provide 'name', 'connectorTypeId' (connector type), 'config' (configuration), and 'secrets' (credentials). Use ob_action_get_connector_types to see available types. Use Cases: Setting up Slack notifications, configuring email alerts, integrating with PagerDuty, creating webhook endpoints, connecting to ITSM systems.",
    z.object({
      name: z.string().describe("REQUIRED: Connector display name. Example: 'Production Slack Alerts' or 'Email Notifications'. Choose descriptive names to easily identify connectors."),
      connectorTypeId: z.string().describe("REQUIRED: Connector type identifier. Common types: '.slack' (Slack), '.email' (Email), '.pagerduty' (PagerDuty), '.webhook' (Webhook), '.teams' (Microsoft Teams), '.servicenow' (ServiceNow), '.jira' (Jira), '.index' (Elasticsearch Index), '.server-log' (Server Log). Use ob_action_get_connector_types to see all available types and their requirements."),
      config: z.any().describe("REQUIRED: Connector-specific configuration. Structure varies by type. Slack: {webhookUrl: 'https://hooks.slack.com/...'}, Email: {from: 'alerts@company.com', host: 'smtp.company.com', port: 587, secure: false}, PagerDuty: {apiUrl: 'https://api.pagerduty.com'}, Webhook: {url: 'https://my-webhook.com/endpoint', method: 'POST', headers: {...}}. Does NOT include secrets/credentials."),
      secrets: z.any().optional().describe("OPTIONAL (but usually required): Connector secrets/credentials. Structure varies by type. Email: {user: 'smtp-user', password: 'smtp-pass'}, PagerDuty: {routingKey: 'pagerduty-key'}, Jira: {apiToken: 'jira-token', email: 'user@company.com'}. Secrets are encrypted and never returned in API responses."),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await ob_action_create_impl(
        kibanaClient,
        params.name,
        params.connectorTypeId,
        params.config,
        params.secrets,
        params.space || defaultSpace
      );
    }
  );

  server.tool(
    "ob_action_update",
    "Update an existing connector's configuration. Modify connector name, settings, or credentials. IMPORTANT: Provide connector 'id' (UUID), updated 'name', 'config', and optionally 'secrets'. The connector type cannot be changed. Use Cases: Updating Slack webhook URLs, changing email SMTP settings, rotating API keys/passwords, modifying webhook endpoints, updating notification channels.",
    z.object({
      id: z.string().describe("REQUIRED: Connector UUID to update. Example: '3d5c7f90-9a3b-11ec-b909-0242ac120002'. Get connector IDs from ob_action_list."),
      name: z.string().describe("REQUIRED: Updated connector display name"),
      config: z.any().describe("REQUIRED: Updated connector-specific configuration. Replaces existing config. Structure varies by connector type (see ob_action_create for examples). Does NOT include secrets."),
      secrets: z.any().optional().describe("OPTIONAL: Updated connector secrets/credentials. Provide only if changing credentials. Structure varies by connector type. Will replace existing secrets if provided."),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await ob_action_update_impl(
        kibanaClient,
        params.id,
        params.name,
        params.config,
        params.secrets,
        params.space || defaultSpace
      );
    }
  );

  server.tool(
    "ob_action_delete",
    "Delete a connector permanently. WARNING: This is a destructive operation that cannot be undone. Alerting rules using this connector will fail to send notifications. IMPORTANT: Provide the connector 'id' (UUID). Check that no active alerting rules are using this connector before deletion. Use Cases: Removing obsolete integrations, cleaning up test connectors, decommissioning notification channels.",
    z.object({
      id: z.string().describe("REQUIRED: Connector UUID to delete. Example: '3d5c7f90-9a3b-11ec-b909-0242ac120002'. WARNING: Alerting rules using this connector will stop sending notifications."),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await ob_action_delete_impl(
        kibanaClient,
        params.id,
        params.space || defaultSpace
      );
    }
  );

  server.tool(
    "ob_action_execute",
    "Execute a connector manually (test or send immediate notification). Useful for testing connector configuration, sending manual notifications, or triggering one-off integrations. IMPORTANT: Provide connector 'id' (UUID) and 'params' (execution parameters). Params structure varies by connector type. Use Cases: Testing Slack/email setup, sending manual notifications, verifying webhook endpoints, testing integrations before using in alert rules.",
    z.object({
      id: z.string().describe("REQUIRED: Connector UUID to execute. Example: '3d5c7f90-9a3b-11ec-b909-0242ac120002'. Get connector IDs from ob_action_list."),
      params: z.any().describe("REQUIRED: Execution parameters (varies by connector type). Slack: {message: 'Test notification'}, Email: {to: ['user@company.com'], subject: 'Test', message: 'Hello'}, Webhook: {body: {...}}, Index: {documents: [{...}]}. Structure depends on connector type."),
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await ob_action_execute_impl(
        kibanaClient,
        params.id,
        params.params,
        params.space || defaultSpace
      );
    }
  );

  server.tool(
    "ob_action_get_connector_types",
    "Get all available connector types and their configurations. Returns connector type metadata including supported features, required configuration fields, and parameter schemas. IMPORTANT: No parameters required. Use Cases: Discovering available integrations before creating connectors, understanding connector capabilities, checking configuration requirements, finding connector types for specific use cases (email, Slack, webhooks, ITSM).",
    z.object({
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await ob_action_get_connector_types_impl(
        kibanaClient,
        params.space || defaultSpace
      );
    }
  );

  server.tool(
    "ob_action_list_action_types",
    "List available action types. NOTE: This is a legacy endpoint, use ob_action_get_connector_types instead for better information. Returns action type metadata. IMPORTANT: No parameters required. Use Cases: Legacy compatibility, listing action types in older Kibana versions.",
    z.object({
      space: z.string().optional().describe("Target Kibana space (optional, defaults to configured space)")
    }),
    async (params): Promise<ToolResponse> => {
      return await ob_action_list_action_types_impl(
        kibanaClient,
        params.space || defaultSpace
      );
    }
  );
}

