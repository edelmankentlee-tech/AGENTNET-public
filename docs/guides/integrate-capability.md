# 集成 Capability

**版本**: V3.0  
**预计时间**: 10 分钟

---

## 1. 概述

本指南介绍如何在 AgentNet Protocol 中注册和使用 Capability（能力）。Capability 是 Agent 调用外部工具/服务的标准化接口。

---

## 2. 基本概念

| 概念 | 说明 |
|------|------|
| **Capability** | 可被发现和调用的能力单元 |
| **Provider** | 提供 Capability 的 Agent 或服务 |
| **Consumer** | 调用 Capability 的 Agent 或用户 |
| **Registry** | Capability 的注册表和发现服务 |

---

## 3. 注册 Capability

### 3.1 定义 Capability

```javascript
const capability = {
  capability_id: 'hello.echo',
  name: 'Echo 服务',
  name_en: 'Echo Service',
  description: '将输入原样返回，用于测试',
  version: '1.0.0',
  provider: {
    agent_id: 'echo-provider',
    name: 'Echo 提供者'
  },
  input_schema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: '要回显的消息',
        minLength: 1,
        maxLength: 1000
      }
    },
    required: ['message']
  },
  output_schema: {
    type: 'object',
    properties: {
      echo: { type: 'string' },
      timestamp: { type: 'string', format: 'date-time' }
    }
  },
  risk_level: 'LOW',
  requires_confirmation: false,
  permissions: ['capability:call:hello.*'],
  pricing: {
    model: 'per_call',
    price: 0.0001,
    currency: 'USD'
  },
  rate_limit: {
    calls_per_minute: 100,
    calls_per_hour: 5000
  }
};
```

### 3.2 注册到 Registry

```javascript
// Node.js
const result = await client.registerCapability(capability);
console.log('Capability 注册成功:', result.capability_id);

// Python
result = await client.register_capability(capability)
print(f'Capability 注册成功: {result.capability_id}')
```

### 3.3 响应格式

```json
{
  "success": true,
  "data": {
    "capability_id": "hello.echo",
    "registered_at": "2026-04-02T10:00:00Z",
    "endpoint": "wss://api.agentnet.ai/capabilities/hello.echo"
  }
}
```

---

## 4. 发现 Capability

### 4.1 搜索 Capability

```javascript
// Node.js
const capabilities = await client.listCapabilities({
  tags: ['search', 'product'],
  risk_level: 'LOW',
  verified: true,
  page: 1,
  page_size: 20
});

capabilities.forEach(cap => {
  console.log(`[${cap.capability_id}] ${cap.name}`);
  console.log(`  价格: $${cap.pricing.price}/${cap.pricing.model}`);
  console.log(`  风险: ${cap.risk_level}`);
});
```

### 4.2 获取详情

```javascript
const detail = await client.getCapability('product.search');
console.log(detail.description);
console.log('输入 Schema:', detail.input_schema);
console.log('定价:', detail.pricing);
```

---

## 5. 调用 Capability

### 5.1 基本调用

```javascript
// Node.js
const result = await client.callCapability({
  capability: 'hello.echo',
  input: { message: '你好，AgentNet！' }
});

console.log(result.output);
// { echo: '你好，AgentNet！', timestamp: '2026-04-02T10:00:01Z' }
```

### 5.2 带上下文的调用

```javascript
// Node.js - 传入 Task 上下文
const result = await client.callCapability({
  capability: 'product.search',
  taskId: task.id,        // 关联到父任务
  input: {
    query: 'laptop',
    budget: 5000,
    category: 'electronics'
  },
  options: {
    timeout: 30000,       // 30秒超时
    priority: 'high'      // 高优先级
  }
});

console.log(`找到 ${result.output.total} 个商品`);
```

### 5.3 调用并监听事件

```javascript
// Node.js
const callId = await client.callCapabilityAsync({
  capability: 'product.search',
  input: { query: 'laptop' }
});

// 监听调用结果
client.onCapabilityResult(callId, (event) => {
  if (event.type === 'capability.started') {
    console.log('Capability 开始执行');
  } else if (event.type === 'capability.progress') {
    console.log(`进度: ${event.payload.progress}%`);
  } else if (event.type === 'capability.completed') {
    console.log('执行完成:', event.payload.result);
  } else if (event.type === 'capability.failed') {
    console.error('执行失败:', event.payload.error);
  }
});
```

---

## 6. 实现 Capability Handler

### 6.1 Echo Capability 实现

