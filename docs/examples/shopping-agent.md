# 示例：电商购物 Agent

**版本**: V3.0

---

## 1. Agent 概述

电商购物 Agent 是 AgentNet Protocol V3 的典型应用场景示例，演示了如何：
- 使用 Intent Engine 理解用户购买意图
- 调用 Capability 搜索和筛选商品
- 生成 Decision Card 等待用户确认
- 执行下单流程

---

## 2. 完整代码

### Node.js 实现

```javascript
/**
 * Shopping Agent - 电商购物 Agent 示例
 *
 * 功能：
 * 1. 解析用户购买意图（预算、品牌、分类）
 * 2. 搜索符合条件商品
 * 3. 生成推荐决策卡片
 * 4. 用户确认后执行下单
 */

import {
  AgentNetClient,
  AgentRuntime,
  DecisionEngine
} from '@agentnet/sdk';

class ShoppingAgent {
  constructor(apiKey, options = {}) {
    this.client = new AgentNetClient({
      apiKey,
      endpoint: 'wss://api.agentnet.ai/ws',
      agentId: options.agentId || 'shopping-agent-v1'
    });

    this.runtime = new AgentRuntime();
    this.decisionEngine = new DecisionEngine();

    this.setupHandlers();
  }

  setupHandlers() {
    // 处理购物任务
    this.client.onTask(async (task) => {
      console.log(`[Shopping] 收到任务: ${task.id}`);

      try {
        const result = await this.processShoppingTask(task);
        await this.client.completeTask(task.id, result);
      } catch (error) {
        console.error('[Shopping] 任务失败:', error);
        await this.client.failTask(task.id, {
          error: error.message,
          code: error.code || 'UNKNOWN_ERROR'
        });
      }
    });

    // 处理决策确认
    this.client.onDecision(async (decision) => {
      console.log(`[Shopping] 收到决策确认: ${decision.id}`);

      if (decision.riskLevel === 'LOW') {
        // LOW 风险自动确认
        await this.client.confirmDecision(decision.id, decision.options[0]);
      } else {
        console.log('[Shopping] 高风险决策，等待用户确认...');
      }
    });

    // 错误处理
    this.client.onError((error) => {
      console.error('[Shopping] Agent 错误:', error);
    });
  }

  async processShoppingTask(task) {
    const { query, preferences = {} } = task.input;

    console.log(`[Shopping] 处理查询: "${query}"`);

    // Step 1: 解析用户意图
    const intent = await this.runtime.parseIntent(query, {
      context: task.context
    });

    console.log(`[Shopping] 解析意图:`, intent);

    // Step 2: 搜索商品
    const searchResults = await this.searchProducts(intent);

    if (searchResults.length === 0) {
      return {
        type: 'text',
        message: '抱歉，没有找到符合条件的商品，请尝试调整搜索条件。'
      };
    }

    // Step 3: 过滤和排序
    const rankedProducts = this.rankProducts(searchResults, intent);

    // Step 4: 生成决策卡片
    const decisionCard = this.decisionEngine.makeDecisionCard({
      taskId: task.id,
      title: '请确认您的选择',
      description: `为您找到 ${rankedProducts.length} 个符合条件的商品`,
      products: rankedProducts.slice(0, 3),
      intent,
      riskLevel: this.calculateRiskLevel(rankedProducts[0])
    });

    return {
      type: 'decision_card',
      decision: decisionCard
    };
  }

  async searchProducts(intent) {
    // 调用商品搜索 Capability
    const results = await this.client.callCapability({
      capability: 'product.search',
      input: {
        query: intent.query || intent.category || '商品',
        category: intent.category,
        budget: intent.budget,
        constraints: intent.constraints
      }
    });

    return results.products || [];
  }

  rankProducts(products, intent) {
    // 按性价比排序
    return products.sort((a, b) => {
      // 价格优先（越接近预算越好）
      const budget = intent.budget || 10000;
      const aRatio = a.price / budget;
      const bRatio = b.price / budget;
      const aScore = aRatio > 0.9 ? aRatio : (1 - aRatio);
      const bScore = bRatio > 0.9 ? bRatio : (1 - bRatio);

      // 考虑评分
      const aFinalScore = aScore * (a.rating || 5) / 5;
      const bFinalScore = bScore * (b.rating || 5) / 5;

      return bFinalScore - aFinalScore;
    });
  }

  calculateRiskLevel(product) {
    if (product.price > 5000) return 'MEDIUM';
    if (product.price > 10000) return 'HIGH';
    return 'LOW';
  }

  async start() {
    await this.client.connect();
    console.log('[Shopping] Agent 已启动');
  }

  async stop() {
    await this.client.disconnect();
    console.log('[Shopping] Agent 已停止');
  }
}

// 启动
const agent = new ShoppingAgent(process.env.AGENTNET_API_KEY, {
  agentId: 'shopping-agent-v1-demo'
});

agent.start().catch(console.error);

// 优雅关闭
process.on('SIGINT', async () => {
  await agent.stop();
  process.exit(0);
});
```

---

## 3. Python 实现

