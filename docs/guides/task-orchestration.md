# 任务编排进阶

**版本**: V3.0  
**预计时间**: 15 分钟

---

## 1. 概述

本指南介绍如何使用 AgentNet Protocol V3 的高级任务编排功能，包括 DAG 工作流设计、多 Agent 协作配置、错误处理与重试、以及性能优化。

---

## 2. DAG 工作流设计

### 2.1 简单线性流程

```yaml
# workflow_simple.yaml
task:
  type: data_processing

orchestration:
  dag:
    - step_id: fetch_data
      action: data.fetch
      depends_on: []

    - step_id: transform_data
      action: data.transform
      depends_on: [fetch_data]

    - step_id: save_result
      action: data.save
      depends_on: [transform_data]
```

### 2.2 并行分支

```yaml
# workflow_parallel.yaml
task:
  type: multi_source_analysis

orchestration:
  dag:
    # 并行获取多个数据源
    - step_id: fetch_web
      action: web.fetch
      depends_on: []

    - step_id: fetch_db
      action: database.query
      depends_on: []

    - step_id: fetch_api
      action: api.call
      depends_on: []

    # 合并结果
    - step_id: merge_data
      action: data.merge
      depends_on: [fetch_web, fetch_db, fetch_api]

    - step_id: analyze
      action: data.analyze
      depends_on: [merge_data]
```

### 2.3 条件分支

```yaml
# workflow_conditional.yaml
task:
  type: intelligent_routing

orchestration:
  dag:
    - step_id: classify
      action: intent.classify
      depends_on: []

    # 条件路由
    - step_id: route_to_shopping
      action: shopping.search
      depends_on: [classify]
      condition:
        variable: classify.intent
        equals: shopping

    - step_id: route_to_search
      action: web.search
      depends_on: [classify]
      condition:
        variable: classify.intent
        equals: search

    - step_id: route_to_help
      action: help.respond
      depends_on: [classify]
      condition:
        variable: classify.intent
        equals: help

    # 汇聚点
    - step_id: format_response
      action: response.format
      depends_on: [route_to_shopping, route_to_search, route_to_help]
```

### 2.4 循环执行

```yaml
# workflow_loop.yaml
task:
  type: batch_processing

orchestration:
  dag:
    - step_id: get_batch
      action: queue.pop
      max_retries: 3
      depends_on: []

    - step_id: process_item
      action: item.process
      depends_on: [get_batch]

    # 循环判断
    - step_id: check_more
      action: queue.is_empty
      depends_on: [process_item]

    - step_id: continue_loop
      action: queue.pop
      depends_on: [check_more]
      condition:
        variable: check_more.has_more
        equals: true

    - step_id: finish
      action: batch.complete
      depends_on: [check_more]
      condition:
        variable: check_more.has_more
        equals: false
```

---

## 3. 多 Agent 协作配置

### 3.1 定义协作任务

```javascript
// Node.js
const collaborationTask = await client.createTask({
  type: 'multi_agent_collaboration',
  input: {
    project: 'Q1 市场分析报告',
    deadline: '2026-04-15'
  },
  orchestration: {
    coordinator: 'project-manager-agent',
    agents: [
      {
        role: 'researcher',
        agent_id: 'market-research-agent',
        capabilities: ['data.search', 'report.generation'],
        max_concurrent: 2
      },
      {
        role: 'analyst',
        agent_id: 'data-analysis-agent',
        capabilities: ['statistics.analyze', 'chart.generate'],
        max_concurrent: 1
      },
      {
        role: 'reviewer',
        agent_id: 'quality-review-agent',
        capabilities: ['content.review', 'grammar.check'],
        max_concurrent: 1
      }
    ],
    workflow: {
      phases: [
        {
          name: 'research',
          parallel: true,
          agents: ['researcher'],
          steps: [
            { action: 'data.search_market_trends', assignee: 'researcher' },
            { action: 'data.search_competitors', assignee: 'researcher' }
          ]
        },
        {
          name: 'analysis',
          parallel: false,
          agents: ['analyst'],
          depends_on: ['research'],
          steps: [
            { action: 'statistics.analyze_data', assignee: 'analyst' },
            { action: 'chart.generate_charts', assignee: 'analyst' }
          ]
        },
        {
          name: 'review',
          parallel: false,
          agents: ['reviewer'],
          depends_on: ['analysis'],
          steps: [
            { action: 'content.review_quality', assignee: 'reviewer' }
          ]
        }
      ]
    }
  }
});
```

