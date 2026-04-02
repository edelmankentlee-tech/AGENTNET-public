# 示例：编程辅助 Agent

**版本**: V3.0

---

## 1. Agent 概述

编程辅助 Agent 演示了如何使用 AgentNet Protocol V3 构建：
- 代码生成和审查能力
- 多步骤任务编排（DAG）
- 集成开发工具（Git、Docker）
- Decision Protocol 用于代码审查确认

---

## 2. 完整代码

```javascript
/**
 * Coding Agent - 编程辅助 Agent 示例
 *
 * 功能：
 * 1. 理解编程任务意图
 * 2. 生成代码实现
 * 3. 执行测试验证
 * 4. 代码审查与确认
 */

import {
  AgentNetClient,
  AgentRuntime
} from '@agentnet/sdk';

class CodingAgent {
  constructor(apiKey, options = {}) {
    this.client = new AgentNetClient({
      apiKey,
      endpoint: 'wss://api.agentnet.ai/ws',
      agentId: options.agentId || 'coding-agent-v1'
    });

    this.runtime = new AgentRuntime();
    this.setupHandlers();
  }

  setupHandlers() {
    this.client.onTask(async (task) => {
      console.log(`[Coding] 收到任务: ${task.id}`);

      try {
        const result = await this.processCodingTask(task);
        await this.client.completeTask(task.id, result);
      } catch (error) {
        console.error('[Coding] 任务失败:', error);
        await this.client.failTask(task.id, {
          error: error.message,
          code: error.code || 'UNKNOWN_ERROR'
        });
      }
    });
  }

  async processCodingTask(task) {
    const { action, language, description, context = {} } = task.input;

    console.log(`[Coding] 处理: ${action} - ${language}`);

    switch (action) {
      case 'generate':
        return await this.generateCode(task);
      case 'review':
        return await this.reviewCode(task);
      case 'debug':
        return await this.debugCode(task);
      case 'refactor':
        return await this.refactorCode(task);
      default:
        throw new Error(`不支持的操作: ${action}`);
    }
  }

  async generateCode(task) {
    const { language, description, framework } = task.input;

    // Step 1: 分析需求
    const analysis = await this.analyzeRequirements(description);

    // Step 2: 生成代码
    const generatedCode = await this.callCapability('code.generate', {
      language,
      framework,
      spec: analysis.spec,
      patterns: analysis.patterns
    });

    // Step 3: 创建审查决策
    const decisionCard = await this.createCodeReviewDecision({
      taskId: task.id,
      code: generatedCode.code,
      language,
      issues: generatedCode.issues || []
    });

    if (decisionCard.riskLevel === 'LOW' && generatedCode.issues.length === 0) {
      // 无问题，自动通过
      return {
        type: 'code_generated',
        code: generatedCode.code,
        language,
        confidence: generatedCode.confidence
      };
    }

    // 有问题，等待审查
    return {
      type: 'decision_card',
      decision: decisionCard
    };
  }

  async reviewCode(task) {
    const { code, language, rules = [] } = task.input;

    // 调用代码审查 Capability
    const review = await this.callCapability('code.review', {
      code,
      language,
      rules: rules.length > 0 ? rules : ['default']
    });

    return {
      type: 'code_review',
      issues: review.issues,
      score: review.score,
      summary: review.summary,
      suggestions: review.suggestions
    };
  }

  async debugCode(task) {
    const { code, error, language } = task.input;

    // 调用调试 Capability
    const debug = await this.callCapability('code.debug', {
      code,
      error_message: error,
      language
    });

    return {
      type: 'debug_result',
      root_cause: debug.root_cause,
      fix: debug.fix,
      explanation: debug.explanation,
      confidence: debug.confidence
    };
  }

  async refactorCode(task) {
    const { code, target, language } = task.input;

    // Step 1: 分析当前代码
    const analysis = await this.callCapability('code.analyze', {
      code,
      language
    });

    // Step 2: 生成重构方案
    const refactored = await this.callCapability('code.refactor', {
      code,
      target,
      language,
      constraints: analysis.constraints
    });

    // Step 3: 对比差异
    const diff = await this.callCapability('code.diff', {
      original: code,
      refactored: refactored.code
    });

    return {
      type: 'refactor_result',
      original_code: code,
      refactored_code: refactored.code,
      changes: diff.summary,
      benefits: refactored.benefits
    };
  }

  async analyzeRequirements(description) {
    // 调用 NLP Capability 分析需求
    return await this.callCapability('nlp.analyze', {
      text: description,
      type: 'requirements'
    });
  }

  async callCapability(capability, input) {
    const result = await this.client.callCapability({
      capability,
      input,
      taskId: this.currentTaskId
    });
    return result.output;
  }

  async createCodeReviewDecision({ taskId, code, language, issues }) {
    const riskLevel = issues.filter(i => i.severity === 'error').length > 0
      ? 'HIGH'
      : issues.filter(i => i.severity === 'warning').length > 0
        ? 'MEDIUM'
        : 'LOW';

    return {
      decision_id: `dec_${Date.now()}`,
      task_id: taskId,
      title: '代码审查确认',
      description: `生成的 ${language} 代码需要审查`,
      risk_level: riskLevel,
      code_preview: code.substring(0, 500) + (code.length > 500 ? '...' : ''),
      issues: issues,
      options: [
        {
          option_id: 'approve',
          label: '确认代码',
          description: '代码通过审查'
        },
        {
          option_id: 'request_changes',
          label: '要求修改',
          description: '返回修改意见'
        }
      ]
    };
  }

  async start() {
    await this.client.connect();
    console.log('[Coding] Agent 已启动');
  }

  async stop() {
    await this.client.disconnect();
    console.log('[Coding] Agent 已停止');
  }
}

// 启动
const agent = new CodingAgent(process.env.AGENTNET_API_KEY);
agent.start().catch(console.error);
```

