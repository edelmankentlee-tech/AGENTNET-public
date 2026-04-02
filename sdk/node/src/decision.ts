/**
 * AgentNet SDK - 决策引擎
 * AgentNet Protocol V3
 */

import { RiskLevel, DecisionRequest, DecisionOption } from './types';

/**
 * 决策配置
 */
export interface DecisionEngineConfig {
  autoConfirmLowRisk?: boolean;
  requireManualConfirmForHighRisk?: boolean;
}

/**
 * 决策结果
 */
export interface DecisionResult {
  decision_id: string;
  action: 'confirm' | 'reject' | 'escalate';
  selected_option?: DecisionOption;
  reason?: string;
}

/**
 * 决策引擎
 * 用于处理 Agent 决策请求
 */
export class DecisionEngine {
  private config: DecisionEngineConfig;

  constructor(config: DecisionEngineConfig = {}) {
    this.config = {
      autoConfirmLowRisk: true,
      requireManualConfirmForHighRisk: true,
      ...config
    };
  }

  /**
   * 处理决策请求
   */
  async processDecision(decision: DecisionRequest): Promise<DecisionResult> {
    // 低风险自动确认
    if (decision.risk_level === RiskLevel.LOW && this.config.autoConfirmLowRisk) {
      return {
        decision_id: decision.id,
        action: 'confirm',
        selected_option: decision.options[0],
        reason: '自动确认低风险决策'
      };
    }

    // 高风险需要人工确认
    if (
      (decision.risk_level === RiskLevel.HIGH || decision.risk_level === RiskLevel.CRITICAL) &&
      this.config.requireManualConfirmForHighRisk
    ) {
      return {
        decision_id: decision.id,
        action: 'escalate',
        reason: '需要人工确认'
      };
    }

    // 中等风险：基于推理选择
    return this.selectBasedOnReasoning(decision);
  }

  /**
   * 基于推理选择选项
   */
  private selectBasedOnReasoning(decision: DecisionRequest): DecisionResult {
    // 如果有推理过程，选择推理推荐的选项
    if (decision.reasoning && decision.options.length > 0) {
      return {
        decision_id: decision.id,
        action: 'confirm',
        selected_option: decision.options[0],
        reason: decision.reasoning
      };
    }

    // 否则选择第一个
    return {
      decision_id: decision.id,
      action: 'confirm',
      selected_option: decision.options[0],
      reason: '默认选择第一个选项'
    };
  }

  /**
   * 评估风险等级
   */
  evaluateRisk(options: DecisionOption[], context: Record<string, unknown>): RiskLevel {
    // 简单的风险评估逻辑
    // 实际实现可能更复杂
    const hasHighValueAction = options.some(
      (opt) => opt.metadata?.value && (opt.metadata.value as number) > 1000
    );

    if (hasHighValueAction) {
      return RiskLevel.MEDIUM;
    }

    return RiskLevel.LOW;
  }

  /**
   * 生成决策解释
   */
  explainDecision(decision: DecisionRequest, result: DecisionResult): string {
    const parts: string[] = [
      `决策 ID: ${decision.id}`,
      `风险等级: ${decision.risk_level}`,
      `执行动作: ${result.action}`
    ];

    if (result.selected_option) {
      parts.push(`选择的选项: ${result.selected_option.label}`);
    }

    if (result.reason) {
      parts.push(`原因: ${result.reason}`);
    }

    if (decision.alternatives && decision.alternatives.length > 0) {
      parts.push(`考虑过的替代方案: ${decision.alternatives.join(', ')}`);
    }

    return parts.join('\n');
  }
}
