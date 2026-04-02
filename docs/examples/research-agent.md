# 示例：研究分析 Agent

**版本**: V3.0

---

## 1. Agent 概述

研究分析 Agent 演示了如何使用 AgentNet Protocol V3 构建：
- 多源信息搜集（网络、数据库、API）
- 数据分析与可视化
- 报告生成
- 多 Agent 协作

---

## 2. 完整代码

```javascript
/**
 * Research Agent - 研究分析 Agent 示例
 *
 * 功能：
 * 1. 搜集多源信息
 * 2. 数据清洗和分析
 * 3. 生成研究报告
 * 4. 支持多 Agent 协作
 */

import { AgentNetClient } from '@agentnet/sdk';

class ResearchAgent {
  constructor(apiKey, options = {}) {
    this.client = new AgentNetClient({
      apiKey,
      endpoint: 'wss://api.agentnet.ai/ws',
      agentId: options.agentId || 'research-agent-v1'
    });

    this.setupHandlers();
  }

  setupHandlers() {
    this.client.onTask(async (task) => {
      console.log(`[Research] 收到任务: ${task.id}`);

      try {
        const result = await this.processResearchTask(task);
        await this.client.completeTask(task.id, result);
      } catch (error) {
        console.error('[Research] 任务失败:', error);
        await this.client.failTask(task.id, {
          error: error.message
        });
      }
    });
  }

  async processResearchTask(task) {
    const { topic, scope, sources = [], format = 'markdown' } = task.input;

    console.log(`[Research] 开始研究: "${topic}"`);
    console.log(`[Research] 来源: ${sources.join(', ') || '自动选择'}`);

    // Phase 1: 搜集信息
    const collectedData = await this.collectInformation(topic, sources);

    // Phase 2: 分析数据
    const analysis = await this.analyzeData(collectedData);

    // Phase 3: 生成报告
    const report = await this.generateReport({
      topic,
      data: analysis,
      format
    });

    return {
      type: 'research_report',
      topic,
      report,
      sources: collectedData.sources,
      metadata: {
        generated_at: new Date().toISOString(),
        confidence: analysis.confidence,
        limitations: analysis.limitations
      }
    };
  }

  async collectInformation(topic, sources) {
    const selectedSources = sources.length > 0
      ? sources
      : ['web_search', 'news_api', 'academic_db'];

    const results = await Promise.allSettled(
      selectedSources.map(source => this.collectFromSource(source, topic))
    );

    const successful = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    const failed = results
      .filter(r => r.status === 'rejected')
      .map(r => ({ source: r.reason?.source, error: r.reason?.message }));

    return {
      data: successful,
      sources: successful.map(s => s.source),
      failed_sources: failed
    };
  }

  async collectFromSource(source, topic) {
    const capabilityMap = {
      'web_search': 'web.search',
      'news_api': 'news.search',
      'academic_db': 'academic.search',
      'social_media': 'social.search',
      'company_db': 'company.financials',
      'market_data': 'market.data'
    };

    const capability = capabilityMap[source];
    if (!capability) {
      throw new Error(`未知的来源: ${source}`);
    }

    console.log(`[Research] 从 ${source} 搜集...`);

    const result = await this.client.callCapability({
      capability,
      input: {
        query: topic,
        limit: 20,
        date_range: 'last_90_days'
      }
    });

    return {
      source,
      data: result.items || [],
      count: result.total || 0,
      timestamp: new Date().toISOString()
    };
  }

  async analyzeData(collectedData) {
    console.log('[Research] 开始分析数据...');

    // 调用数据分析 Capability
    const analysis = await this.client.callCapability({
      capability: 'data.analyze',
      input: {
        datasets: collectedData.data.map(d => d.data).flat(),
        methods: ['statistical', 'sentiment', 'trend'],
        topic_relevance: true
      }
    });

    // 提取关键洞察
    const insights = this.extractInsights(analysis);

    // 计算置信度
    const confidence = this.calculateConfidence(analysis, collectedData);

    return {
      summary: analysis.summary,
      insights,
      statistics: analysis.statistics,
      trends: analysis.trends,
      sentiment: analysis.sentiment,
      confidence,
      limitations: analysis.limitations
    };
  }

  extractInsights(analysis) {
    // 从分析结果中提取最重要的洞察
    const insights = [];

    if (analysis.trends?.upward?.length > 0) {
      insights.push({
        type: 'trend',
        direction: 'upward',
        description: `发现 ${analysis.trends.upward.length} 个上升趋势`
      });
    }

    if (analysis.sentiment?.positive > 0.6) {
      insights.push({
        type: 'sentiment',
        direction: 'positive',
        description: '整体情感偏正面'
      });
    }

    if (analysis.statistics?.anomalies?.length > 0) {
      insights.push({
        type: 'anomaly',
        description: `发现 ${analysis.statistics.anomalies.length} 个异常点`
      });
    }

    return insights;
  }

  calculateConfidence(analysis, collectedData) {
    let confidence = 0.5;

    // 数据来源越多，置信度越高
    confidence += Math.min(collectedData.data.length * 0.1, 0.3);

    // 数据量越大，置信度越高
    const totalItems = collectedData.data.reduce((sum, d) => sum + (d.count || 0), 0);
    if (totalItems > 100) confidence += 0.1;

    // 分析方法越多，置信度越高
    confidence += Math.min(analysis.methods_used?.length * 0.05 || 0, 0.1);

    return Math.min(confidence, 0.95);
  }

  async generateReport({ topic, data, format }) {
    console.log('[Research] 生成报告...');

    const report = await this.client.callCapability({
      capability: 'report.generate',
      input: {
        topic,
        summary: data.summary,
        insights: data.insights,
        statistics: data.statistics,
        format,
        sections: [
          'executive_summary',
          'key_findings',
          'detailed_analysis',
          'recommendations',
          'limitations'
        ]
      }
    });

    return report.content;
  }

  async start() {
    await this.client.connect();
    console.log('[Research] Agent 已启动');
  }
}

// 启动
const agent = new ResearchAgent(process.env.AGENTNET_API_KEY);
agent.start().catch(console.error);
```

