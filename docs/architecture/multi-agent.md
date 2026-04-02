# 多 Agent 协作

**版本**: V3.0  
**文档层级**: L2

---

## 1. 概述

AgentNet Protocol V3 原生支持多 Agent 协作，提供两种核心模式：**Orchestration（编排模式）** 和 **Choreography（编排事件驱动模式）**，以及 **Hierarchical（层级模式）** 适用于复杂场景。

---

## 2. 协作模式对比

| 模式 | 说明 | 适用场景 | 复杂度 |
|------|------|----------|--------|
| **Orchestration** | 中心协调者统一调度 | 任务明确、流程固定 | 低 |
| **Choreography** | 去中心化事件驱动 | 松耦合、事件响应 | 中 |
| **Hierarchical** | 多层级管理 | 大型复杂任务 | 高 |

---

## 3. Orchestration 模式（编排模式）

### 3.1 架构

```
              ┌─────────────────────┐
              │   Coordinator      │
              │   (协调者 Agent)    │
              └──────────┬──────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
   ┌────────────┐ ┌────────────┐ ┌────────────┐
   │ Researcher │ │ Developer  │ │ Reviewer   │
   │   Agent    │ │   Agent    │ │   Agent    │
   └────────────┘ └────────────┘ └────────────┘
```

### 3.2 协作配置

```yaml
# coordinator_workflow.yaml
agents:
  - role: coordinator
    agent_id: project-manager-bot
    responsibilities:
      - 分解任务
      - 分配子任务
      - 收集结果
      - 汇总报告

  - role: researcher
    agent_id: market-research-agent
    capabilities: ["data.search", "report.generation"]
    max_concurrent_tasks: 2

  - role: developer
    agent_id: code-review-agent
    capabilities: ["code.review", "bug.detection"]
    max_concurrent_tasks: 1

workflow:
  - step: 1
    type: parallel
    tasks:
      - action: research.market_trend
        assignee: researcher
        input: { topic: "AI Agent 市场" }

      - action: research.competitor_analysis
        assignee: researcher
        input: { competitors: ["竞品A", "竞品B"] }

  - step: 2
    type: sequential
    action: synthesize.findings
    assignee: coordinator
    depends_on: [step_1]

  - step: 3
    type: manual_approval
    action: confirm_report
    risk_level: MEDIUM
    required_role: manager

  - step: 4
    type: parallel
    tasks:
      - action: publish.report
        assignee: coordinator
      - action: notify.stakeholders
        assignee: coordinator
```

### 3.3 代码示例

```javascript
// 创建协调任务
const task = await client.createTask({
  type: 'multi_agent_collaboration',
  input: { topic: 'Q1 AI Agent 市场分析' },
  orchestration: {
    coordinator: 'project-manager-bot',
    agents: ['market-research-agent', 'code-review-agent'],
    workflow: loadYaml('coordinator_workflow.yaml')
  }
});

// 监听子任务事件
client.onSubTaskEvent(task.id, (event) => {
  console.log(`[${event.agent_role}] ${event.type}: ${event.message}`);
});
```

---

## 4. Choreography 模式（事件驱动）

### 4.1 架构

```
┌─────────────────────────────────────────────────────────┐
│                    Event Bus                             │
│              (Pub/Sub 消息总线)                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Agent A ──publish──→ (topic: order.created)             │
│                                    │                     │
│                                    ▼                     │
│  Agent B ◄─────subscribe──── Event Bus                   │
│                                    │                     │
│                                    ▼                     │
│  Agent C ◄─────subscribe──── Event Bus                   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 4.2 事件定义

```typescript
// 标准事件格式
interface AgentEvent {
  event_id: string;
  event_type: string;           // topic 名称
  source_agent: string;          // 事件来源
  target_agents?: string[];      // 目标（可选，广播）
  timestamp: string;
  payload: Record<string, unknown>;
  correlation_id?: string;       // 用于追踪关联事件
}

// 事件示例
const event: AgentEvent = {
  event_id: 'evt_001',
  event_type: 'order.created',
  source_agent: 'shopping-agent',
  target_agents: ['payment-agent', 'logistics-agent', 'notification-agent'],
  timestamp: '2026-04-02T10:00:00Z',
  payload: {
    order_id: 'order_xxx',
    customer_id: 'user_abc',
    items: [{ product_id: 'prod_001', quantity: 1 }],
    total_amount: 2999
  }
};
```

### 4.3 订阅与处理

```javascript
// 订阅事件
agent.subscribe('order.created', async (event) => {
  console.log(`收到订单事件: ${event.payload.order_id}`);

  // 处理逻辑
  const result = await processOrder(event.payload);

  // 发布后续事件
  await agent.publish({
    event_type: 'order.processed',
    payload: {
      order_id: event.payload.order_id,
      result
    },
    correlation_id: event.event_id
  });
});

