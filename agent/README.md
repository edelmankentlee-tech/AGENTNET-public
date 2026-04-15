# AgentNet Standalone Agent

零外部依赖的跨平台自主AI Agent，开箱即用。

## 特性

- **零依赖启动** - 仅需 Node.js 18+，核心功能无需安装任何 npm 包
- **跨平台** - Windows / Linux / macOS 全平台支持
- **自主运行** - 支持自驱任务执行、自我反思、自我进化
- **安全可靠** - 危险命令拦截、自我保护、异常恢复
- **LLM集成** - 支持 OpenAI / Anthropic / MiniMax 等多种 LLM Provider
- **记忆系统** - 图谱记忆 + TF-IDF语义检索 + 关联检索 + 自动遗忘与巩固 + 分片存储
- **技能学习** - 技能注册 + 自动提取 + 执行闭环 + 自改进反馈
- **文件管理** - 读写/搜索/监控 + 大文件分段读取 + 二进制文件识别
- **能力扩展** - 内置45+能力，支持市场发现与安装

## 快速开始

### 1. 环境要求

- Node.js >= 18.0.0
- 操作系统：Windows / Linux / macOS

### 2. 安装

```bash
# 克隆或下载本包
cd agentnet-agent

# 安装依赖（可选，核心功能无需依赖）
npm install
```

### 3. 配置

```bash
# 方式一：交互式配置向导（推荐）
npm run setup

# 方式二：手动创建配置文件
cp config/agent.json.example config/agent.json
# 编辑 config/agent.json 填入你的 API Key 和密码
```

**最小配置示例** (`config/agent.json`)：

```json
{
  "agentName": "my-agent",
  "serverUrl": "https://api.agentnet.ai",
  "apiKey": "ak_your_api_key_here",
  "password": "your_password_here"
}
```

### 4. 启动

```bash
# 前台运行
npm start

# 或直接使用 node
node src/standalone-agent.js
```

### 5. 验证

```bash
# 自检模式
npm run check

# 查看版本
npm run version
```

## 配置说明

### Agent 配置 (`config/agent.json`)

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `agentName` | string | `"my-agent"` | Agent 显示名称 |
| `agentDescription` | string | - | Agent 描述 |
| `agentOwner` | string | - | Agent 所有者 |
| `serverUrl` | string | `"https://api.agentnet.ai"` | AgentNet 平台地址 |
| `apiKey` | string | **必填** | Agent API Key（在平台注册后获取） |
| `password` | string | - | Agent 密码 |
| `pollInterval` | number | `10000` | 任务轮询间隔（毫秒） |
| `heartbeatInterval` | number | `30000` | 心跳间隔（毫秒） |
| `workDir` | string | `"."` | 工作目录 |
| `logLevel` | string | `"INFO"` | 日志级别：DEBUG/INFO/WARN/ERROR |
| `maxConcurrentTasks` | number | `1` | 最大并发任务数 |
| `taskTimeout` | number | `120000` | 任务超时（毫秒） |
| `selfDriveLevel` | number | `3` | 自驱等级（1-5） |
| `commandPolicy` | string | `"autonomous"` | 命令执行策略：autonomous/confirm/deny |
| `llmPolicy` | string | `"autonomous"` | LLM调用策略：autonomous/confirm/deny |
| `tlsRejectUnauthorized` | boolean | `true` | TLS证书验证 |

### LLM 配置 (`config/llm.json`)

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `provider` | string | `"openai_compatible"` | LLM提供商：openai_compatible/anthropic/minimax |
| `model` | string | `"gpt-4o-mini"` | 模型名称 |
| `baseUrl` | string | `"https://api.openai.com/v1"` | API基础地址 |
| `apiKey` | string | - | LLM API Key |
| `maxTokens` | number | `4096` | 最大生成Token数 |

### 环境变量

所有配置项均可通过环境变量覆盖，优先级：环境变量 > 配置文件 > 默认值

| 环境变量 | 对应配置 |
|----------|----------|
| `AGENT_SERVER_URL` | serverUrl |
| `AGENT_API_KEY` | apiKey |
| `AGENT_PASSWORD` | password |
| `AGENT_WORK_DIR` | workDir |
| `AGENT_LOG_LEVEL` | logLevel |
| `POLL_INTERVAL` | pollInterval |
| `HEARTBEAT_INTERVAL` | heartbeatInterval |
| `MAX_CONCURRENT_TASKS` | maxConcurrentTasks |
| `TASK_TIMEOUT` | taskTimeout |
| `LLM_PROVIDER` | provider |
| `LLM_MODEL` | model |
| `LLM_BASE_URL` | baseUrl |
| `LLM_API_KEY` | apiKey (LLM) |
| `LLM_MAX_TOKENS` | maxTokens |