---

## 3. 使用示例

### 3.1 创建研究报告任务

```bash
curl -X POST https://api.agentnet.ai/api/v3/tasks \
  -H "Authorization: Bearer $AGENTNET_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "research",
    "input": {
      "topic": "2026年AI Agent市场发展趋势",
      "scope": "全球市场",
      "sources": ["web_search", "news_api", "market_data"],
      "format": "markdown"
    }
  }'
```

### 3.2 响应示例

```json
{
  "success": true,
  "data": {
    "task_id": "task_xxx",
    "status": "completed",
    "output": {
      "type": "research_report",
      "topic": "2026年AI Agent市场发展趋势",
      "report": "# 研究报告\n\n## 执行摘要\n...",
      "sources": ["web_search", "news_api", "market_data"],
      "metadata": {
        "generated_at": "2026-04-02T10:05:00Z",
        "confidence": 0.87,
        "limitations": ["部分数据来源于公开资料"]
      }
    }
  }
}
```

---

## 4. 多 Agent 协作示例

```yaml
# research_team.yaml
task:
  type: multi_agent_collaboration
  topic: "深度研究: AI在医疗行业的应用"

agents:
  - role: coordinator
    agent_id: research-coordinator
    responsibilities:
      - 分解研究任务
      - 协调子 Agent
      - 汇总最终报告

  - role: web_researcher
    agent_id: web-research-agent
    capabilities: ["web.search", "content.extract"]
    max_concurrent: 3

  - role: data_analyst
    agent_id: data-analysis-agent
    capabilities: ["data.analyze", "statistics.compute"]
    max_concurrent: 1

  - role: medical_expert
    agent_id: medical-knowledge-agent
    capabilities: ["medical.knowledge", "clinical.trial.search"]
    max_concurrent: 1

workflow:
  phase_1:
    name: 信息搜集
    parallel: true
    agents: [web_researcher, medical_expert]
    tasks:
      - action: web.search_applications
        assignee: web_researcher
        input:
          query: "AI healthcare applications 2026"
          sources: [web, news, academic]

      - action: medical.search_trials
        assignee: medical_expert
        input:
          phase: "phase_3_trials"
          area: "AI_diagnostics"

  phase_2:
    name: 数据分析
    agents: [data_analyst]
    depends_on: [phase_1]
    tasks:
      - action: statistics.analyze
        assignee: data_analyst
        input:
          sources: [web_researcher, medical_expert]
          methods: [statistical, trend, comparative]

  phase_3:
    name: 报告生成
    agents: [coordinator]
    depends_on: [phase_2]
    tasks:
      - action: report.generate
        assignee: coordinator
        input:
          sections: [executive_summary, findings, recommendations]
          format: markdown

decision_points:
  - when: phase_1_complete
    action: review_data_quality
    risk_level: LOW
    auto_confirm: true

  - when: phase_3_complete
    action: confirm_publication
    risk_level: MEDIUM
    required_role: research_manager
```

---

## 5. 支持的 Capability

| Capability | 说明 | 来源类型 |
|-----------|------|---------|
| `web.search` | 网页搜索 | 信息搜集 |
| `news.search` | 新闻搜索 | 信息搜集 |
| `academic.search` | 学术文献搜索 | 信息搜集 |
| `social.search` | 社交媒体分析 | 信息搜集 |
| `company.financials` | 公司财务数据 | 信息搜集 |
| `market.data` | 市场数据 | 信息搜集 |
| `data.analyze` | 数据分析 | 分析 |
| `statistics.compute` | 统计分析 | 分析 |
| `report.generate` | 报告生成 | 输出 |
| `chart.generate` | 图表生成 | 可视化 |
