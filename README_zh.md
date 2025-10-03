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

## 🎯 支持的使用场景

本 MCP 服务器支持 AI 驱动的 Kibana 跨域交互：

### 🔐 安全运营
- **检测工程**（`dt_*` 工具）- 管理安全检测规则和告警
- **威胁调查**（`sc_timeline_*` 工具）- 创建和分析安全时间线
- **异常管理**（`sc_exception_*`, `sc_list_*` 工具）- 管理规则异常和值列表

### 📊 可观测性与监控
- **告警规则**（`ob_alert_*` 工具）- 为指标、日志、链路追踪和正常运行时间创建和管理可观测性告警
- **通知渠道**（`ob_action_*` 工具）- 配置 Slack、邮件、PagerDuty、Webhook 集成
- **SLO 管理**（`ob_slo_*` 工具）- 定义和跟踪服务级别目标与错误预算

### 📈 数据可视化
- **保存对象**（`vl_*` 工具）- 管理仪表板、可视化和画布工作台
- **数据视图**（`dataview_*` 工具）- 配置数据源和字段映射

### 🛠️ 系统管理
- **API 执行**（`execute_kb_api`）- 执行任何 Kibana API 端点
- **空间管理** - 多租户 Kibana 空间支持
- **健康监控** - 检查系统状态和 API 可用性

---

## ⚙️ 工具选择指南

本服务器提供 **87 个专用工具**，以实现对 AI 模型的精确控制。但是，**并非所有工具都是每个用例所必需的**。

### 🎯 适用于高能力模型（GPT-4、Claude 3.5 Sonnet 等）

**推荐配置**：**仅使用基础工具**（6 个工具）

高能力模型可以智能地使用灵活的 `execute_kb_api` 工具访问任何 Kibana API：

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

**优势**：
- ✅ 更快的工具加载和执行
- ✅ 更低的内存占用
- ✅ 更清晰的工具列表
- ✅ 通过 `execute_kb_api` 完整访问所有 API

**基础工具**（始终可用）：
- `get_status` - 获取 Kibana 服务器状态
- `execute_kb_api` - 执行任何 Kibana API（通用工具）
- `get_available_spaces` - 列出 Kibana 空间
- `search_kibana_api_paths` - 搜索 API 端点
- `list_all_kibana_api_paths` - 列出所有 API 端点
- `get_kibana_api_detail` - 获取 API 端点详情

---

### 🔧 适用于低能力模型或特定用例

**推荐配置**：根据需求启用**领域特定工具**

专用工具（`vl_*`、`dt_*`、`sc_*`、`ob_*`、`dataview_*`）提供清晰的、目的明确的接口，帮助低能力模型正确理解和执行操作。

**选择您的工具集**：

```bash
# 安全运营重点
# 启用: base-tools + dt_* + sc_*（安全检测与时间线）
# 6 基础 + 27 检测 + 43 安全 = 76 工具

# 可观测性重点
# 启用: base-tools + ob_* + dataview_*（告警与监控）
# 6 基础 + 14 告警 + 8 连接器 + 7 SLO + 11 数据视图 = 46 工具

# 可视化重点
# 启用: base-tools + vl_* + dataview_*（仪表板与保存对象）
# 6 基础 + 6 可视化 + 11 数据视图 = 23 工具

# 完整套件（所有功能）
# 所有 87 工具启用（默认配置）
```

**专用工具的优势**：
- ✅ 清晰的工具名称和描述
- ✅ 明确的参数验证
- ✅ 更好的 AI 模型理解
- ✅ 降低复杂操作的错误率

---

### 💡 性能优化建议

1. **从最小化开始，按需扩展**
   - 从仅基础工具开始
   - 如果模型难以处理复杂 API 调用，则添加专用工具
   - 监控 AI 应用中的工具使用模式

2. **领域特定部署**
   - 安全团队：仅启用 `dt_*` + `sc_*` 工具
   - SRE 团队：仅启用 `ob_*` + `dataview_*` 工具
   - 分析团队：仅启用 `vl_*` + `dataview_*` 工具

3. **自定义工具过滤**（高级）
   - Fork 此仓库并在 `index.ts` 中注释掉未使用的工具注册
   - 构建仅包含所需工具的自定义版本
   - 减少初始化时间和内存使用

---

## 功能特性

### 核心功能
- 支持连接本地或远程 Kibana 实例
- **双传输模式**：
  - **Stdio 传输**（默认）- 用于 Claude Desktop 和本地 MCP 客户端
  - **Streamable HTTP 传输**（v0.4.0 新增）- 用于远程访问、API 集成和 Web 应用
