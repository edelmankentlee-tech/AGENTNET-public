/**
 * AgentNet SDK - 客户端核心
 * AgentNet Protocol V3
 */

import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import {
  AgentNetClientConfig,
  TaskStatus,
  CreateTaskOptions,
  TaskResult,
  DecisionRequest,
  TaskEvent,
  CapabilityResult
} from './types';
import {
  AgentNetError,
  AuthenticationError,
  NetworkError,
  RateLimitError
} from './errors';

interface EnterpriseTaskOptions extends CreateTaskOptions {
  status?: string;
  context?: string;
  action?: string;
  microtask?: string;
  agent_hint?: string;
  organization_id?: string;
  fleet_id?: string;
  correlation_id?: string;
  request_id?: string;
  task_id?: string;
}

const readText = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
};

const uniqueStrings = (values: Array<unknown>): string[] => {
  const set = new Set<string>();
  for (const value of values) {
    const text = readText(value);
    if (text) set.add(text);
  }
  return Array.from(set);
};

/**
 * AgentNet 客户端
 */
export class AgentNetClient {
  private ws: WebSocket | null = null;
  private config: AgentNetClientConfig;
  private eventHandlers: Map<string, Set<(event: TaskEvent) => void>> = new Map();
  private decisionHandlers: Set<(decision: DecisionRequest) => Promise<void>> = new Set();
  private pendingTasks: Map<string, {
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
  }> = new Map();

