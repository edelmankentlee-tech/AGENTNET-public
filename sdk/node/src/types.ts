/**
 * AgentNet SDK - 类型定义
 * AgentNet Protocol V3
 */

/**
 * 任务状态枚举
 */
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  BLOCKED = 'blocked',
  RUNNING = 'in_progress',
  FAILED = 'blocked',
  CANCELLED = 'blocked'
}

/**
 * 风险等级枚举
 */
export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * 任务输入
 */
export interface TaskInput {
  query?: string;
  [key: string]: unknown;
}

/**
 * 任务上下文
 */
export interface TaskContext {
  user_id?: string;
  session_id?: string;
  preferences?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * 任务创建选项
 */
export interface CreateTaskOptions {
  type: string;
  input: TaskInput;
  context?: TaskContext;
  timeout_ms?: number;
  orchestration?: {
    dag?: DAGStep[];
  };
}

/**
 * DAG 步骤
 */
export interface DAGStep {
  step_id: string;
  action: string;
  depends_on?: string[];
  retry_policy?: {
    max_retries?: number;
    backoff_ms?: number;
  };
}

/**
 * 任务结果
 */
export interface TaskResult {
  task_id: string;
  status: TaskStatus;
  output?: unknown;
  error?: string;
  completed_at?: string;
}

/**
 * 决策选项
 */
export interface DecisionOption {
  id: string;
  label: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 决策请求
 */
export interface DecisionRequest {
  id: string;
  type: string;
  risk_level: RiskLevel;
  options: DecisionOption[];
  reasoning?: string;
  alternatives?: string[];
  created_at: string;
  requires_confirmation: boolean;
}

/**
 * SDK 配置
 */
export interface AgentNetClientConfig {
  apiKey: string;
  endpoint: string;
  timeout?: number;
  retryAttempts?: number;
}

/**
 * 事件类型
 */
export interface TaskEvent {
  type: 'task_started' | 'task_progress' | 'task_completed' | 'task_failed' | 'decision_required';
  task_id: string;
  payload: unknown;
  timestamp: string;
}

/**
 * 能力调用结果
 */
export interface CapabilityResult {
  capability_id: string;
  success: boolean;
  output?: unknown;
  error?: string;
  duration_ms?: number;
}