- **双重认证支持**：
  - Cookie 认证（推荐用于浏览器会话）
  - 基本认证（用户名/密码）
- 支持 SSL/TLS 及自定义 CA 证书
- 支持多空间的企业级 Kibana 环境
- 以工具和资源两种方式暴露 Kibana API 端点
- **87 个专用工具**，按领域组织（安全、可观测性、可视化、数据）
- **灵活的工具选择** - 根据 AI 模型能力使用所有工具或仅基础工具
- 类型安全、可扩展、易集成
- **会话管理** - HTTP 模式下自动生成 UUID
- **健康检查端点** - 用于监控和负载均衡

### 工具分类（总计 87 个）

#### 基础工具（6 个）
- 通用 API 执行和系统管理
- **推荐用于所有部署**

#### 可视化层 - VL 工具（6 个）
- Kibana 保存对象的完整 CRUD 操作
- 通用保存对象管理（仪表板、可视化等）
- 智能参数处理，支持多种输入格式
- 高效批量更新的批量操作

#### 检测引擎 - DT 工具（27 个）
- 安全检测规则管理
- 告警信号跟踪和调查
- 批量操作和规则导入/导出
- 检测权限和索引管理

#### 安全 - SC 工具（43 个）
- 时间线调查（12 个工具）
- 异常列表管理（14 个工具）
- 值列表操作（17 个工具）

#### 可观测性 - OB 工具（29 个）🆕
- **告警规则**（14 个工具）- 指标、日志、链路追踪、正常运行时间告警
- **连接器/操作**（8 个工具）- Slack、邮件、PagerDuty、Webhook 集成
- **SLO 管理**（7 个工具）- 服务级别目标和错误预算

#### 数据视图工具（11 个）
- 数据源配置和字段映射
- 运行时字段管理
- 默认数据视图设置

---

## 目录结构

