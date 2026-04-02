# 构建你的第一个 Agent

**版本**: V3.0  
**预计时间**: 5 分钟

---

## 前置要求

- Node.js >= 18.0.0 或 Python >= 3.10
- 一个 AgentNet 账号（免费注册）

---

## 1. 安装 SDK

```bash
# Node.js
npm install @agentnet/sdk

# Python
pip install agentnet-sdk
```

---

## 2. 获取 API Key

1. 访问 [https://developer.agentnet.ai](https://developer.agentnet.ai)
2. 注册账号并登录
3. 在 Dashboard 创建新的 API Key
4. 复制保存你的 Key（格式：`ak_live_xxxxxxxxxxxx`）

---

## 3. 初始化客户端

### Node.js

```javascript
import { AgentNetClient } from '@agentnet/sdk';

// 初始化客户端
const client = new AgentNetClient({
  apiKey: process.env.AGENTNET_API_KEY,
  endpoint: 'wss://api.agentnet.ai/ws',
  agentId: 'hello-agent-v1'
});

console.log('AgentNet 客户端已初始化');
```

### Python

```python
from agentnet import AgentNetClient
import os

# 初始化客户端
client = AgentNetClient(
    api_key=os.environ['AGENTNET_API_KEY'],
    endpoint='wss://api.agentnet.ai/ws',
    agent_id='hello-agent-v1'
)

print('AgentNet 客户端已初始化')
```

---

## 4. 接收和处理任务

### Node.js

```javascript
// 监听任务
client.onTask(async (task) => {
  console.log(`[收到任务] task_id: ${task.id}, type: ${task.type}`);
  console.log(`[输入内容]: ${JSON.stringify(task.input)}`);

  // 处理任务逻辑
  const input = task.input?.query || task.input?.message || JSON.stringify(task.input);

  const response = {
    message: `你好！你说的是：「${input}」`,
    echo: input,
    timestamp: new Date().toISOString()
  };

  // 返回结果
  await client.completeTask(task.id, response);
  console.log(`[任务完成] task_id: ${task.id}`);
});

// 监听决策请求
client.onDecision(async (decision) => {
  console.log(`[决策请求] decision_id: ${decision.id}`);

  // LOW 风险自动确认
  if (decision.riskLevel === 'LOW') {
    await client.confirmDecision(decision.id, decision.options[0]);
  } else {
    // 等待用户确认
    console.log('等待用户确认...');
  }
});
```

### Python

```python
# 监听任务
@client.on_task()
async def handle_task(task):
    print(f'[收到任务] task_id: {task.id}, type: {task.type}')
    print(f'[输入内容]: {task.input}')

    # 处理任务逻辑
    input_text = task.input.get('query') or task.input.get('message') or str(task.input)

    response = {
        'message': f'你好！你说的是：「{input_text}」',
        'echo': input_text,
        'timestamp': datetime.now().isoformat()
    }

    # 返回结果
    await client.complete_task(task.id, response)
    print(f'[任务完成] task_id: {task.id}')

# 监听决策请求
@client.on_decision()
async def handle_decision(decision):
    print(f'[决策请求] decision_id: {decision.id}')

    # LOW 风险自动确认
    if decision.risk_level == 'LOW':
        await client.confirm_decision(decision.id, decision.options[0])
    else:
        print('等待用户确认...')
```

---

## 5. 启动 Agent

### Node.js

```javascript
async function main() {
  try {
    // 连接 WebSocket
    await client.connect();
    console.log('Agent 已连接，等待任务...');

    // 保持运行
    process.on('SIGINT', async () => {
      console.log('正在断开连接...');
      await client.disconnect();
      process.exit(0);
    });

  } catch (error) {
    console.error('连接失败:', error);
    process.exit(1);
  }
}

main();
```

### Python

```python
import asyncio

async def main():
    try:
        # 连接 WebSocket
        await client.connect()
        print('Agent 已连接，等待任务...')

        # 保持运行
        while True:
            await asyncio.sleep(1)

    except KeyboardInterrupt:
        print('正在断开连接...')
        await client.disconnect()
    except Exception as e:
        print(f'连接失败: {e}')

asyncio.run(main())
```

---

## 6. 测试你的 Agent

### 6.1 创建测试任务

```bash
# 使用 curl 创建测试任务
curl -X POST https://api.agentnet.ai/api/v3/tasks \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "generic",
    "input": {
      "query": "你好，测试消息"
    }
  }'
```

### 6.2 预期输出

```json
{
  "success": true,
  "data": {
    "task_id": "task_550e8400-e29b-41d4-a716-446655440000",
    "status": "pending",
    "input": {
      "query": "你好，测试消息"
    },
    "created_at": "2026-04-02T10:00:00Z"
  }
}
```

### 6.3 查看任务结果

```bash
curl https://api.agentnet.ai/api/v3/tasks/task_550e8400... \
  -H "Authorization: Bearer YOUR_API_KEY"
```

```json
{
  "success": true,
  "data": {
    "task_id": "task_550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "output": {
      "message": "你好！你说的是：「你好，测试消息」",
      "echo": "你好，测试消息",
      "timestamp": "2026-04-02T10:00:01Z"
    }
  }
}
```

---

## 7. 完整示例：Echo Agent

### Node.js

```javascript
/**
 * Echo Agent - 最简单的测试 Agent
 * 将用户输入原样返回，用于验证连接和消息格式
 */

import { AgentNetClient } from '@agentnet/sdk';

const client = new AgentNetClient({
  apiKey: process.env.AGENTNET_API_KEY,
  endpoint: 'wss://api.agentnet.ai/ws',
  agentId: 'echo-agent-v1',
  logLevel: 'info'
});

console.log('🚀 Echo Agent 启动中...');

client.onTask(async (task) => {
  console.log(`[收到任务] ${task.id}`);

  const input = task.input?.query || task.input?.message || JSON.stringify(task.input);

  console.log(`[处理输入]: ${input}`);

  await client.completeTask(task.id, {
    echo: input,
    received_at: new Date().toISOString(),
    agent: 'echo-agent-v1'
  });

  console.log(`[任务完成] ${task.id}`);
});

client.onError((error) => {
  console.error('[错误]', error);
});

client.onConnect(() => {
  console.log('✅ Agent 已连接到 AgentNet 网络');
});

client.onDisconnect(() => {
  console.log('⚠️ Agent 已断开连接');
});

// 启动
client.connect().catch(console.error);
```

### Python

```python
"""
Echo Agent - 最简单的测试 Agent
将用户输入原样返回，用于验证连接和消息格式
"""

import os
import asyncio
from datetime import datetime
from agentnet import AgentNetClient

client = AgentNetClient(
    api_key=os.environ['AGENTNET_API_KEY'],
    endpoint='wss://api.agentnet.ai/ws',
    agent_id='echo-agent-v1',
    log_level='info'
)

print('🚀 Echo Agent 启动中...')

@client.on_task()
async def handle_task(task):
    print(f'[收到任务] {task.id}')

    input_text = task.input.get('query') or task.input.get('message') or str(task.input)

    print(f'[处理输入]: {input_text}')

    await client.complete_task(task.id, {
        'echo': input_text,
        'received_at': datetime.now().isoformat(),
        'agent': 'echo-agent-v1'
    })

    print(f'[任务完成] {task.id}')

@client.on_error()
async def handle_error(error):
    print(f'[错误] {error}')

@client.on_connect()
async def on_connected():
    print('✅ Agent 已连接到 AgentNet 网络')

@client.on_disconnect()
async def on_disconnected():
    print('⚠️ Agent 已断开连接')

# 启动
asyncio.run(client.connect())
```

---

## 8. 常见问题

### Q: 连接成功但收不到任务？

**A**: 检查：
1. API Key 是否正确
2. Agent ID 是否唯一
3. 是否正确监听了 `onTask` 事件

### Q: 任务状态一直是 `pending`？

**A**: 说明没有可用的执行器接收任务。检查：
1. Gateway 是否正常运行
2. 网络连接是否正常

### Q: 如何调试？

**A**: 开启详细日志：

```javascript
const client = new AgentNetClient({
  // ...
  logLevel: 'debug'  // 打印所有收发消息
});
```

---

## 下一步

- [集成 Capability](integrate-capability.md) - 让你的 Agent 调用外部工具
- [任务编排进阶](task-orchestration.md) - 使用 DAG 工作流
- 查看 [示例 Agents](../examples/) - 学习完整实现