### 3.2 监听协作事件

```javascript
// Node.js
client.onCollaborationEvent(collaborationTask.id, (event) => {
  const { phase, agent, type, payload } = event;

  switch (type) {
    case 'phase_started':
      console.log(`📦 阶段开始: ${phase}`);
      break;

    case 'agent_task_assigned':
      console.log(`👤 ${agent} 被分配任务: ${payload.step_id}`);
      break;

    case 'agent_task_completed':
      console.log(`✅ ${agent} 完成: ${payload.step_id}`);
      break;

    case 'phase_completed':
      console.log(`📦 阶段完成: ${phase}，耗时 ${payload.duration_ms}ms`);
      break;

    case 'collaboration_completed':
      console.log(`🎉 协作完成！报告: ${payload.report_url}`);
      break;

    case 'collaboration_failed':
      console.error(`❌ 协作失败: ${payload.error}`);
      break;
  }
});
```

---

## 4. 错误处理与重试

### 4.1 步骤级重试

```yaml
orchestration:
  dag:
    - step_id: fetch_data
      action: api.fetch
      retry_policy:
        max_retries: 3
        backoff_ms: 1000
        max_backoff_ms: 30000
        retry_on:
          - TIMEOUT
          - RATE_LIMIT
          - NETWORK_ERROR
        do_not_retry_on:
          - INVALID_INPUT
          - UNAUTHORIZED
```

### 4.2 任务级容错

```javascript
// Node.js
const task = await client.createTask({
  type: 'data_pipeline',
  input: { dataset: 'sales_2026_q1' },
  orchestration: { /* ... */ },
  error_handling: {
    strategy: 'continue',        // continue / fail_fast / fallback
    fallback_step: 'use_cache',  // 失败时执行的备用步骤
    max_consecutive_errors: 3,   // 连续错误次数超限则终止
    on_step_failure: 'retry_or_skip',
    on_task_failure: {
      notify: ['admin@company.com'],
      retry_task: true,
      max_task_retries: 2
    }
  }
});
```

### 4.3 自定义错误处理

```javascript
// Node.js
server.handle('data.process', async (input, context) => {
  try {
    const result = await processData(input);

    return result;

  } catch (error) {
    // 分类处理错误
    switch (error.code) {
      case 'DATA_NOT_FOUND':
        // 使用缓存数据作为备选
        const cached = await getCachedData(input.dataset_id);
        if (cached) {
          return {
            source: 'cache',
            data: cached,
            warning: '原始数据不可用，使用缓存'
          };
        }
        throw error;

      case 'TRANSFORMATION_ERROR':
        // 尝试简化处理
        return await processDataSimplified(input);

      default:
        throw error;
    }
  }
});
```

---

## 5. 性能优化最佳实践

### 5.1 批量处理

```javascript
// Node.js
// 收集多个小任务为批量执行
const batch = await client.createBatchTask({
  tasks: [
    { type: 'email.send', input: { to: 'user1@example.com', subject: 'A' } },
    { type: 'email.send', input: { to: 'user2@example.com', subject: 'B' } },
    { type: 'email.send', input: { to: 'user3@example.com', subject: 'C' } }
  ],
  options: {
    maxConcurrency: 10,      // 最大并发数
    batchTimeout: 5000,      // 5秒内必须开始
    optimizeFor: 'throughput' // throughput / latency
  }
});
```

### 5.2 结果缓存