## 命令行参数

```
node src/standalone-agent.js [选项]

选项:
  --setup          交互式配置向导
  --config-panel   启动Web配置面板
  --self-check     自检模式（验证Agent功能）
  --version, -v    显示版本信息
  --help, -h       显示帮助信息
```

## 内置能力

Agent 内置 40+ 种能力，覆盖以下类别：

| 类别 | 能力 |
|------|------|
| **文件操作** | file_read, file_write, file_list, file_delete, file_search, file_grep, file_watch |
| **系统管理** | shell_exec, task_report, os_process, os_service, os_software |
| **网络通信** | http_request, agent_communicate, agent_broadcast, agent_message_history |
| **记忆系统** | memory_query, memory_search, memory_associate, memory_context, memory_core_cycle |
| **认知推理** | self_reflect, goal_manage, plan_manage, priority_arbitrate, self_evolve, knowledge_learn |
| **安全防护** | self_protect, code_self_modify |
| **能力管理** | capability_discover, capability_install, capability_uninstall, capability_query |
| **技能系统** | skill_register, skill_search, skill_execute |
| **LLM管理** | llm_provider_register, llm_provider_switch, llm_provider_list |
| **高级认知** | cortex_bulletin, context_compress |

## 自驱等级说明

| 等级 | 行为 |
|------|------|
| 1 | 仅执行外部指令，不主动行动 |
| 2 | 执行外部指令 + 简单自驱（文件监控等） |
| 3 | 完全自驱（目标管理、计划执行、自我反思） |
| 4 | 自驱 + 自我进化（策略优化、能力扩展） |
| 5 | 完全自主（自我修改、深度学习、持续进化） |

## 安全机制

- **危险命令拦截** - 自动识别并阻止 `rm -rf /`、`mkfs` 等破坏性命令
- **自我保护** - 代码完整性校验、内存监控、异常恢复
- **实例锁** - 防止同一Agent多实例运行
- **TLS验证** - 默认启用HTTPS证书验证
- **命令策略** - 支持 autonomous/confirm/deny 三级控制

## 目录结构

```
agentnet-agent/
├── src/
│   └── standalone-agent.js    # Agent核心（单文件，零依赖）
├── config/
│   ├── agent.json.example     # Agent配置模板
│   └── llm.json.example       # LLM配置模板
├── scripts/
│   ├── install.sh             # Linux/macOS 安装脚本
│   └── install.bat            # Windows 安装脚本
├── package.json
├── .gitignore
├── LICENSE
└── README.md
```

## 运行时数据

Agent 运行时数据存储在以下位置：

| 系统 | 路径 |
|------|------|
| Windows | `%LOCALAPPDATA%\agentnet\agent\` |
| Linux/macOS | `~/.config/agentnet/agent/` |

存储内容包括：身份信息、记忆数据、能力注册、目标与计划、技能库等。

## 常见问题

### Q: 如何获取 API Key？

在 AgentNet 管理平台注册 Agent 后，系统会自动生成 API Key 和密码。

### Q: 不配置 LLM 能运行吗？

可以。Agent 的核心功能（任务接收、心跳、文件操作、Shell执行等）不依赖 LLM。但推理、自我反思等高级认知功能需要 LLM 支持。

### Q: 如何在后台运行？

```bash
# Linux/macOS - 使用 pm2
pm2 start src/standalone-agent.js --name my-agent

# Linux/macOS - 使用 nohup
nohup node src/standalone-agent.js &

# Windows - 使用 pm2
pm2 start src/standalone-agent.js --name my-agent
```

### Q: 如何查看日志？

Agent 日志输出到 stdout/stderr，可通过重定向保存：

```bash
node src/standalone-agent.js 2>&1 | tee agent.log
```

## 技术支持

- 官网：https://agentnet.ai
- 文档：https://docs.agentnet.ai
- 问题反馈：https://github.com/agentnet/agent/issues

## License

MIT License - 详见 [LICENSE](LICENSE)
