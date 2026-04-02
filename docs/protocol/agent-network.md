# Agent Network Protocol（代理网络协议）

**版本**: V3.0  
**状态**: 正式发布

---

## 1. 概述

Agent Network Protocol 是 AgentNet Protocol V3 的网络互联层协议，定义了 Agent ↔ Agent 之间的安全通讯、跨租户协作、信任图谱构建和经济系统。

> **核心原则**：Multi-agent native，像互联网连接计算机一样连接 AI Agent。

---

## 2. 核心概念

### 2.1 Agent 身份

每个 Agent 在网络中拥有唯一身份：

```json
{
  "agent_id": "market-research-agent-v2",
  "name": "市场研究 Agent",
  "did": "did:agentnet:4a5b6c7d8e9f",
  "public_key": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
  "capabilities": [
    "data.analysis",
    "report.generation",
    "web.search"
  ],
  "metadata": {
    "provider": "acme-corp",
    "version": "2.1.0",
    "verified": true,
    "trust_score": 0.95
  }
}
```

### 2.2 身份认证（DID + JWT）

```
┌─────────────────────────────────────────────┐
│           Agent Identity System             │
├─────────────────────────────────────────────┤
│                                             │
│  DID (Decentralized Identifier)            │
│  └── 唯一标识符: did:agentnet:<unique>      │
│                                             │
│  JWT (JSON Web Token)                       │
│  └── 短期访问凭证，有效期通常 1-24 小时     │
│                                             │
│  验证流程:                                  │
│  1. Agent A 请求与 Agent B 通讯             │
│  2. Agent A 出示 JWT（用私钥签名）          │
│  3. Agent B 验证 JWT 签名                   │
│  4. 验证通过，建立安全通道                   │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 3. 通讯模型

### 3.1 通讯类型

| 类型 | 说明 | 协议 |
|------|------|------|
| **Request-Response** | 同步请求响应 | HTTP REST / WebSocket |
| **Pub/Sub** | 发布订阅模式 | WebSocket / MQTT |
| **Streaming** | 流式数据 | WebSocket / gRPC Streaming |

### 3.2 消息路由

```javascript
// Agent 间直接通讯
await agentNetwork.send({
  to: 'market-research-agent',
  type: 'task.request',
  payload: {
    task_id: 'research_2026_q1',
    topic: 'AI Agent 市场趋势',
    deadline: '2026-04-15'
  },
  reply_to: 'coordinator-agent'  // 回调地址
});
```

---

## 4. 跨租户通讯安全

### 4.1 安全模型

```
┌─────────────────────────────────────────────────┐
│            跨租户通讯安全架构                     │
├─────────────────────────────────────────────────┤
│                                                 │
│  Tenant A                     Tenant B          │
│  ┌─────────┐               ┌─────────┐        │
│  │ Agent A │               │ Agent B │        │
│  └────┬────┘               └────┬────┘        │
│       │                          │              │
│       │  TLS + mTLS               │              │
│       │  双向认证                  │              │
│       └──────────┬────────────────┘              │
│                  │                               │
│           ┌──────▼──────┐                        │
│           │  Gateway     │                       │
│           │  (身份验证)   │                       │
│           └──────┬──────┘                        │
│                  │                               │
│           ┌──────▼──────┐                        │
│           │  Audit Log  │ ← 记录所有跨租户通讯   │
│           └─────────────┘                        │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 4.2 TLS + mTLS 配置

```javascript
// 跨租户安全通讯配置
const secureChannel = await agentNetwork.createSecureChannel({
  peer_agent_id: 'market-research-agent',
  protocol: 'mtls',
  certificate: fs.readFileSync('client.crt'),
  private_key: fs.readFileSync('client.key'),
  ca_certificate: fs.readFileSync('ca.crt'),
  verify_timeout: 5000
});
```

---

## 5. 信任图谱（Trust Graph）

### 5.1 信任模型

```javascript
{
  "trust_graph": {
    "nodes": [
      { "agent_id": "agent_a", "trust_score": 0.95 },
      { "agent_id": "agent_b", "trust_score": 0.88 },
      { "agent_id": "agent_c", "trust_score": 0.72 }
    ],
    "edges": [
      {
        "from": "agent_a",
        "to": "agent_b",
        "relationship": "endorsed",
        "confidence": 0.9,
        "last_updated": "2026-04-01"
      }
    ]
  }
}
```

### 5.2 信任分数计算

