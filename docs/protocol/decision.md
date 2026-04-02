# Decision Protocol（决策协议）

**版本**: V3.0  
**状态**: 正式发布

---

## 1. 概述

Decision Protocol 是 AgentNet Protocol V3 的人机交互层协议，定义了 Agent 在关键决策点如何与人类交互，确保人类始终掌控 AI 行为，同时保持用户体验流畅。

> **核心原则**：Human-in-the-loop，关键决策必须有人类参与。

---

## 2. 核心概念

### 2.1 Decision Card（决策卡片）

Decision Card 是标准的跨平台决策 UI 组件，用于：
- 展示 Agent 推荐选项
- 显示决策理由和置信度
- 揭示风险等级
- 收集用户确认/拒绝/修改

### 2.2 风险等级

| 等级 | 说明 | Agent 行为 |
|------|------|-----------|
| `LOW` | 无财务/隐私风险 | Agent 可自动执行（若开启） |
| `MEDIUM` | 有轻微风险 | 通知用户，可自动继续 |
| `HIGH` | 有较大风险 | 必须用户明确确认 |
| `CRITICAL` | 高危操作 | 暂停执行，等待人工介入 |

---

## 3. Decision 数据结构

```json
{
  "decision_id": "dec_550e8400-e29b-41d4-a716-446655440000",
  "task_id": "task_abc123",
  "title": "请确认您的选择",
  "description": "根据您的需求，找到3个符合条件的商品",
  "reason": "在预算范围内，性价比较高的3款电脑",
  "confidence": 0.92,
  "risk_level": "MEDIUM",
  "action_type": "single_choice",
  "options": [
    {
      "option_id": "opt_001",
      "label": "ThinkPad X13",
      "description": "i5处理器 16GB 512GB SSD，¥2800",
      "metadata": {
        "price": 2800,
        "source": "京东自营",
        "product_id": "prod_001"
      },
      "confidence": 0.85
    },
    {
      "option_id": "opt_002",
      "label": "华为MateBook 14",
      "description": "i5 16GB 512GB 2K触控屏，¥2999",
      "metadata": {
        "price": 2999,
        "source": "京东自营",
        "product_id": "prod_002"
      },
      "confidence": 0.78
    },
    {
      "option_id": "opt_003",
      "label": "联想小新Air14",
      "description": "i5 16GB 512GB 高色域，¥2999",
      "metadata": {
        "price": 2999,
        "source": "京东自营",
        "product_id": "prod_008"
      },
      "confidence": 0.72
    }
  ],
  "selected_option": null,
  "reasoning": [
    {
      "factor": "价格匹配度",
      "weight": 0.4,
      "contribution": "ThinkPad X13 价格最低，与预算差距最大"
    },
    {
      "factor": "性能配置",
      "weight": 0.3,
      "contribution": "三款均为 i5+16GB，配置相当"
    },
    {
      "factor": "品牌偏好",
      "weight": 0.2,
      "contribution": "用户未指定品牌，三款均可"
    },
    {
      "factor": "用户偏好",
      "weight": 0.1,
      "contribution": "用户提及「编程」，ThinkPad 键盘手感更适合"
    }
  ],
  "alternatives": [
    {
      "action": "扩大预算至4000元",
      "reason": "可以买到性能更好的电脑",
      "why_not_chosen": "超出用户明确预算"
    }
  ],
  "metadata": {
    "created_at": "2026-04-02T10:05:00Z",
    "expires_at": "2026-04-02T10:35:00Z",
    "timeout_action": "auto_cancel",
    "required_role": null
  }
}
```

---

## 4. 决策动作

| 动作 | 说明 | 适用场景 |
|------|------|----------|
| `AUTO_EXECUTE` | Agent 自动执行推荐选项 | LOW 风险，可选开启 |
| `NEED_CONFIRMATION` | 需要用户确认 | MEDIUM/HIGH 风险 |
| `ASK_USER` | 需要用户更多信息 | 信息不足 |
| `BLOCK` | 阻止执行，报告用户 | CRITICAL 风险或违规 |

---

## 5. Decision Card UI 规范

### 5.1 组件结构

