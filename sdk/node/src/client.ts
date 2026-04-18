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
  async createTask(options: CreateTaskOptions): Promise<{ task_id: string }> {
    const taskId = uuidv4();
    const message = {
      type: 'create_task',
      task_id: taskId,
      payload: options
    };

    await this.send(message);

    return { task_id: taskId };
  }

  /**
   * 获取任务状态
   */
  async getTask(taskId: string): Promise<TaskResult> {
    const message = {
      type: 'get_task',
      task_id: taskId
    };

    // 发送请求并等待响应
    const response = await this.sendAndWait(message, taskId);
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
    const message = {
      type: 'call_capability',
      task_id: taskId,
      capability_id: capabilityId,
      input
    };

    const response = await this.sendAndWait(message, `${taskId}:${capabilityId}`);
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
  private sendAndWait(message: object, correlationId: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingTasks.delete(correlationId);
        reject(new AgentNetError('请求超时', 'TIMEOUT', 408));
      }, this.config.timeout);

      this.pendingTasks.set(correlationId, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });

      this.send(message).catch(reject);
    });
  }

  /**
   * 处理收到的消息
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      const { type, task_id, payload } = message;

      if (type === 'decision_required') {
        // 处理决策请求
        const decision = payload as DecisionRequest;
        this.decisionHandlers.forEach((handler) => {
          handler(decision).catch(console.error);
        });
      } else if (task_id) {
        // 处理任务事件
        const event = payload as TaskEvent;
        const handlers = this.eventHandlers.get(task_id);
        handlers?.forEach((handler) => handler(event));

        // 处理待响应的 Promise
        const pending = this.pendingTasks.get(task_id);
        if (pending) {
          if (event.type === 'task_completed' || event.type === 'task_failed') {
            pending.resolve(event.payload);
          } else {
            pending.resolve(event);
          }
        }
      }
    } catch (error) {
      console.error('[AgentNet] 解析消息失败:', error);
    }
  }
}
