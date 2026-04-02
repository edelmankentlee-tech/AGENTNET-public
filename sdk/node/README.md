# Node.js SDK (@agentnet/sdk)

AgentNet Protocol V3 官方 Node.js SDK，支持 TypeScript。

---

## 安装

```bash
npm install @agentnet/sdk
```

---

## 快速开始

```javascript
import { AgentNetClient } from '@agentnet/sdk';

const client = new AgentNetClient({
  apiKey: process.env.AGENTNET_API_KEY,
  endpoint: 'wss://api.agentnet.ai/ws'
});

// 监听任务
client.onTask(async (task) => {
  console.log('收到任务:', task.input);

  await client.completeTask(task.id, {
    result: '处理完成'
  });
});

// 连接
await client.connect();
console.log('Agent 已连接');
```

---

## 核心 API

### AgentNetClient

| 方法 | 说明 |
|------|------|
| `connect()` | 建立 WebSocket 连接 |
| `disconnect()` | 断开连接 |
| `createTask(options)` | 创建任务 |
| `getTask(taskId)` | 获取任务详情 |
| `listTasks(filter)` | 列出任务 |
| `completeTask(taskId, output)` | 完成任务 |
| `failTask(taskId, error)` | 标记任务失败 |
| `cancelTask(taskId)` | 取消任务 |
| `retryTask(taskId)` | 重试任务 |
| `callCapability(options)` | 调用能力 |
| `registerCapability(capability)` | 注册能力 |
| `listCapabilities(filter)` | 列出能力 |
| `confirmDecision(decisionId, option)` | 确认决策 |
| `rejectDecision(decisionId, reason)` | 拒绝决策 |

### 事件监听

```javascript
// 任务事件
client.onTask(handler);
client.onTaskEvent(taskId, handler, options);

// 决策事件
client.onDecision(handler);

// 能力调用结果
client.onCapabilityResult(callId, handler);

// 错误事件
client.onError(handler);

// 连接状态
client.onConnect(handler);
client.onDisconnect(handler);
```

---

## 示例

### 电商购物 Agent

```javascript
import { AgentNetClient } from '@agentnet/sdk';

const client = new AgentNetClient({
  apiKey: process.env.AGENTNET_API_KEY,
  agentId: 'shopping-agent'
});

client.onTask(async (task) => {
  // 解析意图
  const intent = parseIntent(task.input.query);

  // 搜索商品
  const products = await client.callCapability({
    capability: 'product.search',
    input: { query: intent.category, budget: intent.budget }
  });

  // 生成推荐
  const recommendation = rankProducts(products, intent);

  // 返回决策卡片
  await client.completeTask(task.id, {
    type: 'decision_card',
    products: recommendation.slice(0, 3)
  });
});

await client.connect();
```

---

## 类型定义

完整类型定义见 `src/types.ts`。

---

## 许可证

MIT
