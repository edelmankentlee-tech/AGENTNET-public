# 状态机定义

**版本**: V3.0  
**文档层级**: L2（公开接口，不含实现）

---

## 1. 概述

状态机定义了 AgentNet Protocol V3 中所有核心实体（Task、Decision、Capability Call）的生命周期状态与转换规则。

---

## 2. Task 状态机

### 2.1 状态定义

```typescript
// Task 状态枚举
enum TaskState {
  PENDING    = 'pending',    // 等待调度
  RUNNING    = 'running',    // 执行中
  COMPLETED  = 'completed',  // 已完成
  FAILED     = 'failed',     // 失败（可重试）
  CANCELLED  = 'cancelled'   // 已取消
}
```

### 2.2 状态转换表

| 当前状态 | 目标状态 | 触发事件 | 条件 |
|----------|----------|----------|------|
| `pending` | `running` | `TASK_DISPATCHED` | Scheduler 分配执行器 |
| `pending` | `cancelled` | `TASK_CANCELLED` | 用户/系统取消 |
| `running` | `completed` | `TASK_STEPS_COMPLETED` | 所有 DAG 步骤完成 |
| `running` | `failed` | `TASK_EXECUTION_FAILED` | 执行出错且重试耗尽 |
| `running` | `cancelled` | `TASK_CANCELLED` | 用户/系统取消 |
| `failed` | `running` | `TASK_RETRY` | 触发重试 |
| `failed` | `cancelled` | `TASK_CANCELLED` | 用户取消重试 |

### 2.3 状态事件

```typescript
interface TaskStateTransition {
  task_id: string;
  from_state: TaskState;
  to_state: TaskState;
  event: string;
  timestamp: string;       // ISO8601
  triggered_by: string;    // user/system/agent_id
  reason?: string;
  metadata?: Record<string, unknown>;
}
```

---

## 3. Decision 状态机

### 3.1 状态定义

```typescript
// Decision 状态枚举
enum DecisionState {
  PENDING     = 'pending',     // 等待用户响应
  CONFIRMED   = 'confirmed',   // 用户确认
  REJECTED    = 'rejected',    // 用户拒绝
  EXPIRED     = 'expired',     // 超时
  ESCALATED   = 'escalated'    // 上报人工
}
```

### 3.2 状态转换表

| 当前状态 | 目标状态 | 触发事件 | 条件 |
|----------|----------|----------|------|
| `pending` | `confirmed` | `DECISION_CONFIRMED` | 用户选择选项 |
| `pending` | `rejected` | `DECISION_REJECTED` | 用户拒绝 |
| `pending` | `expired` | `DECISION_TIMEOUT` | 超过 TTL |
| `pending` | `escalated` | `DECISION_ESCALATED` | 用户上报 |
| `*` | `*` | - | 终态不可转换 |

### 3.3 超时动作

| 配置值 | 说明 |
|--------|------|
| `auto_cancel` | 自动取消决策 |
| `auto_select_first` | 自动选第一项 |
| `notify_user` | 通知用户后取消 |
| `escalate` | 转交人工 |

---

## 4. Capability Call 状态机

### 4.1 状态定义

```typescript
enum CapabilityCallState {
  PENDING    = 'pending',    // 等待执行
  RUNNING    = 'running',    // 执行中
  SUCCESS    = 'success',   // 执行成功
  FAILED     = 'failed',     // 执行失败
  RATE_LIMITED = 'rate_limited'  // 触发限流
}
```

### 4.2 状态转换表

| 当前状态 | 目标状态 | 触发事件 |
|----------|----------|----------|
| `pending` | `running` | 开始执行 |
| `running` | `success` | 执行成功返回 |
| `running` | `failed` | 执行出错 |
| `running` | `rate_limited` | 触发限流 |
| `rate_limited` | `pending` | 等待期结束 |

---

## 5. Agent 状态机

### 5.1 状态定义

```typescript
enum AgentState {
  OFFLINE    = 'offline',   // 未连接
  ONLINE     = 'online',    // 已连接空闲
  BUSY       = 'busy',      // 处理任务中
  DRAINING   = 'draining',  // 优雅关闭
  SUSPENDED  = 'suspended'  // 被暂停
}
```

### 5.2 状态转换表

| 当前状态 | 目标状态 | 触发事件 |
|----------|----------|----------|
| `offline` | `online` | 建立连接 |
| `online` | `busy` | 接收任务 |
| `online` | `draining` | 触发优雅关闭 |
| `online` | `suspended` | 被管理员暂停 |
| `busy` | `online` | 任务完成 |
| `busy` | `draining` | 触发优雅关闭 |
| `draining` | `offline` | 所有任务完成 |
| `suspended` | `online` | 管理员解除暂停 |

---

## 6. 状态转换历史

### 6.1 记录格式

```json
{
  "transitions": [
    {
      "id": "trans_001",
      "entity_type": "task",
      "entity_id": "task_xxx",
      "from_state": "pending",
      "to_state": "running",
      "event": "TASK_DISPATCHED",
      "timestamp": "2026-04-02T10:00:00Z",
      "triggered_by": "scheduler"
    },
    {
      "id": "trans_002",
      "entity_type": "task",
      "entity_id": "task_xxx",
      "from_state": "running",
      "to_state": "completed",
      "event": "TASK_STEPS_COMPLETED",
      "timestamp": "2026-04-02T10:00:05Z",
      "triggered_by": "task_engine"
    }
  ]
}
```

### 6.2 查询 API

```
GET /api/v3/tasks/{task_id}/transitions
GET /api/v3/decisions/{decision_id}/transitions
GET /api/v3/capabilities/calls/{call_id}/transitions
```

---

## 7. 状态验证规则

### 7.1 有效转换验证

```typescript
// 伪代码：状态转换验证
function validateTransition(entityType, fromState, toState, event) {
  const validTransitions = {
    task: {
      pending: { running: ['TASK_DISPATCHED'], cancelled: ['TASK_CANCELLED'] },
      running: {
        completed: ['TASK_STEPS_COMPLETED'],
        failed: ['TASK_EXECUTION_FAILED', 'TASK_MAX_RETRIES_EXCEEDED'],
        cancelled: ['TASK_CANCELLED']
      },
      failed: { running: ['TASK_RETRY'], cancelled: ['TASK_CANCELLED'] },
      completed: {},  // 终态
      cancelled: {}    // 终态
    },
    decision: {
      pending: {
        confirmed: ['DECISION_CONFIRMED'],
        rejected: ['DECISION_REJECTED'],
        expired: ['DECISION_TIMEOUT'],
        escalated: ['DECISION_ESCALATED']
      },
      // 终态
      confirmed: {},
      rejected: {},
      expired: {},
      escalated: {}
    }
  };

  const transitions = validTransitions[entityType]?.[fromState];
  if (!transitions || !transitions[toState]?.includes(event)) {
    throw new InvalidTransitionError(entityType, fromState, toState, event);
  }

  return true;
}
```

### 7.2 不变量约束

| 实体 | 不变量 |
|------|--------|
| Task | `completed` / `failed` / `cancelled` 为终态 |
| Decision | 所有状态为终态，不可再转换 |
| Capability Call | 终态为 `success` / `failed` |
| Agent | `offline` 时不可接收任务 |
