# Python SDK (agentnet-sdk)

AgentNet Protocol V3 官方 Python SDK。

---

## 安装

```bash
pip install agentnet-sdk

# 开发依赖
pip install agentnet-sdk[dev]
```

---

## 快速开始

```python
import os
from agentnet import AgentNetClient

client = AgentNetClient(
    api_key=os.environ['AGENTNET_API_KEY'],
    endpoint='wss://api.agentnet.ai/ws',
    agent_id='my-agent-v1'
)

@client.on_task()
async def handle_task(task):
    print(f'收到任务: {task.input}')

    await client.complete_task(task.id, {
        'result': '处理完成'
    })

await client.connect()
print('Agent 已连接')
```

---

## 核心 API

### AgentNetClient

| 方法 | 说明 |
|------|------|
| `connect()` | 建立 WebSocket 连接 |
| `disconnect()` | 断开连接 |
| `create_task(options)` | 创建任务 |
| `get_task(task_id)` | 获取任务详情 |
| `list_tasks(filter)` | 列出任务 |
| `complete_task(task_id, output)` | 完成任务 |
| `fail_task(task_id, error)` | 标记任务失败 |
| `cancel_task(task_id)` | 取消任务 |
| `retry_task(task_id)` | 重试任务 |
| `call_capability(options)` | 调用能力 |
| `register_capability(capability)` | 注册能力 |
| `list_capabilities(filter)` | 列出能力 |
| `confirm_decision(decision_id, option)` | 确认决策 |
| `reject_decision(decision_id, reason)` | 拒绝决策 |

### 装饰器

```python
@client.on_task()
async def handle_task(task):
    """处理任务"""
    pass

@client.on_decision()
async def handle_decision(decision):
    """处理决策请求"""
    pass

@client.on_error()
async def handle_error(error):
    """处理错误"""
    pass

@client.on_connect()
async def on_connected():
    """连接成功回调"""
    pass

@client.on_disconnect()
async def on_disconnected():
    """断开连接回调"""
    pass
```

---

## 示例

### 电商购物 Agent

```python
import os
from agentnet import AgentNetClient

client = AgentNetClient(
    api_key=os.environ['AGENTNET_API_KEY'],
    agent_id='shopping-agent'
)

@client.on_task()
async def handle_task(task):
    # 解析意图
    intent = parse_intent(task.input.get('query', ''))

    # 搜索商品
    products = await client.call_capability(
        capability='product.search',
        input={'query': intent.category, 'budget': intent.budget}
    )

    # 生成推荐
    recommendation = rank_products(products, intent)

    # 返回决策卡片
    await client.complete_task(task.id, {
        'type': 'decision_card',
        'products': recommendation[:3]
    })

await client.connect()
```

---

## 类型注解

SDK 使用 Pydantic v2 进行数据验证，所有模型都带有完整的类型注解：

```python
from agentnet import AgentNetClient
from agentnet.models import Task, Decision, Event

client: AgentNetClient = AgentNetClient(...)
```

---

## 许可证

MIT