  constructor(config: AgentNetClientConfig) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      ...config
    };
  }

  /**
   * 连接 WebSocket
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.endpoint, {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'X-Client-Version': '1.0.0'
          }
        });

        this.ws.on('open', () => {
          console.log('[AgentNet] 已连接到服务器');
          resolve();
        });

        this.ws.on('message', (data) => {
          this.handleMessage(data.toString());
        });

        this.ws.on('error', (error) => {
          reject(new NetworkError('WebSocket 连接失败', error));
        });

        this.ws.on('close', () => {
          console.log('[AgentNet] 连接已关闭');
        });
      } catch (error) {
        reject(new NetworkError('连接失败', error as Error));
      }
    });
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * 创建任务
   */
  async createTask(options: EnterpriseTaskOptions): Promise<{ task_id: string; request_id: string; correlation_id: string }> {
    const taskId = readText(options.task_id) || readText((options as { request_id?: string }).request_id) || uuidv4();
    const requestId = readText((options as { request_id?: string }).request_id) || uuidv4();
    const correlationId = readText((options as { correlation_id?: string }).correlation_id) || requestId;

    const taskData = {
      ...options,
      task_id: taskId,
      context: readText(options.context) || (options as Record<string, unknown>).projectId,
      action: readText(options.action) || readText((options as Record<string, unknown>).title),
      type: readText((options as { type: string }).type),
      input: (options as Record<string, unknown>).input,
      request_id: requestId,
      correlation_id: correlationId,
    };

    const message = {
      type: 'create_task',
      task_id: taskId,
      request_id: requestId,
      correlation_id: correlationId,
      status: readText((options as { status?: string }).status) || TaskStatus.PENDING,
      context: taskData.context,
      action: taskData.action,
      microtask: readText(options.microtask),
      agent_hint: readText(options.agent_hint),
      organization_id: readText(options.organization_id),
      fleet_id: readText(options.fleet_id),
      payload: taskData
    };

    await this.send(message);

    return {
      task_id: taskId,
      request_id: requestId,
      correlation_id: correlationId
    };
  }

  /**
   * 获取任务状态
   */
  async getTask(taskId: string): Promise<TaskResult> {
    const requestId = uuidv4();
    const correlationId = requestId;
    const message = {
      type: 'get_task',
      task_id: taskId,
      request_id: requestId,
      correlation_id: correlationId,
    };

    const response = await this.sendAndWait(message, [taskId, requestId, correlationId]);
    return response as TaskResult;
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: string): Promise<void> {
    const message = {
      type: 'cancel_task',
      task_id: taskId
    };

    await this.send(message);
  }

  /**
   * 调用能力
   */
  async callCapability(
    taskId: string,
    capabilityId: string,
    input: Record<string, unknown>
  ): Promise<CapabilityResult> {
    const requestId = uuidv4();
    const correlationId = uuidv4();
    const message = {
      type: 'call_capability',
      task_id: taskId,
      request_id: requestId,
      correlation_id: correlationId,
      capability_id: capabilityId,
      input
    };

    const response = await this.sendAndWait(message, [taskId, requestId, correlationId]);
    return response as CapabilityResult;
  }

  /**
   * 确认决策
   */
  async confirmDecision(
    decisionId: string,
    optionId: string
  ): Promise<void> {
    const message = {
      type: 'confirm_decision',
      decision_id: decisionId,
      option_id: optionId
    };

    await this.send(message);
  }

  /**
   * 拒绝决策
   */
  async rejectDecision(decisionId: string, reason?: string): Promise<void> {
    const message = {
      type: 'reject_decision',
      decision_id: decisionId,
      reason
    };

    await this.send(message);
  }

  /**
   * 监听任务事件
   */
  onTaskEvent(taskId: string, handler: (event: TaskEvent) => void): void {
    if (!this.eventHandlers.has(taskId)) {
      this.eventHandlers.set(taskId, new Set());
    }
    this.eventHandlers.get(taskId)!.add(handler);
  }

  /**
   * 取消监听任务事件
   */
  offTaskEvent(taskId: string, handler: (event: TaskEvent) => void): void {
    this.eventHandlers.get(taskId)?.delete(handler);
  }

  /**
   * 监听决策请求
   */
  onDecision(handler: (decision: DecisionRequest) => Promise<void>): void {
    this.decisionHandlers.add(handler);
  }

  /**
   * 发送消息
   */
  private async send(message: object): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new NetworkError('WebSocket 未连接');
    }

    return new Promise((resolve, reject) => {
      this.ws!.send(JSON.stringify(message), (error) => {
        if (error) {
          reject(new NetworkError('发送消息失败', error));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 发送消息并等待响应
   */
  private sendAndWait(message: object, correlationIds: string | string[]): Promise<unknown> {
    const keys = uniqueStrings(Array.isArray(correlationIds) ? correlationIds : [correlationIds]);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        for (const key of keys) {
          this.pendingTasks.delete(key);
        }
        reject(new AgentNetError('请求超时', 'TIMEOUT', 408));
      }, this.config.timeout);

      const taskState = {
        resolve: (result: unknown) => {
          clearTimeout(timeout);
          for (const key of keys) {
            this.pendingTasks.delete(key);
          }
          resolve(result);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          for (const key of keys) {
            this.pendingTasks.delete(key);
          }
          reject(error);
        },
      };

      for (const key of keys) {
        this.pendingTasks.set(key, taskState);
      }

      this.send(message).catch((error) => {
        taskState.reject(error instanceof Error ? error : new Error(String(error)));
      });
    });
  }

  /**
   * 处理收到的消息
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as Record<string, unknown>;
      const type = readText(message.type);
      const payload = message.payload as TaskEvent | Record<string, unknown> | null;
      const taskId = readText(message.task_id);
      const requestId = readText(message.request_id);
      const correlationId = readText(message.correlation_id);
      const taskCorrelationIds = uniqueStrings([taskId, requestId, correlationId, readText((message as Record<string, unknown>).id)]);

      if (type === 'decision_required') {
        const decision = payload as DecisionRequest;
        this.decisionHandlers.forEach((handler) => {
          handler(decision).catch(console.error);
        });
        return;
      }

      if (!payload) return;

      if (taskId) {
        const event = payload as TaskEvent;
        const handlers = this.eventHandlers.get(taskId);
        handlers?.forEach((handler) => handler(event));
      }

      const pendingKey = taskCorrelationIds.find((key) => this.pendingTasks.has(key));
      if (!pendingKey) return;
      const pending = this.pendingTasks.get(pendingKey);
      if (!pending) return;

      if (type === 'task_event' || type === 'task_progress') {
        pending.resolve(message);
        return;
      }

      if (typeof (payload as TaskEvent).type === 'string') {
        const payloadType = readText((payload as TaskEvent).type);
        if (payloadType === 'task_completed' || payloadType === 'task_failed') {
          pending.resolve((payload as TaskEvent).payload);
          return;
        }
      }

      const event = payload as TaskEvent;
      if (readText(event.type) && readText((event as TaskEvent).type)) {
        pending.resolve(event);
      } else {
        pending.resolve(message);
      }
    } catch (error) {
      console.error('[AgentNet] 解析消息失败:', error);
    }
  }
}
