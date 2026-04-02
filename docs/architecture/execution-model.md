# 执行模型

**版本**: V3.0  
**文档层级**: L2

---

## 1. 执行模型概述

AgentNet 执行模型基于 **DAG（有向无环图）驱动的任务编排**，结合 **事件驱动的状态机**，确保任务执行可追踪、可重试、可解释。

---

## 2. 核心组件

```
┌─────────────────────────────────────────────────────────────┐
│                    Task Engine                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              DAG Scheduler                             │  │
│  │  1. 解析 DAG 定义                                      │  │
│  │  2. 拓扑排序确定执行顺序                                │  │
│  │  3. 并行调度无依赖步骤                                  │  │
│  │  4. 处理步骤间数据传递                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Step Executor                               │  │
│  │  1. 调用 Capability                                  │  │
│  │  2. 捕获执行结果/错误                                   │  │
│  │  3. 应用重试策略                                       │  │
│  │  4. 触发后续步骤                                       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│  State Store  │ │Capability Hub │ │ Event Emitter │
└───────────────┘ └───────────────┘ └───────────────┘
```

---

## 3. DAG 执行流程

### 3.1 DAG 定义

```javascript
const dag = {
  steps: [
    { id: 'search', action: 'product.search', depends_on: [] },
    { id: 'filter', action: 'product.filter', depends_on: ['search'] },
    { id: 'rank', action: 'product.rank', depends_on: ['filter'] },
    { id: 'decide', action: 'decision.make', depends_on: ['rank'] }
  ]
};
```

### 3.2 拓扑排序

```javascript
// Kahn 算法实现拓扑排序
function topologicalSort(steps) {
  const inDegree = new Map();
  const adjacency = new Map();

  // 初始化
  steps.forEach(step => {
    inDegree.set(step.id, 0);
    adjacency.set(step.id, []);
  });

  // 构建图
  steps.forEach(step => {
    (step.depends_on || []).forEach(dep => {
      adjacency.get(dep).push(step.id);
      inDegree.set(step.id, inDegree.get(step.id) + 1);
    });
  });

  // BFS
  const queue = [];
  const result = [];

  inDegree.forEach((degree, id) => {
    if (degree === 0) queue.push(id);
  });

  while (queue.length > 0) {
    const current = queue.shift();
    result.push(current);

    adjacency.get(current).forEach(next => {
      inDegree.set(next, inDegree.get(next) - 1);
      if (inDegree.get(next) === 0) {
        queue.push(next);
      }
    });
  }

  // 检测循环依赖
  if (result.length !== steps.length) {
    throw new Error('DAG 存在循环依赖');
  }

  return result;
}

// 结果: ['search', 'filter', 'rank', 'decide']
```

### 3.3 并行执行优化

```javascript
// 识别可并行执行的步骤
function identifyParallelGroups(sortedSteps, dag) {
  const groups = [];
  const completed = new Set();

  while (sortedSteps.length > 0) {
    const group = [];

    // 找所有依赖都已完成的步骤
    for (const stepId of sortedSteps) {
      const step = dag.steps.find(s => s.id === stepId);
      const deps = step.depends_on || [];

      if (deps.every(dep => completed.has(dep))) {
        group.push(stepId);
      }
    }

    if (group.length === 0 && sortedSteps.length > 0) {
      throw new Error('无法并行化，可能是循环依赖');
    }

    groups.push(group);
    group.forEach(id => {
      completed.add(id);
      const idx = sortedSteps.indexOf(id);
      sortedSteps.splice(idx, 1);
    });
  }

  return groups;
}

// 示例: [['step_a', 'step_b'], ['step_c'], ['step_d']]
// 含义: step_a 和 step_b 可并行，完后执行 step_c，最后 step_d
```

---

## 4. 步骤执行器

### 4.1 执行流程

```javascript
class StepExecutor {
  async execute(step, context) {
    const { id, action, retry_policy, timeout_ms } = step;

    // 1. 创建执行超时
    const timeout = timeout_ms || 30000;
    const startTime = Date.now();

    // 2. 执行带重试
    let lastError;
    const maxRetries = retry_policy?.max_retries || 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // 调用 Capability
        const result = await this.capabilityHub.call({
          capability: action,
          input: context.input,
          timeout
        });

        return {
          status: 'success',
          step_id: id,
          output: result,
          duration_ms: Date.now() - startTime,
          attempt: attempt + 1
        };

      } catch (error) {
        lastError = error;

        // 检查是否应该重试
        if (!this.shouldRetry(error, retry_policy)) {
          break;
        }

        if (attempt < maxRetries) {
          // 指数退避等待
          const backoff = this.calculateBackoff(attempt, retry_policy);
          await this.sleep(backoff);
        }
      }
    }

    // 所有重试都失败
    return {
      status: 'failed',
      step_id: id,
      error: lastError.message,
      attempt: maxRetries + 1,
      duration_ms: Date.now() - startTime
    };
  }

  shouldRetry(error, policy) {
    const noRetryOn = policy?.do_not_retry_on || [];
    const retryOn = policy?.retry_on || ['TIMEOUT', 'RATE_LIMIT', 'NETWORK_ERROR'];

    if (noRetryOn.includes(error.code)) return false;
    if (retryOn.includes(error.code)) return true;

    return false;
  }

  calculateBackoff(attempt, policy) {
    const initial = policy?.backoff_ms || 1000;
    const max = policy?.max_backoff_ms || 30000;

    // 指数退避 + 随机抖动
    const exponential = Math.min(initial * Math.pow(2, attempt), max);
    const jitter = exponential * (0.9 + Math.random() * 0.2);

    return jitter;
  }
}
```