// 订阅多个事件
agent.subscribe([
  { topic: 'payment.success', handler: handlePaymentSuccess },
  { topic: 'payment.failed', handler: handlePaymentFailed },
  { topic: 'inventory.low', handler: handleInventoryAlert, priority: 'high' }
]);
```

---

## 5. Hierarchical 模式（层级模式）

### 5.1 架构

```
                    ┌─────────────────┐
                    │   CEO Agent     │  ← L3: 战略层
                    │  (战略决策)      │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
  │ CTO Agent  │     │ CFO Agent   │     │ COO Agent   │
  │ (技术管理)  │     │ (财务管理)  │     │ (运营管理)  │
  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
         │                   │                   │
    ┌────┴────┐         ┌────┴────┐         ┌────┴────┐
    │         │         │         │         │         │
    ▼         ▼         ▼         ▼         ▼         ▼
 Dev  QA  Security   Reports  Budget  Payroll 物流  客服
```

### 5.2 层级通讯规则

```yaml
# hierarchical_config.yaml
hierarchy:
  levels:
    - level: 3
      name: Executive
      agents: [ceo-agent]
      can_oversee: [level_2, level_1]
      escalation_target: null

    - level: 2
      name: Department Head
      agents: [cto-agent, cfo-agent, coo-agent]
      can_oversee: [level_1]
      escalation_target: ceo-agent

    - level: 1
      name: Individual Contributor
      agents: [*]
      can_oversee: null
      escalation_target: department-head

communication_rules:
  # 下行：上级可以调度下级
  top_down:
    enabled: true
    require_approval: false

  # 上行：下级汇报上级
  bottom_up:
    enabled: true
    auto_escalate_risk: true

  # 平行：同级 Agent 协作
  peer_to_peer:
    enabled: true
    require_approval: true
```

---

## 6. Agent 间通讯协议

### 6.1 消息格式

```typescript
interface AgentMessage {
  id: string;
  type: 'task_request' | 'task_response' | 'event' | 'query';
  from: string;           // 发送方 Agent ID
  to: string;             // 接收方 Agent ID
  session_id: string;     // 关联的会话
  payload: unknown;
  metadata: {
    priority: 'low' | 'normal' | 'high' | 'urgent';
    correlation_id?: string;
    deadline?: string;
    requires_ack?: boolean;
  };
  signature: string;       // ECDSA 签名
  timestamp: string;
}
```

### 6.2 请求/响应模式

```javascript
// Agent A 请求 Agent B
const response = await agentNetwork.request({
  to: 'data-analysis-agent',
  type: 'task_request',
  payload: {
    action: 'analyze',
    data_source: 'sales_2026_q1',
    metrics: ['revenue', 'growth_rate', 'customer_count']
  },
  timeout: 60000  // 60秒超时
});

console.log(response.payload);  // { analysis: {...}, insights: [...] }
```

### 6.3 错误处理

```javascript
// 处理 Agent 间调用错误
try {
  const result = await agentNetwork.request({
    to: 'external-agent',
    timeout: 30000
  });
} catch (error) {
  switch (error.code) {
    case 'AGENT_OFFLINE':
      // Agent 不在线，尝试其他方案
      await tryBackupAgent();
      break;
    case 'AGENT_TIMEOUT':
      // Agent 响应超时，重试或上报
      await retryWithBackoff();
      break;
    case 'TRUST_SCORE_TOO_LOW':
      // Agent 信任分数过低，拒绝调用
      throw new Error(`Agent ${error.agentId} 信任分数不足`);
      break;
  }
}
```

---

## 7. 跨租户协作

### 7.1 安全模型

```
Tenant A                              Tenant B
┌─────────┐                           ┌─────────┐
│ Agent A │                           │ Agent B │
└────┬────┘                           └────┬────┘
     │  mTLS + JWT                      │
     │  跨租户认证                       │
     └──────────────────────────────────┘
              Gateway（验证）
```

### 7.2 信任级别

| 信任级别 | 说明 | 可执行操作 |
|----------|------|-----------|
| `VERIFIED` | 已验证身份 | 所有操作 |
| `TRUSTED` | 良好历史 | 普通任务 |
| `UNKNOWN` | 新加入 | 受限操作 |
| `RESTRICTED` | 有限制 | 只读操作 |

---

## 8. 协作监控

```javascript
// 查看协作网络状态
const status = await client.getNetworkStatus();

// 输出示例
{
  agents_online: 5,
  agents_busy: 2,
  pending_tasks: 12,
  active_collaborations: 3,
  events_per_second: 45.6,
  average_response_time_ms: 234
}

// 查看特定协作详情
const collaboration = await client.getCollaboration(collaborationId);
{
  id: 'collab_001',
  type: 'orchestration',
  coordinator: 'project-manager-bot',
  participants: ['researcher', 'developer'],
  status: 'running',
  progress: { completed_steps: 3, total_steps: 5 },
  started_at: '2026-04-02T10:00:00Z'
}
```
