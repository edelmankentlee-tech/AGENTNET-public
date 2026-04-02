/**
 * AgentNet SDK - 错误定义
 * AgentNet Protocol V3
 */

/**
 * AgentNet 错误基类
 */
export class AgentNetError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AgentNetError';
  }
}

/**
 * 认证错误
 */
export class AuthenticationError extends AgentNetError {
  constructor(message = '认证失败，请检查 API Key') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

/**
 * 权限错误
 */
export class PermissionError extends AgentNetError {
  constructor(message = '权限不足') {
    super(message, 'PERMISSION_ERROR', 403);
    this.name = 'PermissionError';
  }
}

/**
 * 资源不存在
 */
export class NotFoundError extends AgentNetError {
  constructor(resource: string) {
    super(`资源不存在: ${resource}`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

/**
 * 任务执行错误
 */
export class TaskExecutionError extends AgentNetError {
  constructor(
    taskId: string,
    message: string,
    public originalError?: Error
  ) {
    super(`任务执行失败 [${taskId}]: ${message}`, 'TASK_EXECUTION_ERROR');
    this.name = 'TaskExecutionError';
  }
}

/**
 * 决策超时错误
 */
export class DecisionTimeoutError extends AgentNetError {
  constructor(decisionId: string, timeoutMs: number) {
    super(`决策超时 [${decisionId}]: ${timeoutMs}ms 内未收到响应`, 'DECISION_TIMEOUT');
    this.name = 'DecisionTimeoutError';
  }
}

/**
 * 能力调用错误
 */
export class CapabilityError extends AgentNetError {
  constructor(
    capabilityId: string,
    message: string,
    public originalError?: Error
  ) {
    super(`能力调用失败 [${capabilityId}]: ${message}`, 'CAPABILITY_ERROR');
    this.name = 'CapabilityError';
  }
}

/**
 * 网络错误
 */
export class NetworkError extends AgentNetError {
  constructor(message: string, public originalError?: Error) {
    super(`网络错误: ${message}`, 'NETWORK_ERROR');
    this.name = 'NetworkError';
  }
}

/**
 * 速率限制错误
 */
export class RateLimitError extends AgentNetError {
  constructor(
    public retryAfterMs?: number
  ) {
    super('请求频率超限', 'RATE_LIMIT_ERROR', 429);
    this.name = 'RateLimitError';
  }
}