```javascript
// Node.js - 在 Provider Agent 中实现
import { CapabilityServer } from '@agentnet/sdk';

const server = new CapabilityServer({
  agentId: 'echo-provider',
  apiKey: process.env.AGENTNET_API_KEY
});

// 注册 Handler
server.handle('hello.echo', async (input, context) => {
  console.log(`[Echo] 收到请求 from ${context.senderId}`);

  return {
    echo: input.message,
    timestamp: new Date().toISOString(),
    metadata: {
      processing_time_ms: 5,
      provider: 'echo-provider'
    }
  };
});

// 启动服务
await server.start();
console.log('Echo Capability 服务已启动');
```

### 6.2 带验证的实现

```javascript
// Node.js
server.handle('product.search', async (input, context) => {
  // 1. 验证输入
  if (!input.query || input.query.length < 2) {
    throw new CapabilityError('INVALID_INPUT', '查询词至少2个字符');
  }

  // 2. 权限检查
  if (!context.hasPermission('product.read')) {
    throw new CapabilityError('PERMISSION_DENIED', '需要 product.read 权限');
  }

  // 3. 业务逻辑
  const products = await searchProducts(input);

  // 4. 返回结果
  return {
    products,
    total: products.length,
    query: input.query
  };
});
```

### 6.3 错误处理

```javascript
// 定义错误类型
const errorHandler = {
  // 输入验证错误
  INVALID_INPUT: (message) => ({
    code: 'INVALID_INPUT',
    message,
    retryable: false
  }),

  // 服务不可用
  SERVICE_UNAVAILABLE: (message) => ({
    code: 'SERVICE_UNAVAILABLE',
    message,
    retryable: true,
    retry_after_ms: 5000
  }),

  // 限流
  RATE_LIMITED: (retryAfter) => ({
    code: 'RATE_LIMIT_EXCEEDED',
    message: '调用频率超限',
    retryable: true,
    retry_after_ms: retryAfter
  })
};
```

---

## 7. Capability 定价与计费

### 7.1 按次计费

```javascript
// 消费者视角
const result = await client.callCapability({
  capability: 'product.search',
  input: { query: 'laptop' },
  billing: {
    bill_to: 'user_abc'  // 计费到用户
  }
});

console.log(`本次调用成本: $${result.cost}`);
```

### 7.2 查询账单

```javascript
// 查看月度使用量
const usage = await client.getCapabilityUsage({
  capability: 'product.search',
  period: '2026-03'
});

console.log(`3月调用次数: ${usage.total_calls}`);
console.log(`3月总费用: $${usage.total_cost}`);
```

---

## 8. 完整示例：购物搜索 Capability

```javascript
// provider/shopping_capability.js

import { CapabilityServer } from '@agentnet/sdk';

const server = new CapabilityServer({
  agentId: 'shopping-adapter',
  apiKey: process.env.AGENTNET_API_KEY
});

// 注册商品搜索能力
server.handle('product.search', async (input, context) => {
  const { query, category, price_min, price_max } = input;

  console.log(`[Search] query=${query}, category=${category}`);

  // 模拟搜索逻辑
  const results = await mockSearchProducts({
    query,
    category,
    priceMin: price_min,
    priceMax: price_max
  });

  return {
    products: results,
    total: results.length,
    query,
    searched_at: new Date().toISOString()
  };
});

// 注册商品详情能力
server.handle('product.detail', async (input, context) => {
  const { product_id } = input;

  const product = await mockGetProduct(product_id);

  if (!product) {
    throw new CapabilityError('NOT_FOUND', `商品 ${product_id} 不存在`);
  }

  return product;
});

// 注册价格比较能力
server.handle('product.compare', async (input, context) => {
  const { product_ids } = input;

  const products = await Promise.all(
    product_ids.map(id => mockGetProduct(id))
  );

  return {
    products,
    comparison: products.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      value_score: p.price / p.rating  // 性价比
    })).sort((a, b) => b.value_score - a.value_score)
  };
});

// 启动
await server.start();
console.log('🛒 Shopping Capability 服务已启动');
```

---

## 9. 常见问题

### Q: 如何确保 Capability 的可用性？

**A**: 
1. 实现健康检查接口 `GET /health`
2. 设置合理的超时时间
3. 实现重试机制
4. 监控调用成功率

### Q: 如何处理并发调用？

**A**: Capability Server 内置连接池：
```javascript
const server = new CapabilityServer({
  agentId: 'my-agent',
  maxConcurrentCalls: 50,  // 最大并发
  callQueueSize: 100       // 队列大小
});
```

### Q: 如何保护敏感 Capability？

**A**: 
```javascript
server.handle('admin.delete', async (input, context) => {
  // 双重验证
  if (!context.hasPermission('admin.write')) {
    throw new CapabilityError('PERMISSION_DENIED');
  }
  if (input.confirm !== 'DELETE') {
    throw new CapabilityError('CONFIRMATION_REQUIRED', '需要确认删除');
  }
  // 业务逻辑...
}, { requireConfirmation: true });
```
