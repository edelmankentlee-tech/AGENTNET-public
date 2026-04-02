# Message Envelope（消息信封格式）

**版本**: V3.0  
**状态**: 正式发布

---

## 1. 概述

Message Envelope 是 AgentNet Protocol V3 的传输层协议，定义了跨消息通道的统一信封格式，负责消息的路由、签名验证和序列化。

> **设计原则**：Stateless Transport（无状态传输），信封本身不含业务语义，仅负责可靠传输。

---

## 2. 消息信封结构

### 2.1 完整信封格式

```json
{
  "envelope": {
    "version": "3.0",
    "message_id": "msg_550e8400-e29b-41d4-a716-446655440000",
    "type": "task.request",
    "timestamp": "2026-04-02T10:00:00.123Z",
    "sender": {
      "agent_id": "shopping-agent-v2",
      "tenant_id": "tenant_abc123",
      "session_id": "session_xyz789"
    },
    "receiver": {
      "agent_id": "product-adapter",
      "tenant_id": "tenant_abc123"
    },
    "reply_to": "msg_parent_xxx",
    "correlation_id": "corr_12345",
    "headers": {
      "content_type": "application/json",
      "content_encoding": "utf-8",
      "priority": "normal",
      "ttl_ms": 30000
    },
    "routing": {
      "hop_count": 0,
      "max_hops": 10,
      "path": []
    }
  },
  "payload": {
    // 业务数据，格式由 type 决定
  },
  "signature": "MEUCIQD...（ECDSA 签名）",
  "compression": null
}
```

### 2.2 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `version` | string | ✅ | 协议版本，当前为 "3.0" |
| `message_id` | string (UUID) | ✅ | 全局唯一消息 ID |
| `type` | string | ✅ | 消息类型 |
| `timestamp` | ISO8601 | ✅ | 发送时间戳（UTC） |
| `sender` | object | ✅ | 发送方信息 |
| `receiver` | object | ✅ | 接收方信息 |
| `reply_to` | string | ❌ | 回调消息 ID |
| `correlation_id` | string | ❌ | 关联 ID（用于请求/响应匹配） |
| `headers` | object | ❌ | 扩展头信息 |
| `routing` | object | ❌ | 路由信息（网关填入） |

---

## 3. 消息类型

### 3.1 核心消息类型

| 类型 | 说明 | Payload |
|------|------|---------|
| `task.request` | 请求执行任务 | Task 对象 |
| `task.response` | 任务执行响应 | TaskResult |
| `task.event` | 任务事件推送 | Event 对象 |
| `decision.request` | 请求决策确认 | Decision 对象 |
| `decision.response` | 决策响应 | DecisionResponse |
| `capability.call` | 调用能力 | CapabilityCall |
| `capability.result` | 能力调用结果 | CapabilityResult |
| `ping` | 心跳检测 | - |
| `pong` | 心跳响应 | - |
| `error` | 错误消息 | Error 对象 |

### 3.2 Payload 示例

#### task.request

```json
{
  "payload": {
    "task_id": "task_550e8400-e29b-41d4-a716-446655440000",
    "type": "shopping",
    "input": {
      "query": "买一台3000元以内的编程电脑"
    },
    "orchestration": {
      "dag": [...]
    }
  }
}
```

#### decision.request

```json
{
  "payload": {
    "decision_id": "dec_550e8400-e29b-41d4-a716-446655440000",
    "title": "请确认您的选择",
    "risk_level": "MEDIUM",
    "options": [...]
  }
}
```

---

## 4. 签名与验签

### 4.1 签名算法

支持两种签名算法：

| 算法 | 说明 | 适用场景 |
|------|------|----------|
| `ECDSA` | 椭圆曲线数字签名（推荐） | 标准场景 |
| `EdDSA` | Edwards 曲线数字签名 | 高性能场景 |

### 4.2 签名流程

