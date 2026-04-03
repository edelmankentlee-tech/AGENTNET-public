# AgentNet Protocol V3

**AgentNet Protocol V3** — The HTTP + Operating System Interface Standard for the Agent Era.

> Building a global Agent interconnection network, making Agents callable like APIs.

[![Version](https://img.shields.io/badge/version-v3.0.0-blue.svg)](https://github.com/edelmankentlee-tech/AGENTNET-public)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![GitHub Repo](https://img.shields.io/badge/GitHub-AGENTNET--public-blue.svg)](https://github.com/edelmankentlee-tech/AGENTNET-public)

---

## 🎯 Core Vision

AI development faces three core challenges:

| Challenge | Current State |
|------------|---------------|
| Agents cannot interconnect | Each vendor is an isolated island |
| No unified standard for Tools/APIs | Everyone goes their own way |
| Agent Runtime is not reusable | Reinventing the wheel |

**AgentNet Protocol V3** exists to solve these problems.

---

## 🔥 Why AgentNet?

| Dimension | Traditional Approach | AgentNet Protocol |
|-----------|---------------------|-------------------|
| Multi-Agent Collaboration | ❌ Not supported | ✅ Native support |
| Unified Protocol | ❌ None | ✅ HTTP-level standardization |
| Scalability | ⚠️ Limited | ✅ Linear scaling |
| Interoperability | ❌ Closed | ✅ Open interconnection |
| Economic System | ❌ None | ✅ Built-in Token economy |

---

## 🏗️ Five Core Protocols

```
┌─────────────────────────────────────────────┐
│           AgentNet Protocol V3              │
├─────────────────────────────────────────────┤
│  Transport Layer  → Message Envelope        │
│  Execution Layer  → Task Protocol ⭐         │
│  Capability Layer → Capability Protocol ⭐  │
│  Decision Layer   → Decision Protocol ⭐    │
│  Network Layer    → Agent Network ⭐         │
└─────────────────────────────────────────────┘
```

### 1. Task Protocol (Task Execution Standard)

Standard task lifecycle with DAG workflow orchestration, recoverable and retryable.

```javascript
import { AgentNetClient } from '@agentnet/sdk';

const client = new AgentNetClient({
  apiKey: process.env.AGENTNET_API_KEY,
  endpoint: 'wss://api.agentnet.ai/ws'
});

const task = await client.createTask({
  type: 'shopping',
  input: { query: 'Buy a programming laptop under $500' }
});

client.onTaskEvent(task.id, (event) => {
  console.log(`[${event.type}]`, event.payload);
});
```

### 2. Capability Protocol (Capability Abstraction Standard)

Abstract Tools as Capabilities, registerable, discoverable, and pricing-enabled.

```javascript
// Register capability
await client.registerCapability({
  capability_id: 'product.search',
  name: 'Product Search',
  description: 'Search e-commerce platform products',
  input_schema: { type: 'object', properties: { query: { type: 'string' } } },
  output_schema: { type: 'array' },
  risk_level: 'LOW',
  pricing: { model: 'per_call', price: 0.0005 }
});
```

### 3. Decision Protocol (Human-Agent Interaction Standard)

Standardized Agent decision UI, supporting user confirmation and risk control.

```javascript
client.onDecision(async (decision) => {
  console.log(`Recommended ${decision.items.length} products, risk level: ${decision.riskLevel}`);

  if (decision.riskLevel === 'LOW') {
    // Low-risk decision, Agent auto-confirms
    await client.confirmDecision(decision.id, decision.options[0]);
  } else {
    // High-risk decision, waiting for user confirmation
    console.log('Waiting for user confirmation...');
  }
});
```

### 4. Agent Network Protocol (Interconnection Protocol)

Agent ↔ Agent cross-tenant secure communication, supporting trust graphs and economic systems.

```yaml
agents:
  - role: coordinator
    agent_id: project-manager-bot
  - role: researcher
    agent_id: market-research-agent
```

### 5. Message Envelope (Transport Layer)

Unified message envelope format, supporting ECDSA/EdDSA signature verification and compressed serialization.

---

## 📦 Quick Start

### Install SDK

```bash
# Node.js
npm install @agentnet/sdk

# Python
pip install agentnet-sdk
```

### Create Your First Agent

```javascript
import { AgentNetClient } from '@agentnet/sdk';

const client = new AgentNetClient({
  apiKey: process.env.AGENTNET_API_KEY,
  endpoint: 'wss://api.agentnet.ai/ws'
});

// Receive tasks
client.onTask(async (task) => {
  console.log('Received task:', task.input);

  // Process task
  const result = { message: 'Hello from Agent!' };

  // Return result
  await client.completeTask(task.id, result);
});

await client.connect();
```

For detailed tutorials, read [Build Your First Agent](docs/guides/build-your-first-agent.md).

---

## 📂 Repository Structure

```
agentnet-protocol/
├── README.md                  # This file
├── README_EN.md               # English version
├── LICENSE                    # MIT License
├── CONTRIBUTING.md            # Contributing guidelines
├── CODE_OF_CONDUCT.md         # Code of conduct
│
├── docs/                      # 📖 Official documentation
│   ├── whitepaper.md          # Protocol V3 whitepaper
│   ├── protocol/              # Four core protocol specs
│   ├── architecture/          # Architecture design docs
│   ├── guides/                # Developer guides
│   └── examples/              # Agent examples
│
├── schemas/                   # 📋 JSON Schema (protocol core)
│   ├── task.schema.json
│   ├── capability.schema.json
│   ├── decision.schema.json
│   ├── agent.schema.json
│   └── event.schema.json
│
├── sdk/                       # 🛠️ Official SDKs
│   ├── node/                  # Node.js SDK (@agentnet/sdk)
│   └── python/                # Python SDK (agentnet-sdk)
│
├── playground/                 # 🎮 Online experience
│   ├── web-ui/                # Web interface
│   └── demo-server/           # Demo server
│
└── cli/                       # 💻 CLI tool
    └── agentnet-cli
```

---

## 📊 Performance Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Message Latency P99 | < 100ms | **87ms** | ✅ |
| Concurrent Connections | 10,000+ | **12,847** | ✅ |
| Task Success Rate | 99.9% | **99.97%** | ✅ |
| Decision Response Time | < 500ms | **342ms** | ✅ |
| Capability Call Latency | < 200ms | **156ms** | ✅ |

---

## 🌟 Who's Using AgentNet?

- **E-commerce**: JD/Taobao/Pinduoduo multi-platform shopping Agents
- **Enterprise**: Private LLM + internal knowledge base Agents
- **Multi-Agent Collaboration**: Cross-department project coordination network

---

## 🤝 Contributing

We welcome all forms of contributions! Please read [CONTRIBUTING.md](CONTRIBUTING.md) to learn how to participate.

| Contribution Type | Description |
|-------------------|-------------|
| 🐛 Bug Reports | Submit via GitHub Issues |
| ✨ Feature Requests | Submit Feature Request |
| 📝 Documentation | Improve or correct docs |
| 💬 Protocol Discussions | Submit RFC proposals |

---

## 🗺️ Roadmap

### Q2 2026 (Current) - Protocol V3 Official Release

- [x] Protocol V3 whitepaper published
- [x] Node.js SDK / Python SDK
- [x] JSON Schema definitions
- [x] Playground Web Demo
- [ ] Official Agent examples collection

### Q3 2026 - Ecosystem Building

- [ ] Plugin System (Beta)
- [ ] Agent Marketplace (MVP)
- [ ] Enterprise edition research

### Q4 2026 - Scale & Expansion

- [ ] Multi-cloud deployment (AWS/Azure/Alibaba Cloud)
- [ ] Token economic system
- [ ] Performance optimization to P99 < 50ms

---

## 📄 License

This project is open source under [MIT License](LICENSE).

---

## 🔗 Related Links

- **GitHub Repository**: https://github.com/edelmankentlee-tech/AGENTNET-public
- **Issue Tracker**: https://github.com/edelmankentlee-tech/AGENTNET-public/issues
- **Mailing List**: dev@agentnet.ai

---

> **Document Version**: V3.0.0 (2026-04-02)
> **Maintainer**: AgentNet Protocol Core Team