```
├── index.ts                    # 服务器入口与工具注册
├── src/
│   ├── types.ts                # 类型定义与 schema
│   ├── base-tools.ts           # 基础工具（6 个）
│   ├── prompts.ts              # 提示词模板
│   ├── resources.ts            # 资源端点
│   ├── vl_*.ts                 # 可视化层工具（6 个）
│   ├── dt_*.ts                 # 检测引擎工具（27 个）
│   ├── sc_*.ts                 # 安全工具（43 个）
│   ├── ob_*.ts                 # 可观测性工具（29 个）🆕
│   └── dataview_tools.ts       # 数据视图工具（11 个）
├── kibana-openapi-source.yaml  # Kibana API OpenAPI 规范
├── README.md                   # 英文文档
└── README_zh.md                # 中文文档
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

### 基础工具
| 工具名称                    | 描述                                         | 输入参数                                                         |
|-----------------------------|----------------------------------------------|------------------------------------------------------------------|
| `get_status`                | 获取 Kibana 服务器当前状态                   | `space` (可选字符串) - 目标 Kibana 空间                         |
| `execute_kb_api`            | 执行自定义 Kibana API 请求                   | `method` (GET/POST/PUT/DELETE), `path` (字符串), `body` (可选), `params` (可选), `space` (可选字符串) |
| `get_available_spaces`      | 获取可用的 Kibana 空间和当前上下文           | `include_details` (可选布尔值) - 包含完整空间详情                |
| `search_kibana_api_paths`   | 按关键字搜索 Kibana API 端点                 | `search` (字符串)                                                |
| `list_all_kibana_api_paths` | 列出所有 Kibana API 端点                     | 无                                                               |
| `get_kibana_api_detail`     | 获取指定 Kibana API 端点的详细信息           | `method` (字符串), `path` (字符串)                                |

### 专用工具分类

**注意**：以下专用工具旨在帮助低能力 AI 模型。高能力模型（GPT-4、Claude 3.5 Sonnet）仅使用 `execute_kb_api` 基础工具即可实现相同结果。

#### 可视化层 (VL) 工具 - 保存对象管理（6 个）
| 工具名称                      | 描述                                        |
|-------------------------------|---------------------------------------------|
| `vl_search_saved_objects`     | 搜索 Kibana 保存对象（通用）                |
| `vl_get_saved_object`         | 通过类型和 ID 获取单个保存对象              |
| `vl_create_saved_object`      | 创建新的保存对象（通用）                    |
| `vl_update_saved_object`      | 更新单个保存对象                           |
| `vl_bulk_update_saved_objects`| 批量更新多个保存对象                       |
| `vl_bulk_delete_saved_objects`| 批量删除多个保存对象                       |

**支持的保存对象类型：** `dashboard`, `visualization`, `index-pattern`, `search`, `config`, `lens`, `map`, `tag`, `canvas-workpad`, `canvas-element`

#### 可观测性 (OB) 工具 🆕（29 个）

**告警规则**（14 个工具）：
- `ob_alert_find_rules` - 搜索和查找告警规则
- `ob_alert_get_rule` - 获取特定告警规则详情
- `ob_alert_create_rule` - 创建新的告警规则
- `ob_alert_update_rule` - 更新现有告警规则
- `ob_alert_delete_rule` - 删除告警规则
- `ob_alert_enable_rule` / `ob_alert_disable_rule` - 启用/禁用规则
- `ob_alert_mute_all` / `ob_alert_unmute_all` - 静音/取消静音所有告警
- `ob_alert_mute_alert` / `ob_alert_unmute_alert` - 静音/取消静音特定告警
- `ob_alert_update_api_key` - 更新规则 API 密钥
- `ob_alert_get_rule_types` - 获取可用的规则类型
- `ob_alert_health_check` - 检查告警系统健康状态

**连接器/操作**（8 个工具）：
- `ob_action_list` - 列出所有连接器
- `ob_action_get` - 获取特定连接器详情
- `ob_action_create` - 创建新连接器（Slack、邮件、PagerDuty 等）
- `ob_action_update` - 更新现有连接器
- `ob_action_delete` - 删除连接器
- `ob_action_execute` - 执行/测试连接器
- `ob_action_get_connector_types` - 获取可用的连接器类型
- `ob_action_list_action_types` - 列出操作类型（遗留）

**SLO 管理**（7 个工具）：
- `ob_slo_find` - 搜索和查找 SLO
- `ob_slo_get` - 获取特定 SLO 详情
- `ob_slo_create` - 创建新的 SLO
- `ob_slo_update` - 更新现有 SLO
- `ob_slo_delete` - 删除 SLO
- `ob_slo_enable` / `ob_slo_disable` - 启用/禁用 SLO 跟踪

---

## 提示词

| 提示词名称                | 描述                                                                 |
|---------------------------|----------------------------------------------------------------------|
| `kibana-tool-expert`      | 工具专家模式（强烈推荐在 Claude Desktop 使用），支持通过工具智能分析、搜索、执行和解释 Kibana API。推荐大多数用户使用。 |
| `kibana-resource-helper`  | 资源助手模式，指导如何通过资源 URI 访问和使用 Kibana API 信息。适合仅支持资源访问或需要原始 API 元数据的客户端。 |

---

## 配置

通过环境变量配置服务器：

### Kibana 连接设置
| 变量名                          | 描述                                         | 是否必需 |
|----------------------------------|----------------------------------------------|----------|
| `KIBANA_URL`                     | Kibana 服务器地址（如 http://localhost:5601） | 是       |
| `KIBANA_USERNAME`                | Kibana 用户名（用于基本认证）                | 否*      |
| `KIBANA_PASSWORD`                | Kibana 密码（用于基本认证）                  | 否*      |
| `KIBANA_COOKIES`                 | Kibana 会话 cookies（用于 cookie 认证）      | 否*      |
| `KIBANA_DEFAULT_SPACE`           | 默认 Kibana 空间（默认: 'default'）           | 否       |
| `KIBANA_CA_CERT`                 | CA 证书路径（可选，用于 SSL 验证）           | 否       |
| `KIBANA_TIMEOUT`                 | 请求超时时间（毫秒，默认 30000）             | 否       |
| `KIBANA_MAX_RETRIES`             | 最大请求重试次数（默认 3）                   | 否       |
| `NODE_TLS_REJECT_UNAUTHORIZED`   | 设为 `0` 可禁用 SSL 证书校验（谨慎使用）     | 否       |

*必须提供 `KIBANA_COOKIES` 或 `KIBANA_USERNAME` 和 `KIBANA_PASSWORD` 之一用于认证。

### 传输模式设置（v0.4.0 新增）
| 变量名          | 描述                                    | 默认值      | 可选值          |
|-----------------|----------------------------------------|------------|-----------------|
| `MCP_TRANSPORT` | 传输模式选择                            | `stdio`    | `stdio`, `http` |
| `MCP_HTTP_PORT` | HTTP 服务器端口（使用 HTTP 传输时）     | `3000`     | 1-65535         |
| `MCP_HTTP_HOST` | HTTP 服务器主机（使用 HTTP 传输时）     | `localhost`| 任意有效主机     |

**传输模式详解：**
- **Stdio 模式**（默认）：用于 Claude Desktop 和本地 MCP 客户端
- **HTTP 模式**：作为独立 HTTP 服务器运行，支持远程访问、API 集成和 Web 应用

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
git clone https://github.com/TocharianOU/mcp-server-kibana.git
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
        "KIBANA_DEFAULT_SPACE": "default",
        "NODE_TLS_REJECT_UNAUTHORIZED": "0"
      }
    }
  }
}
```

