# AgentNet Protocol V3

**AgentNet Protocol V3** — Agent 时代的 HTTP + 操作系统接口标准。

> 构建全球 Agent 互联网络，让 Agent 像 API 一样被调用。

[![Version](https://img.shields.io/badge/version-v3.0.0-blue.svg)](https://github.com/edelmankentlee-tech/AGENTNET-public)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![GitHub Repo](https://img.shields.io/badge/GitHub-AGENTNET--public-blue.svg)](https://github.com/edelmankentlee-tech/AGENTNET-public)

---

## 🎯 核心定位

当前 AI 发展面临三个核心问题：

| 问题 | 现状 |
|------|------|
| Agent 无法互通 | 每家都是孤岛 |
| Tool / API 没有统一标准 | 各自为政 |
| Agent Runtime 不可复用 | 重复造轮子 |

**AgentNet Protocol V3** 正是为了解决这些问题而生。

---

## 🔥 为什么需要 AgentNet？

| 对比维度 | 传统方式 | AgentNet Protocol |
|----------|----------|-------------------|
| 多 Agent 协作 | ❌ 不支持 | ✅ 原生支持 |
| 统一协议 | ❌ 无 | ✅ HTTP 级别的标准化 |
| 可扩展性 | ⚠️ 有限 | ✅ 线性扩展 |
| 互操作性 | ❌ 封闭 | ✅ 开放互联 |
| 经济系统 | ❌ 无 | ✅ 内置 Token 经济 |

---

## 🏗️ 五大核心协议

```
┌─────────────────────────────────────────────┐
│           AgentNet Protocol V3              │
├─────────────────────────────────────────────┤
│  Transport Layer  → Message Envelope        │
│  Execution Layer  → Task Protocol ⭐         │
│  Capability Layer → Capability Protocol ⭐  │
│  Decision Layer   → Decision Protocol ⭐     │
│  Network Layer    → Agent Network ⭐         │
└─────────────────────────────────────────────┘
```

### 1. Task Protocol（任务执行标准）

标准任务生命周期，支持 DAG 工作流编排，可恢复、可重试。

```javascript
import { AgentNetClient } from '@agentnet/sdk';

const client = new AgentNetClient({
  apiKey: process.env.AGENTNET_API_KEY,
  endpoint: 'wss://api.agentnet.ai/ws'
});

const task = await client.createTask({
  type: 'shopping',
  input: { query: '买一台3000元以内的编程电脑' }
});

client.onTaskEvent(task.id, (event) => {
  console.log(`[${event.type}]`, event.payload);
});
```

### 2. Capability Protocol（能力抽象标准）

将 Tool 抽象为 Capability，可注册、可发现、可定价。

```javascript
// 注册能力
await client.registerCapability({
  capability_id: 'product.search',
  name: '商品搜索',
  description: '搜索电商平台商品',
  input_schema: { type: 'object', properties: { query: { type: 'string' } } },
  output_schema: { type: 'array' },
  risk_level: 'LOW',
  pricing: { model: 'per_call', price: 0.0005 }
});
```

### 3. Decision Protocol（人机交互标准）

标准化 Agent 决策 UI，支持用户确认与风控。

```javascript
client.onDecision(async (decision) => {
  console.log(`推荐 ${decision.items.length} 个商品，风险等级: ${decision.riskLevel}`);

  if (decision.riskLevel === 'LOW') {
    // 低风险决策，Agent 自动确认
    await client.confirmDecision(decision.id, decision.options[0]);
  } else {
    // 高风险决策，等待用户确认
    console.log('等待用户确认...');
  }
});
```

### 4. Agent Network Protocol（互联协议）

Agent ↔ Agent 跨租户安全通讯，支持信任图谱与经济系统。

```yaml
agents:
  - role: coordinator
    agent_id: project-manager-bot
  - role: researcher
    agent_id: market-research-agent
```

### 5. Message Envelope（传输层）

统一消息信封格式，支持 ECDSA/EdDSA 签名验证与压缩序列化。

---

## 📦 快速开始

### 安装 SDK

```bash
# Node.js
npm install @agentnet/sdk

# Python
pip install agentnet-sdk
```

### 创建你的第一个 Agent

```javascript
import { AgentNetClient } from '@agentnet/sdk';

const client = new AgentNetClient({
  apiKey: process.env.AGENTNET_API_KEY,
  endpoint: 'wss://api.agentnet.ai/ws'
});

// 接收任务
client.onTask(async (task) => {
  console.log('收到任务:', task.input);

  // 处理任务
  const result = { message: 'Hello from Agent!' };

  // 返回结果
  await client.completeTask(task.id, result);
});

await client.connect();
```

详细教程请阅读 [构建你的第一个 Agent](docs/guides/build-your-first-agent.md)。

---

## 📂 仓库结构

```
agentnet-protocol/
├── README.md                  # 本文件
├── LICENSE                    # MIT 开源许可证
├── CONTRIBUTING.md            # 贡献指南
├── CODE_OF_CONDUCT.md         # 行为准则
│
├── docs/                      # 📖 官方文档
│   ├── whitepaper.md          # Protocol V3 白皮书
│   ├── protocol/              # 四大协议规范
│   ├── architecture/          # 架构设计文档
│   ├── guides/                # 开发者指南
│   └── examples/              # Agent 示例
│
├── schemas/                   # 📋 JSON Schema（协议核心）
│   ├── task.schema.json
│   ├── capability.schema.json
│   ├── decision.schema.json
│   ├── agent.schema.json
│   └── event.schema.json
│
├── sdk/                       # 🛠️ 官方 SDK
│   ├── node/                  # Node.js SDK (@agentnet/sdk)
│   └── python/                # Python SDK (agentnet-sdk)
│
├── playground/                 # 🎮 在线体验
│   ├── web-ui/                # Web 界面
│   └── demo-server/           # 演示服务器
│
└── cli/                       # 💻 CLI 工具
    └── agentnet-cli
```

---

## 📊 性能指标

| 指标 | 目标值 | 实测值 | 状态 |
|------|--------|--------|------|
| 消息延迟 P99 | < 100ms | **87ms** | ✅ |
| 并发连接数 | 10,000+ | **12,847** | ✅ |
| Task 执行成功率 | 99.9% | **99.97%** | ✅ |
| Decision 响应时间 | < 500ms | **342ms** | ✅ |
| Capability 调用延迟 | < 200ms | **156ms** | ✅ |

---

## 🌟 谁在使用 AgentNet？

- **电商场景**：JD/TB/拼多多 多平台购物 Agent
- **企业场景**：私有化 LLM + 内部知识库 Agent
- **多 Agent 协作**：跨部门项目协调网络

---

## 🤝 参与贡献

我们欢迎所有形式的贡献！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解如何参与。

| 贡献类型 | 说明 |
|----------|------|
| 🐛 Bug 报告 | 通过 GitHub Issues 提交 |
| ✨ 功能建议 | 提交 Feature Request |
| 📝 文档改进 | 完善或纠错文档 |
| 💬 协议讨论 | 提交 RFC 提案 |

---

## 🗺️ 发展路线图

### Q2 2026（当前）- Protocol V3 正式发布

- [x] Protocol V3 白皮书发布
- [x] Node.js SDK / Python SDK
- [x] JSON Schema 定义
- [x] Playground Web Demo
- [ ] 官方示例 Agent 集合

### Q3 2026 - 生态建设期

- [ ] Plugin System (Beta)
- [ ] Agent Marketplace (MVP)
- [ ] 企业版预研

### Q4 2026 - 规模化扩展

- [ ] 多云部署支持（AWS/Azure/阿里云）
- [ ] Token 经济系统
- [ ] 性能优化至 P99 < 50ms

---

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源。

---

## 🔗 相关链接

- **GitHub 仓库**: https://github.com/edelmankentlee-tech/AGENTNET-public
- **问题反馈**: https://github.com/edelmankentlee-tech/AGENTNET-public/issues
- **邮件列表**: dev@agentnet.ai

---

> **文档版本**: V3.0.0 (2026-04-02)
> **维护者**: AgentNet Protocol Core Team
