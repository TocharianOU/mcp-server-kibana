[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/tocharianou-mcp-server-kibana-badge.png)](https://mseep.ai/app/tocharianou-mcp-server-kibana)

# Kibana MCP Server
[![npm version](https://badge.fury.io/js/@tocharian%2Fmcp-server-kibana.svg)](https://www.npmjs.com/package/@tocharian/mcp-server-kibana)
[![Downloads](https://img.shields.io/npm/dm/@tocharian/mcp-server-kibana.svg)](https://www.npmjs.com/package/@tocharian/mcp-server-kibana)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/TocharianOU/mcp-server-kibana)

> **API Specification**
>
> This project is based on the official Elastic Kibana API documentation and uses the OpenAPI YAML specification from Elastic Stack 8.x (ES8) to dynamically retrieve and manage all Kibana API endpoints. For the latest details, see the [Kibana API documentation](https://www.elastic.co/docs/api/doc/kibana/).

A Kibana MCP server implementation that allows any MCP-compatible client (such as Claude Desktop) to access your Kibana instance via natural language or programmatic requests.

**This project is community-maintained and is not an official product of Elastic or MCP.**

---

## 🚀 Installation

### Quick Install
```bash
# Global installation (recommended)
npm install -g @tocharian/mcp-server-kibana

# Or local installation
npm install @tocharian/mcp-server-kibana
```

### Alternative: From Source
```bash
git clone https://github.com/TocharianOU/mcp-server-kibana.git
cd mcp-server-kibana
npm install
npm run build
```

---

## 🎯 Quick Start

### Method 1: Direct CLI Usage

#### Using Basic Authentication
```bash
# Set your Kibana credentials and run
KIBANA_URL=http://your-kibana-server:5601 \
KIBANA_USERNAME=your-username \
KIBANA_PASSWORD=your-password \
npx @tocharian/mcp-server-kibana
```

#### Using Cookie Authentication
```bash
# Set your Kibana session cookies and run
KIBANA_URL=http://your-kibana-server:5601 \
KIBANA_COOKIES="sid=your-session-id; security-session=your-security-session" \
npx @tocharian/mcp-server-kibana
```

### Method 2: Claude Desktop Integration (Recommended)
Add to your Claude Desktop configuration file:

**Config file locations:**
- **MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

#### Using Basic Authentication
```json
{
  "mcpServers": {
    "kibana-mcp-server": {
      "command": "npx",
      "args": ["@tocharian/mcp-server-kibana"],
      "env": {
        "KIBANA_URL": "http://your-kibana-server:5601",
        "KIBANA_USERNAME": "your-username",
        "KIBANA_PASSWORD": "your-password",
        "KIBANA_DEFAULT_SPACE": "default",
        "NODE_TLS_REJECT_UNAUTHORIZED": "0"
      }
    }
  }
}
```

#### Using Cookie Authentication
```json
{
  "mcpServers": {
    "kibana-mcp-server": {
      "command": "npx",
      "args": ["@tocharian/mcp-server-kibana"],
      "env": {
        "KIBANA_URL": "http://your-kibana-server:5601",
        "KIBANA_COOKIES": "sid=your-session-id; security-session=your-security-session",
        "KIBANA_DEFAULT_SPACE": "default",
        "NODE_TLS_REJECT_UNAUTHORIZED": "0"
      }
    }
  }
}
```

### Method 3: Using Environment File
```bash
# Create .env file
cat > kibana-mcp.env << EOF
KIBANA_URL=http://your-kibana-server:5601
KIBANA_USERNAME=your-username
KIBANA_PASSWORD=your-password
NODE_TLS_REJECT_UNAUTHORIZED=0
EOF

# Run with environment file
env $(cat kibana-mcp.env | xargs) npx @tocharian/mcp-server-kibana
```

### Method 4: Streamable HTTP Mode (NEW in v0.4.0)

Run the server as a standalone HTTP service for remote access and API integration:

```bash
# Start HTTP server (default port 3000)
MCP_TRANSPORT=http \
KIBANA_URL=http://your-kibana-server:5601 \
KIBANA_USERNAME=your-username \
KIBANA_PASSWORD=your-password \
npx @tocharian/mcp-server-kibana

# Or with custom port and host
MCP_TRANSPORT=http \
MCP_HTTP_PORT=9000 \
MCP_HTTP_HOST=0.0.0.0 \
KIBANA_URL=http://your-kibana-server:5601 \
KIBANA_USERNAME=your-username \
KIBANA_PASSWORD=your-password \
npx @tocharian/mcp-server-kibana
```

**HTTP Mode Features:**
- Exposes MCP server at `http://host:port/mcp` endpoint
- Health check available at `http://host:port/health`
- Session-based connection management
- Supports both POST (JSON-RPC requests) and GET (SSE streams)
- Compatible with any HTTP client or MCP SDK

**Example HTTP client usage:**
```javascript
// Initialize connection
const response = await fetch('http://localhost:3000/mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'my-client', version: '1.0.0' }
    },
    id: 1
  })
});

const sessionId = response.headers.get('mcp-session-id');

// Subsequent requests include session ID
const toolsResponse = await fetch('http://localhost:3000/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'mcp-session-id': sessionId
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/list',
    params: {},
    id: 2
  })
});
```

---

## 🎯 Supported Use Cases

This MCP server enables AI-powered interactions with Kibana across multiple domains:

### 🔐 Security Operations
- **Detection Engineering** (`dt_*` tools) - Manage security detection rules and alerts
- **Threat Investigation** (`sc_timeline_*` tools) - Create and analyze security timelines
- **Exception Management** (`sc_exception_*`, `sc_list_*` tools) - Manage rule exceptions and value lists

### 📊 Observability & Monitoring
- **Alerting Rules** (`ob_alert_*` tools) - Create and manage observability alerts for metrics, logs, traces, and uptime
- **Notification Channels** (`ob_action_*` tools) - Configure Slack, Email, PagerDuty, Webhook integrations
- **SLO Management** (`ob_slo_*` tools) - Define and track Service Level Objectives and error budgets

### 📈 Data Visualization
- **Saved Objects** (`vl_*` tools) - Manage dashboards, visualizations, and canvas workpads
- **Data Views** (`dataview_*` tools) - Configure data sources and field mappings

### 🛠️ System Management
- **API Execution** (`execute_kb_api`) - Execute any Kibana API endpoint
- **Space Management** - Multi-tenant Kibana space support
- **Health Monitoring** - Check system status and API availability

---

## ⚙️ Tool Selection Guide

This server provides **87 specialized tools** to enable precise control for AI models. However, **not all tools are required for every use case**.

### 🎯 For High-Capability Models (GPT-4, Claude 3.5 Sonnet, etc.)

**Recommended Configuration**: Use **base tools only** (6 tools)

High-capability models can intelligently use the flexible `execute_kb_api` tool to access any Kibana API:

```json
{
  "mcpServers": {
    "kibana-mcp-server": {
      "command": "npx",
      "args": ["@tocharian/mcp-server-kibana"],
      "env": {
        "KIBANA_URL": "http://your-kibana-server:5601",
        "KIBANA_USERNAME": "your-username",
        "KIBANA_PASSWORD": "your-password"
      }
    }
  }
}
```

**Benefits**:
- ✅ Faster tool loading and execution
- ✅ Lower memory footprint
- ✅ Cleaner tool list for AI model
- ✅ Full API access via `execute_kb_api`

**Base Tools** (Always Available):
- `get_status` - Get Kibana server status
- `execute_kb_api` - Execute any Kibana API (universal tool)
- `get_available_spaces` - List Kibana spaces
- `search_kibana_api_paths` - Search API endpoints
- `list_all_kibana_api_paths` - List all API endpoints
- `get_kibana_api_detail` - Get API endpoint details

---

### 🔧 For Lower-Capability Models or Specific Use Cases

**Recommended Configuration**: Enable **domain-specific tools** based on your needs

The specialized tools (`vl_*`, `dt_*`, `sc_*`, `ob_*`, `dataview_*`) provide clear, purpose-specific interfaces that help lower-capability models understand and execute operations correctly.

**Choose your toolset**:

```bash
# Security Operations Focus
# Enable: base-tools + dt_* + sc_* (Security Detection & Timeline)
# 6 base + 27 detection + 43 security = 76 tools

# Observability Focus  
# Enable: base-tools + ob_* + dataview_* (Alerting & Monitoring)
# 6 base + 14 alerting + 8 connectors + 7 SLO + 11 dataview = 46 tools

# Visualization Focus
# Enable: base-tools + vl_* + dataview_* (Dashboards & Saved Objects)
# 6 base + 6 visualization + 11 dataview = 23 tools

# Full Suite (All Features)
# All 87 tools enabled (default configuration)
```

**Benefits of Specialized Tools**:
- ✅ Clear tool names and descriptions
- ✅ Explicit parameter validation
- ✅ Better AI model comprehension
- ✅ Reduced error rates for complex operations

---

### 💡 Performance Optimization Tips

1. **Start Minimal, Expand as Needed**
   - Begin with base tools only
   - Add specialized tools if the model struggles with complex API calls
   - Monitor tool usage patterns in your AI application

2. **Domain-Specific Deployments**
   - Security team: Enable only `dt_*` + `sc_*` tools
   - SRE team: Enable only `ob_*` + `dataview_*` tools
   - Analytics team: Enable only `vl_*` + `dataview_*` tools

3. **Custom Tool Filtering** (Advanced)
   - Fork this repository and comment out unused tool registrations in `index.ts`
   - Build a custom version with only your required tools
   - Reduces initialization time and memory usage

---

## Features

### Core Features
- Connect to local or remote Kibana instances
- **Dual transport modes**:
  - **Stdio transport** (default) - For Claude Desktop and local MCP clients
  - **Streamable HTTP transport** (NEW in v0.4.0) - For remote access, API integration, and web applications
- **Dual authentication support**:
  - Cookie-based authentication (recommended for browser sessions)
  - Basic authentication (username/password)
- SSL/TLS and custom CA certificate support
- Multi-space support for enterprise Kibana environments
- Exposes Kibana API endpoints as both tools and resources
- **87 specialized tools** organized by domain (Security, Observability, Visualization, Data)
- **Flexible tool selection** - use all tools or just base tools depending on AI model capability
- Type-safe, extensible, and easy to integrate
- **Session management** with automatic UUID generation for HTTP mode
- **Health check endpoint** for monitoring and load balancing

### Tool Categories (87 Total)

#### Base Tools (6 tools)
- Universal API execution and system management
- **Recommended for all deployments**

#### Visualization Layer - VL Tools (6 tools)
- Complete CRUD operations for Kibana saved objects
- Universal saved object management (dashboards, visualizations, etc.)
- Intelligent parameter handling with multiple input formats
- Bulk operations for efficient mass updates

#### Detection Engine - DT Tools (27 tools)
- Security detection rule management
- Alert signal tracking and investigation
- Bulk operations and rule import/export
- Detection privileges and index management

#### Security - SC Tools (43 tools)
- Timeline investigation (12 tools)
- Exception list management (14 tools)
- Value list operations (17 tools)

#### Observability - OB Tools (29 tools) 🆕
- **Alerting rules** (14 tools) - Metrics, logs, traces, uptime alerts
- **Connectors/Actions** (8 tools) - Slack, Email, PagerDuty, Webhook integrations
- **SLO Management** (7 tools) - Service Level Objectives and error budgets

#### Data Views Tools (11 tools)
- Data source configuration and field mapping
- Runtime field management
- Default data view settings

---

## Directory Structure

```
├── index.ts                    # Server entry point & tool registration
├── src/
│   ├── types.ts                # Type definitions and schemas
│   ├── base-tools.ts           # Base tools (6 tools)
│   ├── prompts.ts              # Prompt templates
│   ├── resources.ts            # Resource endpoints
│   ├── vl_*.ts                 # Visualization Layer tools (6 tools)
│   ├── dt_*.ts                 # Detection Engine tools (27 tools)
│   ├── sc_*.ts                 # Security tools (43 tools)
│   ├── ob_*.ts                 # Observability tools (29 tools) 🆕
│   └── dataview_tools.ts       # Data View tools (11 tools)
├── kibana-openapi-source.yaml  # Kibana API OpenAPI specification
├── README.md                   # English documentation
└── README_zh.md                # Chinese documentation
```

---

## Resources

| Resource URI                                   | Description                                        |
|------------------------------------------------|----------------------------------------------------|
| `kibana-api://paths`                           | Returns all available Kibana API endpoints (can filter with `search` param) |
| `kibana-api://path/{method}/{encoded_path}`    | Returns details for a specific API endpoint        |

**Examples:**
- `kibana-api://paths?search=saved_objects`
- `kibana-api://path/GET/%2Fapi%2Fstatus`

---

## Tools

### Base Tools
| Tool Name                   | Description                                        | Input Parameters                                                    |
|-----------------------------|----------------------------------------------------|---------------------------------------------------------------------|
| `get_status`                | Get the current status of the Kibana server        | `space` (optional string) - Target Kibana space                    |
| `execute_kb_api`            | Execute a custom Kibana API request                | `method` (GET/POST/PUT/DELETE), `path` (string), `body` (optional), `params` (optional), `space` (optional string) |
| `get_available_spaces`      | Get available Kibana spaces and current context    | `include_details` (optional boolean) - Include full space details  |
| `search_kibana_api_paths`   | Search Kibana API endpoints by keyword             | `search` (string)                                                   |
| `list_all_kibana_api_paths` | List all Kibana API endpoints                      | None                                                                |
| `get_kibana_api_detail`     | Get details for a specific Kibana API endpoint     | `method` (string), `path` (string)                                  |

### Specialized Tools by Category

**Note**: The following specialized tools are designed to help lower-capability AI models. High-capability models (GPT-4, Claude 3.5 Sonnet) can achieve the same results using only the `execute_kb_api` base tool.

#### Visualization Layer (VL) Tools - Saved Objects Management (6 tools)
| Tool Name                      | Description                                        |
|--------------------------------|----------------------------------------------------|
| `vl_search_saved_objects`      | Search for Kibana saved objects (universal)       |
| `vl_get_saved_object`          | Get a single saved object by type and ID          |
| `vl_create_saved_object`       | Create a new saved object (universal)             |
| `vl_update_saved_object`       | Update a single saved object                      |
| `vl_bulk_update_saved_objects` | Update multiple saved objects in bulk             |
| `vl_bulk_delete_saved_objects` | Delete multiple saved objects in bulk             |

**Supported Saved Object Types:** `dashboard`, `visualization`, `index-pattern`, `search`, `config`, `lens`, `map`, `tag`, `canvas-workpad`, `canvas-element`

#### Observability (OB) Tools 🆕 (29 tools)

**Alerting Rules** (14 tools):
- `ob_alert_find_rules` - Search and find alerting rules
- `ob_alert_get_rule` - Get specific alerting rule details
- `ob_alert_create_rule` - Create new alerting rule
- `ob_alert_update_rule` - Update existing alerting rule
- `ob_alert_delete_rule` - Delete alerting rule
- `ob_alert_enable_rule` / `ob_alert_disable_rule` - Enable/disable rules
- `ob_alert_mute_all` / `ob_alert_unmute_all` - Mute/unmute all alerts
- `ob_alert_mute_alert` / `ob_alert_unmute_alert` - Mute/unmute specific alerts
- `ob_alert_update_api_key` - Update rule API key
- `ob_alert_get_rule_types` - Get available rule types
- `ob_alert_health_check` - Check alerting system health

**Connectors/Actions** (8 tools):
- `ob_action_list` - List all connectors
- `ob_action_get` - Get specific connector details
- `ob_action_create` - Create new connector (Slack, Email, PagerDuty, etc.)
- `ob_action_update` - Update existing connector
- `ob_action_delete` - Delete connector
- `ob_action_execute` - Execute/test connector
- `ob_action_get_connector_types` - Get available connector types
- `ob_action_list_action_types` - List action types (legacy)

**SLO Management** (7 tools):
- `ob_slo_find` - Search and find SLOs
- `ob_slo_get` - Get specific SLO details
- `ob_slo_create` - Create new SLO
- `ob_slo_update` - Update existing SLO
- `ob_slo_delete` - Delete SLO
- `ob_slo_enable` / `ob_slo_disable` - Enable/disable SLO tracking

For complete tool documentation, see [API_VERIFICATION_REPORT.md](API_VERIFICATION_REPORT.md) and [OB_TOOLS_IMPLEMENTATION_SUMMARY.md](OB_TOOLS_IMPLEMENTATION_SUMMARY.md)

---

## Prompts

| Prompt Name              | Description                                                                 |
|-------------------------|-----------------------------------------------------------------------------|
| `kibana-tool-expert`    | Tool expert mode (highly recommended in Claude Desktop), supports intelligent analysis, search, execution, and explanation of Kibana APIs via tools. Recommended for most users. |
| `kibana-resource-helper`| Resource helper mode, guides how to access and use Kibana API info via resource URIs. Suitable for clients that only support resource access or need raw API metadata. |

---

## Configuration

Configure the server via environment variables:

### Kibana Connection Settings
| Variable Name                    | Description                                         | Required |
|----------------------------------|-----------------------------------------------------|----------|
| `KIBANA_URL`                     | Kibana server address (e.g. http://localhost:5601)   | Yes      |
| `KIBANA_USERNAME`                | Kibana username (for basic auth)                   | No*      |
| `KIBANA_PASSWORD`                | Kibana password (for basic auth)                   | No*      |
| `KIBANA_COOKIES`                 | Kibana session cookies (for cookie auth)           | No*      |
| `KIBANA_DEFAULT_SPACE`           | Default Kibana space (default: 'default')          | No       |
| `KIBANA_CA_CERT`                 | CA certificate path (optional, for SSL verification) | No       |
| `KIBANA_TIMEOUT`                 | Request timeout in ms (default 30000)                | No       |
| `KIBANA_MAX_RETRIES`             | Max request retries (default 3)                      | No       |
| `NODE_TLS_REJECT_UNAUTHORIZED`   | Set to `0` to disable SSL certificate validation (use with caution) | No |

*Either `KIBANA_COOKIES` or both `KIBANA_USERNAME` and `KIBANA_PASSWORD` must be provided for authentication.

### Transport Mode Settings (NEW in v0.4.0)
| Variable Name     | Description                                    | Default   | Values          |
|-------------------|------------------------------------------------|-----------|-----------------|
| `MCP_TRANSPORT`   | Transport mode selection                       | `stdio`   | `stdio`, `http` |
| `MCP_HTTP_PORT`   | HTTP server port (when using HTTP transport)   | `3000`    | 1-65535         |
| `MCP_HTTP_HOST`   | HTTP server host (when using HTTP transport)   | `localhost` | Any valid host  |

**Transport Mode Details:**
- **Stdio mode** (default): For Claude Desktop and local MCP clients
- **HTTP mode**: Runs as a standalone HTTP server for remote access, API integration, and web applications

---

## 📦 Package Information

- **NPM Package**: [@tocharian/mcp-server-kibana](https://www.npmjs.com/package/@tocharian/mcp-server-kibana)
- **GitHub Repository**: [TocharianOU/mcp-server-kibana](https://github.com/TocharianOU/mcp-server-kibana)
- **Node.js**: >= 18.0.0
- **Package Size**: ~685KB (6.4MB unpacked)

---

## 🔧 Troubleshooting

### Common Issues

#### "import: command not found" error
```bash
# Make sure you're using the latest version
npm install -g @tocharian/mcp-server-kibana@latest

# Or try using node directly
node $(which mcp-server-kibana)
```

#### Connection issues
- Verify Kibana URL is accessible
- Check authentication credentials
- For SSL issues, try setting `NODE_TLS_REJECT_UNAUTHORIZED=0`

#### Claude Desktop not detecting the server
- Restart Claude Desktop after config changes
- Check config file syntax with a JSON validator
- Verify environment variables are set correctly

---

## Example Queries

### Basic Queries
- "What is the status of my Kibana server?"
- "What is the status of my Kibana server in the 'marketing' space?"
- "List all available Kibana spaces I can access."
- "List all available Kibana API endpoints."
- "Show details for the POST /api/saved_objects/_find endpoint."
- "Execute a custom API request for /api/status."

### Saved Objects Management
- "Search for all dashboards in Kibana"
- "Find visualizations containing 'nginx' in the title"
- "Get dashboard with ID 'my-dashboard-123'"
- "Create a new dashboard with title 'Sales Overview'"
- "Update the description of visualization 'viz-456'"
- "Delete multiple old dashboards by their IDs"

### Observability & Monitoring 🆕
- "Create a CPU alert for production that sends Slack notifications when above 80%"
- "List all alerting rules currently configured"
- "Disable all alerts during the maintenance window"
- "Create a Slack connector for the #alerts channel"
- "Set up a PagerDuty integration for critical alerts"
- "Create a 99.9% availability SLO for the API service"
- "Show me the current error budget for all SLOs"
- "Enable SLO tracking for the checkout service"

### Security Operations
- "Search for detection rules related to ransomware"
- "Create a new detection rule for failed login attempts"
- "Add an exception for known safe IPs"
- "Create a timeline for investigating suspicious network activity"

---

## Two Prompt Modes in Claude Desktop

When using this server with Claude Desktop, two different prompt interaction modes are supported:

### 1. Tool-based Prompt Mode
- **How it works:** Claude Desktop can directly call server tools (including base tools like `get_status`, `execute_api`, and VL tools like `vl_search_saved_objects`, `vl_create_saved_object`) to answer your questions or perform actions.
- **Best for:** Users who want a conversational, guided experience. The server will automatically search, execute, and explain Kibana APIs and manage saved objects.
- **Example:** "Show all dashboards containing 'sales'" or "Create a new visualization for web analytics"
- **Testing tip:** Select the `kibana-tool-expert` prompt in Claude Desktop for integration testing, then start using it.

### 2. Resource-based Prompt Mode
- **How it works:** Claude Desktop interacts with the server via resource URIs (such as `kibana-api://paths` or `kibana-api://path/GET/%2Fapi%2Fstatus`), and the server returns structured data for Claude to parse.
- **Best for:** Advanced users, MCP clients that only support resource access, or programming scenarios needing raw API metadata.
- **Example:** "Get resource kibana-api://paths?search=dashboard"

**Note:** The two endpoints in `resources` (`kibana-api://paths` and `kibana-api://path/{method}/{encoded_path}`) have corresponding base tools (`list_all_kibana_api_paths`, `get_kibana_api_detail`). This design ensures compatibility with MCP clients that cannot intelligently select multiple resources, making it easier for tools like Claude Desktop to interact with Kibana.

**Tip:** Most users are recommended to use tool mode for a more natural and powerful experience; resource mode offers maximum flexibility for advanced and compatibility use cases.

---

## Development

Install dependencies:

```bash
npm install
```

Build the server:

```bash
npm run build
```

Auto-rebuild in development mode:

```bash
npm run watch
```

Run in different modes:

```bash
# Stdio mode (default)
npm start

# HTTP mode
npm run start:http

# Development with TypeScript
npm run start:ts

# HTTP mode with TypeScript
npm run start:http:ts
```

---

## Debugging

Since the MCP server communicates via stdio, debugging can be inconvenient. It is recommended to use MCP Inspector:

```bash
npm run inspector
```

After starting, Inspector will provide a browser-accessible debugging tool URL.

---

## Community

This project is community-maintained. Contributions and feedback are welcome! Please be respectful and inclusive in all communications, and follow the [Elastic Community Code of Conduct](https://www.elastic.co/community/codeofconduct).

---

## License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.

---

## Troubleshooting

- Check if MCP configuration is correct
- Ensure the Kibana address is accessible
- Verify authentication credentials have sufficient permissions
- If using a custom CA, ensure the certificate path is correct and readable
- If using `NODE_TLS_REJECT_UNAUTHORIZED=0`, be aware of security risks
- Check error messages output in the terminal