```
1. 构造 envelope.payload_bytes = SHA256(JSON(payload))
2. 对 envelope 元数据 + payload_hash 进行签名
3. 将签名放入 envelope.signature
```

### 4.3 验签示例

```javascript
import { verifySignature, createSignature } from '@agentnet/sdk';

// 发送消息时签名
const envelope = {
  envelope: { /* ... */ },
  payload: { /* ... */ }
};
envelope.signature = createSignature(envelope, privateKey);

// 接收消息时验签
const isValid = verifySignature(envelope, publicKey);
if (!isValid) {
  throw new Error('签名验证失败');
}
```

---

## 5. 压缩与序列化

### 5.1 支持的序列化格式

| 格式 | Content-Type | 说明 |
|------|-------------|------|
| JSON | `application/json` | 默认格式 |
| MessagePack | `application/msgpack` | 更紧凑的二进制格式 |
| CBOR | `application/cbor` | 高效二进制格式 |

### 5.2 压缩算法

| 算法 | 说明 | 压缩比 |
|------|------|--------|
| `gzip` | GNU 压缩 | 中等 |
| `zstd` | Zstandard（推荐） | 高 |
| `lz4` | 极速压缩 | 中等（速度最快） |

### 5.3 压缩使用示例

```javascript
// 请求压缩（适用于大 payload）
const envelope = {
  envelope: {
    headers: {
      content_encoding: 'gzip',
      content_type: 'application/json'
    }
  },
  payload: compressedPayload,
  compression: 'gzip'
};

// Gateway 自动解压
if (envelope.compression) {
  envelope.payload = decompress(envelope.payload, envelope.compression);
}
```

---

## 6. 路由机制

### 6.1 跳数限制（Hop Count）

```javascript
// 防止消息无限循环
{
  "routing": {
    "hop_count": 0,      // 当前跳数
    "max_hops": 10,      // 最大跳数
    "path": []           // 经过的节点路径
  }
}
```

### 6.2 多跳路由

```
Sender → Gateway1 → Gateway2 → Gateway3 → Receiver

每一跳更新:
hop_count++
path.push(current_gateway_id)
```

---

## 7. WebSocket 消息帧

### 7.1 帧格式

```javascript
// 连接建立
{
  "type": "connect",
  "payload": {
    "agent_id": "shopping-agent",
    "token": "jwt_token_here",
    "protocol_version": "3.0"
  }
}

// 心跳
{
  "type": "ping",
  "payload": {}
}

// 推送消息
{
  "type": "message",
  "envelope": { /* 消息信封 */ }
}

// 确认收到
{
  "type": "ack",
  "envelope_id": "msg_xxx"
}
```

---

## 8. 错误处理

### 8.1 错误消息格式

```json
{
  "envelope": {
    "type": "error",
    "message_id": "msg_error_xxx",
    "timestamp": "2026-04-02T10:00:00Z",
    "sender": { "agent_id": "gateway" },
    "receiver": { "agent_id": "shopping-agent" }
  },
  "payload": {
    "error_code": "INVALID_SIGNATURE",
    "message": "消息签名验证失败",
    "details": {
      "reason": "签名已过期",
      "expired_at": "2026-04-02T09:00:00Z"
    },
    "original_envelope_id": "msg_xxx"
  }
}
```

### 8.2 错误码

| 错误码 | 说明 |
|--------|------|
| `INVALID_VERSION` | 协议版本不兼容 |
| `INVALID_SIGNATURE` | 签名验证失败 |
| `MESSAGE_EXPIRED` | 消息 TTL 超时 |
| `HOP_COUNT_EXCEEDED` | 超过最大跳数 |
| `SENDER_NOT_FOUND` | 发送方 Agent 不存在 |
| `RECEIVER_NOT_FOUND` | 接收方 Agent 不存在 |
| `RATE_LIMIT_EXCEEDED` | 发送频率超限 |
| `PAYLOAD_TOO_LARGE` | Payload 超过大小限制 |
