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

---

## Features

- Connect to local or remote Kibana instances
- Flexible authentication support:
  - Cookie-based authentication (recommended for browser sessions)
  - Basic authentication (username/password)
- SSL/TLS and custom CA certificate support
- Multi-space support for enterprise Kibana environments
- Exposes Kibana API endpoints as both tools and resources
- Search, view, and execute Kibana APIs from MCP clients
- Type-safe, extensible, and easy to integrate

---

## Directory Structure

```
├── index.ts                # Server entry point
├── src/
│   ├── types.ts            # Type definitions and schemas
│   ├── base-tools.ts       # Tool registration and API logic
│   ├── prompts.ts          # Prompt registration (expert & resource helper)
│   └── resources.ts        # Resource registration (API paths/URIs)
├── kibana-openapi-source.yaml # Kibana API OpenAPI index
├── README.md               # English documentation
├── README_zh.md            # Chinese documentation
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

| Tool Name                   | Description                                        | Input Parameters                                                    |
|-----------------------------|----------------------------------------------------|---------------------------------------------------------------------|
| `get_status`                | Get the current status of the Kibana server        | `space` (optional string) - Target Kibana space                    |
| `execute_kb_api`            | Execute a custom Kibana API request                | `method` (GET/POST/PUT/DELETE), `path` (string), `body` (optional), `params` (optional), `space` (optional string) |
| `get_available_spaces`      | Get available Kibana spaces and current context    | `include_details` (optional boolean) - Include full space details  |
| `search_kibana_api_paths`   | Search Kibana API endpoints by keyword             | `search` (string)                                                   |
| `list_all_kibana_api_paths` | List all Kibana API endpoints                      | None                                                                |
| `get_kibana_api_detail`     | Get details for a specific Kibana API endpoint     | `method` (string), `path` (string)                                  |

---

## Prompts

| Prompt Name              | Description                                                                 |
|-------------------------|-----------------------------------------------------------------------------|
| `kibana-tool-expert`    | Tool expert mode (highly recommended in Claude Desktop), supports intelligent analysis, search, execution, and explanation of Kibana APIs via tools. Recommended for most users. |
| `kibana-resource-helper`| Resource helper mode, guides how to access and use Kibana API info via resource URIs. Suitable for clients that only support resource access or need raw API metadata. |

---

## Configuration

Configure the server via environment variables:

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

- "What is the status of my Kibana server?"
- "What is the status of my Kibana server in the 'marketing' space?"
- "List all available Kibana spaces I can access."
- "List all available Kibana API endpoints."
- "Show details for the POST /api/saved_objects/_find endpoint."
- "Execute a custom API request for /api/status."
- "Get a list of all dashboards in Kibana."
- "Get a list of all dashboards in the 'production' space."
- "Query API endpoints related to endpoint events."
- "List all case-related API endpoints."
- "Create a new case in Kibana."
- "Create a new dashboard in Kibana."
- "Create a new dashboard in the 'dev-team' space."

---

## Two Prompt Modes in Claude Desktop

When using this server with Claude Desktop, two different prompt interaction modes are supported:

### 1. Tool-based Prompt Mode
- **How it works:** Claude Desktop can directly call server tools (such as `get_status`, `execute_api`, `search_kibana_api_paths`, etc.) to answer your questions or perform actions.
- **Best for:** Users who want a conversational, guided experience. The server will automatically search, execute, and explain Kibana APIs.
- **Example:** "Show all Kibana API endpoints related to saved objects."
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