### 4.2 步骤间数据传递

```javascript
// 步骤输出作为后续步骤输入
const stepResults = {};

async function executeDag(dag, initialInput) {
  const sortedSteps = topologicalSort(dag.steps);
  const parallelGroups = identifyParallelGroups([...sortedSteps], dag);

  for (const group of parallelGroups) {
    // 并行执行组内步骤
    const groupResults = await Promise.all(
      group.map(stepId => executeStep(stepId, stepResults))
    );

    // 收集结果
    groupResults.forEach(result => {
      stepResults[result.step_id] = result.output;
    });
  }

  return stepResults;
}

// 示例: filter 步骤接收 search 的输出
async function executeStep(stepId, previousResults) {
  const step = dag.steps.find(s => s.id === stepId);
  const context = { input: initialInput };

  // 合并所有依赖步骤的输出
  (step.depends_on || []).forEach(depId => {
    context[depId] = stepResults[depId];
  });

  return executor.execute(step, context);
}
```

---

## 5. 状态机

### 5.1 状态转换

```
┌──────────────────────────────────────────────────────────┐
│                    Task 状态机                            │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐    调度        ┌──────────┐              │
│  │ pending  │ ──────────────→│ running  │              │
│  └──────────┘                └────┬─────┘              │
│       │                              │                    │
│   取消 │                              │ 完成              │
│       │                              ▼                    │
│       │                         ┌──────────┐              │
│       └─────────────────────────→│ completed│              │
│           取消                   └──────────┘              │
│                                                          │
│  ┌──────────┐    错误/重试耗尽   ┌──────────┐           │
│  │ running  │ ──────────────────→│  failed  │           │
│  └──────────┘                    └──────────┘           │
│                                        │                   │
│                                    重试                   │
│                                        │                   │
│                                        ▼                   │
│                                  ┌──────────┐              │
│                                  │ running  │              │
│                                  └──────────┘              │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 5.2 状态持久化

```javascript
// 状态存储事件
{
  "task_id": "task_xxx",
  "from_state": "running",
  "to_state": "completed",
  "triggered_by": "step_decide",
  "timestamp": "2026-04-02T10:00:05Z",
  "metadata": {
    "duration_ms": 5000,
    "steps_completed": 4,
    "output": { "result": "..." }
  }
}
```

---

## 6. 事件模型

### 6.1 事件发布

```javascript
// Task Engine 事件
eventEmitter.emit('task.created', { taskId, input, createdAt });
eventEmitter.emit('task.started', { taskId, startedAt });
eventEmitter.emit('task.step_started', { taskId, stepId });
eventEmitter.emit('task.step_completed', { taskId, stepId, result, durationMs });
eventEmitter.emit('task.progress', { taskId, progress, message });
eventEmitter.emit('task.completed', { taskId, output, totalDurationMs });
eventEmitter.emit('task.failed', { taskId, error, failedStepId, retryCount });
eventEmitter.emit('task.cancelled', { taskId, reason, cancelledBy });
```

### 6.2 事件订阅

```javascript
// WebSocket 实时推送
client.subscribe(`task:${taskId}`, (event) => {
  console.log(`[${event.type}]`, event.payload);
});

// HTTP 长轮询
const events = await client.getTaskEvents(taskId, {
  since: '2026-04-02T09:00:00Z',
  types: ['task.completed', 'task.failed']
});
```

---

## 7. 性能优化

### 7.1 连接池

```javascript
// Capability Hub 连接池
const pool = {
  min: 5,
  max: 50,
  acquireTimeout: 5000,
  idleTimeout: 60000
};
```

### 7.2 批量处理

```javascript
// 多个独立任务批量调度
const batch = await scheduler.scheduleBatch(tasks, {
  maxConcurrency: 10,
  strategy: 'priority'  // 按优先级排序
});
```

---

## 8. 错误处理策略

| 错误类型 | 处理策略 | 影响范围 |
|----------|----------|----------|
| `TIMEOUT` | 重试（指数退避） | 当前步骤 |
| `RATE_LIMIT` | 等待后重试 | 当前步骤 |
| `INVALID_INPUT` | 记录错误，终止 | 整任务 |
| `CAPABILITY_UNAVAILABLE` | 切换备用 Capability | 当前步骤 |
| `SYSTEM_ERROR` | 记录错误，终止 | 整任务 |
