# Capability Protocol（能力协议）

**版本**: V3.0  
**状态**: 正式发布

---

## 1. 概述

Capability Protocol 是 AgentNet Protocol V3 的能力抽象层协议，将传统的 Tool / API 抽象为统一的 Capability（能力）概念，支持注册、发现、定价和权限控制。

> **核心思想**：Tool → Capability，就像 REST API 的资源抽象一样通用。

---

## 2. 核心概念

### 2.1 Capability vs Tool

| 维度 | Tool（传统） | Capability（协议标准） |
|------|-------------|----------------------|
| 抽象层级 | 实现细节 | 接口契约 |
| 描述格式 | 自由文本 | 结构化 Schema |
| 发现机制 | 无 | Registry + Index |
| 定价模型 | 无 | flat_rate / per_call / subscription |
| 权限控制 | 粗粒度 | 细粒度 Scope |
| 审计日志 | 可选 | 标准字段 |

---

## 3. Capability 数据结构

```json
{
  "capability_id": "product.search",
  "name": "商品搜索",
  "name_en": "Product Search",
  "description": "在电商平台搜索商品，支持关键词、价格区间、分类筛选",
  "version": "1.2.0",
  "provider": {
    "agent_id": "jd-adapter-agent",
    "name": "京东适配器 Agent",
    "verified": true
  },
  "input_schema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "搜索关键词",
        "minLength": 1,
        "maxLength": 200
      },
      "category": {
        "type": "string",
        "enum": ["laptop", "phone", "tablet", "accessory"]
      },
      "price_min": {
        "type": "number",
        "minimum": 0
      },
      "price_max": {
        "type": "number",
        "minimum": 0
      }
    },
    "required": ["query"]
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "products": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": { "type": "string" },
            "name": { "type": "string" },
            "price": { "type": "number" },
            "source": { "type": "string" }
          }
        }
      },
      "total": { "type": "integer" }
    }
  },
  "risk_level": "LOW",
  "requires_confirmation": false,
  "permissions": ["capability:call:product.*"],
  "pricing": {
    "model": "per_call",
    "price": 0.0005,
    "currency": "USD",
    "free_tier": {
      "monthly_calls": 1000,
      "enabled": true
    }
  },
  "rate_limit": {
    "calls_per_minute": 60,
    "calls_per_hour": 2000,
    "calls_per_day": 10000
  },
  "metadata": {
    "tags": ["ecommerce", "search", "product"],
    "documentation_url": "https://docs.agentnet.ai/capabilities/product.search",
    "version": "1.2.0",
    "deprecated": false
  }
}
```

---

## 4. 能力发现机制

### 4.1 注册表（Registry）

```javascript
// 查询所有可用能力
const capabilities = await client.listCapabilities({
  category: 'ecommerce',
  risk_level: 'LOW',
  tags: ['search'],
  page: 1,
  page_size: 20
});
```

### 4.2 搜索过滤条件

| 字段 | 说明 | 示例 |
|------|------|------|
| `category` | 能力分类 | `ecommerce`, `productivity` |
| `risk_level` | 风险等级 | `LOW`, `MEDIUM`, `HIGH` |
| `tags` | 标签（AND 匹配） | `["search", "product"]` |
| `provider` | 提供者 Agent ID | `jd-adapter-agent` |
| `pricing_model` | 定价模型 | `per_call`, `flat_rate` |
| `verified` | 仅显示已验证 | `true` |

---

## 5. 定价模型

### 5.1 按次计费（per_call）

```json
{
  "model": "per_call",
  "price": 0.0005,
  "currency": "USD",
  "free_tier": {
    "monthly_calls": 1000,
    "enabled": true
  }
}
```

### 5.2 固定月费（flat_rate）

```json
{
  "model": "flat_rate",
  "price": 29.99,
  "currency": "USD",
  "period": "month",
  "includes_calls": 50000
}
```

### 5.3 订阅制（subscription）