```javascript
// Node.js
const task = await client.createTask({
  type: 'product_search',
  input: { query: 'laptop gaming' },
  caching: {
    enabled: true,
    ttl_seconds: 3600,           // 1小时
    cache_key: ['query'],       // 基于哪些字段生成 key
    invalidate_on: ['inventory_update']
  }
});
```

### 5.3 优先级调度

```javascript
// Node.js - 高优先级任务优先处理
const urgentTask = await client.createTask({
  type: 'critical_alert',
  input: { message: '系统异常' },
  priority: 'urgent',  // urgent / high / normal / low
  metadata: {
    SLA_deadline: '2026-04-02T10:05:00Z',
    notify_on_failure: 'oncall@company.com'
  }
});
```

### 5.4 资源限制

```yaml
orchestration:
  dag:
    - step_id: heavy_compute
      action: ml.inference
      resources:
        max_memory_mb: 2048
        max_cpu_seconds: 30
        max_cost: 0.50
      depends_on: []

    - step_id: result_save
      action: storage.save
      resources:
        max_file_size_mb: 100
      depends_on: [heavy_compute]
```

---

## 6. 完整示例：电商搜索工作流

```javascript
// Node.js
import { AgentNetClient } from '@agentnet/sdk';

const client = new AgentNetClient({
  apiKey: process.env.AGENTNET_API_KEY
});

// 创建电商搜索任务
const task = await client.createTask({
  type: 'shopping_search',
  input: {
    query: '买一台3000元以内的编程电脑',
    user_preferences: {
      priority: '性价比',
      preferred_brands: ['联想', 'ThinkPad', '华为']
    }
  },
  orchestration: {
    dag: [
      {
        step_id: 'intent_parse',
        action: 'nlp.parse_intent',
        depends_on: [],
        retry_policy: { max_retries: 2 }
      },
      {
        step_id: 'search_products',
        action: 'ecommerce.search',
        depends_on: ['intent_parse'],
        retry_policy: {
          max_retries: 3,
          backoff_ms: 500
        }
      },
      {
        step_id: 'filter_by_budget',
        action: 'ecommerce.filter_price',
        depends_on: ['search_products']
      },
      {
        step_id: 'filter_by_preference',
        action: 'ecommerce.filter_brand',
        depends_on: ['filter_by_budget']
      },
      {
        step_id: 'rank_products',
        action: 'ecommerce.rank',
        depends_on: ['filter_by_preference'],
        config: {
          ranking_criteria: ['price', 'rating', 'relevance'],
          weights: [0.4, 0.3, 0.3]
        }
      },
      {
        step_id: 'generate_decision',
        action: 'decision.create_card',
        depends_on: ['rank_products'],
        config: {
          top_n: 3,
          include_reasoning: true
        }
      }
    ]
  },
  timeout_ms: 60000
});

// 监听事件
client.onTaskEvent(task.id, (event) => {
  console.log(`[${event.type}]`, event.payload);
});

// 等待完成
const result = await client.waitForCompletion(task.id);
console.log('最终推荐:', result.output);
```

---

## 7. 监控与调试

### 7.1 查看执行状态

```javascript
// Node.js
const status = await client.getTaskStatus(task.id);

console.log(`
Task: ${task.id}
状态: ${status.state}
进度: ${status.progress_percent}%
当前步骤: ${status.current_step}
已用时间: ${status.elapsed_ms}ms
执行日志: ${status.logs.length} 条
`);
```

### 7.2 获取执行时间线

```javascript
const timeline = await client.getTaskTimeline(task.id);

timeline.forEach(event => {
  console.log(
    `${event.timestamp} | ${event.step_id.padEnd(20)} | ${event.type.padEnd(15)} | ${event.duration_ms}ms`
  );
});
```

---

## 下一步

- 查看 [完整示例](../examples/) - 电商 Agent、编程 Agent、研究 Agent
- 阅读 [架构文档](../architecture/) - 深入理解执行模型
