# Kibana MCP 服务器
[![npm 版本](https://badge.fury.io/js/@tocharian%2Fmcp-server-kibana.svg)](https://www.npmjs.com/package/@tocharian/mcp-server-kibana)
[![下载量](https://img.shields.io/npm/dm/@tocharian/mcp-server-kibana.svg)](https://www.npmjs.com/package/@tocharian/mcp-server-kibana)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/TocharianOU/mcp-server-kibana)

> **API 规范**
>
> 本项目基于 Elastic 官方 Kibana API 文档，并使用 Elastic Stack 8.x (ES8) 的 OpenAPI YAML 规范，动态获取和管理所有 Kibana API 端点。最新详情请参见 [Kibana API 文档](https://www.elastic.co/docs/api/doc/kibana/)。

这是一个 Kibana MCP 服务器实现，允许任何 MCP 兼容客户端（如 Claude Desktop）通过自然语言或编程方式访问你的 Kibana 实例。

**本项目由社区维护，非 Elastic 或 MCP 官方产品。**

---

## 功能特性

- 支持连接本地或远程 Kibana 实例
- 安全认证（用户名/密码）
- 支持 SSL/TLS 及自定义 CA 证书
- 以工具和资源两种方式暴露 Kibana API 端点
- 支持 MCP 客户端搜索、查看、执行 Kibana API
- 类型安全、可扩展、易集成

---

## 目录结构

```
├── index.ts                # 服务器入口
├── src/
│   ├── types.ts            # 类型定义与 schema
│   ├── base-tools.ts       # 工具注册与 API 逻辑
│   ├── prompts.ts          # 提示词注册（专家 & 资源助手）
│   └── resources.ts        # 资源注册（API 路径/URI）
├── kibana-openapi-source.yaml # Kibana API OpenAPI 索引
├── README.md               # 英文文档
├── README_zh.md            # 中文文档
```

---

## 资源

| 资源 URI                                      | 描述                                         |
|-----------------------------------------------|----------------------------------------------|
| `kibana-api://paths`                          | 返回所有可用的 Kibana API 端点（可用 `search` 参数过滤） |
| `kibana-api://path/{method}/{encoded_path}`   | 返回指定 API 端点的详细信息                  |

**示例：**
- `kibana-api://paths?search=saved_objects`
- `kibana-api://path/GET/%2Fapi%2Fstatus`

---

## 工具

| 工具名称                    | 描述                                         | 输入参数                                                         |
|-----------------------------|----------------------------------------------|------------------------------------------------------------------|
| `get_status`                | 获取 Kibana 服务器当前状态                   | 无                                                               |
| `execute_api`               | 执行自定义 Kibana API 请求                   | `method` (GET/POST/PUT/DELETE), `path` (字符串), `body` (可选), `params` (可选) |
| `search_kibana_api_paths`   | 按关键字搜索 Kibana API 端点                 | `search` (字符串)                                                |
| `list_all_kibana_api_paths` | 列出所有 Kibana API 端点                     | 无                                                               |
| `get_kibana_api_detail`     | 获取指定 Kibana API 端点的详细信息           | `method` (字符串), `path` (字符串)                                |

---

## 提示词

| 提示词名称                | 描述                                                                 |
|---------------------------|----------------------------------------------------------------------|
| `kibana-tool-expert`      | 工具专家模式（强烈推荐在 Claude Desktop 使用），支持通过工具智能分析、搜索、执行和解释 Kibana API。推荐大多数用户使用。 |
| `kibana-resource-helper`  | 资源助手模式，指导如何通过资源 URI 访问和使用 Kibana API 信息。适合仅支持资源访问或需要原始 API 元数据的客户端。 |

---

## 配置

通过环境变量配置服务器：

| 变量名                          | 描述                                         | 是否必需 |
|----------------------------------|----------------------------------------------|----------|
| `KIBANA_URL`                     | Kibana 服务器地址（如 http://localhost:5601） | 是       |
| `KIBANA_USERNAME`                | Kibana 用户名                                | 是       |
| `KIBANA_PASSWORD`                | Kibana 密码                                  | 是       |
| `KIBANA_CA_CERT`                 | CA 证书路径（可选，用于 SSL 验证）           | 否       |
| `KIBANA_TIMEOUT`                 | 请求超时时间（毫秒，默认 30000）             | 否       |
| `KIBANA_MAX_RETRIES`             | 最大请求重试次数（默认 3）                   | 否       |
| `NODE_TLS_REJECT_UNAUTHORIZED`   | 设为 `0` 可禁用 SSL 证书校验（谨慎使用）     | 否       |

---

## 🚀 安装

### 快速安装
```bash
# 全局安装（推荐）
npm install -g @tocharian/mcp-server-kibana

# 或本地安装
npm install @tocharian/mcp-server-kibana
```

### 替代方案：从源码安装
```bash
git clone https://github.com/TocharinOU/mcp-server-kibana.git
cd mcp-server-kibana
npm install
npm run build
```

---

## 🎯 快速开始

### 方法 1: 直接命令行使用
```bash
# 设置 Kibana 凭据并运行
KIBANA_URL=http://your-kibana-server:5601 \
KIBANA_USERNAME=your-username \
KIBANA_PASSWORD=your-password \
npx @tocharian/mcp-server-kibana
```

### 方法 2: Claude Desktop 集成（推荐）
添加到 Claude Desktop 配置文件：

**配置文件位置:**
- **MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

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
        "NODE_TLS_REJECT_UNAUTHORIZED": "0"
      }
    }
  }
}
```

---

## 示例查询

- "我的 Kibana 服务器状态如何？"
- "列出所有可用的 Kibana API 端点。"
- "显示 POST /api/saved_objects/_find 端点的详细信息。"
- "为 /api/status 执行自定义 API 请求。"
- "获取 Kibana 中所有仪表盘的列表。"
- "查询与 endpoint events 相关的 API 端点。"
- "列出所有 case 相关的 API 端点。"
- "在 Kibana 中创建一个新 case。"
- "在 Kibana 中创建一个新仪表盘。"

---

## Claude Desktop 的两种提示词模式

当在 Claude Desktop 中使用本服务器时，支持两种不同的提示词交互模式：

### 1. 工具模式
- **工作方式：** Claude Desktop 可直接调用服务器工具（如 `get_status`、`execute_api`、`search_kibana_api_paths` 等）来回答你的问题或执行操作。
- **适用人群：** 需要对话式、引导式体验的用户。服务器会自动搜索、执行并解释 Kibana API。
- **示例：** "显示所有与 saved objects 相关的 Kibana API 端点。"
- **测试建议：** 在 Claude Desktop 选择 `kibana-tool-expert` 提示词进行集成测试，然后开始使用。

### 2. 资源模式
- **工作方式：** Claude Desktop 通过资源 URI（如 `kibana-api://paths` 或 `kibana-api://path/GET/%2Fapi%2Fstatus`）与服务器交互，服务器返回结构化数据，便于 Claude 解析。
- **适用人群：** 高级用户、仅支持资源访问的 MCP 客户端，或需要原始 API 元数据的编程场景。
- **示例：** "获取资源 kibana-api://paths?search=dashboard"

**注意：** `resources` 中的两个端点（`kibana-api://paths` 和 `kibana-api://path/{method}/{encoded_path}`）有对应的基础工具（`list_all_kibana_api_paths`、`get_kibana_api_detail`）。该设计确保了对无法智能选择多个资源的 MCP 客户端的兼容性，使 Claude Desktop 等工具更易与 Kibana 交互。

**提示：** 推荐大多数用户使用工具模式，体验更自然强大；资源模式则为高级和兼容性场景提供最大灵活性。

---

## 开发

安装依赖：

```bash
npm install
```

构建服务器：

```bash
npm run build
```

开发模式下自动重建：

```bash
npm run watch
```

---

## 调试

由于 MCP 服务器通过 stdio 通信，调试可能不便。推荐使用 MCP Inspector：

```bash
npm run inspector
```

启动后，Inspector 会提供一个可在浏览器访问的调试工具 URL。

---

## 社区

本项目由社区维护。欢迎贡献和反馈！请在所有交流中保持尊重和包容，并遵守 [Elastic 社区行为准则](https://www.elastic.co/community/codeofconduct)。

---

## 许可证

本项目采用 Apache License 2.0 许可。详情见 [LICENSE](LICENSE) 文件。

---

## 📦 包信息

- **NPM 包**: [@tocharian/mcp-server-kibana](https://www.npmjs.com/package/@tocharian/mcp-server-kibana)
- **GitHub 仓库**: [TocharinOU/mcp-server-kibana](https://github.com/TocharinOU/mcp-server-kibana)
- **Node.js 要求**: >= 18.0.0
- **包大小**: ~685KB (解压后 6.4MB)

---

## 🔧 故障排查

### 常见问题

#### "import: command not found" 错误
```bash
# 确保使用最新版本
npm install -g @tocharian/mcp-server-kibana@latest

# 或尝试直接使用 node
node $(which mcp-server-kibana)
```

- 检查 MCP 配置是否正确
- 确认 Kibana 地址可访问
- 验证认证凭据是否有足够权限
- 如使用自定义 CA，确保证书路径正确且可读
- 如使用 `NODE_TLS_REJECT_UNAUTHORIZED=0`，请注意安全风险
- 检查终端输出的错误信息
