[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/tocharianou-mcp-server-kibana-badge.png)](https://mseep.ai/app/tocharianou-mcp-server-kibana)

# Kibana MCP Server
[![npm version](https://badge.fury.io/js/@tocharian%2Fmcp-server-kibana.svg)](https://www.npmjs.com/package/@tocharian/mcp-server-kibana)
[![Downloads](https://img.shields.io/npm/dm/@tocharian/mcp-server-kibana.svg)](https://www.npmjs.com/package/@tocharian/mcp-server-kibana)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/TocharianOU/mcp-server-kibana)

A Kibana MCP server implementation that allows any MCP-compatible client (such as Claude Desktop) to access your Kibana instance via natural language or programmatic requests.

> This project is based on the official Elastic Kibana API documentation and uses the OpenAPI YAML specification from Elastic Stack 8.x. For details, see the [Kibana API documentation](https://www.elastic.co/docs/api/doc/kibana/).

**This project is community-maintained and is not an official product of Elastic or MCP.**

> **💡 Companion Project:** For complete Elastic Stack integration, pair this with [**Elasticsearch MCP Server**](https://github.com/TocharianOU/mcp-server-elasticsearch-sl) for direct Elasticsearch data operations.

---

## 🚀 Installation

```bash
# Global installation (recommended)
npm install -g @tocharianou/mcp-server-kibana

# Or use directly with npx
npx @tocharianou/mcp-server-kibana
```

### From Source
```bash
git clone https://github.com/TocharianOU/mcp-server-kibana.git
cd mcp-server-kibana
npm install && npm run build
```

---

## 🎯 Quick Start

### Claude Desktop Integration (Recommended)

Add to your Claude Desktop configuration file:
- **MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "kibana": {
      "command": "npx",
      "args": ["@tocharianou/mcp-server-kibana"],
      "env": {
        "KIBANA_URL": "http://your-kibana-server:5601",
        "KIBANA_API_KEY": "your-api-key",
        "KIBANA_DEFAULT_SPACE": "default"
      }
    }
  }
}
```

### Direct CLI Usage

```bash
# Using API Key (recommended)
KIBANA_URL=http://localhost:5601 \
KIBANA_API_KEY=your-api-key \
npx @tocharianou/mcp-server-kibana

# Using Basic Auth
KIBANA_URL=http://localhost:5601 \
KIBANA_USERNAME=your-username \
KIBANA_PASSWORD=your-password \
npx @tocharianou/mcp-server-kibana

# Using Cookie Auth
KIBANA_URL=http://localhost:5601 \
KIBANA_COOKIES="sid=xxx; security-session=yyy" \
npx @tocharianou/mcp-server-kibana
```

### HTTP Mode (Remote Access)

```bash
MCP_TRANSPORT=http \
MCP_HTTP_PORT=3000 \
KIBANA_URL=http://localhost:5601 \
KIBANA_API_KEY=your-api-key \
npx @tocharianou/mcp-server-kibana
```

Access at: `http://localhost:3000/mcp`  
Health check: `http://localhost:3000/health`

---

## ✨ Features

### Core Capabilities
- **Dual transport modes**: Stdio (local) and HTTP (remote access)
- **Multiple authentication methods**: API Key, Basic Auth, Cookie-based
- **Multi-space support**: Enterprise-ready Kibana space management
- **SSL/TLS support**: Custom CA certificate configuration
- **Session management**: Automatic UUID generation for HTTP mode
- **Dynamic API discovery**: Based on official Kibana OpenAPI specification

### Saved Objects Management
- Complete CRUD operations for all Kibana saved object types
- Intelligent search with pagination support
- Bulk operations for efficient mass updates
- Version control with optimistic concurrency
- Reference management for object relationships

---

## 🔧 Configuration

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `KIBANA_URL` | Kibana server address | `http://localhost:5601` |

### Authentication (choose one method)

| Variable | Description | Priority |
|----------|-------------|----------|
| `KIBANA_API_KEY` | API Key (base64 encoded) | 1st |
| `KIBANA_USERNAME` + `KIBANA_PASSWORD` | Basic authentication | 2nd |
| `KIBANA_COOKIES` | Session cookies | 3rd |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `KIBANA_DEFAULT_SPACE` | Default Kibana space | `default` |
| `KIBANA_CA_CERT` | CA certificate path | - |
| `KIBANA_TIMEOUT` | Request timeout (ms) | `30000` |
| `MCP_TRANSPORT` | Transport mode | `stdio` |
| `MCP_HTTP_PORT` | HTTP server port | `3000` |
| `MCP_HTTP_HOST` | HTTP server host | `localhost` |
| `NODE_TLS_REJECT_UNAUTHORIZED` | Disable SSL validation | `1` |

---

## 🛠️ Available Tools

### Base Tools
- `get_status` - Get Kibana server status
- `execute_kb_api` - Execute custom Kibana API requests
- `get_available_spaces` - List available Kibana spaces
- `search_kibana_api_paths` - Search API endpoints
- `list_all_kibana_api_paths` - List all API endpoints
- `get_kibana_api_detail` - Get API endpoint details

### Saved Objects Tools
- `vl_search_saved_objects` - Search saved objects (universal)
- `vl_get_saved_object` - Get single saved object
- `vl_create_saved_object` - Create new saved object
- `vl_update_saved_object` - Update single saved object
- `vl_bulk_update_saved_objects` - Bulk update operations
- `vl_bulk_delete_saved_objects` - Bulk delete operations

**Supported Object Types:** dashboard, visualization, index-pattern, search, config, lens, map, tag, canvas-workpad, canvas-element

### Analysis Tools (v0.6.0+)
- `analyze_object_dependencies` - Analyze saved object dependencies
- `analyze_deletion_impact` - Check impact before deletion
- `check_dashboard_health` - Dashboard health check
- `scan_all_dashboards_health` - Batch health scanning

---

## 📖 Resources

| Resource URI | Description |
|--------------|-------------|
| `kibana-api://paths` | List all available API endpoints |
| `kibana-api://paths?search=<keyword>` | Search endpoints by keyword |
| `kibana-api://path/{method}/{encoded_path}` | Get specific endpoint details |

---

## 💬 Example Queries

### Basic Operations
- "What is the status of my Kibana server?"
- "List all available Kibana spaces"
- "Show me all API endpoints related to dashboards"

### Saved Objects
- "Search for all dashboards"
- "Find visualizations containing 'nginx' in the title"
- "Create a new dashboard named 'Sales Overview'"
- "Update the description of dashboard 'my-dashboard-123'"
- "Delete multiple dashboards by their IDs"

### Health & Analysis
- "Check health of dashboard 'overview'"
- "Analyze dependencies for visualization 'viz-123'"
- "Scan all dashboards for health issues"

---

## 🐛 Troubleshooting

### Connection Issues
- Verify Kibana URL is accessible
- Check authentication credentials
- For SSL issues: `NODE_TLS_REJECT_UNAUTHORIZED=0` (use with caution)

### Claude Desktop Issues
- Restart Claude Desktop after config changes
- Validate JSON config syntax
- Check console logs for errors

### Common Errors
- **"import: command not found"**: Update to latest version
- **Authentication failed**: Verify credentials and permissions
- **SSL errors**: Check CA certificate or disable SSL validation

---

## 🔍 Debugging

Use MCP Inspector for debugging:

```bash
npm run inspector
```

This provides a browser-accessible debugging interface.

---

## 📦 Package Information

- **NPM**: [@tocharianou/mcp-server-kibana](https://www.npmjs.com/package/@tocharianou/mcp-server-kibana)
- **GitHub**: [TocharianOU/mcp-server-kibana](https://github.com/TocharianOU/mcp-server-kibana)
- **Node.js**: >= 18.0.0
- **License**: Apache 2.0

---

## 🤝 Contributing

This project is community-maintained. Contributions and feedback are welcome!

Please follow the [Elastic Community Code of Conduct](https://www.elastic.co/community/codeofconduct) in all communications.

---

## 📄 License

Apache License 2.0 - See [LICENSE](LICENSE) file for details.
