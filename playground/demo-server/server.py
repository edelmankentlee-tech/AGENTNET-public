#!/usr/bin/env python3
"""
AgentNet Protocol Playground Demo Server

一个简单的演示服务器，用于测试 AgentNet Protocol V3。
不适用于生产环境！

使用方法:
    python demo_server.py

启动后访问 http://localhost:3000
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 创建 FastAPI 应用
app = FastAPI(title='AgentNet Protocol Playground')

# 静态文件
BASE_DIR = Path(__file__).parent
app.mount('/static', StaticFiles(directory=str(BASE_DIR / 'web-ui')), name='static')


@app.get('/')
async def index():
    """返回 Playground HTML"""
    html_path = BASE_DIR / 'web-ui' / 'index.html'
    return HTMLResponse(content=html_path.read_text(), status_code=200)


# ===================== WebSocket 处理 =====================

class ConnectionManager:
    """WebSocket 连接管理器"""

    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, agent_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[agent_id] = websocket
        logger.info(f'Agent 连接: {agent_id}')

    def disconnect(self, agent_id: str):
        if agent_id in self.active_connections:
            del self.active_connections[agent_id]
        logger.info(f'Agent 断开: {agent_id}')

    async def send(self, agent_id: str, message: dict):
        if agent_id in self.active_connections:
            await self.active_connections[agent_id].send_json(message)


manager = ConnectionManager()


@app.websocket('/ws')
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket 端点 - 演示服务器

    注意：这是一个模拟服务器，仅用于测试前端界面。
    实际协议处理请使用完整的 reference implementation。
    """
    agent_id = None

    try:
        # 接收认证消息
        auth_msg = await websocket.receive_json()
        logger.info(f'收到认证消息: {auth_msg}')

        if auth_msg.get('type') == 'connect':
            agent_id = auth_msg.get('payload', {}).get('agent_id', 'unknown')
            await manager.connect(agent_id, websocket)

            # 发送连接确认
            await websocket.send_json({
                'type': 'connected',
                'payload': {
                    'agent_id': agent_id,
                    'protocol_version': '3.0',
                    'session_id': f'session_{uuid.uuid4().hex[:8]}'
                }
            })

        # 进入消息循环
        while True:
            message = await websocket.receive_json()
            await handle_message(agent_id, message, websocket)

    except WebSocketDisconnect:
        if agent_id:
            manager.disconnect(agent_id)
    except Exception as e:
        logger.error(f'WebSocket 错误: {e}')
        if agent_id:
            manager.disconnect(agent_id)


async def handle_message(agent_id: str, message: dict, websocket: WebSocket):
    """
    处理 WebSocket 消息

    支持的消息类型:
    - task.request: 创建任务（模拟处理）
    - ping: 心跳
    - subscribe: 订阅主题
    """
    msg_type = message.get('type')
    payload = message.get('payload', {})

    logger.info(f'[{agent_id}] 收到消息: {msg_type}')

    if msg_type == 'task.request':
        # 模拟处理任务
        task_id = payload.get('task_id', f'task_{uuid.uuid4().hex[:8]}')

        await websocket.send_json({
            'type': 'task.started',
            'payload': {
                'task_id': task_id,
                'started_at': datetime.utcnow().isoformat()
            }
        })

        # 模拟处理延迟
        await asyncio.sleep(0.5)

        # 返回结果
        result = {
            'type': 'task.completed',
            'payload': {
                'task_id': task_id,
                'status': 'completed',
                'output': {
                    'message': f'任务 {task_id} 处理完成！',
                    'echo': payload.get('input', {}),
                    'timestamp': datetime.utcnow().isoformat()
                }
            }
        }
        await websocket.send_json(result)

        logger.info(f'[{agent_id}] 任务完成: {task_id}')

    elif msg_type == 'ping':
        await websocket.send_json({
            'type': 'pong',
            'payload': {}
        })

    elif msg_type == 'subscribe':
        topic = payload.get('topic')
        await websocket.send_json({
            'type': 'subscribed',
            'payload': {'topic': topic}
        })

    else:
        await websocket.send_json({
            'type': 'error',
            'payload': {
                'code': 'UNKNOWN_MESSAGE_TYPE',
                'message': f'未知消息类型: {msg_type}'
            }
        })


# ===================== 健康检查 =====================

@app.get('/health')
async def health():
    """健康检查"""
    return {
        'status': 'healthy',
        'service': 'agentnet-playground',
        'version': '1.0.0',
        'timestamp': datetime.utcnow().isoformat(),
        'connections': len(manager.active_connections)
    }


@app.get('/api/demo')
async def demo_api():
    """演示 API"""
    return {
        'message': '这是 AgentNet Protocol Playground 演示服务器',
        'endpoints': {
            'websocket': '/ws',
            'docs': '/docs',
            'health': '/health'
        },
        'note': '此服务器仅用于演示，不适用于生产环境'
    }


# ===================== 启动 =====================

def main():
    import uvicorn

    print("""
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🤖 AgentNet Protocol Playground - Demo Server           ║
║                                                           ║
║   🌐 http://localhost:3000                                ║
║   📚 API Docs: http://localhost:3000/docs                 ║
║                                                           ║
║   按 Ctrl+C 停止服务器                                    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    """)

    uvicorn.run(app, host='0.0.0.0', port=3000, log_level='info')


if __name__ == '__main__':
    main()