```python
"""
Shopping Agent - 电商购物 Agent 示例
"""

import os
import asyncio
from datetime import datetime
from agentnet import AgentNetClient, AgentRuntime, DecisionEngine

class ShoppingAgent:
    def __init__(self, api_key, agent_id='shopping-agent-v1'):
        self.client = AgentNetClient(
            api_key=api_key,
            endpoint='wss://api.agentnet.ai/ws',
            agent_id=agent_id
        )
        self.runtime = AgentRuntime()
        self.decision_engine = DecisionEngine()

    def setup_handlers(self):
        self.client.on_task(self.handle_task)
        self.client.on_decision(self.handle_decision)
        self.client.on_error(self.handle_error)

    async def handle_task(self, task):
        print(f'[Shopping] 收到任务: {task.id}')

        try:
            result = await self.process_shopping_task(task)
            await self.client.complete_task(task.id, result)
        except Exception as e:
            print(f'[Shopping] 任务失败: {e}')
            await self.client.fail_task(task.id, {
                'error': str(e),
                'code': 'UNKNOWN_ERROR'
            })

    async def handle_decision(self, decision):
        print(f'[Shopping] 收到决策确认: {decision.id}')

        if decision.risk_level == 'LOW':
            await self.client.confirm_decision(
                decision.id,
                decision.options[0]
            )
        else:
            print('[Shopping] 高风险决策，等待用户确认...')

    def handle_error(self, error):
        print(f'[Shopping] Agent 错误: {error}')

    async def process_shopping_task(self, task):
        query = task.input.get('query', '')
        preferences = task.input.get('preferences', {})

        print(f'[Shopping] 处理查询: "{query}"')

        # Step 1: 解析意图
        intent = await self.runtime.parse_intent(
            query,
            context=task.context
        )

        # Step 2: 搜索商品
        products = await self.search_products(intent)

        if not products:
            return {
                'type': 'text',
                'message': '抱歉，没有找到符合条件的商品'
            }

        # Step 3: 排序
        ranked = self.rank_products(products, intent)

        # Step 4: 生成决策卡片
        decision_card = self.decision_engine.make_decision_card(
            task_id=task.id,
            title='请确认您的选择',
            description=f'为您找到 {len(ranked)} 个符合条件的商品',
            products=ranked[:3],
            risk_level=self.calculate_risk_level(ranked[0])
        )

        return {
            'type': 'decision_card',
            'decision': decision_card
        }

    async def search_products(self, intent):
        result = await self.client.call_capability(
            capability='product.search',
            input={
                'query': intent.get('query') or intent.get('category', '商品'),
                'category': intent.get('category'),
                'budget': intent.get('budget'),
                'constraints': intent.get('constraints', [])
            }
        )
        return result.get('products', [])

    def rank_products(self, products, intent):
        budget = intent.get('budget', 10000)

        def score(p):
            ratio = p['price'] / budget
            base = ratio if ratio > 0.9 else (1 - ratio)
            rating = p.get('rating', 5) / 5
            return base * rating

        return sorted(products, key=score, reverse=True)

    def calculate_risk_level(self, product):
        if product['price'] > 5000:
            return 'MEDIUM'
        elif product['price'] > 10000:
            return 'HIGH'
        return 'LOW'

    async def start(self):
        await self.client.connect()
        print('[Shopping] Agent 已启动')

    async def stop(self):
        await self.client.disconnect()
        print('[Shopping] Agent 已停止')

async def main():
    agent = ShoppingAgent(
        api_key=os.environ['AGENTNET_API_KEY'],
        agent_id='shopping-agent-v1-demo'
    )
    agent.setup_handlers()
    await agent.start()

if __name__ == '__main__':
    asyncio.run(main())
```

---

## 4. 使用流程

### 4.1 启动 Agent

```bash
# Node.js
AGENTNET_API_KEY=your_key node shopping_agent.js

# Python
AGENTNET_API_KEY=your_key python shopping_agent.py
```

### 4.2 发送测试任务

```bash
curl -X POST https://api.agentnet.ai/api/v3/tasks \
  -H "Authorization: Bearer $AGENTNET_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "shopping",
    "input": {
      "query": "帮我买一台3000元以内的电脑，适合编程用",
      "preferences": {
        "priority": "性价比"
      }
    },
    "assigned_agent": "shopping-agent-v1-demo"
  }'
```

### 4.3 预期交互流程

```
用户: 帮我买一台3000元以内的电脑

Agent:
├── 意图解析: buy_product, budget=3000, category=laptop
├── 搜索商品: 找到 15 个商品
├── 过滤筛选: 剩余 8 个符合预算
├── 排序: ThinkPad X13 (¥2800) > 华为MateBook 14 (¥2999) > ...
└── 生成决策卡片:
    ├── 推荐: ThinkPad X13 ¥2800
    ├── 备选: 华为MateBook 14 ¥2999
    ├── 备选: 联想小新Air14 ¥2999
    └── 风险等级: LOW（自动确认）

用户确认后 → 执行下单 → 返回订单结果
```

---

## 5. 架构图

```
┌──────────────────────────────────────────────────────────────┐
│                     Shopping Agent                            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  User Query: "帮我买一台3000元以内的编程电脑"                  │
│                           │                                   │
│                           ▼                                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Intent Engine                              │  │
│  │  intent: buy_product                                   │  │
│  │  budget: 3000                                           │  │
│  │  category: laptop                                      │  │
│  │  constraints: ["适合编程"]                              │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           │                                   │
│                           ▼                                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │           Product Search (Capability)                  │  │
│  │  input: { query, budget, category }                     │  │
│  │  output: [ products... ]                                │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           │                                   │
│                           ▼                                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Decision Engine                            │  │
│  │  生成 Decision Card (Top 3 商品)                        │  │
│  │  风险评估: LOW / MEDIUM / HIGH                          │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           │                                   │
│                           ▼                                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              User Confirmation                          │  │
│  │  LOW → 自动确认                                         │  │
│  │  HIGH → 等待用户确认                                     │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. 扩展方向

| 扩展功能 | 说明 |
|---------|------|
| 多平台搜索 | 并行调用 JD/TB/拼多多 Adapter |
| 价格历史 | 查询历史价格走势 |
| 评论分析 | 分析商品评论情感 |
| 比价 | 跨平台价格对比 |
| 推荐 | 基于用户历史偏好推荐 |
