# Task Protocol（任务协议）

**版本**: V3.0  
**状态**: 正式发布

---

## 1. 概述

Task Protocol 是 AgentNet Protocol V3 的核心执行层协议，定义了标准的任务生命周期、DAG 工作流编排语法、重试策略和事件模型。

> **核心原则**：有状态执行（Stateful Execution），确保任务可追踪、可恢复、可重试。

---

## 2. 任务生命周期

### 2.1 状态定义

```
                    ┌──────────┐
                    │ pending  │  ← 任务创建，进入等待队列
                    └────┬─────┘
                         │
                    ┌────▼─────┐
              ┌─────│ running  │─────┐  ← 任务正在执行
              │     └────┬─────┘     │
              │          │          │
        ┌─────▼────┐      │    ┌─────▼─────┐
        │completed │      │    │  failed   │
        └──────────┘      │    └──────┬─────┘
                          │           │
                    ┌─────▼───────────▼─────┐
                    │       cancelled        │  ← 任务被取消
                    └───────────────────────┘
```

| 状态 | 说明 | 是否终态 |
|------|------|---------|
| `pending` | 任务已创建，等待调度 | ❌ |
| `running` | 任务正在执行中 | ❌ |
| `completed` | 任务成功完成 | ✅ |
| `failed` | 任务执行失败（可重试） | ✅ |
| `cancelled` | 任务被用户/系统取消 | ✅ |

### 2.2 状态转换规则

| 当前状态 | 目标状态 | 触发条件 |
|----------|----------|----------|
| pending | running | Scheduler 调度分配 |
| running | completed | 所有步骤执行成功 |
| running | failed | 执行出错且重试耗尽 |
| running | cancelled | 用户主动取消 |
| pending | cancelled | 用户提前取消 |
| failed | running | 触发重试 |

---

## 3. Task 数据结构

```json
{
  "task_id": "task_550e8400-e29b-41d4-a716-446655440000",
  "type": "shopping",
  "status": "running",
  "input": {
    "query": "买一台3000元以内的编程电脑",
    "preferences": {
      "priority": "cost_performance",
      "brand": "any"
    }
  },
  "context": {
    "user_id": "user_abc123",
    "session_id": "session_xyz789",
    "preferences": {}
  },
  "orchestration": {
    "dag": [
      {
        "step_id": "step_search",
        "action": "product.search",
        "depends_on": [],
        "retry_policy": {
          "max_retries": 3,
          "backoff_ms": 1000
        }
      },
      {
        "step_id": "step_filter",
        "action": "product.filter",
        "depends_on": ["step_search"]
      },
      {
        "step_id": "step_rank",
        "action": "product.rank",
        "depends_on": ["step_filter"]
      },
      {
        "step_id": "step_decide",
        "action": "decision.make",
        "depends_on": ["step_rank"]
      }
    ]
  },
  "metadata": {
    "created_at": "2026-04-02T10:00:00Z",
    "updated_at": "2026-04-02T10:00:05Z",
    "priority": "normal",
    "timeout_ms": 30000,
    "assigned_agent": "agent_shopping_v2",
    "retry_count": 0,
    "max_retries": 3
  }
}
```

---

## 4. DAG 工作流编排

### 4.1 基本语法

```yaml
orchestration:
  dag:
    - step_id: <唯一步骤ID>
      action: <Capability ID>
      depends_on: [<前置步骤ID列表>]
      retry_policy:
        max_retries: <最大重试次数>
        backoff_ms: <退避毫秒数>
      timeout_ms: <步骤超时>
```

### 4.2 DAG 示例

```yaml
task:
  id: "task_shopping_001"
  type: "shopping"

orchestration:
  dag:
    # 第1步：搜索商品（无依赖）
    - step_id: search
      action: product.search
      retry_policy:
        max_retries: 3
        backoff_ms: 1000

    # 第2步：筛选商品（依赖搜索）
    - step_id: filter
      action: product.filter
      depends_on: [search]

    # 第3步：排序商品（依赖筛选）
    - step_id: rank
      action: product.rank
      depends_on: [filter]

    # 第4步：生成决策（依赖排序）
    - step_id: decide
      action: decision.make
      depends_on: [rank]
```