---

## 3. 使用示例

### 3.1 生成代码

```bash
curl -X POST https://api.agentnet.ai/api/v3/tasks \
  -H "Authorization: Bearer $AGENTNET_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "coding",
    "input": {
      "action": "generate",
      "language": "python",
      "framework": "fastapi",
      "description": "创建一个用户管理 API，包含注册、登录、获取用户信息功能"
    }
  }'
```

### 3.2 审查代码

```bash
curl -X POST https://api.agentnet.ai/api/v3/tasks \
  -H "Authorization: Bearer $AGENTNET_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "coding",
    "input": {
      "action": "review",
      "language": "javascript",
      "code": "function calculateSum(arr) { return arr.reduce((a, b) => a + b); }",
      "rules": ["eslint:recommended", "security"]
    }
  }'
```

### 3.3 调试代码

```bash
curl -X POST https://api.agentnet.ai/api/v3/tasks \
  -H "Authorization: Bearer $AGENTNET_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "coding",
    "input": {
      "action": "debug",
      "language": "python",
      "code": "def divide(a, b): return a / b",
      "error": "ZeroDivisionError: division by zero"
    }
  }'
```

---

## 4. 支持的 Capability

| Capability | 说明 | 风险等级 |
|-----------|------|----------|
| `code.generate` | 根据描述生成代码 | LOW |
| `code.review` | 代码审查和评分 | LOW |
| `code.debug` | 错误诊断和修复建议 | MEDIUM |
| `code.refactor` | 代码重构 | MEDIUM |
| `code.test` | 生成测试用例 | LOW |
| `code.analyze` | 代码静态分析 | LOW |
| `code.diff` | 代码差异对比 | LOW |

---

## 5. DAG 工作流示例

```yaml
task:
  type: coding
  action: full_stack_feature

orchestration:
  dag:
    # 分析需求
    - step_id: analyze
      action: nlp.analyze
      depends_on: []

    # 生成 API 代码
    - step_id: generate_api
      action: code.generate
      depends_on: [analyze]
      config:
        type: api
        language: python

    # 生成前端代码
    - step_id: generate_ui
      action: code.generate
      depends_on: [analyze]
      config:
        type: frontend
        language: javascript

    # 生成测试
    - step_id: generate_tests
      action: code.test
      depends_on: [generate_api]
      config:
        coverage_target: 80

    # 审查 API
    - step_id: review_api
      action: code.review
      depends_on: [generate_api]
      risk_level: MEDIUM

    # 审查前端
    - step_id: review_ui
      action: code.review
      depends_on: [generate_ui]
      risk_level: MEDIUM

    # 合并代码
    - step_id: merge
      action: git.commit
      depends_on: [review_api, review_ui, generate_tests]
      config:
        require_all_approved: true
```
