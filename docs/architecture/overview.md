# 架构总览

**版本**: V3.0  
**文档层级**: L1

---

## 1. 架构设计原则

| 原则 | 说明 |
|------|------|
| **无状态传输** | Transport Layer 不保存业务状态 |
| **有状态执行** | Execution Layer 保证任务可追踪 |
| **能力驱动编排** | Capability 作为最小执行单元 |
| **人机协同** | Decision Layer 确保人类始终掌控 |
| **多 Agent 原生** | Network Layer 支持大规模协作 |

---

## 2. 七层模型

```
┌──────────────────────────────────────────────────────────────┐
│                    AgentNet Protocol V3                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  L7. Application Layer（应用层）                        │ │
│  │  Agent 应用、UI、CLI、SDK                               │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  L6. Capability Layer（能力层）⭐                       │ │
│  │  Tool Registry / Execution Sandbox / Marketplace        │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  L5. Decision Layer（决策层）⭐                         │ │
│  │  Decision Engine / Risk Rules / Human-in-the-loop      │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  L4. Execution Layer（执行层）⭐                       │ │
│  │  Task Engine / DAG Scheduler / State Machine           │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  L3. Network Layer（网络层）                           │ │
│  │  Agent Registry / Trust Graph / P2P Communication       │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  L2. Transport Layer（传输层）                         │ │
│  │  WebSocket / HTTP / Message Envelope / mTLS             │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  L1. Security Layer（安全层）                          │ │
│  │  Authentication / Authorization / Encryption / Audit    │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. 核心组件关系

```
┌─────────────┐
│   Client    │  ← 用户界面 / CLI / SDK
└──────┬──────┘
       │ HTTPS / WSS
       ▼
┌──────────────────────────────────────────┐
│              Gateway Layer               │
│  ┌──────────────┐    ┌─────────────────┐  │
│  │ REST Gateway │    │ WS Gateway     │  │
│  └──────────────┘    └─────────────────┘  │
│         │                  │              │
│         └────────┬─────────┘              │
│                  ▼                        │
│         ┌──────────────────┐              │
│         │  Message Router   │              │
│         └────────┬─────────┘              │
└──────────────────┼───────────────────────┘
                   │
┌──────────────────┼───────────────────────┐
│          Runtime Layer                    │
│                                          │
│  ┌─────────────────┐  ┌────────────────┐  │
│  │   Task Engine   │  │Decision Engine │  │
│  └────────┬────────┘  └───────┬────────┘  │
│           │                   │           │
│  ┌────────▼───────────────────▼────────┐  │
│  │         DAG Scheduler              │  │
│  └────────┬───────────────────┬────────┘  │
│           │                   │           │
│  ┌────────▼────────┐ ┌────────▼────────┐   │
│  │  State Manager  │ │  Capability Hub │   │
│  └─────────────────┘ └────────────────┘   │
└──────────────────────────────────────────┘
```

---

## 4. 各层职责

### L1. Security Layer（安全层）

- **身份认证**：JWT / DID 验证
- **权限控制**：Tenant 隔离、API Key 分级、Scope 权限
- **传输加密**：TLS / mTLS、端到端加密
- **审计日志**：完整操作记录

### L2. Transport Layer（传输层）

- **协议适配**：WebSocket 长连接 / HTTP REST
- **消息信封**：统一 Envelope 格式、签名验签
- **路由分发**：消息路由、负载均衡
- **压缩序列化**：JSON / MessagePack / gzip / zstd

### L3. Network Layer（网络层）

- **Agent 注册**：身份注册与发现
- **信任图谱**：Trust Score 计算与传播
- **P2P 通讯**：Agent 间直接通讯
- **经济系统**：Token 支付与结算

### L4. Execution Layer（执行层）⭐

- **Task Engine**：任务生命周期管理
- **DAG Scheduler**：工作流拓扑排序与调度
- **State Machine**：任务状态转换
- **重试机制**：指数退避、错误处理

### L5. Decision Layer（决策层）⭐

- **Decision Engine**：风险评估与决策生成
- **Risk Rules**：风险规则引擎
- **Human-in-the-loop**：决策确认与审批
- **可解释性**：Reasoning 生成

### L6. Capability Layer（能力层）⭐

- **Tool Registry**：能力注册与管理
- **Execution Sandbox**：安全沙箱执行
- **Marketplace**：能力发布与交易
- **定价引擎**：按次/月/订阅计费

### L7. Application Layer（应用层）

- **Web UI**：用户交互界面
- **SDK**：Node.js / Python 官方 SDK
- **CLI**：命令行工具
- **示例 Agents**：电商/编程/研究示例

---

## 5. 数据流

### 5.1 任务执行数据流

```
1. Client → Gateway: 创建 Task (HTTPS POST)
2. Gateway → Task Engine: 提交任务
3. Task Engine → State Manager: 保存状态 (pending)
4. Task Engine → DAG Scheduler: 解析 DAG
5. DAG Scheduler → Capability Hub: 调用 Capability
6. Capability Hub → Sandbox: 执行能力
7. Sandbox → Task Engine: 返回结果
8. Task Engine → Decision Engine: 生成决策（如需要）
9. Task Engine → State Manager: 更新状态 (completed)
10. Gateway → Client: 推送事件 (WebSocket)
```

### 5.2 决策确认数据流

```
1. Decision Engine → Gateway: 推送 Decision Card
2. Gateway → Client: 显示决策 UI
3. Client → Gateway: 用户确认决策
4. Gateway → Task Engine: 继续执行
5. Task Engine → Client: 任务完成
```

---

## 6. 部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Load Balancer                          │
│                   (Nginx / HAProxy)                         │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  Gateway #1   │   │  Gateway #2   │   │  Gateway #3   │
│  (Node.js)    │   │  (Node.js)    │   │  (Node.js)    │
└───────┬───────┘   └───────┬───────┘   └───────┬───────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │           Message Queue                  │
        │         (Redis Pub/Sub)                 │
        └───────────────────┼───────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ Runtime #1    │   │ Runtime #2    │   │ Runtime #3    │
│ Task Engine   │   │ Task Engine   │   │ Task Engine   │
│ Decision Eng. │   │ Decision Eng. │   │ Decision Eng. │
└───────────────┘   └───────────────┘   └───────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │       State Store         │
              │  (Redis + PostgreSQL)    │
              └───────────────────────────┘
```

---

## 7. 关键设计决策

### Q: 为什么选择有状态执行？

**A**: 任务执行需要跨多个步骤、中间状态、错误恢复，有状态模型确保：
- 可追踪：每个步骤都有记录
- 可恢复：失败后可从断点继续
- 可重试：失败步骤可按策略重试

### Q: 为什么分离 Decision Layer？

**A**: 决策是人机交互的关键节点，分离出来可以：
- 统一 Decision Card UI 规范
- 标准化风险评估流程
- 支持跨 Agent 的决策共享

### Q: 为什么 Capability 抽象重要？

**A**: Capability 是比 Tool 更高层的抽象：
- Interface vs Implementation：接口标准化
- Discoverable：可注册发现
- Monetizable：可定价收费
- Composable：可组合使用