### 4.3 DAG 执行规则

1. **并行执行**：没有依赖关系的步骤可以并行执行
2. **拓扑排序**：按依赖关系拓扑排序确定执行顺序
3. **依赖检查**：循环依赖检测，检测到则拒绝任务
4. **失败传播**：某步骤失败，后续依赖该步骤的任务不会执行

---

## 5. 重试策略

### 5.1 指数退避算法

```javascript
// 重试间隔计算
const backoff = Math.min(
  initialBackoff * Math.pow(2, retryCount),
  maxBackoff
);
// 添加随机抖动 ±10%
const jitter = backoff * (0.9 + Math.random() * 0.2);
```

### 5.2 重试策略配置

```json
{
  "retry_policy": {
    "max_retries": 3,
    "backoff_ms": 1000,
    "max_backoff_ms": 30000,
    "retry_on": ["TIMEOUT", "RATE_LIMIT", "NETWORK_ERROR"],
    "do_not_retry_on": ["INVALID_INPUT", "UNAUTHORIZED"]
  }
}
```

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `max_retries` | 最大重试次数 | 3 |
| `backoff_ms` | 初始退避毫秒数 | 1000 |
| `max_backoff_ms` | 最大退避毫秒数 | 30000 |

---

## 6. 事件模型

### 6.1 事件类型

| 事件类型 | 触发时机 | Payload |
|----------|----------|---------|
| `task.created` | 任务创建 | 完整 Task 对象 |
| `task.started` | 任务开始执行 | `{ task_id, started_at }` |
| `task.step_started` | DAG 步骤开始 | `{ task_id, step_id }` |
| `task.step_completed` | DAG 步骤完成 | `{ task_id, step_id, result }` |
| `task.progress` | 进度更新 | `{ task_id, progress_percent, message }` |
| `task.completed` | 任务完成 | `{ task_id, output, duration_ms }` |
| `task.failed` | 任务失败 | `{ task_id, error, retry_count }` |
| `task.cancelled` | 任务取消 | `{ task_id, reason, cancelled_by }` |

### 6.2 事件订阅

```javascript
// 订阅任务事件
client.onTaskEvent(task.id, (event) => {
  console.log(`[${event.type}]`, event.payload);

  if (event.type === 'task.completed') {
    console.log('任务完成，耗时:', event.payload.duration_ms);
  }
});

// 仅订阅特定事件
client.onTaskEvent(task.id, (event) => {
  if (event.type === 'task.failed') {
    console.error('任务失败:', event.payload.error);
  }
}, { filter: ['task.failed', 'task.completed'] });
```

---

## 7. REST API 端点

| 方法 | 端点 | 说明 |
|------|------|------|
| `POST` | `/api/v3/tasks` | 创建任务 |
| `GET` | `/api/v3/tasks/{task_id}` | 获取任务详情 |
| `GET` | `/api/v3/tasks` | 列出任务（支持过滤） |
| `POST` | `/api/v3/tasks/{task_id}/cancel` | 取消任务 |
| `POST` | `/api/v3/tasks/{task_id}/retry` | 重试失败任务 |
| `GET` | `/api/v3/tasks/{task_id}/transitions` | 获取状态转换历史 |

---

## 8. 错误码

| 错误码 | 说明 |
|--------|------|
| `TASK_NOT_FOUND` | 任务不存在 |
| `TASK_ALREADY_COMPLETED` | 任务已完成，无法取消/重试 |
| `TASK_MAX_RETRIES_EXCEEDED` | 超过最大重试次数 |
| `TASK_CIRCULAR_DEPENDENCY` | DAG 存在循环依赖 |
| `TASK_TIMEOUT` | 任务执行超时 |
| `TASK_UNAUTHORIZED` | 无权访问该任务 |