### 方法 3: Streamable HTTP 模式（v0.4.0 新增）

将服务器作为独立的 HTTP 服务运行，支持远程访问和 API 集成：

```bash
# 启动 HTTP 服务器（默认端口 3000）
MCP_TRANSPORT=http \
KIBANA_URL=http://your-kibana-server:5601 \
KIBANA_USERNAME=your-username \
KIBANA_PASSWORD=your-password \
npx @tocharian/mcp-server-kibana

# 或使用自定义端口和主机
MCP_TRANSPORT=http \
MCP_HTTP_PORT=9000 \
MCP_HTTP_HOST=0.0.0.0 \
KIBANA_URL=http://your-kibana-server:5601 \
KIBANA_USERNAME=your-username \
KIBANA_PASSWORD=your-password \
npx @tocharian/mcp-server-kibana
```

**HTTP 模式特性：**
- 在 `http://host:port/mcp` 端点暴露 MCP 服务器
- 在 `http://host:port/health` 提供健康检查
- 基于会话的连接管理
- 支持 POST（JSON-RPC 请求）和 GET（SSE 流）
- 兼容任何 HTTP 客户端或 MCP SDK

**HTTP 客户端使用示例：**
```javascript
// 初始化连接
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

// 后续请求需包含 session ID
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

## 示例查询

### 基础查询
- "我的 Kibana 服务器状态如何？"
- "营销空间中我的 Kibana 服务器状态如何？"
- "列出我可以访问的所有 Kibana 空间。"
- "列出所有可用的 Kibana API 端点。"
- "显示 POST /api/saved_objects/_find 端点的详细信息。"
- "为 /api/status 执行自定义 API 请求。"

### 保存对象管理
- "搜索 Kibana 中的所有仪表盘"
- "查找标题包含 'nginx' 的可视化"
- "获取 ID 为 'my-dashboard-123' 的仪表盘"
- "创建标题为 '销售概览' 的新仪表盘"
- "更新可视化 'viz-456' 的描述"
- "通过 ID 删除多个旧仪表盘"

### 可观测性与监控 🆕
- "为生产环境创建 CPU 告警，超过 80% 时发送 Slack 通知"
- "列出当前配置的所有告警规则"
- "在维护窗口期间禁用所有告警"
- "为 #alerts 频道创建 Slack 连接器"
- "为关键告警设置 PagerDuty 集成"
- "为 API 服务创建 99.9% 可用性 SLO"
- "显示所有 SLO 的当前错误预算"
- "为结账服务启用 SLO 跟踪"

### 安全运营
- "搜索与勒索软件相关的检测规则"
- "为失败的登录尝试创建新的检测规则"
- "为已知安全 IP 添加异常"
- "创建时间线以调查可疑网络活动"

---

## Claude Desktop 的两种提示词模式

当在 Claude Desktop 中使用本服务器时，支持两种不同的提示词交互模式：

### 1. 工具模式
- **工作方式：** Claude Desktop 可直接调用服务器工具（包括基础工具如 `get_status`、`execute_kb_api` 和 VL 工具如 `vl_search_saved_objects`、`vl_create_saved_object`）来回答你的问题或执行操作。
- **适用人群：** 需要对话式、引导式体验的用户。服务器会自动搜索、执行并解释 Kibana API 和管理保存对象。
- **示例：** "显示所有包含 'sales' 的仪表盘" 或 "创建用于 web 分析的新可视化"
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

以不同模式运行：

```bash
# Stdio 模式（默认）
npm start

# HTTP 模式
npm run start:http

# TypeScript 开发模式
npm run start:ts

# HTTP 模式 TypeScript 开发
npm run start:http:ts
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
- **GitHub 仓库**: [TocharianOU/mcp-server-kibana](https://github.com/TocharianOU/mcp-server-kibana)
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