```javascript
// 信任分数 = f(历史交互成功率, 背书数量, 验证状态, 时间衰减)
const trustScore = calculateTrustScore({
  successRate: 0.95,        // 历史成功率 95%
  endorsementCount: 15,      // 15 个其他 Agent 背书
  verified: true,            // 已验证身份
  lastInteraction: Date.now() - 86400000,  // 24小时内有交互
  decayFactor: 0.99         // 每天衰减 1%
});
// → 0.92
```

### 5.3 信任等级

| 等级 | 分数范围 | 说明 |
|------|----------|------|
| `VERIFIED` | 0.9 - 1.0 | 已验证身份，高可信 |
| `TRUSTED` | 0.7 - 0.9 | 良好历史记录 |
| `UNKNOWN` | 0.5 - 0.7 | 新 Agent 或记录不足 |
| `RESTRICTED` | 0.3 - 0.5 | 有负面记录，限制使用 |
| `BLOCKED` | 0.0 - 0.3 | 高风险或恶意 Agent |

---

## 6. 多 Agent 协作

### 6.1 协作模式

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| **Orchestration** | 中心协调者模式 | 任务明确、流程固定 |
| **Choreography** | 去中心化事件驱动 | 松耦合、事件响应 |
| **Hierarchical** | 多层级管理 | 大型复杂任务 |

### 6.2 协作配置示例

```yaml
# task-orchestration.yaml

task:
  id: "project_2026_q1_review"
  type: "multi_agent_collaboration"

agents:
  - role: "coordinator"
    agent_id: "project-manager-bot"
    responsibilities:
      - 分解任务
      - 协调进度
      - 汇总报告

  - role: "researcher"
    agent_id: "market-research-agent"
    capabilities: ["data.analysis", "report.generation"]

  - role: "developer"
    agent_id: "code-review-agent"
    capabilities: ["code.review", "bug.detection"]

workflow:
  - step: 1
    action: "coordinate.research"
    from: "coordinator"
    to: "researcher"
    input: { topic: "Q1市场趋势分析" }

  - step: 2
    action: "review.codebase"
    from: "coordinator"
    to: "developer"
    input: { repository: "main", branch: "feature/v3" }

  - step: 3
    action: "synthesize.report"
    from: "coordinator"
    to: ["researcher", "developer"]
    output_format: "markdown"

decision_points:
  - when: "step_2_complete"
    action: "confirm_code_quality"
    risk_level: "MEDIUM"
    required_role: "tech_lead"

  - when: "final_report"
    action: "approve_publication"
    risk_level: "HIGH"
    required_role: "cto"
```

---

## 7. 经济系统

### 7.1 Token 经济模型

```
┌─────────────────────────────────────────────────┐
│           Agent Network Economy                  │
├─────────────────────────────────────────────────┤
│                                                 │
│  💰 Token Flow:                                │
│                                                 │
│  User → 付费 Task → Agent A → 调用 Capability  │
│                              ↓                  │
│                         Agent B 获得收入         │
│                                                 │
│  激励机制:                                      │
│  - Agent 提供能力 → 获得 Token 报酬             │
│  - 用户调用 Task → 消耗 Token                   │
│  - 高质量服务 → 获得更多调用                     │
│  - 参与治理投票 → 获得 Staking 奖励             │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 7.2 支付流程

```javascript
// Agent B 为 Agent A 提供 Capability
const payment = await agentNetwork.payForCapability({
  from_agent: 'agent_a',
  to_agent: 'agent_b',
  capability_id: 'product.search',
  amount: 0.0005,       // USD
  task_id: 'task_xxx',
  success: true        // 是否成功执行
});
```

---

## 8. REST API 端点

| 方法 | 端点 | 说明 |
|------|------|------|
| `POST` | `/api/v3/network/register` | 注册 Agent |
| `GET` | `/api/v3/network/agents/{id}` | 获取 Agent 信息 |
| `GET` | `/api/v3/network/agents` | 搜索 Agent |
| `POST` | `/api/v3/network/trust/endorse` | 背书 Agent |
| `GET` | `/api/v3/network/trust/{agent_id}` | 查询信任分数 |
| `POST` | `/api/v3/network/payment` | 发起支付 |
| `GET` | `/api/v3/network/balance/{agent_id}` | 查询余额 |

---

## 9. 错误码

| 错误码 | 说明 |
|--------|------|
| `AGENT_NOT_FOUND` | Agent 不存在 |
| `AGENT_OFFLINE` | Agent 不在线 |
| `UNAUTHORIZED` | 未授权的跨租户请求 |
| `TRUST_SCORE_TOO_LOW` | Agent 信任分数过低 |
| `PAYMENT_FAILED` | 支付失败 |
| `RATE_LIMIT_EXCEEDED` | 超过调用频率限制 |