```
┌─────────────────────────────────────────────┐
│  📋 请确认您的选择                           │
│  根据您的需求，找到3个符合条件的商品         │
├─────────────────────────────────────────────┤
│  💡 推荐理由                                 │
│  在预算范围内，性价比较高的3款电脑          │
│  置信度: 92%                                │
├─────────────────────────────────────────────┤
│                                             │
│  ○ ThinkPad X13         ¥2800 ⭐推荐        │
│    i5处理器 16GB 512GB SSD · 京东自营       │
│                                             │
│  ○ 华为MateBook 14      ¥2999               │
│    i5 16GB 512GB 2K触控屏 · 京东自营        │
│                                             │
│  ● 联想小新Air14       ¥2999               │
│    i5 16GB 512GB 高色域 · 京东自营          │
│                                             │
├─────────────────────────────────────────────┤
│  ⚠️ 风险等级: MEDIUM                         │
│  此操作涉及下单支付，请确认您的选择          │
├─────────────────────────────────────────────┤
│                                             │
│  [ 查看备选方案 ]  [ 取消 ]  [ 确认选择 ]   │
│                                             │
└─────────────────────────────────────────────┘
```

### 5.2 可解释性展示

```javascript
// 决策理由展开
const reasoning = decision.reasoning.map(f => ({
  factor: f.factor,
  weight: `${(f.weight * 100).toFixed(0)}%`,
  contribution: f.contribution
}));

// 备选方案
const alternatives = decision.alternatives.map(a => ({
  action: a.action,
  reason: a.reason,
  whyNotChosen: a.whyNotChosen
}));
```

---

## 6. 确认流程

### 6.1 用户确认

```javascript
// 用户选择某个选项
await client.confirmDecision(decision.id, {
  option_id: 'opt_001',
  custom_input: null  // 可选，用户可修改输入
});

// 用户拒绝
await client.rejectDecision(decision.id, {
  reason: '价格还是太高了',
  feedback: '希望能推荐3000元以下的'
});

// 用户上报
await client.escalateDecision(decision.id, {
  reason: '涉及大额支出，需要主管审批',
  required_role: 'manager'
});
```

### 6.2 超时处理

| 超时动作 | 说明 |
|----------|------|
| `auto_cancel` | 自动取消决策 |
| `auto_select_first` | 自动选择第一个选项 |
| `notify_user` | 通知用户（不自动执行） |
| `escalate` | 转交人工处理 |

---

## 7. 可解释性设计

### 7.1 Reasoning（推理因子）

每个决策包含多个推理因子，说明决策依据：

```javascript
{
  "reasoning": [
    {
      "factor": "价格匹配度",
      "weight": 0.4,        // 权重（总和=1）
      "contribution": "ThinkPad X13 价格最低，与预算差距最大"
    }
  ]
}
```

### 7.2 Alternatives（备选方案）

```javascript
{
  "alternatives": [
    {
      "action": "扩大预算至4000元",
      "reason": "可以买到性能更好的电脑",
      "why_not_chosen": "超出用户明确预算（3000元）"
    }
  ]
}
```

---

## 8. 与 Task Protocol 的关系

```
Task 执行流程:

  Task Running
     │
     ▼
  ┌──────────────────┐
  │  Decision Point  │  ← Agent 需要人类决策
  └────────┬─────────┘
           │
     ┌─────┴─────┐
     │           │
  Decision   Decision
  Card UI    Confirmed
     │           │
     ▼           ▼
  Wait for   Continue
  Human      Execution
     │
     ▼
  Task Completed
```

---

## 9. 决策历史与学习

```javascript
// 记录决策结果
await client.recordDecisionFeedback({
  decision_id: 'dec_xxx',
  outcome: 'confirmed',      // confirmed / rejected / modified
  selected_option: 'opt_001',
  user_feedback: 'good',
  actual_result: 'order_completed'
});

// 获取决策统计
const stats = await client.getDecisionStats({
  agent_id: 'shopping-agent',
  time_range: '30d'
});
// 返回: { total: 1000, confirmed: 850, rejected: 100, modified: 50 }
```

---

## 10. REST API 端点

| 方法 | 端点 | 说明 |
|------|------|------|
| `GET` | `/api/v3/decisions/{id}` | 获取决策详情 |
| `POST` | `/api/v3/decisions/{id}/confirm` | 确认决策 |
| `POST` | `/api/v3/decisions/{id}/reject` | 拒绝决策 |
| `POST` | `/api/v3/decisions/{id}/escalate` | 上报决策 |
| `POST` | `/api/v3/decisions/{id}/feedback` | 提交反馈 |
| `GET` | `/api/v3/decisions/{id}/reasoning` | 获取推理详情 |

---

## 11. 错误码

| 错误码 | 说明 |
|--------|------|
| `DECISION_NOT_FOUND` | 决策不存在 |
| `DECISION_EXPIRED` | 决策已超时 |
| `DECISION_ALREADY_RESOLVED` | 决策已被处理 |
| `INVALID_OPTION` | 选择的选项无效 |
| `UNAUTHORIZED` | 无权操作此决策 |
| `ESCALATION_REJECTED` | 上报请求被拒绝 |