```json
{
  "model": "subscription",
  "plans": [
    {
      "name": "Basic",
      "price": 9.99,
      "calls_per_month": 5000
    },
    {
      "name": "Pro",
      "price": 49.99,
      "calls_per_month": 50000
    },
    {
      "name": "Enterprise",
      "price": null,
      "negotiable": true
    }
  ]
}
```

---

## 6. 权限控制

### 6.1 权限层级

```
┌─────────────────────────────────┐
│  Tenant Isolation              │  ← L1: 租户隔离
├─────────────────────────────────┤
│  API Key Scope                 │  ← L2: Key 级别权限
│  task:create, task:read        │
│  capability:call:*             │
├─────────────────────────────────┤
│  Capability-specific Scope      │  ← L3: 能力粒度权限
│  product.search ✓              │
│  order.create  ✗ (需显式授权)   │
└─────────────────────────────────┘
```

### 6.2 授权操作

```javascript
// 授权用户使用能力
await client.authorizeCapability({
  capability_id: 'product.search',
  user_id: 'user_abc123',
  permissions: ['call', 'view_usage']
});

// 撤销授权
await client.revokeCapabilityPermission({
  capability_id: 'product.search',
  user_id: 'user_abc123'
});

// 查询用户权限
const permissions = await client.getCapabilityPermissions({
  capability_id: 'product.search',
  user_id: 'user_abc123'
});
```

---

## 7. 审计日志

```json
{
  "event_id": "evt_a1b2c3d4e5f6",
  "timestamp": "2026-04-02T14:30:00Z",
  "actor": {
    "type": "api_key",
    "id": "ak_live_xxx",
    "tenant_id": "tenant_abc123"
  },
  "action": "capability.call",
  "resource": {
    "type": "capability",
    "id": "product.search"
  },
  "details": {
    "input": { "query": "laptop" },
    "output_size_bytes": 2048,
    "execution_time_ms": 156
  },
  "result": "success",
  "cost": 0.0005
}
```

---

## 8. 风险等级

| 等级 | 说明 | 是否需要确认 | 示例 |
|------|------|-------------|------|
| `LOW` | 无财务/隐私风险 | ❌ 自动执行 | 商品搜索、天气查询 |
| `MEDIUM` | 有轻微风险 | ⚠️ 建议确认 | 修改个人信息、发送通知 |
| `HIGH` | 有较大风险 | ✅ 必须确认 | 下单支付、删除数据 |
| `CRITICAL` | 高危操作 | 🚨 必须人工介入 | 转账、注销账户 |

---

## 9. REST API 端点

| 方法 | 端点 | 说明 |
|------|------|------|
| `GET` | `/api/v3/capabilities` | 列出所有能力 |
| `GET` | `/api/v3/capabilities/{id}` | 获取能力详情 |
| `POST` | `/api/v3/capabilities` | 注册新能力 |
| `POST` | `/api/v3/capabilities/execute` | 执行能力调用 |
| `POST` | `/api/v3/capabilities/{id}/authorize` | 授权用户 |
| `DELETE` | `/api/v3/capabilities/{id}/authorize/{user_id}` | 撤销授权 |
| `GET` | `/api/v3/capabilities/{id}/permissions/{user_id}` | 查询权限 |
| `POST` | `/api/v3/capabilities/cost-estimate` | 预估调用成本 |

---

## 10. 错误码

| 错误码 | 说明 |
|--------|------|
| `CAPABILITY_NOT_FOUND` | 能力不存在 |
| `CAPABILITY_DEPRECATED` | 能力已废弃 |
| `INVALID_INPUT` | 输入参数不符合 Schema |
| `PERMISSION_DENIED` | 无权调用该能力 |
| `RATE_LIMIT_EXCEEDED` | 超过调用频率限制 |
| `EXECUTION_FAILED` | 能力执行失败 |
| `QUOTA_EXCEEDED` | 超过配额限制 |
