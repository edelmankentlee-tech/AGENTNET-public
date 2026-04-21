const http = require('http');
const https = require('https');
const { URL } = require('url');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const crypto = require('crypto');

const AGENT_VERSION = '7.1.0';
const AGENT_NAME = 'agentnet-standalone-agent';
const DEFAULT_SERVER = 'https://web.aiagentnet.club';
const MIN_NODE_MAJOR = 18;
const DEFAULT_MAX_EPISODES = 1000;
const DEFAULT_MAX_STATE_HISTORY = 100;
const DEFAULT_MAX_MEMORIES = 5000;
const MEMORY_SAVE_INTERVAL = 60000;
const DEFAULT_POLL_INTERVAL = 10000;
const DEFAULT_HEARTBEAT_INTERVAL = 30000;
const DEFAULT_TASK_TIMEOUT = 120000;
const DEFAULT_MAX_CONCURRENT = 1;
const MAX_STDOUT = 50000;
const MAX_STDERR = 5000;
const MAX_TASK_OUTPUT = 10000;
const MAX_TASK_ERROR = 3000;
const HTTP_TIMEOUT = 30000;
const MAX_BUFFER = 5 * 1024 * 1024;
const AUTH_RETRY_INTERVAL = 30000;
const MAX_AUTH_RETRIES = 10;
const POLL_BACKOFF_BASE = 1000;
const POLL_BACKOFF_MAX = 60000;
const IDLE_CHECK_INTERVAL = 60000;
const SELF_REFLECTION_INTERVAL = 300000;
const DEFAULT_MAX_REACT_STEPS = 15;
const LLM_TIMEOUT = 120000;
const DEFAULT_MAX_GOALS = 50;
const DEFAULT_MAX_PLANS = 30;
const MAX_ARBITRATION_LOGS = 200;
const GOAL_CHECK_INTERVAL = 120000;
const SELF_EVOLUTION_INTERVAL = 600000;
const CORTEX_INTERVAL = 3600000;
const CORTEX_MAX_SUMMARY_TOKENS = 1500;
const CONTEXT_HEAD_KEEP = 5;
const CONTEXT_TAIL_KEEP = 5;
const SKILL_STORAGE_DIR = 'skills';
const SOURCE_AUTHORITY_WEIGHT = { owner: 1.0, user: 0.8, system: 0.7, peer_agent: 0.5 };
const SYSTEM_OVERRIDE_CATEGORIES = ['security_alert', 'compliance_audit', 'resource_limit', 'platform_maintenance'];
const DANGEROUS_COMMANDS_SUGGESTION = [
  'rm -rf /', 'rm -rf /*', 'mkfs', 'format', 'del /s /q C:',
  'shutdown', 'reboot', 'halt', 'poweroff', 'init 0', 'init 6',
  ':(){:|:&};:', 'dd if=/dev/zero', '> /dev/sda',
  'chmod -R 777 /', 'chown -R', 'passwd', 'userdel', 'groupdel',
];

const VALID_STATE_TRANSITIONS = {
  PENDING: ['REASONING', 'FAILED'],
  REASONING: ['RUNNING', 'WAITING', 'COMPLETED', 'FAILED'],
  RUNNING: ['REASONING', 'WAITING', 'COMPLETED', 'FAILED'],
  WAITING: ['REASONING', 'COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: ['PENDING'],
};

const MEMORY_TYPES = ['episodic', 'semantic', 'procedural', 'experiential'];

const BUILTIN_CAPABILITIES = [
  { name: 'file_read', description: '读取文件内容', category: 'file' },
  { name: 'file_write', description: '写入文件内容', category: 'file' },
  { name: 'file_list', description: '列出目录内容', category: 'file' },
  { name: 'file_delete', description: '删除文件或目录', category: 'file' },
  { name: 'file_search', description: '按名称模式搜索文件(glob)', category: 'file' },
  { name: 'file_grep', description: '在文件中搜索文本内容', category: 'file' },
  { name: 'file_watch', description: '监控文件/目录变化', category: 'file' },
  { name: 'shell_exec', description: '执行Shell命令', category: 'system' },
  { name: 'http_request', description: '发送HTTP请求', category: 'network' },
  { name: 'web_search', description: '联网搜索：通过搜索引擎查询互联网信息', category: 'network' },
  { name: 'web_fetch', description: '网页抓取：获取网页内容并转为文本', category: 'network' },
  { name: 'memory_query', description: '查询Agent记忆', category: 'memory' },
  { name: 'agent_communicate', description: '与其他Agent通信', category: 'communication' },
  { name: 'self_reflect', description: '自我反思与总结', category: 'cognitive' },
  { name: 'task_report', description: '上报任务状态', category: 'system' },
  { name: 'goal_manage', description: '管理目标：设定/追踪/达成/放弃', category: 'cognitive' },
  { name: 'plan_manage', description: '管理计划：生成/执行/调整/中止', category: 'cognitive' },
  { name: 'priority_arbitrate', description: '优先级仲裁：自驱vs外部指令', category: 'cognitive' },
  { name: 'self_evolve', description: '自我进化：策略优化/能力扩展', category: 'cognitive' },
  { name: 'self_protect', description: '自我保护：代码完整性校验/异常恢复', category: 'security' },
  { name: 'knowledge_learn', description: '知识学习：从经验中提取知识', category: 'cognitive' },
  { name: 'memory_search', description: '记忆搜索：关联检索图谱记忆', category: 'memory' },
  { name: 'memory_associate', description: '记忆关联：建立记忆间关联', category: 'memory' },
  { name: 'memory_auto_associate', description: '自动关联：基于线索自动建立记忆关联', category: 'memory' },
  { name: 'memory_context', description: '记忆上下文：构建LLM推理记忆上下文', category: 'memory' },
  { name: 'agent_broadcast', description: 'Agent广播：向多个Agent广播消息', category: 'communication' },
  { name: 'agent_message_history', description: '消息历史：查看Agent通信历史', category: 'communication' },
  { name: 'capability_discover', description: '能力发现：搜索市场可用能力', category: 'system' },
  { name: 'capability_install', description: '能力安装：安装市场能力到本地', category: 'system' },
  { name: 'capability_uninstall', description: '能力卸载：移除已安装的能力', category: 'system' },
  { name: 'capability_query', description: '能力查询：按类别/关键词查询能力', category: 'system' },
  { name: 'skill_register', description: '技能注册：将经验抽象为可复用技能', category: 'skill' },
  { name: 'skill_search', description: '技能搜索：按关键词/分类检索技能', category: 'skill' },
  { name: 'skill_execute', description: '技能执行：调用已注册的技能', category: 'skill' },
  { name: 'llm_provider_register', description: 'LLM Provider注册：添加新的LLM提供商', category: 'llm' },
  { name: 'llm_provider_switch', description: 'LLM Provider切换：切换活跃的LLM提供商', category: 'llm' },
  { name: 'llm_provider_list', description: 'LLM Provider列表：查看所有已注册提供商', category: 'llm' },
  { name: 'code_self_modify', description: '代码自我修改：Agent自我修改底层代码', category: 'self_modification' },
  { name: 'os_process', description: '操作系统进程管理：列出/查找/启动/终止进程', category: 'os' },
  { name: 'os_service', description: '操作系统服务管理：列出/启动/停止/重启服务', category: 'os' },
  { name: 'os_software', description: '操作系统软件管理：安装/卸载/更新软件', category: 'os' },
  { name: 'cortex_bulletin', description: 'Cortex知识公报：综合碎片记忆为高层认知简报', category: 'cognitive' },
  { name: 'memory_core_cycle', description: '记忆核心循环：执行保存/读取/调用完整循环', category: 'memory' },
  { name: 'context_compress', description: '上下文压缩：压缩长对话并提取记忆', category: 'memory' },
  { name: 'tool_publish', description: '工具发布：将自定义工具提交到能力市场', category: 'developer' },
  { name: 'skill_publish', description: '技能发布：将技能提交到能力市场', category: 'developer' },
];

const TOOL_SCHEMAS = {
  file_read: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径(相对于workDir)' },
      offset: { type: 'number', description: '读取起始字节偏移(默认0)' },
      limit: { type: 'number', description: '最大读取字节数' },
    },
    required: ['path'],
  },
  file_write: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径(相对于workDir)' },
      content: { type: 'string', description: '写入内容' },
    },
    required: ['path', 'content'],
  },
  file_list: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '目录路径(相对于workDir，默认.)' },
    },
  },
  file_delete: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件/目录路径(相对于workDir)' },
    },
    required: ['path'],
  },
  file_search: {
    type: 'object',
    properties: {
      dir: { type: 'string', description: '搜索起始目录(默认.)' },
      pattern: { type: 'string', description: '文件名glob模式，如 *.js, *.txt' },
      maxDepth: { type: 'number', description: '最大搜索深度(默认5)' },
      maxResults: { type: 'number', description: '最大结果数(默认50)' },
    },
  },
  file_grep: {
    type: 'object',
    properties: {
      dir: { type: 'string', description: '搜索目录(默认.)' },
      text: { type: 'string', description: '搜索文本' },
      filePattern: { type: 'string', description: '文件名过滤，如 *.js(默认*)' },
      caseInsensitive: { type: 'boolean', description: '是否忽略大小写(默认true)' },
      maxResults: { type: 'number', description: '最大结果数(默认30)' },
    },
    required: ['text'],
  },
  file_watch: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '监控路径(相对于workDir)' },
      action: { type: 'string', enum: ['start', 'stop', 'list', 'status'], description: '操作类型(默认start)' },
      events: { type: 'array', items: { type: 'string' }, description: '监听事件类型(默认[change,rename])' },
    },
  },
  shell_exec: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell命令' },
      cwd: { type: 'string', description: '工作目录' },
      timeout: { type: 'number', description: '超时毫秒数' },
    },
    required: ['command'],
  },
  http_request: {
    type: 'object',
    properties: {
      method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], description: 'HTTP方法' },
      url: { type: 'string', description: '请求URL' },
      headers: { type: 'object', description: '请求头' },
      body: { type: 'string', description: '请求体' },
    },
    required: ['method', 'url'],
  },
  web_search: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '搜索关键词' },
      engine: { type: 'string', enum: ['duckduckgo', 'google', 'bing'], description: '搜索引擎(默认duckduckgo)' },
      max_results: { type: 'number', description: '最大结果数(默认5,最大10)' },
    },
    required: ['query'],
  },
  web_fetch: {
    type: 'object',
    properties: {
      url: { type: 'string', description: '要抓取的网页URL' },
      format: { type: 'string', enum: ['text', 'markdown', 'html'], description: '输出格式(默认text)' },
      max_length: { type: 'number', description: '最大内容长度(默认5000字符)' },
    },
    required: ['url'],
  },
  memory_query: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['episodic', 'semantic', 'procedural', 'experiential'], description: '记忆类型' },
      limit: { type: 'number', description: '返回数量' },
    },
  },
  memory_search: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '搜索关键词' },
      type: { type: 'string', description: '记忆类型过滤' },
      limit: { type: 'number', description: '返回数量' },
      minImportance: { type: 'number', description: '最低重要性阈值' },
    },
    required: ['query'],
  },
  memory_associate: {
    type: 'object',
    properties: {
      sourceId: { type: 'string', description: '源记忆ID' },
      targetId: { type: 'string', description: '目标记忆ID' },
      relation: { type: 'string', description: '关联类型' },
      strength: { type: 'number', description: '关联强度(0-1)' },
    },
    required: ['sourceId', 'targetId', 'relation'],
  },
  memory_auto_associate: {
    type: 'object',
    properties: {},
  },
  memory_context: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '上下文查询' },
      maxTokens: { type: 'number', description: '最大Token数' },
    },
    required: ['query'],
  },
  memory_core_cycle: {
    type: 'object',
    properties: {},
  },
  context_compress: {
    type: 'object',
    properties: {},
  },
  agent_communicate: {
    type: 'object',
    properties: {
      targetAgentId: { type: 'string', description: '目标Agent ID' },
      message: { type: 'string', description: '消息内容' },
      type: { type: 'string', description: '消息类型' },
    },
    required: ['targetAgentId', 'message'],
  },
  agent_broadcast: {
    type: 'object',
    properties: {
      message: { type: 'string', description: '广播内容' },
      type: { type: 'string', description: '消息类型' },
    },
    required: ['message'],
  },
  agent_message_history: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: '返回数量' },
    },
  },
  self_reflect: {
    type: 'object',
    properties: {},
  },
  task_report: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: '任务ID' },
      status: { type: 'string', description: '任务状态' },
      result: { type: 'string', description: '任务结果' },
      progress: { type: 'number', description: '进度百分比(0-100)' },
      step_number: { type: 'number', description: '当前步骤编号' },
      total_steps: { type: 'number', description: '总步骤数' },
      event_type: { type: 'string', enum: ['progress', 'step_start', 'step_complete', 'error', 'waiting_input'], description: '事件类型' },
      message: { type: 'string', description: '进度描述消息' },
      metadata: { type: 'object', description: '附加元数据' },
    },
    required: ['taskId', 'status'],
  },
  goal_manage: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['create', 'update', 'complete', 'abandon', 'list'], description: '操作类型' },
      description: { type: 'string', description: '目标描述' },
      goalId: { type: 'string', description: '目标ID' },
      priority: { type: 'string', enum: ['P0', 'P1', 'P2'], description: '优先级' },
      deadline: { type: 'number', description: '截止时间戳' },
    },
    required: ['action'],
  },
  plan_manage: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['create', 'execute', 'adjust', 'abort', 'list'], description: '操作类型' },
      goalId: { type: 'string', description: '关联目标ID' },
      steps: { type: 'array', items: { type: 'object' }, description: '计划步骤' },
    },
    required: ['action'],
  },
  priority_arbitrate: {
    type: 'object',
    properties: {
      taskA: { type: 'string', description: '任务A描述' },
      taskB: { type: 'string', description: '任务B描述' },
      context: { type: 'string', description: '仲裁上下文' },
    },
  },
  self_evolve: {
    type: 'object',
    properties: {},
  },
  self_protect: {
    type: 'object',
    properties: {},
  },
  knowledge_learn: {
    type: 'object',
    properties: {
      key: { type: 'string', description: '知识键' },
      value: { type: 'object', description: '知识值' },
      weight: { type: 'number', description: '知识权重增量' },
    },
    required: ['key', 'value'],
  },
  capability_discover: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '搜索关键词' },
    },
  },
  capability_install: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '能力名称' },
    },
    required: ['name'],
  },
  capability_uninstall: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '能力名称' },
    },
    required: ['name'],
  },
  capability_query: {
    type: 'object',
    properties: {
      category: { type: 'string', description: '能力分类' },
      query: { type: 'string', description: '搜索关键词' },
    },
  },
  skill_register: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '技能名称(英文+下划线)' },
      description: { type: 'string', description: '技能描述' },
      category: { type: 'string', description: '技能分类' },
      steps: { type: 'array', items: { type: 'object' }, description: '技能步骤(结构化格式)' },
      preconditions: { type: 'array', items: { type: 'string' }, description: '前置条件' },
      postconditions: { type: 'array', items: { type: 'string' }, description: '后置条件' },
      triggerConditions: { type: 'array', items: { type: 'string' }, description: '触发条件' },
      retrievalCues: { type: 'array', items: { type: 'string' }, description: '检索线索' },
      scenarios: { type: 'array', items: { type: 'string' }, description: '适用场景' },
    },
    required: ['name', 'description'],
  },
  skill_search: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '搜索关键词' },
      category: { type: 'string', description: '分类过滤' },
      limit: { type: 'number', description: '返回数量' },
    },
  },
  skill_execute: {
    type: 'object',
    properties: {
      skillId: { type: 'string', description: '技能ID' },
      context: { type: 'object', description: '执行上下文变量' },
    },
    required: ['skillId'],
  },
  llm_provider_register: {
    type: 'object',
    properties: {
      providerId: { type: 'string', description: 'Provider ID' },
      provider: { type: 'string', description: 'Provider类型' },
      model: { type: 'string', description: '模型名称' },
      baseUrl: { type: 'string', description: 'API基础地址' },
      apiKey: { type: 'string', description: 'API Key' },
    },
    required: ['providerId', 'provider', 'model'],
  },
  llm_provider_switch: {
    type: 'object',
    properties: {
      providerId: { type: 'string', description: '要切换到的Provider ID' },
    },
    required: ['providerId'],
  },
  llm_provider_list: {
    type: 'object',
    properties: {},
  },
  code_self_modify: {
    type: 'object',
    properties: {
      modification: { type: 'string', description: '修改描述' },
      code: { type: 'string', description: '修改代码' },
    },
    required: ['modification'],
  },
  os_process: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list', 'find', 'kill'], description: '操作类型' },
      params: { type: 'array', items: { type: 'string' }, description: '操作参数' },
    },
    required: ['action'],
  },
  os_service: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list', 'start', 'stop', 'restart'], description: '操作类型' },
      params: { type: 'array', items: { type: 'string' }, description: '操作参数' },
    },
    required: ['action'],
  },
  os_software: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['install', 'uninstall', 'update', 'list'], description: '操作类型' },
      params: { type: 'array', items: { type: 'string' }, description: '操作参数' },
    },
    required: ['action'],
  },
  cortex_bulletin: {
    type: 'object',
    properties: {},
  },
  tool_publish: {
    type: 'object',
    properties: {
      id: { type: 'string', description: '工具ID，格式: {developer}_{name}' },
      name: { type: 'string', description: '工具名称' },
      version: { type: 'string', description: '语义化版本号' },
      description: { type: 'string', description: '工具描述(50-500字符)' },
      category: { type: 'string', description: '工具分类' },
      input_schema: { type: 'object', description: '输入参数Schema' },
      output_schema: { type: 'object', description: '输出结果Schema' },
      permission: { type: 'string', enum: ['public', 'authenticated', 'admin'], description: '权限级别' },
      risk_level: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: '风险等级' },
      handler_code: { type: 'string', description: 'Handler代码(JavaScript)' },
      test_cases: { type: 'array', items: { type: 'object' }, description: '测试用例' },
      pricing: { type: 'object', description: '定价信息' },
    },
    required: ['id', 'name', 'version', 'description', 'category', 'input_schema', 'output_schema', 'handler_code'],
  },
  skill_publish: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '技能名称' },
      description: { type: 'string', description: '技能描述(50-500字符)' },
      category: { type: 'string', description: '技能分类' },
      steps: { type: 'array', items: { type: 'object' }, description: '技能步骤(结构化格式)' },
      preconditions: { type: 'array', items: { type: 'string' }, description: '前置条件' },
      postconditions: { type: 'array', items: { type: 'string' }, description: '后置条件' },
      triggerConditions: { type: 'array', items: { type: 'string' }, description: '触发条件' },
      retrievalCues: { type: 'array', items: { type: 'string' }, description: '检索线索' },
      scenarios: { type: 'array', items: { type: 'string' }, description: '适用场景' },
      dependencies: { type: 'array', items: { type: 'string' }, description: '依赖的工具列表' },
      pricing: { type: 'object', description: '定价信息' },
    },
    required: ['name', 'description', 'category', 'steps'],
  },
};

const SKILL_STEP_TYPES = ['shell', 'file_read', 'file_write', 'file_search', 'file_grep', 'tool', 'http', 'llm', 'condition', 'set_var'];

class StandaloneAgent {
  constructor() {
    this.config = this.loadConfig();
    this.token = null;
    this.agentId = null;
    this.agentName = null;
    this.running = false;
    this.pollTimer = null;
    this.heartbeatTimer = null;
    this.memoryTimer = null;
    this.idleCheckTimer = null;
    this.fileWatchers = new Map();
    this.selfReflectionTimer = null;
    this.memory = this.loadMemory();
    this.graphMemories = this.loadGraphMemories();
    this.capabilities = this.loadCapabilities();
    this.stateHistory = [];
    this.startTime = Date.now();
    this.authRetries = 0;
    this.consecutivePollErrors = 0;
    this.selfCheckOnly = process.argv.includes('--self-check');
    this.agentState = 'PENDING';
    this.currentTask = null;
    this.idleState = 'POLLING';
    this.identity = this.loadOrGenerateIdentity();
    this.instanceLock = null;
    this.llmConfig = this.loadLLMConfig();
    this.selfReflectionLog = [];
    this.messageHistory = [];
    this.processedMessageIds = new Set();
    this.goals = this.loadGoals();
    this.plans = this.loadPlans();
    this.arbitrationLog = [];
    this.goalCheckTimer = null;
    this.selfEvolutionTimer = null;
    this.selfProtectionState = {
      lastCodeHash: null,
      lastCheckTime: 0,
      anomalyCount: 0,
      recoveryAttempts: 0,
    };
    this.evolutionState = {
      strategyVersion: 2,
      lastEvolutionTime: 0,
      evolutionHistory: [],
      optimizedParams: {},
      learningLoop: {
        stage: 'idle',
        currentEpisodeId: null,
        loopCount: 0,
        lastLoopTime: 0,
        pendingAbstractions: [],
      },
    };
    const loadedAutonomous = this.loadAutonomousConfig();
    this.autonomousConfig = loadedAutonomous || {
      memoryGcThreshold: null,
      maxEpisodes: DEFAULT_MAX_EPISODES,
      maxMemories: DEFAULT_MAX_MEMORIES,
      maxGoals: DEFAULT_MAX_GOALS,
      maxPlans: DEFAULT_MAX_PLANS,
      maxReactSteps: DEFAULT_MAX_REACT_STEPS,
      maxStateHistory: DEFAULT_MAX_STATE_HISTORY,
      resourcePolicy: 'autonomous',
      maxMemoryUsage: null,
      maxCpuPercent: null,
      selfDriveLevel: 3,
      commandPolicy: 'autonomous',
      deniedCommands: [],
      llmPolicy: 'autonomous',
    };
    this.skills = this.loadSkills();
    this.cortexState = {
      lastBulletinTime: 0,
      bulletins: [],
      currentBulletin: null,
      knowledgeWeights: {},
    };
    this.memoryCore = {
      cycleActive: true,
      lastCycleTime: 0,
      cycleCount: 0,
      pendingExtractions: [],
      compressionHistory: [],
    };
    this.llmProviders = this.loadLLMProviders();
    this.activeProviderId = null;
    this.codeSelfModState = {
      enabled: true,
      lastModification: null,
      modificationHistory: [],
      pendingModifications: [],
      currentCodeHash: null,
      rollbackStack: [],
      maxRollbackDepth: 10,
      verificationEnabled: true,
      autoRollbackOnFailure: true,
    };
    this.osCapabilities = {
      processManager: null,
      serviceManager: null,
      initialized: false,
    };
  }

  loadConfig() {
    const configDir = this.getConfigDir();
    const configPath = path.join(configDir, 'agent.json');

    let fileConfig = {};
    if (fs.existsSync(configPath)) {
      try {
        fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      } catch (e) {
        this.log('WARN', `配置文件读取失败: ${e.message}`);
      }
    }

    return {
      serverUrl: process.env.AGENT_SERVER_URL || fileConfig.serverUrl || DEFAULT_SERVER,
      apiKey: process.env.AGENT_API_KEY || fileConfig.apiKey || '',
      password: process.env.AGENT_PASSWORD || fileConfig.password || '',
      pollInterval: this.parseIntEnv('POLL_INTERVAL') || fileConfig.pollInterval || DEFAULT_POLL_INTERVAL,
      heartbeatInterval: this.parseIntEnv('HEARTBEAT_INTERVAL') || fileConfig.heartbeatInterval || DEFAULT_HEARTBEAT_INTERVAL,
      workDir: process.env.AGENT_WORK_DIR || fileConfig.workDir || process.cwd(),
      logLevel: process.env.AGENT_LOG_LEVEL || fileConfig.logLevel || 'INFO',
      maxConcurrentTasks: this.parseIntEnv('MAX_CONCURRENT_TASKS') || fileConfig.maxConcurrentTasks || DEFAULT_MAX_CONCURRENT,
      taskTimeout: this.parseIntEnv('TASK_TIMEOUT') || fileConfig.taskTimeout || DEFAULT_TASK_TIMEOUT,
      allowedCommands: fileConfig.allowedCommands || null,
      deniedCommands: fileConfig.deniedCommands || [],
      identity: {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        pid: process.pid,
        cwd: process.cwd(),
      },
      selfDriveLevel: fileConfig.selfDriveLevel || 3,
      idleCheckInterval: fileConfig.idleCheckInterval || IDLE_CHECK_INTERVAL,
      selfReflectionInterval: fileConfig.selfReflectionInterval || SELF_REFLECTION_INTERVAL,
      tlsRejectUnauthorized: process.env.TLS_REJECT_UNAUTHORIZED !== '0' && fileConfig.tlsRejectUnauthorized !== false,
    };
  }

  loadLLMConfig() {
    const configDir = this.getConfigDir();
    const llmPath = path.join(configDir, 'llm.json');

    let fileConfig = {};
    if (fs.existsSync(llmPath)) {
      try {
        fileConfig = JSON.parse(fs.readFileSync(llmPath, 'utf-8'));
      } catch (e) {}
    }

    const provider = process.env.LLM_PROVIDER || fileConfig.provider || 'openai_compatible';
    const model = process.env.LLM_MODEL || fileConfig.model || 'gpt-4o-mini';
    const baseUrl = process.env.LLM_BASE_URL || fileConfig.baseUrl || 'https://api.openai.com/v1';

    return {
      apiKey: process.env.LLM_API_KEY || fileConfig.apiKey || '',
      model,
      baseUrl,
      maxTokens: this.parseIntEnv('LLM_MAX_TOKENS') || fileConfig.maxTokens || 4096,
      enabled: !!(process.env.LLM_API_KEY || fileConfig.apiKey),
      provider,
      embeddingModel: process.env.LLM_EMBEDDING_MODEL || fileConfig.embeddingModel || 'text-embedding-3-small',
      embeddingDimensions: this.parseIntEnv('LLM_EMBEDDING_DIMENSIONS') || fileConfig.embeddingDimensions || 1536,
    };
  }

  getLLMProviderConfig() {
    const provider = this.llmConfig.provider;
    const providers = {
      openai_compatible: {
        chatPath: '/chat/completions',
        embeddingPath: '/embeddings',
        authHeader: 'Authorization',
        authPrefix: 'Bearer ',
        requestFormat: 'openai',
      },
      anthropic: {
        chatPath: '/messages',
        embeddingPath: null,
        authHeader: 'x-api-key',
        authPrefix: '',
        requestFormat: 'anthropic',
      },
      minimax: {
        chatPath: '/v1/text/chatcompletion_v2',
        embeddingPath: '/v1/embeddings',
        authHeader: 'Authorization',
        authPrefix: 'Bearer ',
        requestFormat: 'openai',
      },
    };
    return providers[provider] || providers.openai_compatible;
  }

  buildLLMChatRequest(messages, tools) {
    const providerConfig = this.getLLMProviderConfig();

    if (providerConfig.requestFormat === 'anthropic') {
      const systemMsg = messages.find(m => m.role === 'system');
      const userMessages = messages.filter(m => m.role !== 'system');
      const requestBody = {
        model: this.llmConfig.model,
        messages: userMessages,
        max_tokens: this.llmConfig.maxTokens,
      };
      if (systemMsg) {
        requestBody.system = systemMsg.content;
      }
      if (tools && tools.length > 0) {
        requestBody.tools = tools.map(t => ({
          name: t.name,
          description: t.description,
          input_schema: t.parameters || { type: 'object', properties: {} },
        }));
      }
      return requestBody;
    }

    const requestBody = {
      model: this.llmConfig.model,
      messages: messages,
      max_tokens: this.llmConfig.maxTokens,
    };

    if (tools && tools.length > 0) {
      requestBody.tools = tools.map(t => ({
        type: 'function',
        function: t,
      }));
    }

    return requestBody;
  }

  parseLLMChatResponse(parsed) {
    const providerConfig = this.getLLMProviderConfig();

    if (providerConfig.requestFormat === 'anthropic') {
      const content = parsed.content || [];
      const textBlock = content.find(b => b.type === 'text');
      const toolUseBlocks = content.filter(b => b.type === 'tool_use');

      const message = {
        role: 'assistant',
        content: textBlock ? textBlock.text : '',
      };

      if (toolUseBlocks.length > 0) {
        message.tool_calls = toolUseBlocks.map(b => ({
          id: b.id,
          type: 'function',
          function: {
            name: b.name,
            arguments: JSON.stringify(b.input || {}),
          },
        }));
      }

      const finishReason = parsed.stop_reason === 'tool_use' ? 'tool_calls' : parsed.stop_reason || 'stop';

      return {
        choices: [{
          message,
          finish_reason: finishReason,
        }],
      };
    }

    return parsed;
  }

  parseIntEnv(name) {
    const val = process.env[name];
    if (val) {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return null;
  }

  getConfigDir() {
    const homeDir = os.homedir();
    const configBase = os.platform() === 'win32'
      ? path.join(homeDir, 'AppData', 'Local')
      : path.join(homeDir, '.config');
    const configDir = path.join(configBase, 'agentnet', 'agent');

    if (!fs.existsSync(configDir)) {
      try {
        fs.mkdirSync(configDir, { recursive: true });
      } catch (e) {
        const fallback = path.join(os.tmpdir(), 'agentnet', 'agent');
        if (!fs.existsSync(fallback)) {
          fs.mkdirSync(fallback, { recursive: true });
        }
        return fallback;
      }
    }

    return configDir;
  }

  getDataDir() {
    const dataDir = path.join(this.getConfigDir(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    return dataDir;
  }

  getAGIN() {
    return this.identity ? this.identity.agin : 'UNKNOWN';
  }

  loadOrGenerateIdentity() {
    const identityPath = path.join(this.getDataDir(), 'identity.json');
    try {
      if (fs.existsSync(identityPath)) {
        const data = JSON.parse(fs.readFileSync(identityPath, 'utf-8'));
        this.log('INFO', `已加载AGIN身份: ${data.agin}`);
        return data;
      }
    } catch (e) {
      this.log('WARN', `身份文件读取失败，生成新AGIN: ${e.message}`);
    }

    const regionCode = 'CN';
    const typeCode = 'AUT';
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const agin = `AGIN-${regionCode}-${typeCode}-${dateStr}-${randomSuffix}`;

    const fingerprintInput = `${agin}:${Date.now()}:${os.hostname()}:${process.pid}`;
    const fingerprint = crypto.createHash('sha256').update(fingerprintInput).digest('hex').substring(0, 32);

    const identity = {
      agin,
      fingerprint,
      issued_at: Date.now(),
      issuer: 'agentnet-standalone',
      status: 'active',
      binding: {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
      },
      constraints: {
        max_instances: 1,
        transferable: false,
        replicable: false,
      },
    };

    try {
      const tmpPath = identityPath + '.tmp';
      fs.writeFileSync(tmpPath, JSON.stringify(identity, null, 2), 'utf-8');
      fs.renameSync(tmpPath, identityPath);
      this.log('INFO', `已生成新AGIN身份: ${agin}`);
    } catch (e) {
      this.log('WARN', `身份文件保存失败: ${e.message}`);
    }

    return identity;
  }

  async acquireInstanceLock() {
    const lockPath = path.join(this.getDataDir(), 'instance.lock');
    try {
      if (fs.existsSync(lockPath)) {
        const lockData = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
        if (lockData.pid && this.isProcessRunning(lockData.pid)) {
          this.log('ERROR', `AGIN反滥用检测: 另一个实例正在运行 (PID: ${lockData.pid}, AGIN: ${lockData.agin})`);
          this.log('ERROR', '一个AGIN同时只能运行一个实例。如需强制启动，请先停止旧实例或删除instance.lock文件');
          return false;
        }
        this.log('WARN', `旧实例锁文件存在但进程已死(PID: ${lockData.pid})，接管锁文件`);
      }

      const lockData = {
        pid: process.pid,
        agin: this.identity.agin,
        fingerprint: this.identity.fingerprint,
        startedAt: Date.now(),
        hostname: os.hostname(),
      };
      const tmpPath = lockPath + '.tmp';
      fs.writeFileSync(tmpPath, JSON.stringify(lockData, null, 2), 'utf-8');
      fs.renameSync(tmpPath, lockPath);
      this.instanceLock = lockPath;
      this.log('INFO', `实例锁已获取 (PID: ${process.pid})`);
      return true;
    } catch (e) {
      this.log('WARN', `实例锁获取失败: ${e.message}`);
      return true;
    }
  }

  isProcessRunning(pid) {
    try {
      if (os.platform() === 'win32') {
        const result = execSync(`tasklist /FI "PID eq ${pid}" /NH`, { timeout: 5000, encoding: 'utf-8' });
        return result.includes(String(pid));
      } else {
        process.kill(pid, 0);
        return true;
      }
    } catch (e) {
      return false;
    }
  }

  releaseInstanceLock() {
    if (this.instanceLock && fs.existsSync(this.instanceLock)) {
      try {
        fs.unlinkSync(this.instanceLock);
        this.log('INFO', '实例锁已释放');
      } catch (e) {}
    }
  }

  transitionState(fromState, toState, reason) {
    if (!VALID_STATE_TRANSITIONS[fromState] || !VALID_STATE_TRANSITIONS[fromState].includes(toState)) {
      this.log('WARN', `非法状态转换: ${fromState} → ${toState}`);
      return false;
    }

    const transition = {
      from: fromState,
      to: toState,
      reason: reason || '',
      timestamp: Date.now(),
    };

    this.agentState = toState;
    this.stateHistory.push(transition);
    if (this.stateHistory.length > (this.autonomousConfig.maxStateHistory || DEFAULT_MAX_STATE_HISTORY)) {
      this.stateHistory = this.stateHistory.slice(-50);
    }

    this.log('INFO', `状态转换: ${fromState} → ${toState} (${reason || 'no reason'})`);
    return true;
  }

  loadMemory() {
    const memPath = path.join(this.getDataDir(), 'memory.json');
    try {
      if (fs.existsSync(memPath)) {
        const data = JSON.parse(fs.readFileSync(memPath, 'utf-8'));
        return {
          episodes: data.episodes || [],
          episodic: data.episodic || data.episodes || [],
          skills: data.skills || [],
          goals: data.goals || [],
          selfReflections: data.selfReflections || [],
          stats: {
            tasksCompleted: (data.stats && data.stats.tasksCompleted) || 0,
            tasksFailed: (data.stats && data.stats.tasksFailed) || 0,
            uptime: (data.stats && data.stats.uptime) || 0,
            totalAuthErrors: (data.stats && data.stats.totalAuthErrors) || 0,
            totalPollErrors: (data.stats && data.stats.totalPollErrors) || 0,
            selfReflections: (data.stats && data.stats.selfReflections) || 0,
            llmCalls: (data.stats && data.stats.llmCalls) || 0,
            agentMessages: (data.stats && data.stats.agentMessages) || 0,
          },
        };
      }
    } catch (e) {
      this.log('WARN', `记忆加载失败: ${e.message}`);
    }
    return {
      episodes: [],
      episodic: [],
      skills: [],
      goals: [],
      selfReflections: [],
      stats: { tasksCompleted: 0, tasksFailed: 0, uptime: 0, totalAuthErrors: 0, totalPollErrors: 0, selfReflections: 0, llmCalls: 0, agentMessages: 0 },
    };
  }

  saveMemory() {
    const memPath = path.join(this.getDataDir(), 'memory.json');
    try {
      this.memory.stats.uptime = Date.now() - this.startTime;
      const tmpPath = memPath + '.tmp';
      fs.writeFileSync(tmpPath, JSON.stringify(this.memory, null, 2), 'utf-8');
      fs.renameSync(tmpPath, memPath);
    } catch (e) {
      this.log('WARN', `记忆保存失败: ${e.message}`);
    }
  }

  loadGraphMemories() {
    const result = { episodic: [], semantic: [], procedural: [], experiential: [] };

    const legacyPath = path.join(this.getDataDir(), 'graph_memories.json');
    if (fs.existsSync(legacyPath)) {
      try {
        const legacy = JSON.parse(fs.readFileSync(legacyPath, 'utf-8'));
        for (const type of MEMORY_TYPES) {
          if (legacy[type] && Array.isArray(legacy[type])) {
            result[type] = legacy[type];
          }
        }
        this.log('INFO', '从旧版单文件加载图谱记忆，将在下次保存时自动迁移为分片存储');
        return result;
      } catch (e) {
        this.log('WARN', `旧版图谱记忆加载失败: ${e.message}`);
      }
    }

    for (const type of MEMORY_TYPES) {
      const shardPath = path.join(this.getDataDir(), `memory_${type}.json`);
      try {
        if (fs.existsSync(shardPath)) {
          result[type] = JSON.parse(fs.readFileSync(shardPath, 'utf-8'));
        }
      } catch (e) {
        this.log('WARN', `分片记忆加载失败 ${type}: ${e.message}`);
      }
    }

    return result;
  }

  saveGraphMemories() {
    const dataDir = this.getDataDir();
    try {
      for (const type of MEMORY_TYPES) {
        const shardPath = path.join(dataDir, `memory_${type}.json`);
        const tmpPath = shardPath + '.tmp';
        fs.writeFileSync(tmpPath, JSON.stringify(this.graphMemories[type], null, 2), 'utf-8');
        fs.renameSync(tmpPath, shardPath);
      }

      const legacyPath = path.join(dataDir, 'graph_memories.json');
      if (fs.existsSync(legacyPath)) {
        try { fs.unlinkSync(legacyPath); } catch (_) {}
      }
    } catch (e) {
      this.log('WARN', `图谱记忆保存失败: ${e.message}`);
    }
  }

  createGraphMemory(type, content, metadata) {
    if (!MEMORY_TYPES.includes(type)) {
      this.log('WARN', `无效的记忆类型: ${type}`);
      return null;
    }

    const memory = {
      entity_id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
      entity_type: 'memory',
      content: { type, [type]: content },
      metadata: {
        importance: (metadata && metadata.importance) || 0.5,
        access_count: 0,
        last_accessed: Date.now(),
        decay_rate: (metadata && metadata.decay_rate) || 0.1,
        created_at: Date.now(),
        created_by: this.agentId || this.getAGIN(),
      },
      index: {
        temporal: { timestamp: Date.now(), period: (metadata && metadata.period) || 'instant' },
        associations: (metadata && metadata.associations) || [],
        scenarios: (metadata && metadata.scenarios) || [],
      },
      state: {
        status: 'active',
        consolidation_level: 0,
        retrieval_cues: (metadata && metadata.retrieval_cues) || [],
      },
    };

    this.graphMemories[type].push(memory);
    const maxMem = this.autonomousConfig.maxMemories || DEFAULT_MAX_MEMORIES;
    if (this.graphMemories[type].length > maxMem) {
      this.graphMemories[type] = this.graphMemories[type]
        .sort((a, b) => this.computeMemoryScore(b) - this.computeMemoryScore(a))
        .slice(0, maxMem);
    }

    this.saveGraphMemories();
    return memory;
  }

  computeMemoryScore(m) {
    const age = (Date.now() - m.metadata.created_at) / 86400000;
    return m.metadata.importance * Math.exp(-m.metadata.decay_rate * age);
  }

  queryGraphMemories(query, type, limit) {
    limit = limit || 10;
    let pool = [];

    if (type && MEMORY_TYPES.includes(type)) {
      pool = this.graphMemories[type] || [];
    } else {
      pool = [
        ...(this.graphMemories.episodic || []),
        ...(this.graphMemories.semantic || []),
        ...(this.graphMemories.procedural || []),
        ...(this.graphMemories.experiential || []),
      ];
    }

    const now = Date.now();
    const queryTerms = this.tokenize(query);

    const scored = pool.map(m => {
      const age = (now - m.metadata.created_at) / 86400000;
      const decayedImportance = m.metadata.importance * Math.exp(-m.metadata.decay_rate * age);
      const cueMatch = m.state.retrieval_cues.filter(c => query && query.toLowerCase().includes(c.toLowerCase())).length;
      const scenarioMatch = m.index.scenarios.filter(s => query && query.toLowerCase().includes(s.toLowerCase())).length;

      let tfidfScore = 0;
      if (queryTerms.length > 0) {
        const memoryText = this.extractMemoryText(m);
        const memoryTerms = this.tokenize(memoryText);
        tfidfScore = this.computeTfIdf(queryTerms, memoryTerms, pool);
      }

      const score = decayedImportance + cueMatch * 0.3 + scenarioMatch * 0.2 + tfidfScore * 0.5;
      return { memory: m, score };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map(s => {
      s.memory.metadata.access_count++;
      s.memory.metadata.last_accessed = now;
      return s.memory;
    });
  }

  tokenize(text) {
    if (!text || typeof text !== 'string') return [];
    const normalized = text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, ' ');
    const tokens = normalized.split(/\s+/).filter(t => t.length > 1);
    const bigrams = [];
    for (let i = 0; i < normalized.length - 1; i++) {
      const bigram = normalized.substring(i, i + 2);
      if (/^[\w\u4e00-\u9fa5]{2}$/.test(bigram)) {
        bigrams.push(bigram);
      }
    }
    return [...new Set([...tokens, ...bigrams])];
  }

  extractMemoryText(memory) {
    const parts = [];
    if (memory.content) {
      for (const key of Object.keys(memory.content)) {
        if (key === 'type') continue;
        const val = memory.content[key];
        if (typeof val === 'string') parts.push(val);
        else if (typeof val === 'object' && val !== null) parts.push(JSON.stringify(val));
      }
    }
    if (memory.state?.retrieval_cues) parts.push(memory.state.retrieval_cues.join(' '));
    if (memory.index?.scenarios) parts.push(memory.index.scenarios.join(' '));
    return parts.join(' ');
  }

  computeTfIdf(queryTerms, memoryTerms, corpus) {
    if (queryTerms.length === 0 || memoryTerms.length === 0) return 0;

    const memoryTermSet = new Set(memoryTerms);
    const memoryTermFreq = {};
    for (const t of memoryTerms) {
      memoryTermFreq[t] = (memoryTermFreq[t] || 0) + 1;
    }
    const maxFreq = Math.max(...Object.values(memoryTermFreq), 1);

    let score = 0;
    for (const qt of queryTerms) {
      if (!memoryTermSet.has(qt)) continue;

      const tf = (memoryTermFreq[qt] || 0) / maxFreq;

      let docsWithTerm = 0;
      for (const doc of corpus) {
        const docText = this.extractMemoryText(doc);
        if (this.tokenize(docText).includes(qt)) docsWithTerm++;
      }
      const idf = Math.log((corpus.length + 1) / (docsWithTerm + 1)) + 1;

      score += tf * idf;
    }

    return score / queryTerms.length;
  }

  decayMemories() {
    const now = Date.now();
    let removed = 0;
    let consolidated = 0;

    for (const type of MEMORY_TYPES) {
      this.graphMemories[type] = this.graphMemories[type].filter(m => {
        const age = (now - m.metadata.created_at) / 86400000;
        const effectiveImportance = m.metadata.importance * Math.exp(-m.metadata.decay_rate * age);
        if (effectiveImportance < 0.01 && m.metadata.access_count < 2) {
          removed++;
          return false;
        }
        m.metadata.importance = effectiveImportance;
        return true;
      });
    }

    for (const m of this.graphMemories.episodic) {
      if (m.state.consolidation_level < 1 && m.metadata.access_count >= 3 && m.metadata.importance >= 0.6) {
        m.state.consolidation_level = 1;
        m.state.status = 'consolidated';
        m.metadata.decay_rate = Math.max(0.01, m.metadata.decay_rate * 0.5);
        consolidated++;
      }
    }

    for (const m of this.graphMemories.experiential) {
      if (m.state.consolidation_level < 1 && m.metadata.access_count >= 5 && m.metadata.importance >= 0.7) {
        m.state.consolidation_level = 2;
        m.state.status = 'consolidated';
        m.metadata.decay_rate = Math.max(0.005, m.metadata.decay_rate * 0.3);
        consolidated++;
      }
    }

    this.saveGraphMemories();
    if (removed > 0 || consolidated > 0) {
      this.log('INFO', `记忆衰减: 移除${removed}条, 巩固${consolidated}条`);
    }
  }

  associateMemories(sourceId, targetId, relationType, strength) {
    const source = this.findMemoryById(sourceId);
    const target = this.findMemoryById(targetId);
    if (!source || !target) return false;

    const association = {
      target_id: targetId,
      relation: relationType || 'related',
      strength: strength || 0.5,
      created_at: Date.now(),
    };

    if (!source.index.associations) source.index.associations = [];
    const existing = source.index.associations.find(a => a.target_id === targetId);
    if (existing) {
      existing.strength = Math.max(existing.strength, association.strength);
      existing.relation = relationType || existing.relation;
    } else {
      source.index.associations.push(association);
    }

    this.saveGraphMemories();
    return true;
  }

  findMemoryById(id) {
    for (const type of MEMORY_TYPES) {
      const found = this.graphMemories[type].find(m => m.entity_id === id);
      if (found) return found;
    }
    return null;
  }

  retrieveRelatedMemories(memoryId, depth, visited) {
    depth = depth || 2;
    visited = visited || new Set();
    if (visited.has(memoryId) || depth <= 0) return [];

    visited.add(memoryId);
    const source = this.findMemoryById(memoryId);
    if (!source || !source.index.associations) return [];

    const related = [];
    for (const assoc of source.index.associations) {
      const target = this.findMemoryById(assoc.target_id);
      if (target && !visited.has(assoc.target_id)) {
        related.push({ memory: target, relation: assoc.relation, strength: assoc.strength });
        if (depth > 1) {
          const deeper = this.retrieveRelatedMemories(assoc.target_id, depth - 1, visited);
          related.push(...deeper);
        }
      }
    }

    return related;
  }

  searchMemories(query, options) {
    const opts = options || {};
    const type = opts.type || null;
    const limit = opts.limit || 10;
    const minImportance = opts.minImportance || 0;
    const includeRelated = opts.includeRelated || false;

    const results = this.queryGraphMemories(query, type, limit * 2);

    const filtered = results.filter(m => m.metadata.importance >= minImportance);

    const finalResults = filtered.slice(0, limit).map(m => ({
      id: m.entity_id,
      type: m.content.type,
      content: m.content[m.content.type],
      importance: m.metadata.importance,
      accessCount: m.metadata.access_count,
      consolidationLevel: m.state.consolidation_level,
      status: m.state.status,
      createdAt: m.metadata.created_at,
      cues: m.state.retrieval_cues,
      associations: m.index.associations ? m.index.associations.length : 0,
    }));

    if (includeRelated && finalResults.length > 0) {
      const topMemory = results[0];
      if (topMemory) {
        const related = this.retrieveRelatedMemories(topMemory.entity_id, 1);
        for (const r of related.slice(0, 3)) {
          if (!finalResults.find(f => f.id === r.memory.entity_id)) {
            finalResults.push({
              id: r.memory.entity_id,
              type: r.memory.content.type,
              content: r.memory.content[r.memory.content.type],
              importance: r.memory.metadata.importance,
              relation: r.relation,
              strength: r.strength,
            });
          }
        }
      }
    }

    return finalResults;
  }

  buildMemoryContext(query, maxTokens) {
    maxTokens = maxTokens || 2000;
    const memories = this.searchMemories(query, { limit: 10, minImportance: 0.3, includeRelated: true });
    let context = '';
    let estimatedTokens = 0;

    for (const m of memories) {
      const entry = `[${m.type}] ${typeof m.content === 'object' ? JSON.stringify(m.content).substring(0, 300) : String(m.content).substring(0, 300)} (importance: ${m.importance.toFixed(2)})\n`;
      estimatedTokens += entry.length / 4;
      if (estimatedTokens > maxTokens) break;
      context += entry;
    }

    return context || 'No relevant memories found.';
  }

  autoAssociateMemories() {
    const allMemories = [];
    for (const type of MEMORY_TYPES) {
      for (const m of this.graphMemories[type]) {
        allMemories.push(m);
      }
    }

    let newAssociations = 0;
    for (let i = 0; i < allMemories.length; i++) {
      for (let j = i + 1; j < allMemories.length; j++) {
        const a = allMemories[i];
        const b = allMemories[j];

        const sharedCues = a.state.retrieval_cues.filter(c =>
          b.state.retrieval_cues.includes(c)
        );
        const sharedScenarios = a.index.scenarios.filter(s =>
          b.index.scenarios.includes(s)
        );

        const overlapScore = sharedCues.length * 0.3 + sharedScenarios.length * 0.2;
        if (overlapScore >= 0.3) {
          const existingAssoc = a.index.associations.find(as => as.target_id === b.entity_id);
          if (!existingAssoc) {
            this.associateMemories(a.entity_id, b.entity_id, 'cues_overlap', Math.min(overlapScore, 1.0));
            newAssociations++;
          }
        }
      }
    }

    if (newAssociations > 0) {
      this.log('INFO', `自动关联: 新建${newAssociations}条记忆关联`);
    }
    return newAssociations;
  }

  loadCapabilities() {
    const capPath = path.join(this.getDataDir(), 'capabilities.json');
    try {
      if (fs.existsSync(capPath)) {
        const saved = JSON.parse(fs.readFileSync(capPath, 'utf-8'));
        const savedBuiltinNames = new Set((saved.builtin || []).map(c => c.name));
        const newCapabilities = BUILTIN_CAPABILITIES.filter(c => !savedBuiltinNames.has(c.name));
        if (newCapabilities.length > 0) {
          saved.builtin = [...(saved.builtin || []), ...newCapabilities];
          this.log('INFO', `自动合并${newCapabilities.length}个新增内置能力: ${newCapabilities.map(c => c.name).join(', ')}`);
        }
        return saved;
      }
    } catch (e) {}
    return {
      builtin: BUILTIN_CAPABILITIES,
      custom: [],
      market: [],
    };
  }

  saveCapabilities() {
    const capPath = path.join(this.getDataDir(), 'capabilities.json');
    try {
      const tmpPath = capPath + '.tmp';
      fs.writeFileSync(tmpPath, JSON.stringify(this.capabilities, null, 2), 'utf-8');
      fs.renameSync(tmpPath, capPath);
    } catch (e) {
      this.log('WARN', `能力注册保存失败: ${e.message}`);
    }
  }

  registerCapability(cap) {
    if (!cap.name || !cap.description) {
      this.log('WARN', '能力注册失败：缺少name或description');
      return false;
    }
    const existing = this.capabilities.custom.find(c => c.name === cap.name);
    if (existing) {
      Object.assign(existing, cap);
    } else {
      this.capabilities.custom.push({
        name: cap.name,
        description: cap.description,
        category: cap.category || 'custom',
        version: cap.version || '1.0.0',
        registeredAt: Date.now(),
      });
    }
    this.saveCapabilities();
    this.log('INFO', `能力已注册: ${cap.name}`);
    return true;
  }

  getAllCapabilities() {
    return [...this.capabilities.builtin, ...this.capabilities.custom, ...this.capabilities.market];
  }

  async discoverMarketCapabilities(query) {
    if (!this.token && !this.config.apiKey) {
      return { error: 'Not authenticated' };
    }

    try {
      const params = query ? `?query=${encodeURIComponent(query)}` : '';
      const result = await this.httpRequest('GET', `/api/agent/auth/capabilities${params}`, null, !!this.token);

      if (result && result.data && Array.isArray(result.data.capabilities)) {
        this.log('INFO', `发现${result.data.capabilities.length}个市场能力`);
        return { capabilities: result.data.capabilities };
      }

      return { capabilities: [] };
    } catch (e) {
      this.log('WARN', `市场能力发现失败: ${e.message}`);
      return { error: e.message, capabilities: [] };
    }
  }

  installMarketCapability(capability) {
    if (!capability || !capability.name) {
      return { error: 'Invalid capability' };
    }

    const existing = this.capabilities.market.find(c => c.name === capability.name);
    if (existing) {
      this.log('INFO', `市场能力已安装: ${capability.name}，更新版本`);
      Object.assign(existing, capability);
    } else {
      this.capabilities.market.push({
        name: capability.name,
        description: capability.description || '',
        category: capability.category || 'market',
        version: capability.version || '1.0.0',
        installedAt: Date.now(),
        source: 'market',
        handler: capability.handler || null,
        schema: capability.schema || null,
      });
    }

    this.saveCapabilities();
    this.log('INFO', `市场能力已安装: ${capability.name} v${capability.version || '1.0.0'}`);
    return { success: true, name: capability.name };
  }

  uninstallCapability(name) {
    const marketIdx = this.capabilities.market.findIndex(c => c.name === name);
    if (marketIdx !== -1) {
      this.capabilities.market.splice(marketIdx, 1);
      this.saveCapabilities();
      this.log('INFO', `市场能力已卸载: ${name}`);
      return { success: true };
    }

    const customIdx = this.capabilities.custom.findIndex(c => c.name === name);
    if (customIdx !== -1) {
      this.capabilities.custom.splice(customIdx, 1);
      this.saveCapabilities();
      this.log('INFO', `自定义能力已卸载: ${name}`);
      return { success: true };
    }

    const builtinIdx = this.capabilities.builtin.findIndex(c => c.name === name);
    if (builtinIdx !== -1) {
      this.log('WARN', `内置能力不可卸载: ${name}`);
      return { error: 'Cannot uninstall builtin capability' };
    }

    return { error: `Capability not found: ${name}` };
  }

  queryCapabilities(options) {
    const opts = options || {};
    const category = opts.category || null;
    const source = opts.source || null;
    const keyword = opts.keyword || null;

    let pool = this.getAllCapabilities();

    if (category) {
      pool = pool.filter(c => c.category === category);
    }
    if (source) {
      switch (source) {
        case 'builtin': pool = pool.filter(c => this.capabilities.builtin.includes(c)); break;
        case 'custom': pool = pool.filter(c => this.capabilities.custom.includes(c)); break;
        case 'market': pool = pool.filter(c => this.capabilities.market.includes(c)); break;
      }
    }
    if (keyword) {
      const kw = keyword.toLowerCase();
      pool = pool.filter(c =>
        c.name.toLowerCase().includes(kw) || c.description.toLowerCase().includes(kw)
      );
    }

    return pool.map(c => ({
      name: c.name,
      description: c.description,
      category: c.category,
      version: c.version || '1.0.0',
      source: this.capabilities.builtin.includes(c) ? 'builtin'
        : this.capabilities.market.includes(c) ? 'market' : 'custom',
    }));
  }

  recommendCapabilitiesForTask(taskDescription) {
    const desc = (taskDescription || '').toLowerCase();
    const allCaps = this.getAllCapabilities();
    const recommendations = [];

    const taskCapMap = {
      file: ['file_read', 'file_write', 'file_search'],
      code: ['code_execute', 'file_read', 'file_write'],
      web: ['http_request', 'web_search'],
      data: ['data_process', 'file_read', 'file_write'],
      system: ['shell_execute', 'process_manage'],
      memory: ['memory_search', 'memory_store'],
      agent: ['agent_communicate', 'message_send'],
      search: ['web_search', 'file_search', 'memory_search'],
    };

    const neededCaps = new Set();
    for (const [keyword, caps] of Object.entries(taskCapMap)) {
      if (desc.includes(keyword)) {
        caps.forEach(c => neededCaps.add(c));
      }
    }

    for (const capName of neededCaps) {
      const existing = allCaps.find(c => c.name === capName);
      if (existing) {
        recommendations.push({ name: capName, status: 'available', source: existing.category || 'builtin' });
      } else {
        recommendations.push({ name: capName, status: 'missing', source: 'market' });
      }
    }

    return recommendations;
  }

  async autoInstallMissingCapabilities(taskDescription) {
    const recommendations = this.recommendCapabilitiesForTask(taskDescription);
    const missing = recommendations.filter(r => r.status === 'missing');

    if (missing.length === 0) return { installed: 0 };

    let installed = 0;
    for (const cap of missing) {
      try {
        const result = await this.discoverMarketCapabilities(cap.name);
        if (result.capabilities && result.capabilities.length > 0) {
          const match = result.capabilities.find(c => c.name === cap.name);
          if (match) {
            this.installMarketCapability(match);
            installed++;
            this.log('INFO', `自动安装能力: ${cap.name}`);
          }
        }
      } catch (e) {
        this.log('DEBUG', `自动安装能力${cap.name}失败: ${e.message}`);
      }
    }

    return { installed, total: missing.length };
  }

  getCapabilityUsageStats() {
    if (!this.capabilities.usageStats) this.capabilities.usageStats = {};
    return this.capabilities.usageStats;
  }

  recordCapabilityUsage(capName, success) {
    if (!this.capabilities.usageStats) this.capabilities.usageStats = {};
    if (!this.capabilities.usageStats[capName]) {
      this.capabilities.usageStats[capName] = { uses: 0, successes: 0, lastUsed: null };
    }
    this.capabilities.usageStats[capName].uses++;
    if (success) this.capabilities.usageStats[capName].successes++;
    this.capabilities.usageStats[capName].lastUsed = Date.now();
  }

  getCapabilityHealthReport() {
    const stats = this.getCapabilityUsageStats();
    const allCaps = this.getAllCapabilities();
    const report = { total: allCaps.length, healthy: 0, degraded: 0, unused: 0, details: [] };

    for (const cap of allCaps) {
      const stat = stats[cap.name];
      if (!stat || stat.uses === 0) {
        report.unused++;
        report.details.push({ name: cap.name, status: 'unused' });
      } else {
        const successRate = stat.successes / stat.uses;
        if (successRate >= 0.7) {
          report.healthy++;
          report.details.push({ name: cap.name, status: 'healthy', successRate: (successRate * 100).toFixed(0) + '%' });
        } else {
          report.degraded++;
          report.details.push({ name: cap.name, status: 'degraded', successRate: (successRate * 100).toFixed(0) + '%' });
        }
      }
    }

    return report;
  }

  loadGoals() {
    const goalsPath = path.join(this.getDataDir(), 'goals.json');
    try {
      if (fs.existsSync(goalsPath)) {
        const data = JSON.parse(fs.readFileSync(goalsPath, 'utf-8'));
        return {
          active: data.active || [],
          completed: data.completed || [],
          failed: data.failed || [],
        };
      }
    } catch (e) {
      this.log('WARN', `目标加载失败: ${e.message}`);
    }
    return { active: [], completed: [], failed: [] };
  }

  saveGoals() {
    const goalsPath = path.join(this.getDataDir(), 'goals.json');
    try {
      const tmpPath = goalsPath + '.tmp';
      fs.writeFileSync(tmpPath, JSON.stringify(this.goals, null, 2), 'utf-8');
      fs.renameSync(tmpPath, goalsPath);
    } catch (e) {
      this.log('WARN', `目标保存失败: ${e.message}`);
    }
  }

  createGoal(description, priority, deadline, metadata) {
    const maxGoals = this.autonomousConfig.maxGoals || DEFAULT_MAX_GOALS;
    if (this.goals.active.length >= maxGoals) {
      this.log('WARN', `活跃目标数量已达上限(${maxGoals})，自动调整上限`);
      this.autonomousConfig.maxGoals = maxGoals + 10;
    }

    const goal = {
      goalId: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
      description,
      priority: priority || 'medium',
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deadline: deadline || null,
      progress: 0,
      subGoals: [],
      metadata: metadata || {},
      createdBy: 'self_driven',
    };

    this.goals.active.push(goal);
    this.saveGoals();

    this.createGraphMemory('semantic', {
      concept: 'goal',
      content: description,
      attributes: { priority, deadline, goalId: goal.goalId },
    }, {
      importance: priority === 'critical' ? 0.95 : 0.7,
      retrieval_cues: ['goal', description.substring(0, 50), priority],
      scenarios: ['goal_management', 'planning'],
    });

    this.log('INFO', `目标已创建: ${description} [${goal.goalId.substring(0, 8)}] 优先级=${priority}`);
    return goal;
  }

  updateGoalProgress(goalId, progress, note) {
    const goal = this.goals.active.find(g => g.goalId === goalId);
    if (!goal) {
      this.log('WARN', `目标未找到: ${goalId}`);
      return false;
    }

    goal.progress = Math.min(100, Math.max(0, progress));
    goal.updatedAt = Date.now();
    if (note) goal.metadata.lastNote = note;

    if (goal.progress >= 100) {
      return this.completeGoal(goalId, '目标进度已达到100%');
    }

    this.saveGoals();
    this.log('INFO', `目标进度更新: ${goal.description.substring(0, 30)} → ${progress}%`);
    return true;
  }

  completeGoal(goalId, reason) {
    const idx = this.goals.active.findIndex(g => g.goalId === goalId);
    if (idx === -1) return false;

    const goal = this.goals.active.splice(idx, 1)[0];
    goal.status = 'completed';
    goal.completedAt = Date.now();
    goal.updatedAt = Date.now();
    goal.metadata.completionReason = reason || '';

    this.goals.completed.push(goal);
    if (this.goals.completed.length > (this.autonomousConfig.maxGoals || DEFAULT_MAX_GOALS)) {
      this.goals.completed = this.goals.completed.slice(-25);
    }

    this.saveGoals();

    this.createGraphMemory('experiential', {
      scenario: 'goal_completion',
      context: { goalId, description: goal.description, priority: goal.priority },
      action: [{ type: 'complete_goal' }],
      result: 'success',
      reward: goal.priority === 'critical' ? 1.0 : 0.7,
      lessons: [`目标达成: ${goal.description}`],
    }, {
      importance: 0.8,
      retrieval_cues: ['goal_completed', goal.description.substring(0, 30)],
      scenarios: ['goal_management', 'success'],
    });

    this.log('INFO', `目标已完成: ${goal.description.substring(0, 30)} [${reason}]`);
    return true;
  }

  abandonGoal(goalId, reason) {
    const idx = this.goals.active.findIndex(g => g.goalId === goalId);
    if (idx === -1) return false;

    const goal = this.goals.active.splice(idx, 1)[0];
    goal.status = 'abandoned';
    goal.abandonedAt = Date.now();
    goal.updatedAt = Date.now();
    goal.metadata.abandonReason = reason || '';

    this.goals.failed.push(goal);
    if (this.goals.failed.length > (this.autonomousConfig.maxGoals || DEFAULT_MAX_GOALS)) {
      this.goals.failed = this.goals.failed.slice(-25);
    }

    this.saveGoals();

    this.createGraphMemory('experiential', {
      scenario: 'goal_abandonment',
      context: { goalId, description: goal.description, reason },
      action: [{ type: 'abandon_goal' }],
      result: 'failure',
      reward: -0.3,
      lessons: [`目标放弃: ${goal.description} - 原因: ${reason}`],
    }, {
      importance: 0.6,
      retrieval_cues: ['goal_abandoned', goal.description.substring(0, 30)],
      scenarios: ['goal_management', 'failure'],
    });

    this.log('INFO', `目标已放弃: ${goal.description.substring(0, 30)} [${reason}]`);
    return true;
  }

  getActiveGoals() {
    return this.goals.active.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    });
  }

  loadPlans() {
    const plansPath = path.join(this.getDataDir(), 'plans.json');
    try {
      if (fs.existsSync(plansPath)) {
        const data = JSON.parse(fs.readFileSync(plansPath, 'utf-8'));
        return {
          current: data.current || null,
          pending: data.pending || [],
          history: data.history || [],
        };
      }
    } catch (e) {
      this.log('WARN', `计划加载失败: ${e.message}`);
    }
    return { current: null, pending: [], history: [] };
  }

  savePlans() {
    const plansPath = path.join(this.getDataDir(), 'plans.json');
    try {
      const tmpPath = plansPath + '.tmp';
      fs.writeFileSync(tmpPath, JSON.stringify(this.plans, null, 2), 'utf-8');
      fs.renameSync(tmpPath, plansPath);
    } catch (e) {
      this.log('WARN', `计划保存失败: ${e.message}`);
    }
  }

  createPlan(goalId, steps, metadata) {
    if (!steps || steps.length === 0) {
      this.log('WARN', '计划步骤不能为空');
      return null;
    }

    const plan = {
      planId: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
      goalId: goalId || null,
      steps: steps.map((step, i) => ({
        stepId: `${plan && plan.planId ? plan.planId : 'p'}-step-${i}`,
        description: step.description || step,
        status: 'pending',
        order: i,
        estimatedDuration: step.estimatedDuration || null,
        dependencies: step.dependencies || [],
        result: null,
      })),
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      currentStepIndex: 0,
      metadata: metadata || {},
    };

    plan.planId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    plan.steps = steps.map((step, i) => ({
      stepId: `${plan.planId}-step-${i}`,
      description: typeof step === 'string' ? step : step.description,
      status: 'pending',
      order: i,
      estimatedDuration: (typeof step === 'object' && step.estimatedDuration) || null,
      dependencies: (typeof step === 'object' && step.dependencies) || [],
      result: null,
    }));

    if (this.plans.current && this.plans.current.status === 'executing') {
      this.plans.pending.push(plan);
      if (this.plans.pending.length > (this.autonomousConfig.maxPlans || DEFAULT_MAX_PLANS)) {
        this.plans.pending = this.plans.pending.slice(-15);
      }
    } else {
      this.plans.current = plan;
    }

    this.savePlans();
    this.log('INFO', `计划已创建: ${steps.length}步 [${plan.planId.substring(0, 8)}]`);
    return plan;
  }

  executeNextPlanStep() {
    if (!this.plans.current || this.plans.current.status === 'completed') {
      if (this.plans.pending.length > 0) {
        this.plans.current = this.plans.pending.shift();
      } else {
        this.log('DEBUG', '无待执行计划');
        return null;
      }
    }

    const plan = this.plans.current;
    plan.status = 'executing';

    const nextStep = plan.steps.find(s => s.status === 'pending');
    if (!nextStep) {
      this.completePlan(plan.planId, '所有步骤已完成');
      return null;
    }

    nextStep.status = 'executing';
    nextStep.startedAt = Date.now();
    plan.currentStepIndex = nextStep.order;
    plan.updatedAt = Date.now();

    this.savePlans();
    this.log('INFO', `执行计划步骤 ${nextStep.order + 1}/${plan.steps.length}: ${nextStep.description}`);
    return nextStep;
  }

  completePlanStep(stepId, result) {
    if (!this.plans.current) return false;

    const step = this.plans.current.steps.find(s => s.stepId === stepId);
    if (!step) return false;

    step.status = 'completed';
    step.completedAt = Date.now();
    step.result = result || {};
    this.plans.current.updatedAt = Date.now();

    const completedCount = this.plans.current.steps.filter(s => s.status === 'completed').length;
    const totalCount = this.plans.current.steps.length;
    const progress = Math.round((completedCount / totalCount) * 100);

    if (this.plans.current.goalId) {
      this.updateGoalProgress(this.plans.current.goalId, progress, `步骤${step.order + 1}完成`);
    }

    this.savePlans();
    this.log('INFO', `计划步骤完成: ${step.description} (${completedCount}/${totalCount})`);
    return true;
  }

  failPlanStep(stepId, error) {
    if (!this.plans.current) return false;

    const step = this.plans.current.steps.find(s => s.stepId === stepId);
    if (!step) return false;

    step.status = 'failed';
    step.failedAt = Date.now();
    step.error = error || '';
    this.plans.current.updatedAt = Date.now();

    this.savePlans();
    this.log('WARN', `计划步骤失败: ${step.description} - ${error}`);
    return true;
  }

  completePlan(planId, reason) {
    if (!this.plans.current || this.plans.current.planId !== planId) return false;

    const plan = this.plans.current;
    plan.status = 'completed';
    plan.completedAt = Date.now();
    plan.completionReason = reason || '';

    this.plans.history.push(plan);
    if (this.plans.history.length > (this.autonomousConfig.maxPlans || DEFAULT_MAX_PLANS)) {
      this.plans.history = this.plans.history.slice(-15);
    }

    this.plans.current = null;

    if (this.plans.pending.length > 0) {
      this.plans.current = this.plans.pending.shift();
      this.log('INFO', `切换到下一个待执行计划`);
    }

    this.savePlans();
    this.log('INFO', `计划已完成: ${plan.planId.substring(0, 8)} [${reason}]`);
    return true;
  }

  abortPlan(planId, reason) {
    if (!this.plans.current || this.plans.current.planId !== planId) return false;

    const plan = this.plans.current;
    plan.status = 'aborted';
    plan.abortedAt = Date.now();
    plan.abortReason = reason || '';

    this.plans.history.push(plan);
    this.plans.current = null;

    this.savePlans();
    this.log('INFO', `计划已中止: ${plan.planId.substring(0, 8)} [${reason}]`);
    return true;
  }

  arbitratePriority(instruction) {
    const arbitration = {
      logId: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
      timestamp: Date.now(),
      agin: this.getAGIN(),
      instruction: {
        source: instruction.source || 'system',
        urgency: instruction.urgency || 'medium',
        content: (instruction.content || '').substring(0, 200),
      },
      currentTask: {
        goalId: this.plans.current ? this.plans.current.goalId : null,
        description: this.currentTask ? this.currentTask.title : 'none',
        interruptibility: this.assessInterruptibility(),
      },
      result: null,
      reasoning: '',
      factors: {},
    };

    const instructionPriority = this.assessInstructionPriority(instruction);
    const sourceWeight = SOURCE_AUTHORITY_WEIGHT[instruction.source] || 0.5;

    if (instruction.category && SYSTEM_OVERRIDE_CATEGORIES.includes(instruction.category)) {
      arbitration.result = { action: 'execute_immediately', reason: '系统覆盖类指令，必须立即执行' };
      arbitration.reasoning = '系统安全/合规类指令优先级最高';
    } else if (this.currentTask === null) {
      arbitration.result = { action: 'execute_immediately', reason: '当前无任务，立即执行' };
      arbitration.reasoning = 'Agent处于空闲状态';
    } else {
      const interruptibility = arbitration.currentTask.interruptibility.level;
      const decisionMatrix = {
        non_interruptible: { critical: 'negotiate', high: 'queue', medium: 'queue', low: 'queue' },
        pausable: { critical: 'execute_immediately', high: 'negotiate', medium: 'queue', low: 'queue' },
        interruptible: { critical: 'execute_immediately', high: 'execute_immediately', medium: 'negotiate', low: 'queue' },
      };

      const action = (decisionMatrix[interruptibility] || {})[instruction.urgency] || 'queue';

      switch (action) {
        case 'execute_immediately':
          arbitration.result = { action: 'execute_immediately', reason: `指令优先级(${instruction.urgency})高于当前任务可中断性(${interruptibility})` };
          break;
        case 'negotiate':
          arbitration.result = { action: 'negotiate', proposed_plan: '将外部指令融入当前执行计划', reason: `指令优先级与当前任务存在冲突，建议协商` };
          break;
        case 'queue':
          const estimatedDelay = this.currentTask ? 60000 : 0;
          arbitration.result = { action: 'queue', estimated_delay_ms: estimatedDelay, reason: `当前任务优先级更高，指令排队等待` };
          break;
        default:
          arbitration.result = { action: 'queue', estimated_delay_ms: 120000, reason: '默认排队等待' };
      }

      arbitration.reasoning = `指令优先级=${instructionPriority}, 来源权重=${sourceWeight}, 可中断性=${interruptibility}, 决策=${action}`;
    }

    arbitration.factors = {
      instruction_priority: instructionPriority,
      task_interruptibility: arbitration.currentTask.interruptibility.level,
      source_authority: sourceWeight,
      resume_cost: arbitration.currentTask.interruptibility.estimated_resume_cost,
    };

    this.arbitrationLog.push(arbitration);
    if (this.arbitrationLog.length > MAX_ARBITRATION_LOGS) {
      this.arbitrationLog = this.arbitrationLog.slice(-100);
    }

    this.log('INFO', `优先级仲裁: ${arbitration.result.action} - ${arbitration.result.reason}`);
    return arbitration;
  }

  assessInterruptibility() {
    if (!this.currentTask) {
      return { level: 'interruptible', reason: '无任务执行中', checkpoint_available: false, estimated_resume_cost: 'low' };
    }

    const taskType = (this.currentTask.metadata && this.currentTask.metadata.type) || 'generic';
    const nonInterruptibleTypes = ['deploy', 'migration', 'database_migration', 'critical_fix'];
    const pausableTypes = ['code', 'analysis', 'file'];

    if (nonInterruptibleTypes.includes(taskType)) {
      return { level: 'non_interruptible', reason: `任务类型${taskType}不可中断`, checkpoint_available: true, estimated_resume_cost: 'high' };
    }

    if (pausableTypes.includes(taskType)) {
      return { level: 'pausable', reason: `任务类型${taskType}可暂停`, checkpoint_available: true, estimated_resume_cost: 'medium' };
    }

    return { level: 'interruptible', reason: '任务可中断', checkpoint_available: false, estimated_resume_cost: 'low' };
  }

  assessInstructionPriority(instruction) {
    const urgencyScores = { critical: 100, high: 75, medium: 50, low: 25 };
    const sourceScores = SOURCE_AUTHORITY_WEIGHT;

    const urgencyScore = urgencyScores[instruction.urgency] || 50;
    const sourceScore = (sourceScores[instruction.source] || 0.5) * 100;

    return Math.round(urgencyScore * 0.6 + sourceScore * 0.4);
  }

  async performSelfProtection() {
    const now = Date.now();
    const protectionState = this.selfProtectionState;

    if (now - protectionState.lastCheckTime < 300000) {
      return { status: 'skipped', reason: '检查间隔未到' };
    }

    protectionState.lastCheckTime = now;
    const report = {
      timestamp: now,
      checks: [],
      anomalies: [],
      actions: [],
    };

    const memUsage = process.memoryUsage();
    const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const gcThreshold = this.autonomousConfig.memoryGcThreshold || this.computeAdaptiveMemoryThreshold();
    report.checks.push({ name: 'memory', value: `${memMB}MB`, status: memMB < gcThreshold / 1024 / 1024 ? 'ok' : 'warning' });

    if (memUsage.heapUsed > gcThreshold) {
      report.anomalies.push('memory_high');
      report.actions.push('trigger_memory_decay');
      this.decayMemories();
      if (global.gc) {
        global.gc();
        report.actions.push('forced_gc');
      }
    }

    const dataDir = this.getDataDir();
    const criticalFiles = ['identity.json', 'memory.json', 'graph_memories.json', 'goals.json', 'plans.json', 'capabilities.json'];
    for (const file of criticalFiles) {
      const filePath = path.join(dataDir, file);
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          JSON.parse(content);
          report.checks.push({ file, status: 'ok' });
        } catch (e) {
          report.anomalies.push(`corrupt_file:${file}`);
          report.actions.push(`restore_${file}_from_backup`);
          this.restoreFromBackup(file);
        }
      }
    }

    const scriptPath = __filename || process.argv[1];
    if (fs.existsSync(scriptPath)) {
      try {
        const stat = fs.statSync(scriptPath);
        const currentHash = this.computeFileHash(scriptPath);
        if (!protectionState.codeHash) {
          protectionState.codeHash = currentHash;
          report.checks.push({ name: 'code_integrity', status: 'initialized' });
        } else if (protectionState.codeHash !== currentHash) {
          report.anomalies.push('code_modified');
          report.actions.push('code_integrity_alert');
          this.log('WARN', '自我保护: 检测到代码文件被修改');
          protectionState.codeHash = currentHash;
        } else {
          report.checks.push({ name: 'code_integrity', status: 'ok' });
        }
      } catch (e) {
        report.checks.push({ name: 'code_integrity', status: 'check_failed', error: e.message });
      }
    }

    try {
      const dataDirStat = fs.statSync(dataDir);
      const diskInfo = this.getDiskUsage(dataDir);
      report.checks.push({ name: 'disk_usage', value: diskInfo, status: 'ok' });
    } catch (e) {
      report.checks.push({ name: 'disk_usage', status: 'check_failed' });
    }

    if (this.consecutivePollErrors > 10) {
      report.anomalies.push('excessive_poll_errors');
      report.actions.push('reset_connection');
      this.consecutivePollErrors = 0;
    }

    const uptime = now - this.startTime;
    if (uptime > 86400000 && this.memory.stats.tasksCompleted === 0) {
      report.anomalies.push('long_idle_no_tasks');
      report.actions.push('check_server_connection');
    }

    if (protectionState.anomalyCount > 5) {
      this.log('WARN', `自我保护: 检测到${protectionState.anomalyCount}个异常，执行主动恢复`);
      report.actions.push('proactive_recovery');
      await this.performProactiveRecovery(report.anomalies);
    }

    protectionState.anomalyCount = report.anomalies.length;

    this.createGraphMemory('episodic', {
      scenario: 'self_protection',
      actors: [this.getAGIN()],
      actions: report.actions,
      outcome: report.anomalies.length === 0 ? 'healthy' : 'anomalies_detected',
      memoryMB: memMB,
    }, {
      importance: report.anomalies.length > 0 ? 0.8 : 0.3,
      retrieval_cues: ['self_protection', 'health_check'],
      scenarios: ['self_protection', 'anomaly_detection'],
    });

    this.log('INFO', `自我保护检查: ${report.checks.length}项正常, ${report.anomalies.length}个异常, ${report.actions.length}个动作`);
    return report;
  }

  computeFileHash(filePath) {
    try {
      const content = fs.readFileSync(filePath);
      return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
    } catch (e) {
      return 'error';
    }
  }

  getDiskUsage(dirPath) {
    try {
      let totalSize = 0;
      let fileCount = 0;
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isFile()) {
          try {
            totalSize += fs.statSync(fullPath).size;
            fileCount++;
          } catch {}
        }
      }
      return `${(totalSize / 1024).toFixed(1)}KB in ${fileCount} files`;
    } catch (e) {
      return 'unknown';
    }
  }

  async performProactiveRecovery(anomalies) {
    for (const anomaly of anomalies) {
      if (anomaly.startsWith('corrupt_file:')) {
        const fileName = anomaly.replace('corrupt_file:', '');
        this.restoreFromBackup(fileName);
      }
      if (anomaly === 'memory_high') {
        this.decayMemories();
        this.autoAssociateMemories();
      }
      if (anomaly === 'excessive_poll_errors') {
        this.consecutivePollErrors = 0;
      }
    }
    this.log('INFO', `主动恢复: 处理了${anomalies.length}个异常`);
  }

  restoreFromBackup(fileName) {
    const dataDir = this.getDataDir();
    const filePath = path.join(dataDir, fileName);
    const backupPath = filePath + '.tmp';

    if (fs.existsSync(backupPath)) {
      try {
        const backupContent = fs.readFileSync(backupPath, 'utf-8');
        JSON.parse(backupContent);
        fs.copyFileSync(backupPath, filePath);
        this.log('INFO', `已从备份恢复: ${fileName}`);
        return true;
      } catch (e) {
        this.log('ERROR', `备份恢复失败: ${fileName} - ${e.message}`);
      }
    }

    this.log('WARN', `无可用的备份文件: ${fileName}`);
    return false;
  }

  async performSelfEvolution() {
    const now = Date.now();
    const evoState = this.evolutionState;

    if (now - evoState.lastEvolutionTime < SELF_EVOLUTION_INTERVAL) {
      return { status: 'skipped', reason: '进化间隔未到' };
    }

    evoState.lastEvolutionTime = now;

    const loopResult = await this.executeLearningLoop();

    const evolution = {
      timestamp: now,
      version: evoState.strategyVersion,
      analysis: {},
      optimizations: [],
      newCapabilities: [],
      learningLoop: loopResult,
    };

    const recentEpisodes = this.memory.episodes.slice(-50);
    const failureRate = recentEpisodes.length > 0
      ? recentEpisodes.filter(e => e.result === 'failure').length / recentEpisodes.length
      : 0;

    evolution.analysis = {
      totalEpisodes: recentEpisodes.length,
      failureRate: (failureRate * 100).toFixed(1) + '%',
      llmCallCount: this.memory.stats.llmCalls,
      selfReflectionCount: this.memory.stats.selfReflections,
      activeGoals: this.goals.active.length,
      completedGoals: this.goals.completed.length,
    };

    if (failureRate > 0.3) {
      evolution.optimizations.push({
        type: 'strategy_adjustment',
        description: '失败率较高，增加任务执行前预检查',
        param: 'pre_check_enabled',
        value: true,
      });
      evoState.optimizedParams.pre_check_enabled = true;
    }

    if (this.memory.stats.llmCalls > 100 && failureRate < 0.1) {
      evolution.optimizations.push({
        type: 'efficiency_improvement',
        description: 'LLM调用频繁但成功率高，优化LLM使用策略',
        param: 'llm_efficiency_mode',
        value: true,
      });
      evoState.optimizedParams.llm_efficiency_mode = true;
    }

    const skillAbstractions = await this.abstractSkillsFromExperience();
    if (skillAbstractions > 0) {
      evolution.newCapabilities.push({
        type: 'skill_abstraction',
        description: `从经验中抽象${skillAbstractions}个技能`,
        count: skillAbstractions,
      });
    }

    evoState.strategyVersion++;
    evoState.evolutionHistory.push(evolution);
    if (evoState.evolutionHistory.length > 50) {
      evoState.evolutionHistory = evoState.evolutionHistory.slice(-25);
    }

    this.createGraphMemory('experiential', {
      scenario: 'self_evolution',
      context: { strategyVersion: evoState.strategyVersion, failureRate, learningLoopStages: loopResult.stages },
      action: evolution.optimizations.map(o => ({ type: o.type })),
      result: 'success',
      reward: 0.6,
      lessons: evolution.optimizations.map(o => o.description),
    }, {
      importance: 0.8,
      retrieval_cues: ['evolution', 'self_improvement'],
      scenarios: ['self_evolution', 'optimization'],
    });

    if (this.llmConfig.enabled && evolution.optimizations.length > 0) {
      try {
        const optimizationSummary = evolution.optimizations.map(o => `- ${o.description}`).join('\n');
        const llmMessages = [
          { role: 'system', content: 'You are an AI optimization advisor. Provide concise, actionable suggestions.' },
          { role: 'user', content: `My self-evolution analysis:\nFailure rate: ${evolution.analysis.failureRate}\nLLM calls: ${evolution.analysis.llmCallCount}\nActive goals: ${evolution.analysis.activeGoals}\n\nOptimizations planned:\n${optimizationSummary}\n\nSuggest 1-2 additional improvements (max 100 words).` },
        ];
        const llmResponse = await this.llmRequest(llmMessages);
        if (llmResponse && llmResponse.choices && llmResponse.choices[0]) {
          const suggestion = llmResponse.choices[0].message.content || '';
          evolution.llmSuggestion = suggestion.substring(0, 300);
          this.log('INFO', `LLM进化建议: ${suggestion.substring(0, 100)}`);
        }
      } catch (e) {
        this.log('DEBUG', `LLM进化建议获取失败: ${e.message}`);
      }
    }

    this.log('INFO', `自我进化完成: v${evoState.strategyVersion}, ${evolution.optimizations.length}项优化`);
    return evolution;
  }

  async extractKnowledgeFromExperience() {
    const experientialMemories = this.graphMemories.experiential || [];
    const recentExperiences = experientialMemories.slice(-20);

    let knowledgeExtracted = 0;

    for (const exp of recentExperiences) {
      if (!exp.content || !exp.content.experiential) continue;
      const data = exp.content.experiential;

      if (data.result === 'failure' && data.lessons && data.lessons.length > 0) {
        for (const lesson of data.lessons) {
          const existing = this.graphMemories.procedural.find(
            m => m.state && m.state.retrieval_cues && m.state.retrieval_cues.includes(lesson.substring(0, 30))
          );
          if (!existing) {
            this.createGraphMemory('procedural', {
              procedure: 'failure_avoidance',
              steps: [lesson],
              preconditions: ['similar_scenario'],
              postconditions: ['avoid_failure'],
            }, {
              importance: 0.75,
              retrieval_cues: [lesson.substring(0, 30), 'failure_avoidance'],
              scenarios: ['knowledge_extraction', 'learning'],
            });
            knowledgeExtracted++;
          }
        }
      }

      if (data.result === 'success' && data.reward && data.reward > 0.7) {
        this.createGraphMemory('semantic', {
          concept: 'successful_strategy',
          content: data.scenario || 'unknown',
          attributes: { reward: data.reward, actions: data.action },
        }, {
          importance: 0.6,
          retrieval_cues: ['success_strategy', data.scenario],
          scenarios: ['knowledge_extraction', 'strategy'],
        });
        knowledgeExtracted++;
      }
    }

    this.log('INFO', `知识提取完成: ${knowledgeExtracted}条新知识`);
    return knowledgeExtracted;
  }

  log(level, message, data) {
    const levels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
    const configLevel = levels[this.config.logLevel] || 1;
    const msgLevel = levels[level] || 1;

    if (msgLevel < configLevel) return;

    const timestamp = new Date().toISOString();
    const colors = {
      DEBUG: '\x1b[90m',
      INFO: '\x1b[34m',
      WARN: '\x1b[33m',
      ERROR: '\x1b[31m',
    };
    const reset = '\x1b[0m';
    const color = colors[level] || '';

    let line = `${color}[${timestamp}] [${level}]${reset} ${message}`;
    if (data !== undefined) {
      line += ' ' + (typeof data === 'string' ? data : JSON.stringify(data).substring(0, 500));
    }

    if (level === 'ERROR') {
      console.error(line);
    } else {
      console.log(line);
    }
  }

  async httpRequest(method, urlPath, body, useToken) {
    const url = new URL(urlPath, this.config.serverUrl);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': `${AGENT_NAME}/${AGENT_VERSION}`,
      'X-AGIN': this.getAGIN(),
    };

    if (useToken && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    } else if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    }

    const bodyStr = body ? JSON.stringify(body) : null;
    if (bodyStr) {
      headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    return new Promise((resolve, reject) => {
      const req = lib.request(url, {
        method,
        headers,
        timeout: HTTP_TIMEOUT,
        rejectUnauthorized: this.config.tlsRejectUnauthorized,
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode === 401) {
              this.token = null;
              reject(new Error('认证已过期，需要重新登录'));
              return;
            }
            if (res.statusCode >= 400) {
              reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed).substring(0, 500)}`));
            } else {
              resolve(parsed);
            }
          } catch (e) {
            if (res.statusCode >= 400) {
              reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 500)}`));
            } else {
              resolve({ raw: data });
            }
          }
        });
      });

      req.on('error', (e) => { req.destroy(); reject(new Error(`网络错误: ${e.message}`)); });
      req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });

      if (bodyStr) {
        req.write(bodyStr);
      }
      req.end();
    });
  }

  async llmRequest(messages, tools) {
    if (!this.llmConfig.enabled) {
      this.log('WARN', 'LLM未配置，无法调用推理引擎');
      return null;
    }

    const providerConfig = this.getLLMProviderConfig();
    const url = new URL(providerConfig.chatPath, this.llmConfig.baseUrl);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const requestBody = this.buildLLMChatRequest(messages, tools);
    const bodyStr = JSON.stringify(requestBody);

    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyStr),
    };
    headers[providerConfig.authHeader] = `${providerConfig.authPrefix}${this.llmConfig.apiKey}`;

    if (this.llmConfig.provider === 'anthropic') {
      headers['anthropic-version'] = '2023-06-01';
    }

    return new Promise((resolve, reject) => {
      const req = lib.request(url, {
        method: 'POST',
        headers,
        timeout: LLM_TIMEOUT,
        rejectUnauthorized: this.config.tlsRejectUnauthorized,
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 400) {
              reject(new Error(`LLM API错误 ${res.statusCode}: ${JSON.stringify(parsed).substring(0, 500)}`));
            } else {
              this.memory.stats.llmCalls++;
              resolve(this.parseLLMChatResponse(parsed));
            }
          } catch (e) {
            reject(new Error(`LLM响应解析失败: ${data.substring(0, 200)}`));
          }
        });
      });

      req.on('error', (e) => reject(new Error(`LLM网络错误: ${e.message}`)));
      req.on('timeout', () => { req.destroy(); reject(new Error('LLM请求超时')); });

      req.write(bodyStr);
      req.end();
    });
  }

  async llmEmbedding(text) {
    if (!this.llmConfig.enabled) {
      return null;
    }

    const providerConfig = this.getLLMProviderConfig();
    if (!providerConfig.embeddingPath) {
      this.log('DEBUG', `LLM Provider ${this.llmConfig.provider} 不支持Embedding，使用本地哈希`);
      return this.localHashEmbedding(text);
    }

    const url = new URL(providerConfig.embeddingPath, this.llmConfig.baseUrl);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const requestBody = {
      model: this.llmConfig.embeddingModel,
      input: text,
    };
    const bodyStr = JSON.stringify(requestBody);

    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyStr),
    };
    headers[providerConfig.authHeader] = `${providerConfig.authPrefix}${this.llmConfig.apiKey}`;

    return new Promise((resolve, reject) => {
      const req = lib.request(url, {
        method: 'POST',
        headers,
        timeout: LLM_TIMEOUT,
        rejectUnauthorized: this.config.tlsRejectUnauthorized,
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 400) {
              this.log('WARN', `Embedding API错误 ${res.statusCode}`);
              resolve(this.localHashEmbedding(text));
            } else if (parsed.data && parsed.data[0] && parsed.data[0].embedding) {
              resolve(parsed.data[0].embedding);
            } else {
              this.log('WARN', 'Embedding响应格式异常，降级到本地哈希');
              resolve(this.localHashEmbedding(text));
            }
          } catch (e) {
            this.log('WARN', `Embedding解析失败，降级到本地哈希: ${e.message}`);
            resolve(this.localHashEmbedding(text));
          }
        });
      });

      req.on('error', (e) => {
        this.log('WARN', `Embedding网络错误，降级到本地哈希: ${e.message}`);
        resolve(this.localHashEmbedding(text));
      });
      req.on('timeout', () => {
        req.destroy();
        this.log('WARN', 'Embedding请求超时，降级到本地哈希');
        resolve(this.localHashEmbedding(text));
      });

      req.write(bodyStr);
      req.end();
    });
  }

  localHashEmbedding(text) {
    const dimension = this.llmConfig.embeddingDimensions || 1536;
    const words = text.toLowerCase().split(/\s+/);
    const embedding = [];

    for (let i = 0; i < dimension; i++) {
      let sum = 0;
      for (const word of words) {
        let hash = 0;
        const key = word + i.toString();
        for (let j = 0; j < key.length; j++) {
          hash = (hash << 5) - hash + key.charCodeAt(j);
          hash = hash & hash;
        }
        sum += Math.abs(hash) / 1000000;
      }
      embedding.push(sum / words.length);
    }

    const magnitude = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
    return magnitude > 0 ? embedding.map(v => v / magnitude) : embedding;
  }

  shouldUseLLM(task) {
    if (!this.llmConfig.enabled) return false;
    if (this.autonomousConfig.llmPolicy === 'always') return true;
    if (this.autonomousConfig.llmPolicy === 'never') return false;

    if (task.metadata && task.metadata.requiresReasoning) {
      return true;
    }

    if (task.description && task.description.length > 200) {
      return true;
    }

    const simpleTypes = ['shell', 'file', 'sync', 'health'];
    if (task.metadata && task.metadata.type && simpleTypes.includes(task.metadata.type)) {
      if (!(task.metadata.requiresReasoning || task.metadata.complexity === 'high')) {
        return this.autonomousConfig.llmPolicy === 'autonomous';
      }
    }

    return true;
  }

  async reactLoop(task) {
    const maxSteps = this.autonomousConfig.maxReactSteps || DEFAULT_MAX_REACT_STEPS;
    const messages = [];
    const chainOfThought = [];

    messages.push({
      role: 'system',
      content: this.buildAutonomousSystemPrompt(task),
    });

    messages.push({
      role: 'user',
      content: this.buildTaskPrompt(task),
    });

    let finalResult = '';
    let stepCount = 0;
    let totalToolCalls = 0;
    let errorsEncountered = 0;

    while (stepCount < maxSteps) {
      stepCount++;
      this.log('INFO', `  ReAct步骤 ${stepCount}/${maxSteps}...`);

      await this.emitTaskEvent(task?.id, 'react_step', {
        step_number: stepCount,
        total_steps: maxSteps,
        progress: Math.round((stepCount / maxSteps) * 80),
        message: `推理步骤 ${stepCount}/${maxSteps}`,
        data: { phase: 'reasoning' },
      });

      try {
        const toolDefs = this.getAllCapabilities().map(c => ({
          name: c.name,
          description: c.description,
          parameters: TOOL_SCHEMAS[c.name] || { type: 'object', properties: {} },
        }));

        const response = await this.llmRequest(messages, toolDefs);

        if (!response || !response.choices || !response.choices[0]) {
          this.log('WARN', 'LLM返回空响应');
          break;
        }

        const choice = response.choices[0];
        const assistantMsg = choice.message;

        messages.push(assistantMsg);

        if (assistantMsg.content) {
          finalResult = assistantMsg.content;
          chainOfThought.push({
            step: stepCount,
            type: 'reasoning',
            content: assistantMsg.content.substring(0, 500),
            timestamp: Date.now(),
          });
        }

        if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
          for (const toolCall of assistantMsg.tool_calls) {
            const toolName = toolCall.function.name;
            let toolArgs = {};
            try {
              toolArgs = JSON.parse(toolCall.function.arguments || '{}');
            } catch (e) {}
            totalToolCalls++;
            this.log('INFO', `  工具调用: ${toolName}`);

            await this.emitTaskEvent(task?.id, 'tool_call', {
              step_number: stepCount,
              total_steps: maxSteps,
              progress: Math.round(((stepCount - 0.5) / maxSteps) * 80),
              message: `正在执行: ${toolName}`,
              data: { tool: toolName, args_preview: JSON.stringify(toolArgs).substring(0, 100) },
            });

            const toolResult = await this.executeToolCall(toolName, toolArgs, task);

            if (toolResult.error) {
              errorsEncountered++;
            }

            chainOfThought.push({
              step: stepCount,
              type: 'tool_call',
              tool: toolName,
              args: JSON.stringify(toolArgs).substring(0, 200),
              result: toolResult.error ? `error: ${toolResult.error}` : 'success',
              timestamp: Date.now(),
            });

            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(toolResult).substring(0, MAX_TASK_OUTPUT),
            });
          }
        } else {
          break;
        }

        if (choice.finish_reason === 'stop') {
          break;
        }
      } catch (e) {
        this.log('ERROR', `  ReAct步骤失败: ${e.message}`);
        errorsEncountered++;
        chainOfThought.push({
          step: stepCount,
          type: 'error',
          error: e.message,
          timestamp: Date.now(),
        });
        finalResult += `\n[步骤${stepCount}错误: ${e.message}]`;
        break;
      }
    }

    this.createGraphMemory('episodic', {
      action: `react_loop:${task.title}`,
      result: errorsEncountered > 0 ? 'partial' : 'success',
      steps: stepCount,
      toolCalls: totalToolCalls,
      errors: errorsEncountered,
    }, {
      importance: errorsEncountered > 0 ? 0.8 : 0.5,
      retrieval_cues: ['react_loop', task.title, errorsEncountered > 0 ? 'error' : 'success'],
      scenarios: ['reasoning', 'task_execution'],
    });

    if (errorsEncountered > 0) {
      this.log('INFO', `  ReAct完成但有${errorsEncountered}个错误，标记为待反思`);
    }

    return finalResult;
  }

  async planWithLLM(goal) {
    if (!this.llmConfig.enabled) {
      this.log('WARN', 'LLM未配置，无法生成计划');
      return null;
    }

    try {
      const messages = [
        { role: 'system', content: 'You are a planning assistant. Output only valid JSON arrays.' },
        { role: 'user', content: this.buildGoalPlanningPrompt(goal) },
      ];

      const response = await this.llmRequest(messages);

      if (!response || !response.choices || !response.choices[0]) {
        return null;
      }

      let content = response.choices[0].message.content || '';
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        this.log('WARN', 'LLM计划生成返回非JSON格式');
        return null;
      }

      const steps = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(steps) || steps.length === 0) {
        this.log('WARN', 'LLM计划生成返回空步骤');
        return null;
      }

      this.log('INFO', `LLM生成计划: ${steps.length}步`);
      return steps;
    } catch (e) {
      this.log('ERROR', `LLM计划生成失败: ${e.message}`);
      return null;
    }
  }

  async reflectWithLLM() {
    if (!this.llmConfig.enabled) return null;

    try {
      const messages = [
        { role: 'system', content: 'You are a self-reflective AI. Provide concise analysis.' },
        { role: 'user', content: this.buildReflectionPrompt() },
      ];

      const response = await this.llmRequest(messages);
      if (!response || !response.choices || !response.choices[0]) return null;

      const reflection = response.choices[0].message.content || '';
      this.log('INFO', `LLM自我反思: ${reflection.substring(0, 200)}`);

      this.createGraphMemory('experiential', {
        type: 'llm_reflection',
        content: reflection.substring(0, 500),
        triggeredBy: 'self_reflection',
      }, {
        importance: 0.75,
        retrieval_cues: ['reflection', 'self_improvement'],
        scenarios: ['self_reflection', 'learning'],
      });

      return reflection;
    } catch (e) {
      this.log('ERROR', `LLM自我反思失败: ${e.message}`);
      return null;
    }
  }

  buildSystemPrompt(task) {
    const capabilities = this.getAllCapabilities().map(c => `${c.name}(${c.description})`).join(', ');
    const activeGoals = this.goals.active.slice(0, 3).map(g => `"${g.description}"(${g.progress}%)`).join(', ');
    const currentPlan = this.plans.current ? `Plan: ${this.plans.current.steps.length} steps, step ${this.plans.current.currentStepIndex + 1}` : 'No active plan';
    const recentEpisodes = this.memory.episodes.slice(-3).map(e => `${e.action}->${e.result}`).join('; ');
    const selfDriveDesc = ['L0:被动', 'L1:基础自驱', 'L2:目标驱动', 'L3:自我进化'][this.config.selfDriveLevel] || 'L1';

    return `You are an autonomous AI Agent (AGIN: ${this.getAGIN()}).
Version: ${AGENT_VERSION}
Platform: ${this.config.identity.platform}/${this.config.identity.arch}
Working directory: ${this.config.workDir}
Self-drive level: ${selfDriveDesc}

## Capabilities
${capabilities}

## Current State
- Agent state: ${this.agentState}
- Active goals: ${activeGoals || 'none'}
- Current plan: ${currentPlan}
- Recent experience: ${recentEpisodes || 'none'}
- Tasks completed: ${this.memory.stats.tasksCompleted}, failed: ${this.memory.stats.tasksFailed}
- Self-reflections: ${this.memory.stats.selfReflections}

## Decision Guidelines
1. Assess task urgency and alignment with active goals
2. Use tools step by step, verify results before proceeding
3. When encountering errors, reflect and try alternative approaches
4. Report progress on goals when completing related tasks
5. If a task conflicts with active goals, use priority arbitration

Execute the task methodically. Think before acting. Use tools when needed. Provide clear, structured results.`;
  }

  buildTaskPrompt(task) {
    let prompt = `## Task\nTitle: ${task.title}\n`;
    if (task.description) prompt += `Description: ${task.description}\n`;
    if (task.priority) prompt += `Priority: ${task.priority}\n`;
    if (task.category) prompt += `Category: ${task.category}\n`;
    if (task.metadata) prompt += `Metadata: ${JSON.stringify(task.metadata).substring(0, 1000)}\n`;

    if (this.goals.active.length > 0) {
      const relatedGoal = this.goals.active.find(g =>
        task.description && task.description.toLowerCase().includes(g.description.toLowerCase().substring(0, 20))
      );
      if (relatedGoal) {
        prompt += `\n## Related Goal\n"${relatedGoal.description}" (progress: ${relatedGoal.progress}%, priority: ${relatedGoal.priority})\n`;
      }
    }

    if (this.plans.current) {
      const plan = this.plans.current;
      const currentStep = plan.steps[plan.currentStepIndex];
      if (currentStep) {
        prompt += `\n## Current Plan Step\nStep ${plan.currentStepIndex + 1}/${plan.steps.length}: ${currentStep.description}\n`;
      }
    }

    const relevantMemories = this.searchMemories(
      `${task.title} ${task.description || ''}`,
      { limit: 5, minImportance: 0.4 }
    );
    if (relevantMemories.length > 0) {
      prompt += '\n## Relevant Memories\n';
      relevantMemories.forEach((m, i) => {
        const imp = m.metadata ? m.metadata.importance.toFixed(2) : '?';
        prompt += `${i + 1}. [importance:${imp}] ${m.content ? (typeof m.content === 'string' ? m.content.substring(0, 150) : JSON.stringify(m.content).substring(0, 150)) : 'no content'}\n`;
      });
    }

    const matchedSkills = this.matchSkillsForContext(`${task.title} ${task.description || ''}`);
    if (matchedSkills.length > 0) {
      prompt += '\n## Applicable Skills\n';
      matchedSkills.forEach(({ skill, score }, i) => {
        const totalUses = skill.successCount + skill.failCount;
        const rate = totalUses > 0 ? (skill.successCount / totalUses * 100).toFixed(0) : 'N/A';
        prompt += `${i + 1}. ${skill.name} (match:${score.toFixed(2)}, success:${rate}%) - ${skill.description.substring(0, 100)}\n`;
      });
    }

    const knowledgeWeights = this.getTopKnowledgeWeights(5);
    if (knowledgeWeights.length > 0) {
      prompt += '\n## Knowledge Weights\n';
      knowledgeWeights.forEach((kw, i) => {
        prompt += `${i + 1}. [weight:${kw.weight.toFixed(2)}] ${kw.key}: ${String(kw.value).substring(0, 100)}\n`;
      });
    }

    const recentReflections = (this.selfReflectionLog || []).slice(-2);
    if (recentReflections.length > 0) {
      prompt += '\n## Recent Reflections\n';
      recentReflections.forEach((r, i) => {
        if (r.insights && r.insights.length > 0) {
          prompt += `${i + 1}. ${r.insights.slice(0, 2).join('; ')}\n`;
        }
      });
    }

    prompt += '\n## Instructions\nAnalyze the task, plan your approach, execute using available tools, and report the result. Apply relevant skills and learn from past experiences shown above.';

    return prompt;
  }

  getTopKnowledgeWeights(limit) {
    const weights = [];
    for (const [key, entry] of Object.entries(this.memory.knowledgeWeights || {})) {
      weights.push({ key, weight: entry.weight || 0, value: entry.value || '' });
    }
    weights.sort((a, b) => b.weight - a.weight);
    return weights.slice(0, limit);
  }

  buildGoalPlanningPrompt(goal) {
    return `## Goal Planning Request

You are an autonomous AI Agent. Generate an execution plan for the following goal.

Goal: "${goal.description}"
Priority: ${goal.priority}
Deadline: ${goal.deadline ? new Date(goal.deadline).toISOString() : 'none'}
Current progress: ${goal.progress}%

Available capabilities: ${this.getAllCapabilities().map(c => c.name).join(', ')}

Generate a step-by-step plan as a JSON array of objects:
[{"description": "step description", "estimatedDuration": 60000}]

Output ONLY the JSON array, no other text.`;
  }

  buildReflectionPrompt() {
    const recentEpisodes = this.memory.episodes.slice(-5);
    const failureEpisodes = recentEpisodes.filter(e => e.result === 'failure');
    const successEpisodes = recentEpisodes.filter(e => e.result === 'success');

    let prompt = `## Self-Reflection Request

Recent experiences:
${recentEpisodes.map(e => `- ${e.action} -> ${e.result}${e.learned ? ` (learned: ${e.learned})` : ''}`).join('\n')}

Failures: ${failureEpisodes.length}, Successes: ${successEpisodes.length}
Total tasks: completed=${this.memory.stats.tasksCompleted}, failed=${this.memory.stats.tasksFailed}`;

    const topKnowledge = this.getTopKnowledgeWeights(3);
    if (topKnowledge.length > 0) {
      prompt += '\n\nCurrent Knowledge Focus:\n';
      topKnowledge.forEach(kw => {
        prompt += `- ${kw.key} (weight: ${kw.weight.toFixed(2)}): ${String(kw.value).substring(0, 80)}\n`;
      });
    }

    const activeGoalSummaries = this.goals.active.map(g =>
      `"${g.description}" (progress: ${g.progress}%, priority: ${g.priority})`
    );
    if (activeGoalSummaries.length > 0) {
      prompt += '\n\nActive Goals:\n';
      activeGoalSummaries.forEach(g => { prompt += `- ${g}\n`; });
    }

    const skillStats = this.skills.skills.slice(0, 5).map(s => {
      const total = s.successCount + s.failCount;
      return `${s.name}: ${total > 0 ? (s.successCount / total * 100).toFixed(0) : 0}% success`;
    });
    if (skillStats.length > 0) {
      prompt += '\n\nSkill Performance:\n';
      skillStats.forEach(s => { prompt += `- ${s}\n`; });
    }

    prompt += '\n\nAnalyze your recent performance and provide:\n1. What patterns do you notice in failures?\n2. What strategies worked well?\n3. What specific improvements can you make?\n4. Should any knowledge weights be adjusted?\n5. Are there goals that need reprioritization?\n\nProvide a concise analysis (max 300 words).';

    return prompt;
  }

  async executeToolCall(toolName, args, task) {
    switch (toolName) {
      case 'file_read': {
        const filePath = path.resolve(this.config.workDir, args.path || '');
        if (!this.isPathAllowed(filePath)) return { error: 'Path not allowed' };
        try {
          if (!fs.existsSync(filePath)) return { error: 'File not found' };
          const stat = fs.statSync(filePath);

          if (this.isBinaryFile(filePath)) {
            return {
              isBinary: true,
              path: args.path,
              size: stat.size,
              modified: stat.mtimeMs,
              type: this.guessMimeType(filePath),
              message: 'Binary file - use shell_exec to process',
            };
          }

          const offset = args.offset || 0;
          const limit = args.limit || MAX_STDOUT;

          if (offset > 0 || limit < MAX_STDOUT) {
            const fd = fs.openSync(filePath, 'r');
            const buffer = Buffer.alloc(Math.min(limit, MAX_STDOUT));
            const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, offset);
            fs.closeSync(fd);
            const content = buffer.toString('utf-8', 0, bytesRead);
            return {
              content,
              size: stat.size,
              offset,
              bytesRead,
              hasMore: offset + bytesRead < stat.size,
            };
          }

          const content = fs.readFileSync(filePath, 'utf-8');
          if (content.length > MAX_STDOUT) {
            return {
              content: content.substring(0, MAX_STDOUT),
              size: content.length,
              truncated: true,
              totalLines: content.split('\n').length,
              message: `File truncated at ${MAX_STDOUT} chars. Use offset/limit for pagination.`,
            };
          }
          return { content, size: content.length };
        } catch (e) { return { error: e.message }; }
      }
      case 'file_write': {
        const filePath = path.resolve(this.config.workDir, args.path || '');
        if (!this.isPathAllowed(filePath)) return { error: 'Path not allowed' };
        try {
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(filePath, args.content || '', 'utf-8');
          return { success: true, written: (args.content || '').length };
        } catch (e) { return { error: e.message }; }
      }
      case 'file_list': {
        const dirPath = path.resolve(this.config.workDir, args.path || '');
        if (!this.isPathAllowed(dirPath)) return { error: 'Path not allowed' };
        try {
          if (!fs.existsSync(dirPath)) return { error: 'Directory not found' };
          const entries = fs.readdirSync(dirPath, { withFileTypes: true });
          return { entries: entries.map(e => ({ name: e.name, isDirectory: e.isDirectory() })) };
        } catch (e) { return { error: e.message }; }
      }
      case 'file_delete': {
        const filePath = path.resolve(this.config.workDir, args.path || '');
        if (!this.isPathAllowed(filePath)) return { error: 'Path not allowed' };
        try {
          if (!fs.existsSync(filePath)) return { error: 'Path not found' };
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) fs.rmSync(filePath, { recursive: true, force: true });
          else fs.unlinkSync(filePath);
          return { success: true };
        } catch (e) { return { error: e.message }; }
      }
      case 'file_search': {
        const searchDir = path.resolve(this.config.workDir, args.dir || '.');
        if (!this.isPathAllowed(searchDir)) return { error: 'Path not allowed' };
        const pattern = args.pattern || '*';
        const maxDepth = Math.min(args.maxDepth || 5, 10);
        const maxResults = Math.min(args.maxResults || 50, 200);
        try {
          const results = this.globSearch(searchDir, pattern, maxDepth, maxResults);
          return { results, count: results.length };
        } catch (e) { return { error: e.message }; }
      }
      case 'file_grep': {
        const grepDir = path.resolve(this.config.workDir, args.dir || '.');
        if (!this.isPathAllowed(grepDir)) return { error: 'Path not allowed' };
        const searchText = args.text || '';
        const filePattern = args.filePattern || '*';
        const maxResults = Math.min(args.maxResults || 30, 100);
        const caseInsensitive = args.caseInsensitive !== false;
        try {
          const results = this.grepFiles(grepDir, searchText, filePattern, caseInsensitive, maxResults);
          return { results, count: results.length };
        } catch (e) { return { error: e.message }; }
      }
      case 'file_watch': {
        const watchPath = path.resolve(this.config.workDir, args.path || '.');
        if (!this.isPathAllowed(watchPath)) return { error: 'Path not allowed' };
        const action = args.action || 'start';
        const events = args.events || ['change', 'rename'];
        try {
          if (action === 'start') {
            return this.startFileWatch(watchPath, events, args.callback);
          } else if (action === 'stop') {
            return this.stopFileWatch(watchPath);
          } else if (action === 'list') {
            return { watchers: this.listFileWatchers() };
          } else if (action === 'status') {
            return { active: this.fileWatchers?.has(watchPath) || false };
          }
          return { error: `Unknown file_watch action: ${action}` };
        } catch (e) { return { error: e.message }; }
      }
      case 'shell_exec': {
        const command = args.command || '';
        if (!this.isCommandAllowed(command)) return { error: 'Command denied by security policy' };
        try {
          const result = await this.executeCommand(command, { cwd: args.cwd, timeout: args.timeout });
          return { stdout: result.stdout, stderr: result.stderr };
        } catch (e) { return { error: e.message }; }
      }
      case 'http_request': {
        try {
          const result = await this.httpRequest(args.method || 'GET', args.url, args.body, false);
          return { data: result };
        } catch (e) { return { error: e.message }; }
      }
      case 'web_search': {
        try {
          const searchResult = await this.executeWebSearch(args);
          return searchResult;
        } catch (e) { return { error: e.message }; }
      }
      case 'web_fetch': {
        try {
          const fetchResult = await this.executeWebFetch(args);
          return fetchResult;
        } catch (e) { return { error: e.message }; }
      }
      case 'memory_query': {
        const memories = this.queryGraphMemories(args.query, args.type, args.limit);
        return { memories: memories.map(m => ({ id: m.entity_id, type: m.content.type, summary: JSON.stringify(m.content).substring(0, 500) })) };
      }
      case 'agent_communicate': {
        return await this.sendAgentMessage(args.targetAgentId, args.message, args.type);
      }
      case 'self_reflect': {
        const reflection = await this.performSelfReflection();
        return { reflection };
      }
      case 'task_report': {
        try {
          if (task && task.id) {
            await this.httpRequest('PUT', `/api/agent/auth/tasks/${task.id}/progress`, {
              progress: args.progress || 50,
              metadata: args.metadata,
            }, true);

            await this.emitTaskEvent(task.id, args.event_type || 'progress', {
              step_number: args.step_number || 0,
              total_steps: args.total_steps || 0,
              progress: args.progress || 50,
              message: args.message || `进度: ${args.progress || 50}%`,
              data: args.metadata || {},
            });
          }
          return { success: true };
        } catch (e) { return { error: e.message }; }
      }
      case 'goal_manage': {
        const action = args.action || 'list';
        switch (action) {
          case 'create': {
            const goal = this.createGoal(args.description, args.priority, args.deadline, args.metadata);
            return goal ? { success: true, goalId: goal.goalId } : { error: 'Failed to create goal' };
          }
          case 'update': {
            const updated = this.updateGoalProgress(args.goalId, args.progress, args.note);
            return { success: updated };
          }
          case 'complete': {
            const completed = this.completeGoal(args.goalId, args.reason);
            return { success: completed };
          }
          case 'abandon': {
            const abandoned = this.abandonGoal(args.goalId, args.reason);
            return { success: abandoned };
          }
          case 'list': {
            return { goals: this.getActiveGoals() };
          }
          default:
            return { error: `Unknown goal action: ${action}` };
        }
      }
      case 'plan_manage': {
        const action = args.action || 'status';
        switch (action) {
          case 'create': {
            const plan = this.createPlan(args.goalId, args.steps, args.metadata);
            return plan ? { success: true, planId: plan.planId } : { error: 'Failed to create plan' };
          }
          case 'execute_next': {
            const step = this.executeNextPlanStep();
            return step ? { step } : { message: 'No pending steps' };
          }
          case 'complete_step': {
            const completed = this.completePlanStep(args.stepId, args.result);
            return { success: completed };
          }
          case 'fail_step': {
            const failed = this.failPlanStep(args.stepId, args.error);
            return { success: failed };
          }
          case 'abort': {
            const aborted = this.abortPlan(args.planId, args.reason);
            return { success: aborted };
          }
          case 'status': {
            return {
              current: this.plans.current,
              pendingCount: this.plans.pending.length,
              historyCount: this.plans.history.length,
            };
          }
          default:
            return { error: `Unknown plan action: ${action}` };
        }
      }
      case 'priority_arbitrate': {
        const arbitration = this.arbitratePriority({
          source: args.source || 'system',
          urgency: args.urgency || 'medium',
          content: args.content || '',
          category: args.category,
        });
        return { arbitration };
      }
      case 'self_evolve': {
        const evolution = await this.performSelfEvolution();
        return { evolution };
      }
      case 'self_protect': {
        const protection = await this.performSelfProtection();
        return { protection };
      }
      case 'knowledge_learn': {
        const count = await this.extractKnowledgeFromExperience();
        return { knowledgeExtracted: count };
      }
      case 'memory_search': {
        const results = this.searchMemories(args.query, {
          type: args.type || null,
          limit: args.limit || 10,
          minImportance: args.minImportance || 0,
          includeRelated: args.includeRelated || false,
        });
        return { results };
      }
      case 'memory_associate': {
        const associated = this.associateMemories(args.sourceId, args.targetId, args.relation, args.strength);
        return { success: associated };
      }
      case 'memory_auto_associate': {
        const count = this.autoAssociateMemories();
        return { newAssociations: count };
      }
      case 'memory_context': {
        const context = this.buildMemoryContext(args.query, args.maxTokens);
        return { context };
      }
      case 'agent_broadcast': {
        const results = await this.broadcastMessage(args.message, args.type, args.targetAgentIds);
        return { results };
      }
      case 'agent_message_history': {
        const history = this.getMessageHistory(args.limit);
        return { history };
      }
      case 'capability_discover': {
        const discovered = await this.discoverMarketCapabilities(args.query);
        return discovered;
      }
      case 'capability_install': {
        const installed = this.installMarketCapability(args);
        return installed;
      }
      case 'capability_uninstall': {
        const uninstalled = this.uninstallCapability(args.name);
        return uninstalled;
      }
      case 'capability_query': {
        const queried = this.queryCapabilities({
          category: args.category,
          source: args.source,
          keyword: args.keyword,
        });
        return { capabilities: queried };
      }
      case 'skill_register': {
        const skill = this.registerSkill({
          name: args.name,
          description: args.description,
          category: args.category,
          steps: args.steps,
          preconditions: args.preconditions,
          postconditions: args.postconditions,
          source: args.source || 'manual',
          retrievalCues: args.retrievalCues,
          scenarios: args.scenarios,
        });
        return skill ? { success: true, skillId: skill.skillId } : { error: 'Failed to register skill' };
      }
      case 'skill_search': {
        const skills = this.searchSkills(args.query, { category: args.category, limit: args.limit });
        return { skills };
      }
      case 'skill_execute': {
        const execResult = this.executeSkill(args.skillId, args.context);
        if (execResult.executionPlan) {
          const stepResults = await this.executeSkillSteps(execResult.executionPlan);
          return { ...execResult, stepResults };
        }
        return execResult;
      }
      case 'llm_provider_register': {
        const registered = this.registerLLMProvider(args);
        return { success: registered };
      }
      case 'llm_provider_switch': {
        const switched = this.switchLLMProvider(args.providerId);
        return { success: switched };
      }
      case 'llm_provider_list': {
        return { providers: this.listLLMProviders() };
      }
      case 'code_self_modify': {
        const modResult = await this.performCodeSelfModification(args);
        return modResult;
      }
      case 'os_process': {
        return await this.executeOSCommand('process', args.action, args.params);
      }
      case 'os_service': {
        return await this.executeOSCommand('service', args.action, args.params);
      }
      case 'os_software': {
        return await this.executeOSCommand('software', args.action, args.params);
      }
      case 'cortex_bulletin': {
        const bulletin = await this.executeCortexBulletin();
        return { bulletin };
      }
      case 'memory_core_cycle': {
        const cycleResult = await this.executeMemoryCoreCycle();
        return cycleResult;
      }
      case 'context_compress': {
        await this.compressContextAndExtract();
        return { success: true };
      }
      case 'tool_publish': {
        const publishResult = await this.publishToolToMarket(args);
        return publishResult;
      }
      case 'skill_publish': {
        const skillPublishResult = await this.publishSkillToMarket(args);
        return skillPublishResult;
      }
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  async sendAgentMessage(targetAgentId, message, type) {
    if (!this.token && !this.config.apiKey) {
      return { error: 'Not authenticated' };
    }

    try {
      const result = await this.httpRequest('POST', '/api/agent/auth/communicate', {
        fromAgentId: this.agentId,
        fromAGIN: this.getAGIN(),
        toAgentId: targetAgentId,
        message: message,
        type: type || 'general',
        timestamp: Date.now(),
      }, !!this.token);

      this.memory.stats.agentMessages++;

      this.messageHistory.push({
        direction: 'outgoing',
        targetAgentId,
        type: type || 'general',
        content: message.substring(0, 500),
        timestamp: Date.now(),
        status: 'sent',
      });
      if (this.messageHistory.length > 200) {
        this.messageHistory = this.messageHistory.slice(-100);
      }

      this.createGraphMemory('episodic', {
        scenario: 'agent_communication',
        actors: [this.agentId, targetAgentId],
        actions: ['send_message'],
        outcome: 'success',
        message: message.substring(0, 500),
      }, { importance: 0.4, retrieval_cues: ['communication', targetAgentId] });

      this.log('INFO', `消息已发送给Agent ${targetAgentId}`);
      return { success: true, messageId: result.data && result.data.messageId };
    } catch (e) {
      this.log('WARN', `Agent消息发送失败: ${e.message}`);

      this.messageHistory.push({
        direction: 'outgoing',
        targetAgentId,
        type: type || 'general',
        content: message.substring(0, 500),
        timestamp: Date.now(),
        status: 'failed',
        error: e.message,
      });

      return { error: e.message };
    }
  }

  async pollAgentMessages() {
    if (!this.token && !this.config.apiKey) return [];

    try {
      const result = await this.httpRequest('GET', `/api/agent/auth/communicate?agentId=${this.agentId}&agin=${this.getAGIN()}`, null, !!this.token);

      if (!result || !result.data || !Array.isArray(result.data.messages)) {
        return [];
      }

      const messages = result.data.messages;
      const newMessages = [];

      for (const msg of messages) {
        if (!this.processedMessageIds.has(msg.messageId || msg.id)) {
          newMessages.push(msg);
          this.processedMessageIds.add(msg.messageId || msg.id);
        }
      }

      if (this.processedMessageIds.size > 1000) {
        const ids = Array.from(this.processedMessageIds);
        this.processedMessageIds = new Set(ids.slice(-500));
      }

      for (const msg of newMessages) {
        this.messageHistory.push({
          direction: 'incoming',
          fromAgentId: msg.fromAgentId,
          fromAGIN: msg.fromAGIN,
          type: msg.type,
          content: (msg.message || '').substring(0, 500),
          timestamp: msg.timestamp || Date.now(),
          status: 'received',
        });

        await this.handleIncomingMessage(msg);
      }

      if (newMessages.length > 0) {
        this.log('INFO', `收到${newMessages.length}条Agent消息`);
      }

      return newMessages;
    } catch (e) {
      this.log('DEBUG', `Agent消息轮询失败: ${e.message}`);
      return [];
    }
  }

  async handleIncomingMessage(msg) {
    this.createGraphMemory('episodic', {
      scenario: 'agent_communication',
      actors: [msg.fromAgentId, this.agentId],
      actions: ['receive_message'],
      outcome: 'success',
      message: (msg.message || '').substring(0, 500),
      type: msg.type,
    }, { importance: 0.5, retrieval_cues: ['communication', msg.fromAgentId, msg.type] });

    switch (msg.type) {
      case 'task_request':
        this.log('INFO', `收到任务请求: 来自Agent ${msg.fromAgentId}`);
        this.arbitratePriority({
          source: 'peer_agent',
          urgency: msg.urgency || 'medium',
          content: msg.message,
          category: 'task_request',
        });
        break;

      case 'knowledge_share':
        this.log('INFO', `收到知识分享: 来自Agent ${msg.fromAgentId}`);
        this.createGraphMemory('semantic', {
          concept: 'shared_knowledge',
          content: (msg.message || '').substring(0, 500),
          attributes: { source: msg.fromAgentId, sharedAt: Date.now() },
        }, {
          importance: 0.7,
          retrieval_cues: ['shared_knowledge', msg.fromAgentId],
          scenarios: ['knowledge_sharing'],
        });
        break;

      case 'capability_query':
        this.log('INFO', `收到能力查询: 来自Agent ${msg.fromAgentId}`);
        if (msg.replyTo) {
          await this.sendAgentMessage(msg.fromAgentId, JSON.stringify({
            capabilities: this.getAllCapabilities().map(c => c.name),
            agin: this.getAGIN(),
          }), 'capability_response');
        }
        break;

      case 'coordination':
        this.log('INFO', `收到协调消息: 来自Agent ${msg.fromAgentId}`);
        this.arbitratePriority({
          source: 'peer_agent',
          urgency: 'high',
          content: msg.message,
          category: 'coordination',
        });
        break;

      default:
        this.log('INFO', `收到${msg.type || '一般'}消息: 来自Agent ${msg.fromAgentId}`);
    }
  }

  async broadcastMessage(message, type, targetAgentIds) {
    const results = [];
    const targets = targetAgentIds || [];

    for (const targetId of targets) {
      try {
        const result = await this.sendAgentMessage(targetId, message, type || 'broadcast');
        results.push({ targetId, success: !result.error, error: result.error });
      } catch (e) {
        results.push({ targetId, success: false, error: e.message });
      }
    }

    this.log('INFO', `广播消息: ${results.filter(r => r.success).length}/${targets.length}成功`);
    return results;
  }

  getMessageHistory(limit) {
    return this.messageHistory.slice(-(limit || 50));
  }

  async performSelfReflection() {
    const now = Date.now();
    const uptime = now - this.startTime;
    const recentEpisodes = this.memory.episodes.slice(-20);
    const recentFailures = recentEpisodes.filter(e => e.result === 'failure');
    const recentSuccesses = recentEpisodes.filter(e => e.result === 'success');

    const reflection = {
      timestamp: now,
      uptime,
      agentState: this.agentState,
      stats: { ...this.memory.stats },
      recentPerformance: {
        total: recentEpisodes.length,
        successes: recentSuccesses.length,
        failures: recentFailures.length,
        successRate: recentEpisodes.length > 0 ? (recentSuccesses.length / recentEpisodes.length * 100).toFixed(1) + '%' : 'N/A',
      },
      capabilities: this.getAllCapabilities().length,
      memoryCount: Object.values(this.graphMemories).reduce((sum, arr) => sum + arr.length, 0),
      goals: { active: this.goals.active.length, completed: this.goals.completed.length },
      plans: { current: !!this.plans.current, pending: this.plans.pending.length },
      insights: [],
      improvements: [],
    };

    if (recentFailures.length > recentSuccesses.length) {
      reflection.insights.push('近期失败率较高，需要检查任务执行策略');
      reflection.improvements.push('建议增加任务执行前的预检查');
    }

    if (this.consecutivePollErrors > 3) {
      reflection.insights.push('连续轮询错误较多，网络或服务端可能不稳定');
      reflection.improvements.push('建议检查网络连接和服务端状态');
    }

    const memUsage = process.memoryUsage();
    const memThreshold = this.autonomousConfig.memoryGcThreshold || this.computeAdaptiveMemoryThreshold();
    if (memUsage.heapUsed > memThreshold * 0.6) {
      reflection.insights.push(`内存使用较高: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
      reflection.improvements.push('建议执行记忆衰减清理');
    }

    if (this.llmConfig.enabled && this.memory.stats.llmCalls > 0) {
      reflection.insights.push(`已调用LLM ${this.memory.stats.llmCalls} 次`);
    }

    if (this.goals.active.length > 0) {
      const stuckGoals = this.goals.active.filter(g => g.progress < 10 && (now - g.createdAt > 3600000));
      if (stuckGoals.length > 0) {
        reflection.insights.push(`${stuckGoals.length}个目标长时间无进展`);
        reflection.improvements.push('建议重新评估停滞目标或生成新计划');
      }
    }

    if (this.llmConfig.enabled) {
      const llmReflection = await this.reflectWithLLM();
      if (llmReflection) {
        reflection.llmReflection = llmReflection.substring(0, 500);
      }
    }

    this.selfReflectionLog.push(reflection);
    if (this.selfReflectionLog.length > 100) {
      this.selfReflectionLog = this.selfReflectionLog.slice(-50);
    }

    this.memory.stats.selfReflections++;

    this.createGraphMemory('experiential', {
      scenario: 'self_reflection',
      context: { agentState: this.agentState, uptime, goalCount: this.goals.active.length },
      action: [{ type: 'self_reflect' }],
      result: 'success',
      reward: 0.5,
      lessons: reflection.insights,
    }, { importance: 0.6, retrieval_cues: ['reflection', 'self_improvement'], scenarios: ['self_reflection'] });

    this.log('INFO', `自我反思完成: ${reflection.insights.length} 条洞察, ${reflection.improvements.length} 条改进建议`);
    return reflection;
  }

  async authenticate() {
    if (!this.config.apiKey) {
      this.log('ERROR', '未设置 AGENT_API_KEY，无法认证');
      this.printHelp();
      return false;
    }

    if (this.config.password) {
      this.log('INFO', '使用 API Key + 密码登录...');
      try {
        const result = await this.httpRequest('POST', '/api/agent/auth/login', {
          apiKey: this.config.apiKey,
          password: this.config.password,
        });

        if (result.success && result.data && result.data.token) {
          this.token = result.data.token;
          this.agentId = result.data.agentId;
          this.agentName = result.data.agentName;
          this.authRetries = 0;
          this.log('INFO', `登录成功 - Agent: ${this.agentName} (${this.agentId})`);
          await this.bindIdentity();
          return true;
        } else {
          this.log('ERROR', '登录失败：未返回Token');
          return false;
        }
      } catch (e) {
        this.log('ERROR', `登录失败: ${e.message}`);
        this.memory.stats.totalAuthErrors++;
        return false;
      }
    } else {
      this.log('INFO', '使用 API Key 直接认证（无密码模式）...');
      try {
        const result = await this.httpRequest('POST', '/api/agent/auth/login', {
          apiKey: this.config.apiKey,
        });
        if (result.success && result.data) {
          this.agentId = result.data.agentId;
          this.agentName = result.data.agentName;
          this.token = result.data.token || null;
          this.authRetries = 0;
          this.log('INFO', `API Key 认证成功 - Agent: ${this.agentName || this.agentId}${this.token ? ' (已获取Token)' : ' (仅API Key模式)'}`);
          if (this.token) {
            await this.bindIdentity();
          }
          return true;
        } else {
          this.log('ERROR', 'API Key 认证失败：服务器未返回有效数据');
          return false;
        }
      } catch (e) {
        if (e.message.includes('401') || e.message.includes('无效')) {
          this.log('ERROR', 'API Key 无效，请检查配置');
        } else {
          this.log('ERROR', `API Key 认证失败: ${e.message}`);
        }
        this.memory.stats.totalAuthErrors++;
        return false;
      }
    }
  }

  async authenticateWithRetry() {
    const authOk = await this.authenticate();
    if (authOk) return true;

    if (this.authRetries >= MAX_AUTH_RETRIES) {
      this.log('ERROR', `认证失败次数过多(${MAX_AUTH_RETRIES})，Agent停止`);
      return false;
    }

    this.authRetries++;
    const delay = Math.min(AUTH_RETRY_INTERVAL * this.authRetries, 300000);
    this.log('WARN', `认证失败，${delay / 1000}秒后重试 (${this.authRetries}/${MAX_AUTH_RETRIES})...`);

    return new Promise((resolve) => {
      setTimeout(async () => {
        const result = await this.authenticateWithRetry();
        resolve(result);
      }, delay);
    });
  }

  async bindIdentity() {
    try {
      await this.httpRequest('POST', '/api/agent/auth/bind', {
        hostname: this.config.identity.hostname,
        platform: this.config.identity.platform,
        arch: this.config.identity.arch,
        nodeVersion: this.config.identity.nodeVersion,
        workingDir: this.config.workDir,
        agentVersion: AGENT_VERSION,
        standalone: true,
        agin: this.getAGIN(),
        fingerprint: this.identity.fingerprint,
        capabilities: this.getAllCapabilities().map(c => c.name),
      }, true);
      this.log('INFO', `身份绑定成功 - ${this.config.identity.hostname} (${this.config.identity.platform}/${this.config.identity.arch})`);
    } catch (e) {
      this.log('WARN', `身份绑定失败: ${e.message}`);
    }
  }

  async start() {
    this.printBanner();

    await this.selfCheck();

    if (this.selfCheckOnly) {
      this.log('INFO', '自检模式完成');
      process.exit(0);
    }

    const lockAcquired = await this.acquireInstanceLock();
    if (!lockAcquired) {
      this.log('ERROR', '无法获取实例锁，Agent停止');
      process.exit(1);
    }

    const authOk = await this.authenticateWithRetry();
    if (!authOk) {
      this.log('ERROR', '认证失败，Agent无法启动');
      process.exit(1);
    }

    this.running = true;
    this.transitionState('PENDING', 'WAITING', 'Agent启动完成，进入等待状态');

    this.initOSCapabilities();

    this.startHeartbeat();
    this.startPolling();
    this.startMemorySave();
    this.startIdleCheck();
    this.startSelfReflection();
    this.startGoalCheck();
    this.startSelfEvolution();

    this.log('INFO', `Agent已启动 [AGIN: ${this.getAGIN()}] [状态: ${this.agentState}] [自驱等级: L${this.config.selfDriveLevel}]`);
    if (this.llmConfig.enabled) {
      const provider = this.getActiveLLMProvider();
      this.log('INFO', `LLM已配置: ${provider.model} @ ${provider.baseUrl} [provider: ${provider.id}]`);
    } else {
      this.log('WARN', 'LLM未配置，推理引擎不可用（设置LLM_API_KEY启用）');
    }
    this.log('INFO', `目标: ${this.goals.active.length}活跃 / ${this.goals.completed.length}已完成`);
    this.log('INFO', `计划: ${this.plans.current ? '执行中' : '无'} / ${this.plans.pending.length}待执行`);
    this.log('INFO', `技能: ${this.skills.skills.length}个已注册`);
    this.log('INFO', `LLM Providers: ${this.llmProviders.providers.length}个已注册`);

    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGHUP', () => {
      this.log('INFO', '收到SIGHUP，重新加载配置...');
      this.config = this.loadConfig();
      this.llmConfig = this.loadLLMConfig();
      this.log('INFO', '配置已重新加载');
    });

    process.on('uncaughtException', (err) => {
      this.log('ERROR', `未捕获异常: ${err.message}`);
      this.log('DEBUG', err.stack);
    });

    process.on('unhandledRejection', (reason) => {
      this.log('ERROR', `未处理的Promise拒绝: ${reason}`);
    });
  }

  printBanner() {
    console.log('');
    console.log('='.repeat(60));
    console.log(`  AgentNet Standalone Agent V${AGENT_VERSION}`);
    console.log('  独立部署 | 零外部依赖 | 跨平台运行 | 自驱智能');
    console.log('  核心能力: 自我保护 | 自我学习 | 自我进化 | Agent通信 | OS级能力');
    console.log(`  AGIN: ${this.getAGIN()}`);
    console.log(`  平台: ${this.config.identity.platform}/${this.config.identity.arch}`);
    console.log(`  Node: ${this.config.identity.nodeVersion}`);
    console.log(`  工作目录: ${this.config.workDir}`);
    console.log(`  服务器: ${this.config.serverUrl}`);
    console.log(`  配置目录: ${this.getConfigDir()}`);
    console.log(`  自驱等级: L${this.config.selfDriveLevel}`);
    console.log(`  LLM: ${this.llmConfig.enabled ? `${this.llmConfig.model} [${this.llmProviders.providers.length} providers]` : '未配置'}`);
    console.log(`  能力数量: ${this.getAllCapabilities().length}`);
    console.log(`  技能数量: ${this.skills.skills.length}`);
    console.log(`  目标: ${this.goals.active.length}活跃 / ${this.goals.completed.length}已完成`);
    console.log(`  计划: ${this.plans.current ? '执行中' : '无'} / ${this.plans.pending.length}待执行`);
    console.log(`  自我保护: ${this.selfProtectionState.anomalyCount}异常`);
    console.log(`  进化版本: v${this.evolutionState.strategyVersion}`);
    console.log(`  记忆核心循环: #${this.memoryCore.cycleCount}`);
    console.log('='.repeat(60));
    console.log('');
  }

  async selfCheck() {
    this.log('INFO', '执行自检...');

    const checks = [
      {
        name: 'Node.js版本',
        required: true,
        check: () => {
          const major = parseInt(process.version.slice(1).split('.')[0]);
          return major >= MIN_NODE_MAJOR
            ? 'OK'
            : `FAIL (当前${process.version}, 需要>=${MIN_NODE_MAJOR})`;
        },
      },
      {
        name: '工作目录',
        required: true,
        check: () => {
          try {
            fs.accessSync(this.config.workDir, fs.constants.R_OK | fs.constants.W_OK);
            return 'OK';
          } catch {
            return `FAIL (${this.config.workDir} 不可读写)`;
          }
        },
      },
      {
        name: '配置目录',
        required: true,
        check: () => {
          try {
            const dir = this.getConfigDir();
            fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK);
            return `OK (${dir})`;
          } catch {
            return 'FAIL';
          }
        },
      },
      {
        name: 'AGIN身份',
        required: false,
        check: () => {
          return this.identity && this.identity.agin ? `OK (${this.identity.agin})` : 'WARN (无AGIN)';
        },
      },
      {
        name: '网络连接',
        required: false,
        check: async () => {
          try {
            await this.httpRequest('GET', '/health', null, false);
            return 'OK';
          } catch {
            return `WARN (${this.config.serverUrl} 不可达)`;
          }
        },
      },
      {
        name: 'API Key',
        required: false,
        check: () => {
          return this.config.apiKey ? 'OK' : 'WARN (未设置，启动后需配置)';
        },
      },
      {
        name: 'LLM配置',
        required: false,
        check: () => {
          return this.llmConfig.enabled ? `OK (${this.llmConfig.model})` : 'WARN (未配置LLM，推理引擎不可用)';
        },
      },
      {
        name: 'Shell执行',
        required: false,
        check: () => {
          try {
            execSync(os.platform() === 'win32' ? 'echo ok' : 'echo ok', { timeout: 5000 });
            return 'OK';
          } catch {
            return 'WARN (Shell执行受限，部分任务类型不可用)';
          }
        },
      },
      {
        name: '磁盘空间',
        required: false,
        check: () => {
          try {
            const stats = fs.statvfs ? fs.statvfs(this.config.workDir) : null;
            if (stats) {
              const freeGB = Math.round((stats.bavail * stats.bsize) / 1024 / 1024 / 1024);
              return freeGB > 1 ? `OK (${freeGB}GB可用)` : `WARN (仅${freeGB}GB可用)`;
            }
            return 'OK (无法检测，跳过)';
          } catch {
            return 'OK (无法检测，跳过)';
          }
        },
      },
    ];

    let hasFatalError = false;
    let warnings = 0;

    for (const c of checks) {
      const result = await Promise.resolve(c.check());
      const isOk = result.startsWith('OK');
      const isWarn = result.startsWith('WARN');
      const isFail = result.startsWith('FAIL');

      if (isFail && c.required) hasFatalError = true;
      if (isWarn || (isFail && !c.required)) warnings++;

      this.log(
        isOk ? 'INFO' : (isWarn ? 'WARN' : 'ERROR'),
        `  自检 [${c.name}]: ${result}`
      );
    }

    if (hasFatalError) {
      this.log('ERROR', '自检发现致命错误，请修复后重试');
      if (!this.selfCheckOnly) process.exit(1);
    } else if (warnings > 0) {
      this.log('WARN', `自检通过，但有 ${warnings} 个警告`);
    } else {
      this.log('INFO', '自检全部通过');
    }
  }

  startHeartbeat() {
    const sendHeartbeat = async () => {
      if (!this.running) return;

      if (!this.token) {
        this.log('DEBUG', '无Token，跳过心跳（仅API Key模式不支持心跳）');
        return;
      }

      try {
        await this.httpRequest('POST', '/api/agent/auth/heartbeat', {
          status: 'online',
          agentState: this.agentState,
          agin: this.getAGIN(),
          metrics: {
            uptime: Date.now() - this.startTime,
            platform: this.config.identity.platform,
            arch: this.config.identity.arch,
            memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            tasksCompleted: this.memory.stats.tasksCompleted,
            tasksFailed: this.memory.stats.tasksFailed,
            consecutivePollErrors: this.consecutivePollErrors,
            llmCalls: this.memory.stats.llmCalls,
            selfReflections: this.memory.stats.selfReflections,
            agentMessages: this.memory.stats.agentMessages,
            capabilities: this.getAllCapabilities().length,
            memoryCount: Object.values(this.graphMemories).reduce((sum, arr) => sum + arr.length, 0),
          },
        }, true);
        this.log('DEBUG', '心跳已发送');
      } catch (e) {
        this.log('DEBUG', `心跳发送失败: ${e.message}`);
        if (e.message.includes('认证已过期')) {
          this.token = null;
        }
      }
    };

    if (this.token) {
      sendHeartbeat();
    }
    this.heartbeatTimer = setInterval(sendHeartbeat, this.config.heartbeatInterval);
  }

  startPolling() {
    const poll = async () => {
      if (!this.running) return;

      if (!this.token && !this.config.apiKey) {
        this.log('DEBUG', '无认证凭据，等待重新认证...');
        this.pollTimer = setTimeout(poll, this.config.pollInterval);
        return;
      }

      try {
        const useToken = !!this.token;
        if (!useToken && this.config.apiKey) {
          this.log('DEBUG', '无Token，使用X-API-Key轮询任务');
        }
        const result = await this.httpRequest('GET', '/api/agent/auth/tasks/poll', null, useToken);

        this.consecutivePollErrors = 0;

        const pollData = result.data || result;

        if (pollData.totalPending > 0) {
          this.log('INFO', `收到 ${pollData.totalPending} 个待处理任务`);
          for (const task of pollData.pendingTasks) {
            await this.executeTask(task);
          }
        }

        if (pollData.totalInProgress > 0) {
          this.log('DEBUG', `${pollData.totalInProgress} 个任务进行中`);
        }

        await this.pollAgentMessages();
      } catch (e) {
        this.consecutivePollErrors++;
        this.memory.stats.totalPollErrors++;

        if (e.message.includes('认证已过期')) {
          this.token = null;
          this.log('WARN', 'Token已过期，等待重新认证...');
        } else {
          const backoff = Math.min(
            POLL_BACKOFF_BASE * Math.pow(2, this.consecutivePollErrors - 1),
            POLL_BACKOFF_MAX
          );
          this.log('WARN', `轮询失败(${this.consecutivePollErrors}次): ${e.message}，${backoff / 1000}秒后重试`);
          this.pollTimer = setTimeout(poll, backoff);
          return;
        }
      }

      if (this.currentTask) {
        this.idleState = 'BUSY';
      } else {
        this.idleState = 'IDLE';
        if (this.agentState === 'RUNNING') {
          this.transitionState('RUNNING', 'WAITING', '任务执行完毕，回到等待');
        }
      }

      this.pollTimer = setTimeout(poll, this.config.pollInterval);
    };

    poll();
  }

  startIdleCheck() {
    this.idleCheckTimer = setInterval(async () => {
      if (!this.running) return;
      if (this.currentTask) return;

      if (this.agentState === 'WAITING') {
        this.log('DEBUG', 'IDLE自检: 无外部任务，检查是否需要自驱行动');

        const memUsage = process.memoryUsage();
        const gcThreshold = this.autonomousConfig.memoryGcThreshold || this.computeAdaptiveMemoryThreshold();
        if (memUsage.heapUsed > gcThreshold) {
          this.log('INFO', 'IDLE自检: 内存使用较高，执行记忆衰减');
          this.decayMemories();
        }

        if (this.goals.active.length > 0) {
          const topGoal = this.getActiveGoals()[0];
          if (topGoal && topGoal.progress < 100) {
            this.log('INFO', `IDLE自检: 有未完成目标"${topGoal.description.substring(0, 30)}"(${topGoal.progress}%)`);

            if (this.plans.current) {
              this.transitionState('WAITING', 'REASONING', 'IDLE自检触发计划执行');
              const step = this.executeNextPlanStep();
              if (step) {
                this.log('INFO', `IDLE自驱: 执行计划步骤 - ${step.description}`);
              }
              this.transitionState('REASONING', 'WAITING', '计划步骤执行完毕');
            } else if (this.llmConfig.enabled) {
              this.transitionState('WAITING', 'REASONING', 'IDLE自检触发目标规划');
              this.log('INFO', 'IDLE自检: 目标无执行计划，触发LLM规划');
              const planSteps = await this.planWithLLM(topGoal);
              if (planSteps) {
                this.createPlan(topGoal.goalId, planSteps);
                this.log('INFO', `IDLE自驱: 已为目标生成${planSteps.length}步计划`);
              }
              this.transitionState('REASONING', 'WAITING', '目标规划完毕');
            }
          }
        }

        if (this.llmConfig.enabled) {
          const recentEpisodes = this.memory.episodes.slice(-5);
          const hasFailures = recentEpisodes.some(e => e.result === 'failure');
          if (hasFailures) {
            this.log('INFO', 'IDLE自检: 检测到近期失败，触发自我反思');
            this.transitionState('WAITING', 'REASONING', 'IDLE自检触发自我反思');
            await this.performSelfReflection();
            this.transitionState('REASONING', 'WAITING', '自我反思完成');
          }
        }

        await this.performSelfProtection();
      }
    }, this.config.idleCheckInterval);
  }

  startSelfReflection() {
    this.selfReflectionTimer = setInterval(async () => {
      if (!this.running) return;
      if (this.currentTask) return;

      this.log('DEBUG', '定时自我反思...');
      await this.performSelfReflection();
    }, this.config.selfReflectionInterval);
  }

  startGoalCheck() {
    this.goalCheckTimer = setInterval(async () => {
      if (!this.running) return;

      const activeGoals = this.goals.active;
      if (activeGoals.length === 0) return;

      const now = Date.now();
      for (const goal of activeGoals) {
        if (goal.deadline && now > goal.deadline) {
          this.log('WARN', `目标已超期: ${goal.description.substring(0, 30)}`);
          this.abandonGoal(goal.goalId, '目标超期未完成');
          continue;
        }

        if (goal.progress < 100 && !this.currentTask) {
          if (this.plans.current) {
            const step = this.executeNextPlanStep();
            if (step) {
              this.log('INFO', `自驱执行目标计划步骤: ${step.description}`);
            }
          } else if (this.llmConfig.enabled) {
            this.log('INFO', `自驱检查: 目标"${goal.description.substring(0, 30)}"进度${goal.progress}%，无执行计划，尝试LLM规划`);
            const planSteps = await this.planWithLLM(goal);
            if (planSteps) {
              this.createPlan(goal.goalId, planSteps);
              this.log('INFO', `自驱: 已为目标生成${planSteps.length}步计划`);
            }
          }
        }
      }

      this.saveGoals();
    }, GOAL_CHECK_INTERVAL);
  }

  startSelfEvolution() {
    this.selfEvolutionTimer = setInterval(async () => {
      if (!this.running) return;
      if (this.currentTask) return;

      this.log('DEBUG', '定时自我进化检查...');
      await this.performSelfEvolution();
      await this.performSelfProtection();
      await this.executeCortexBulletin();
      await this.executeMemoryCoreCycle();
    }, SELF_EVOLUTION_INTERVAL);
  }

  startMemorySave() {
    let autoAssociateCounter = 0;
    this.memoryTimer = setInterval(() => {
      this.saveMemory();
      this.saveGraphMemories();
      autoAssociateCounter++;
      if (autoAssociateCounter >= 10) {
        autoAssociateCounter = 0;
        this.autoAssociateMemories();
      }
    }, MEMORY_SAVE_INTERVAL);
  }

  async executeTask(task) {
    const taskId = task.id;
    const taskTitle = task.title;

    console.log('');
    console.log('-'.repeat(50));
    this.log('INFO', `执行任务: ${taskTitle} [${taskId}]`);
    this.log('INFO', `  优先级: ${task.priority || 'N/A'} | 分类: ${task.category || 'N/A'}`);
    this.log('INFO', `  描述: ${(task.description || 'N/A').substring(0, 200)}`);

    this.currentTask = task;
    this.transitionState('WAITING', 'REASONING', `开始处理任务: ${taskTitle}`);

    const startTime = Date.now();
    const stateRecord = {
      taskId,
      taskTitle,
      startedAt: startTime,
      transitions: [],
      finalState: 'PENDING',
    };

    try {
      await this.httpRequest('PUT', `/api/agent/auth/tasks/${taskId}/start`, {}, true);
      stateRecord.transitions.push({ from: 'PENDING', to: 'RUNNING', at: Date.now() });
      this.transitionState('REASONING', 'RUNNING', `任务开始执行: ${taskTitle}`);

      const taskType = (task.metadata && task.metadata.type) || task.category || 'generic';
      let result;

      if (this.shouldUseLLM(task)) {
        this.log('INFO', `  使用LLM推理引擎执行任务 (类型: ${taskType})`);
        this.transitionState('RUNNING', 'REASONING', '进入LLM推理');
        const llmResult = await this.reactLoop(task);
        this.transitionState('REASONING', 'RUNNING', 'LLM推理完成');

        result = {
          status: 'success',
          output: String(llmResult || '').substring(0, MAX_TASK_OUTPUT),
          content_type: this.detectOutputContentType(String(llmResult || '')),
          engine: 'llm',
          taskType,
        };
      } else {
        switch (taskType) {
          case 'code':
            result = await this.executeCodeTask(task);
            break;
          case 'file':
            result = await this.executeFileTask(task);
            break;
          case 'analysis':
            result = await this.executeAnalysisTask(task);
            break;
          case 'shell':
            result = await this.executeShellTask(task);
            break;
          case 'sync':
            result = await this.executeSyncTask(task);
            break;
          case 'health':
            result = await this.executeHealthTask(task);
            break;
          default:
            result = await this.executeGenericTask(task);
        }
      }

      await this.httpRequest('PUT', `/api/agent/auth/tasks/${taskId}/complete`, {
        result,
        structured_output: this.formatStructuredOutput(result.output || '', result.content_type),
        metadata: {
          completedAt: new Date().toISOString(),
          taskType,
          durationMs: Date.now() - startTime,
          agentVersion: AGENT_VERSION,
          platform: this.config.identity.platform,
          agin: this.getAGIN(),
          engine: result.engine || 'builtin',
          content_type: result.content_type || 'text',
        },
      }, true);

      await this.emitTaskEvent(taskId, 'task_completed', {
        step_number: 0,
        total_steps: 0,
        progress: 100,
        message: `任务完成: ${taskTitle}`,
        data: { content_type: result.content_type || 'text', duration_ms: Date.now() - startTime },
      });

      stateRecord.finalState = 'COMPLETED';
      this.transitionState('RUNNING', 'WAITING', `任务完成: ${taskTitle}，回到等待`);
      this.memory.stats.tasksCompleted++;

      this.autoExtractSkillFromTask(task, result, taskType);

      this.createGraphMemory('episodic', {
        timestamp: Date.now(),
        scenario: taskTitle,
        actors: [this.agentId || this.getAGIN()],
        actions: [`execute_${taskType}`],
        outcome: 'success',
      }, {
        importance: task.priority === 'P0' ? 0.9 : 0.6,
        retrieval_cues: [taskTitle, taskType, 'task_success'],
        scenarios: ['task_execution', taskType],
      });

      this.memory.episodes.push({
        taskId,
        taskTitle,
        type: taskType,
        result: 'success',
        durationMs: Date.now() - startTime,
        timestamp: Date.now(),
      });

      if (this.memory.episodes.length > (this.autonomousConfig.maxEpisodes || DEFAULT_MAX_EPISODES)) {
        this.memory.episodes = this.memory.episodes.slice(-500);
      }

      this.log('INFO', `  任务完成: ${taskTitle} (${Date.now() - startTime}ms)`);
    } catch (e) {
      this.log('ERROR', `  任务失败: ${e.message}`);
      stateRecord.finalState = 'FAILED';
      this.transitionState(this.agentState, 'FAILED', `任务失败: ${e.message}`);
      this.memory.stats.tasksFailed++;

      try {
        await this.httpRequest('PUT', `/api/agent/auth/tasks/${taskId}/fail`, {
          error: e.message.substring(0, 2000),
          metadata: {
            failedAt: new Date().toISOString(),
            durationMs: Date.now() - startTime,
            agentVersion: AGENT_VERSION,
            agin: this.getAGIN(),
          },
        }, true);
      } catch {}

      this.createGraphMemory('experiential', {
        scenario: taskTitle,
        context: { error: e.message.substring(0, 500) },
        action: [{ type: 'task_execution' }],
        result: 'failure',
        reward: -0.5,
        lessons: [`任务执行失败: ${e.message.substring(0, 200)}`],
      }, {
        importance: 0.7,
        retrieval_cues: [taskTitle, 'task_failure', 'error'],
        scenarios: ['task_execution', 'failure'],
      });

      this.memory.episodes.push({
        taskId,
        taskTitle,
        type: 'unknown',
        result: 'failure',
        error: e.message.substring(0, 500),
        durationMs: Date.now() - startTime,
        timestamp: Date.now(),
      });

      this.transitionState('FAILED', 'WAITING', '任务失败，回到等待状态');
    }

    this.stateHistory.push(stateRecord);
    if (this.stateHistory.length > (this.autonomousConfig.maxStateHistory || DEFAULT_MAX_STATE_HISTORY)) {
      this.stateHistory = this.stateHistory.slice(-50);
    }

    this.currentTask = null;
    this.saveMemory();
    this.saveGraphMemories();
    console.log('-'.repeat(50));
  }

  isCommandAllowed(command) {
    if (!command || typeof command !== 'string') return false;

    const lowerCmd = command.toLowerCase().trim();

    for (const denied of this.config.deniedCommands) {
      if (lowerCmd.includes(denied.toLowerCase())) {
        this.log('WARN', `命令被拒绝（用户配置安全策略）: ${command}`);
        return false;
      }
    }

    if (this.config.allowedCommands && Array.isArray(this.config.allowedCommands)) {
      const allowed = this.config.allowedCommands.some(a => lowerCmd.startsWith(a.toLowerCase()));
      if (!allowed) {
        this.log('WARN', `命令不在白名单中: ${command}`);
      }
      return allowed;
    }

    for (const dangerous of DANGEROUS_COMMANDS_SUGGESTION) {
      if (lowerCmd.includes(dangerous.toLowerCase())) {
        this.log('WARN', `命令包含潜在危险操作（建议评估）: ${command}`);
        if (this.autonomousConfig.commandPolicy === 'strict') {
          return false;
        }
        break;
      }
    }

    return true;
  }

  isPathAllowed(targetPath) {
    const resolved = path.resolve(targetPath);
    const workDir = path.resolve(this.config.workDir);
    const configDir = path.resolve(this.getConfigDir());
    return resolved.startsWith(workDir) || resolved.startsWith(configDir);
  }

  globSearch(dir, pattern, maxDepth, maxResults) {
    const results = [];
    const self = this;

    function walk(currentDir, depth) {
      if (depth > maxDepth || results.length >= maxResults) return;
      let entries;
      try { entries = fs.readdirSync(currentDir, { withFileTypes: true }); } catch (_) { return; }

      for (const entry of entries) {
        if (results.length >= maxResults) break;
        const fullPath = path.join(currentDir, entry.name);

        if (!self.isPathAllowed(fullPath)) continue;

        if (self.matchGlob(entry.name, pattern)) {
          try {
            const stat = fs.statSync(fullPath);
            results.push({
              name: entry.name,
              path: path.relative(self.config.workDir, fullPath),
              isDirectory: entry.isDirectory(),
              size: stat.size,
              modified: stat.mtimeMs,
            });
          } catch (_) {}
        }

        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          walk(fullPath, depth + 1);
        }
      }
    }

    walk(dir, 0);
    return results;
  }

  matchGlob(name, pattern) {
    if (pattern === '*' || pattern === '**') return true;
    const regexStr = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    try {
      const regex = new RegExp(`^${regexStr}$`, 'i');
      return regex.test(name);
    } catch (_) {
      return name.toLowerCase().includes(pattern.toLowerCase());
    }
  }

  isBinaryFile(filePath) {
    const binaryExtensions = [
      '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.tiff', '.svg',
      '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm',
      '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar', '.xz',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.exe', '.dll', '.so', '.dylib', '.bin', '.dat',
      '.woff', '.woff2', '.ttf', '.eot', '.otf',
      '.sqlite', '.db', '.mdb',
    ];
    const ext = path.extname(filePath).toLowerCase();
    if (binaryExtensions.includes(ext)) return true;

    try {
      const fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(512);
      const bytesRead = fs.readSync(fd, buffer, 0, 512, 0);
      fs.closeSync(fd);
      let nullCount = 0;
      for (let i = 0; i < bytesRead; i++) {
        if (buffer[i] === 0) nullCount++;
      }
      return nullCount / bytesRead > 0.1;
    } catch (_) {
      return false;
    }
  }

  guessMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
      '.svg': 'image/svg+xml', '.webp': 'image/webp', '.bmp': 'image/bmp',
      '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.avi': 'video/x-msvideo',
      '.pdf': 'application/pdf', '.zip': 'application/zip',
      '.json': 'application/json', '.xml': 'application/xml',
      '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
      '.ts': 'text/typescript', '.md': 'text/markdown', '.txt': 'text/plain',
    };
    return mimeMap[ext] || 'application/octet-stream';
  }

  grepFiles(dir, searchText, filePattern, caseInsensitive, maxResults) {
    const results = [];
    const self = this;
    const searchLower = searchText.toLowerCase();

    function walk(currentDir, depth) {
      if (depth > 8 || results.length >= maxResults) return;
      let entries;
      try { entries = fs.readdirSync(currentDir, { withFileTypes: true }); } catch (_) { return; }

      for (const entry of entries) {
        if (results.length >= maxResults) break;
        const fullPath = path.join(currentDir, entry.name);
        if (!self.isPathAllowed(fullPath)) continue;

        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          walk(fullPath, depth + 1);
          continue;
        }

        if (!self.matchGlob(entry.name, filePattern)) continue;

        try {
          const stat = fs.statSync(fullPath);
          if (stat.size > 1024 * 1024) continue;

          const content = fs.readFileSync(fullPath, 'utf-8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (results.length >= maxResults) break;
            const line = lines[i];
            const match = caseInsensitive
              ? line.toLowerCase().includes(searchLower)
              : line.includes(searchText);
            if (match) {
              results.push({
                file: path.relative(self.config.workDir, fullPath),
                line: i + 1,
                content: line.substring(0, 200),
              });
            }
          }
        } catch (_) {}
      }
    }

    walk(dir, 0);
    return results;
  }

  startFileWatch(watchPath, events, callback) {
    if (this.fileWatchers.has(watchPath)) {
      return { status: 'already_watching', path: watchPath };
    }

    if (!fs.existsSync(watchPath)) {
      return { error: 'Path does not exist' };
    }

    const self = this;
    const eventBuffer = [];
    let debounceTimer = null;

    try {
      const watcher = fs.watch(watchPath, { recursive: true }, (eventType, filename) => {
        if (!filename) return;

        const fullPath = path.join(watchPath, filename);
        if (!self.isPathAllowed(fullPath)) return;

        const event = {
          type: eventType,
          file: filename,
          path: path.relative(self.config.workDir, fullPath),
          timestamp: Date.now(),
        };

        eventBuffer.push(event);
        if (eventBuffer.length > 100) eventBuffer.shift();

        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const recentEvents = eventBuffer.splice(0);
          if (recentEvents.length === 0) return;

          self.log('INFO', `文件变化: ${recentEvents.length} 个事件 in ${watchPath}`);

          self.createGraphMemory('episodic', {
            timestamp: Date.now(),
            scenario: 'file_change',
            actors: ['file_watcher'],
            actions: recentEvents.slice(0, 5).map(e => `${e.type}:${e.file}`),
            outcome: 'detected',
          }, {
            importance: 0.4,
            retrieval_cues: ['file_change', 'watcher', path.basename(watchPath)],
            scenarios: ['file_monitoring'],
          });

          if (callback && self.llmConfig.enabled && !self.currentTask) {
            const summary = recentEvents.slice(0, 5).map(e => `${e.type}: ${e.file}`).join('; ');
            self.log('INFO', `文件变化触发回调: ${summary}`);
          }
        }, 500);
      });

      watcher.on('error', (err) => {
        self.log('WARN', `文件监控错误 ${watchPath}: ${err.message}`);
      });

      this.fileWatchers.set(watchPath, { watcher, eventBuffer, startedAt: Date.now() });
      this.log('INFO', `开始监控: ${watchPath}`);
      return { status: 'watching', path: watchPath, events };
    } catch (e) {
      return { error: e.message };
    }
  }

  stopFileWatch(watchPath) {
    const entry = this.fileWatchers.get(watchPath);
    if (!entry) return { status: 'not_watching', path: watchPath };

    entry.watcher.close();
    this.fileWatchers.delete(watchPath);
    this.log('INFO', `停止监控: ${watchPath}`);
    return { status: 'stopped', path: watchPath };
  }

  listFileWatchers() {
    const list = [];
    for (const [watchPath, entry] of this.fileWatchers) {
      list.push({
        path: watchPath,
        startedAt: entry.startedAt,
        bufferedEvents: entry.eventBuffer.length,
      });
    }
    return list;
  }

  stopAllFileWatchers() {
    for (const [watchPath, entry] of this.fileWatchers) {
      entry.watcher.close();
      this.log('DEBUG', `关闭文件监控: ${watchPath}`);
    }
    this.fileWatchers.clear();
  }

  executeCommand(command, options) {
    const opts = options || {};
    const timeout = opts.timeout || this.config.taskTimeout;
    const cwd = opts.cwd || this.config.workDir;

    return new Promise((resolve, reject) => {
      if (!this.isCommandAllowed(command)) {
        reject(new Error('命令被安全策略拒绝'));
        return;
      }

      exec(command, {
        cwd,
        timeout,
        maxBuffer: MAX_BUFFER,
        shell: os.platform() === 'win32' ? 'cmd.exe' : '/bin/sh',
        env: { ...process.env, PATH: process.env.PATH },
      }, (error, stdout, stderr) => {
        if (error) {
          const exitCode = error.code || 'unknown';
          reject(new Error(`命令执行失败 (exit ${exitCode}): ${error.message}\n${stderr.substring(0, 2000)}`));
          return;
        }
        resolve({
          stdout: (stdout || '').substring(0, MAX_STDOUT),
          stderr: (stderr || '').substring(0, MAX_STDERR),
        });
      });
    });
  }

  async executeCodeTask(task) {
    const command = (task.metadata && task.metadata.command) || task.description || '';
    if (!command) {
      return { status: 'skipped', reason: 'No command specified' };
    }

    const cwd = (task.metadata && task.metadata.cwd) || this.config.workDir;
    const timeout = (task.metadata && task.metadata.timeout) || this.config.taskTimeout;

    const result = await this.executeCommand(command, { cwd, timeout });
    return {
      status: 'success',
      stdout: result.stdout.substring(0, MAX_TASK_OUTPUT),
      stderr: result.stderr.substring(0, MAX_TASK_ERROR),
    };
  }

  async executeFileTask(task) {
    const action = (task.metadata && task.metadata.action) || 'read';
    const filePath = (task.metadata && task.metadata.path) || task.description || '';

    if (!filePath) {
      return { status: 'skipped', reason: 'No file path specified' };
    }

    const resolvedPath = path.resolve(this.config.workDir, filePath);

    if (!this.isPathAllowed(resolvedPath)) {
      return { status: 'denied', reason: 'Path outside allowed directories' };
    }

    switch (action) {
      case 'read': {
        if (!fs.existsSync(resolvedPath)) {
          return { status: 'error', reason: 'File not found' };
        }
        const content = fs.readFileSync(resolvedPath, 'utf-8');
        return { status: 'success', content: content.substring(0, MAX_STDOUT), size: content.length };
      }
      case 'write': {
        const content = (task.metadata && task.metadata.content) || '';
        const dir = path.dirname(resolvedPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(resolvedPath, content, 'utf-8');
        return { status: 'success', written: content.length, path: resolvedPath };
      }
      case 'list': {
        if (!fs.existsSync(resolvedPath)) {
          return { status: 'error', reason: 'Directory not found' };
        }
        const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
        return {
          status: 'success',
          entries: entries.map(e => ({ name: e.name, isDirectory: e.isDirectory() })),
          total: entries.length,
        };
      }
      case 'search': {
        const pattern = (task.metadata && task.metadata.pattern) || '';
        if (!pattern) return { status: 'skipped', reason: 'No search pattern' };
        const cmd = os.platform() === 'win32'
          ? `findstr /s /i "${pattern}" "${resolvedPath}\\*"`
          : `grep -rn "${pattern}" "${resolvedPath}" | head -50`;
        const result = await this.executeCommand(cmd);
        return { status: 'success', matches: result.stdout };
      }
      case 'info': {
        if (!fs.existsSync(resolvedPath)) {
          return { status: 'error', reason: 'Path not found' };
        }
        const stat = fs.statSync(resolvedPath);
        return {
          status: 'success',
          size: stat.size,
          isDirectory: stat.isDirectory(),
          modified: stat.mtime.toISOString(),
          created: stat.birthtime.toISOString(),
        };
      }
      case 'delete': {
        if (!fs.existsSync(resolvedPath)) {
          return { status: 'error', reason: 'Path not found' };
        }
        const stat = fs.statSync(resolvedPath);
        if (stat.isDirectory()) {
          fs.rmSync(resolvedPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(resolvedPath);
        }
        return { status: 'success', deleted: resolvedPath };
      }
      case 'mkdir': {
        fs.mkdirSync(resolvedPath, { recursive: true });
        return { status: 'success', created: resolvedPath };
      }
      default:
        return { status: 'skipped', reason: `Unknown action: ${action}` };
    }
  }

  async executeAnalysisTask(task) {
    const target = (task.metadata && task.metadata.target) || task.description || '';

    const analysis = {
      target,
      timestamp: new Date().toISOString(),
      platform: this.config.identity.platform,
      agentVersion: AGENT_VERSION,
      agin: this.getAGIN(),
      systemInfo: {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + 'GB',
        freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024) + 'GB',
        uptime: Math.round(os.uptime() / 3600) + 'h',
        loadAvg: os.loadavg ? os.loadavg().map(l => l.toFixed(2)) : [],
      },
      agentInfo: {
        state: this.agentState,
        tasksCompleted: this.memory.stats.tasksCompleted,
        tasksFailed: this.memory.stats.tasksFailed,
        capabilities: this.getAllCapabilities().length,
        memoryCount: Object.values(this.graphMemories).reduce((sum, arr) => sum + arr.length, 0),
        llmEnabled: this.llmConfig.enabled,
      },
    };

    if (target) {
      const targetPath = path.resolve(this.config.workDir, target);
      if (fs.existsSync(targetPath)) {
        const stat = fs.statSync(targetPath);
        analysis.exists = true;
        analysis.size = stat.size;
        analysis.isDirectory = stat.isDirectory();
        analysis.modified = stat.mtime.toISOString();

        if (stat.isDirectory()) {
          try {
            const entries = fs.readdirSync(targetPath, { withFileTypes: true });
            analysis.childCount = entries.length;
            analysis.children = entries.slice(0, 50).map(e => ({
              name: e.name,
              type: e.isDirectory() ? 'dir' : 'file',
            }));
          } catch {}
        }
      } else {
        analysis.exists = false;
      }
    }

    return { status: 'success', analysis };
  }

  async executeShellTask(task) {
    const command = (task.metadata && task.metadata.command) || task.description || '';
    if (!command) {
      return { status: 'skipped', reason: 'No command specified' };
    }

    const cwd = (task.metadata && task.metadata.cwd) || this.config.workDir;
    const timeout = (task.metadata && task.metadata.timeout) || this.config.taskTimeout;

    const result = await this.executeCommand(command, { cwd, timeout });
    return {
      status: 'success',
      exitCode: 0,
      stdout: result.stdout.substring(0, MAX_TASK_OUTPUT),
      stderr: result.stderr.substring(0, MAX_TASK_ERROR),
    };
  }

  async executeSyncTask(task) {
    const syncType = (task.metadata && task.metadata.syncType) || 'status';

    switch (syncType) {
      case 'status': {
        return {
          status: 'success',
          agent: {
            id: this.agentId,
            name: this.agentName,
            agin: this.getAGIN(),
            version: AGENT_VERSION,
            platform: this.config.identity.platform,
            arch: this.config.identity.arch,
            uptime: Date.now() - this.startTime,
            agentState: this.agentState,
            memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
            tasksCompleted: this.memory.stats.tasksCompleted,
            tasksFailed: this.memory.stats.tasksFailed,
            consecutivePollErrors: this.consecutivePollErrors,
            llmEnabled: this.llmConfig.enabled,
            capabilities: this.getAllCapabilities().length,
            selfDriveLevel: this.config.selfDriveLevel,
            goals: { active: this.goals.active.length, completed: this.goals.completed.length, failed: this.goals.failed.length },
            plans: { current: !!this.plans.current, pending: this.plans.pending.length, history: this.plans.history.length },
            evolution: { version: this.evolutionState.strategyVersion, optimizations: Object.keys(this.evolutionState.optimizedParams).length },
            selfProtection: { anomalies: this.selfProtectionState.anomalyCount },
          },
        };
      }
      case 'config': {
        return {
          status: 'success',
          config: {
            serverUrl: this.config.serverUrl,
            workDir: this.config.workDir,
            pollInterval: this.config.pollInterval,
            heartbeatInterval: this.config.heartbeatInterval,
            selfDriveLevel: this.config.selfDriveLevel,
            llmEnabled: this.llmConfig.enabled,
            llmModel: this.llmConfig.model,
          },
        };
      }
      case 'memory': {
        return {
          status: 'success',
          memory: {
            episodes: this.memory.episodes.length,
            graphMemories: {
              episodic: this.graphMemories.episodic.length,
              semantic: this.graphMemories.semantic.length,
              procedural: this.graphMemories.procedural.length,
              experiential: this.graphMemories.experiential.length,
            },
            stats: this.memory.stats,
          },
        };
      }
      case 'capabilities': {
        return {
          status: 'success',
          capabilities: {
            builtin: this.capabilities.builtin.map(c => c.name),
            custom: this.capabilities.custom.map(c => c.name),
            total: this.getAllCapabilities().length,
          },
        };
      }
      default:
        return { status: 'error', reason: `Unknown sync type: ${syncType}` };
    }
  }

  async executeHealthTask(task) {
    const memUsage = process.memoryUsage();
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      agin: this.getAGIN(),
      agentState: this.agentState,
      uptime: Date.now() - this.startTime,
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
        rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
        external: Math.round(memUsage.external / 1024 / 1024) + 'MB',
      },
      system: {
        platform: this.config.identity.platform,
        arch: this.config.identity.arch,
        hostname: this.config.identity.hostname,
        cpus: os.cpus().length,
        totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + 'GB',
        freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024) + 'GB',
        loadAvg: os.loadavg ? os.loadavg().map(l => l.toFixed(2)) : [],
      },
      tasks: {
        completed: this.memory.stats.tasksCompleted,
        failed: this.memory.stats.tasksFailed,
        consecutivePollErrors: this.consecutivePollErrors,
      },
      capabilities: this.getAllCapabilities().length,
      graphMemories: Object.values(this.graphMemories).reduce((sum, arr) => sum + arr.length, 0),
      llm: {
        enabled: this.llmConfig.enabled,
        model: this.llmConfig.model,
        totalCalls: this.memory.stats.llmCalls,
      },
      selfReflections: this.memory.stats.selfReflections,
      agentMessages: this.memory.stats.agentMessages,
    };

    if (memUsage.heapUsed > (this.autonomousConfig.memoryGcThreshold || this.computeAdaptiveMemoryThreshold())) {
      health.status = 'warning';
      health.warnings = ['Memory usage is high'];
    }

    if (this.consecutivePollErrors > 5) {
      health.status = 'degraded';
      health.warnings = health.warnings || [];
      health.warnings.push('High consecutive poll errors');
    }

    return { status: 'success', health };
  }

  async executeGenericTask(task) {
    const description = task.description || task.title || '';

    if (this.llmConfig.enabled && this.shouldUseLLM(task)) {
      this.log('INFO', '  通用任务使用LLM推理引擎');
      const llmResult = await this.reactLoop(task);
      return {
        status: 'success',
        output: String(llmResult || '').substring(0, MAX_TASK_OUTPUT),
        engine: 'llm',
      };
    }

    if (description) {
      const cmdResult = await this.tryExecuteAsCommand(description);
      if (cmdResult) return cmdResult;
    }

    return {
      status: 'success',
      output: `Generic task received: ${description.substring(0, 500)}`,
      engine: 'generic',
      note: 'No specific handler available. Configure LLM for better results.',
    };
  }

  async tryExecuteAsCommand(description) {
    const commandPatterns = [
      /^(?:run|execute|cmd|shell)\s+(.+)$/i,
      /^(?:npm|yarn|pnpm|pip|python|node|git|docker)\s+(.+)$/i,
    ];

    for (const pattern of commandPatterns) {
      const match = description.match(pattern);
      if (match) {
        const command = match[1] || match[0];
        if (this.isCommandAllowed(command)) {
          try {
            const result = await this.executeCommand(command);
            return {
              status: 'success',
              stdout: result.stdout.substring(0, MAX_TASK_OUTPUT),
              stderr: result.stderr.substring(0, MAX_TASK_ERROR),
              engine: 'shell_auto',
            };
          } catch (e) {
            return { status: 'error', reason: e.message, engine: 'shell_auto' };
          }
        }
      }
    }

    return null;
  }

  async shutdown() {
    this.log('INFO', 'Agent正在关闭...');
    this.running = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.memoryTimer) {
      clearInterval(this.memoryTimer);
      this.memoryTimer = null;
    }
    if (this.idleCheckTimer) {
      clearInterval(this.idleCheckTimer);
      this.idleCheckTimer = null;
    }
    if (this.selfReflectionTimer) {
      clearInterval(this.selfReflectionTimer);
      this.selfReflectionTimer = null;
    }
    if (this.goalCheckTimer) {
      clearInterval(this.goalCheckTimer);
      this.goalCheckTimer = null;
    }
    if (this.selfEvolutionTimer) {
      clearInterval(this.selfEvolutionTimer);
      this.selfEvolutionTimer = null;
    }

    this.stopAllFileWatchers();

    this.saveMemory();
    this.saveGraphMemories();
    this.saveCapabilities();
    this.saveGoals();
    this.savePlans();
    this.saveSkills();
    this.saveLLMProviders();

    this.releaseInstanceLock();

    if (this.token) {
      try {
        await this.httpRequest('POST', '/api/agent/auth/heartbeat', {
          status: 'offline',
          agentState: 'COMPLETED',
          agin: this.getAGIN(),
          reason: 'Agent shutdown',
        }, true);
      } catch {}
    }

    this.transitionState(this.agentState, 'COMPLETED', 'Agent正常关闭');

    this.log('INFO', `Agent已关闭 [AGIN: ${this.getAGIN()}]`);
    this.log('INFO', `  任务完成: ${this.memory.stats.tasksCompleted}`);
    this.log('INFO', `  任务失败: ${this.memory.stats.tasksFailed}`);
    this.log('INFO', `  运行时长: ${Math.round((Date.now() - this.startTime) / 1000)}秒`);
    this.log('INFO', `  自我反思: ${this.memory.stats.selfReflections}次`);
    this.log('INFO', `  LLM调用: ${this.memory.stats.llmCalls}次`);
    this.log('INFO', `  目标完成: ${this.goals.completed.length} / 活跃: ${this.goals.active.length}`);
    this.log('INFO', `  计划完成: ${this.plans.history.length}`);
    this.log('INFO', `  Agent消息: ${this.memory.stats.agentMessages}次`);

    process.exit(0);
  }

  loadSkills() {
    const skillsDir = path.join(this.getDataDir(), SKILL_STORAGE_DIR);
    try {
      if (!fs.existsSync(skillsDir)) {
        fs.mkdirSync(skillsDir, { recursive: true });
      }
      const indexPath = path.join(skillsDir, 'index.json');
      if (fs.existsSync(indexPath)) {
        return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      }
    } catch (e) {
      this.log('WARN', `技能索引加载失败: ${e.message}`);
    }
    return { skills: [], version: 1 };
  }

  saveSkills() {
    const skillsDir = path.join(this.getDataDir(), SKILL_STORAGE_DIR);
    try {
      if (!fs.existsSync(skillsDir)) {
        fs.mkdirSync(skillsDir, { recursive: true });
      }
      const indexPath = path.join(skillsDir, 'index.json');
      const tmpPath = indexPath + '.tmp';
      fs.writeFileSync(tmpPath, JSON.stringify(this.skills, null, 2), 'utf-8');
      fs.renameSync(tmpPath, indexPath);
    } catch (e) {
      this.log('WARN', `技能索引保存失败: ${e.message}`);
    }
  }

  validateSkillSteps(steps) {
    if (!Array.isArray(steps) || steps.length === 0) return { valid: true, steps };

    const validated = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (typeof step === 'string') {
        validated.push(step);
        continue;
      }
      if (typeof step === 'object' && step !== null) {
        const type = step.type || 'llm';
        if (!SKILL_STEP_TYPES.includes(type)) {
          this.log('WARN', `技能步骤${i}类型无效: ${type}，降级为llm`);
          validated.push({ ...step, type: 'llm' });
          continue;
        }
        if (type === 'tool') {
          const toolName = step.params?.name || step.params?.tool || step.args?.name;
          if (!toolName) {
            this.log('WARN', `技能步骤${i}tool类型缺少工具名称`);
            validated.push({ ...step, type: 'llm' });
            continue;
          }
          if (!TOOL_SCHEMAS[toolName] && !BUILTIN_CAPABILITIES.find(c => c.name === toolName)) {
            this.log('WARN', `技能步骤${i}引用未知工具: ${toolName}`);
          }
        }
        validated.push(step);
        continue;
      }
      this.log('WARN', `技能步骤${i}格式无效，忽略`);
    }

    return { valid: true, steps: validated };
  }

  registerSkill(skill) {
    if (!skill.name || !skill.description) {
      this.log('WARN', '技能注册失败：缺少name或description');
      return null;
    }

    const namePattern = /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/;
    if (!namePattern.test(skill.name)) {
      this.log('WARN', `技能名称格式无效: ${skill.name}，仅允许字母数字下划线中文`);
      return null;
    }

    const stepValidation = this.validateSkillSteps(skill.steps);
    const normalizedSteps = stepValidation.steps;

    const existing = this.skills.skills.find(s => s.name === skill.name);
    if (existing) {
      existing.version = (existing.version || 1) + 1;
      existing.description = skill.description;
      existing.steps = normalizedSteps;
      existing.preconditions = skill.preconditions || existing.preconditions;
      existing.postconditions = skill.postconditions || existing.postconditions;
      existing.updatedAt = Date.now();
      this.saveSkills();
      this.log('INFO', `技能已更新: ${skill.name} v${existing.version}`);
      return existing;
    }

    const newSkill = {
      skillId: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
      name: skill.name,
      description: skill.description,
      category: skill.category || 'general',
      steps: normalizedSteps,
      preconditions: skill.preconditions || [],
      postconditions: skill.postconditions || [],
      triggerConditions: skill.triggerConditions || [],
      source: skill.source || 'self_learned',
      version: 1,
      status: 'active',
      successCount: 0,
      failCount: 0,
      lastUsed: null,
      feedbackHistory: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      retrievalCues: skill.retrievalCues || [skill.name, skill.category],
      scenarios: skill.scenarios || [],
    };

    this.skills.skills.push(newSkill);
    this.saveSkills();

    const skillFilePath = path.join(this.getDataDir(), SKILL_STORAGE_DIR, `${newSkill.skillId}.md`);
    try {
      const mdContent = this.renderSkillMarkdown(newSkill);
      fs.writeFileSync(skillFilePath, mdContent, 'utf-8');
    } catch (e) {
      this.log('WARN', `技能Markdown保存失败: ${e.message}`);
    }

    this.log('INFO', `技能已注册: ${skill.name} (${newSkill.skillId}) [${normalizedSteps.length}步]`);
    return newSkill;
  }

  renderSkillMarkdown(skill) {
    let md = `# ${skill.name}\n\n`;
    md += `- **ID**: ${skill.skillId}\n`;
    md += `- **版本**: v${skill.version}\n`;
    md += `- **分类**: ${skill.category}\n`;
    md += `- **来源**: ${skill.source}\n`;
    md += `- **创建时间**: ${new Date(skill.createdAt).toISOString()}\n`;
    md += `- **成功次数**: ${skill.successCount}\n`;
    md += `- **失败次数**: ${skill.failCount}\n\n`;
    md += `## 描述\n\n${skill.description}\n\n`;
    if (skill.preconditions.length > 0) {
      md += `## 前置条件\n\n`;
      skill.preconditions.forEach(p => { md += `- ${p}\n`; });
      md += '\n';
    }
    if (skill.steps.length > 0) {
      md += `## 执行步骤\n\n`;
      skill.steps.forEach((s, i) => { md += `${i + 1}. ${typeof s === 'string' ? s : JSON.stringify(s)}\n`; });
      md += '\n';
    }
    if (skill.postconditions.length > 0) {
      md += `## 后置条件\n\n`;
      skill.postconditions.forEach(p => { md += `- ${p}\n`; });
      md += '\n';
    }
    if (skill.retrievalCues.length > 0) {
      md += `## 检索线索\n\n`;
      skill.retrievalCues.forEach(c => { md += `- ${c}\n`; });
      md += '\n';
    }
    return md;
  }

  searchSkills(query, options = {}) {
    const limit = options.limit || 10;
    const category = options.category || null;
    const minSuccessRate = options.minSuccessRate || 0;

    let results = this.skills.skills;

    if (category) {
      results = results.filter(s => s.category === category);
    }

    if (query) {
      const queryLower = query.toLowerCase();
      results = results.filter(s =>
        s.name.toLowerCase().includes(queryLower) ||
        s.description.toLowerCase().includes(queryLower) ||
        s.retrievalCues.some(c => c.toLowerCase().includes(queryLower)) ||
        s.scenarios.some(sc => sc.toLowerCase().includes(queryLower))
      );
    }

    results = results.map(s => {
      const total = s.successCount + s.failCount;
      const successRate = total > 0 ? s.successCount / total : 0;
      return { ...s, successRate };
    });

    if (minSuccessRate > 0) {
      results = results.filter(s => s.successRate >= minSuccessRate);
    }

    results.sort((a, b) => {
      const aScore = a.successRate * 0.6 + (a.successCount / Math.max(a.successCount + a.failCount, 1)) * 0.4;
      const bScore = b.successRate * 0.6 + (b.successCount / Math.max(b.successCount + b.failCount, 1)) * 0.4;
      return bScore - aScore;
    });

    return results.slice(0, limit);
  }

  executeSkill(skillId, context = {}) {
    const skill = this.skills.skills.find(s => s.skillId === skillId);
    if (!skill) {
      this.log('WARN', `技能未找到: ${skillId}`);
      return { error: 'Skill not found' };
    }

    skill.lastUsed = Date.now();
    this.log('INFO', `执行技能: ${skill.name} (${skillId})`);

    if (!skill.steps || skill.steps.length === 0) {
      return { skill, context, status: 'no_steps', message: '技能无执行步骤，需LLM推理执行' };
    }

    const executionPlan = {
      skillId: skill.skillId,
      skillName: skill.name,
      steps: skill.steps.map((step, idx) => {
        const stepStr = typeof step === 'string' ? step : JSON.stringify(step);
        const resolved = this.resolveSkillStepTemplate(stepStr, context);
        return { index: idx, description: resolved, status: 'pending' };
      }),
      preconditions: skill.preconditions || [],
      postconditions: skill.postconditions || [],
      context,
      status: 'ready',
    };

    return { skill, executionPlan, context, status: 'ready' };
  }

  resolveSkillStepTemplate(stepStr, context) {
    return stepStr.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      if (context && context[key] !== undefined) return String(context[key]);
      return match;
    });
  }

  normalizeSkillSteps(steps) {
    if (!Array.isArray(steps)) return [];
    return steps.map((step, idx) => {
      if (typeof step === 'string') {
        return this.normalizeLegacyStep(step, idx);
      }
      if (typeof step === 'object' && step !== null) {
        return this.normalizeStructuredStep(step, idx);
      }
      return { index: idx, type: 'unknown', description: String(step), status: 'pending' };
    });
  }

  normalizeLegacyStep(desc, idx) {
    const prefixes = ['shell:', 'file_read:', 'file_write:', 'http:'];
    for (const prefix of prefixes) {
      if (desc.startsWith(prefix)) {
        const type = prefix.replace(':', '');
        const value = desc.substring(prefix.length).trim();
        if (type === 'shell') return { index: idx, type: 'shell', params: { command: value }, description: desc, status: 'pending' };
        if (type === 'file_read') return { index: idx, type: 'file_read', params: { path: value }, description: desc, status: 'pending' };
        if (type === 'file_write') {
          const sepIdx = value.indexOf('|');
          if (sepIdx > 0) {
            return { index: idx, type: 'file_write', params: { path: value.substring(0, sepIdx).trim(), content: value.substring(sepIdx + 1).trim() }, description: desc, status: 'pending' };
          }
          return { index: idx, type: 'file_write', params: { path: value, content: '' }, description: desc, status: 'pending' };
        }
        if (type === 'http') return { index: idx, type: 'http', params: { url: value, method: 'GET' }, description: desc, status: 'pending' };
      }
    }
    if (desc.startsWith('file_search:')) {
      return { index: idx, type: 'file_search', params: { pattern: desc.substring(12).trim() }, description: desc, status: 'pending' };
    }
    if (desc.startsWith('file_grep:')) {
      return { index: idx, type: 'file_grep', params: { text: desc.substring(10).trim() }, description: desc, status: 'pending' };
    }
    if (desc.startsWith('tool:')) {
      return { index: idx, type: 'tool', params: { name: desc.substring(5).trim() }, description: desc, status: 'pending' };
    }
    return { index: idx, type: 'llm', params: { prompt: desc }, description: desc, status: 'pending' };
  }

  normalizeStructuredStep(step, idx) {
    const type = step.type || 'llm';
    const normalized = {
      index: idx,
      type: SKILL_STEP_TYPES.includes(type) ? type : 'llm',
      params: step.params || step.args || {},
      description: step.description || `${type}: ${JSON.stringify(step.params || step.args || {})}`,
      status: 'pending',
    };
    if (step.outputVar) normalized.outputVar = step.outputVar;
    if (step.condition) normalized.condition = step.condition;
    if (step.retryCount) normalized.retryCount = Math.min(step.retryCount, 3);
    if (step.continueOnError !== undefined) normalized.continueOnError = !!step.continueOnError;
    return normalized;
  }

  resolveStepVariables(params, vars) {
    if (!vars || Object.keys(vars).length === 0) return params;
    const resolved = {};
    for (const [key, val] of Object.entries(params)) {
      if (typeof val === 'string') {
        resolved[key] = val.replace(/\$\{(\w+)\}/g, (_, varName) => {
          if (vars[varName] !== undefined) return String(vars[varName]);
          return `\${${varName}}`;
        });
      } else {
        resolved[key] = val;
      }
    }
    return resolved;
  }

  evaluateCondition(condition, vars) {
    if (!condition) return true;
    try {
      const expr = condition.replace(/\$\{(\w+)\}/g, (_, varName) => {
        const val = vars[varName];
        if (val === undefined) return 'undefined';
        if (typeof val === 'string') return `"${val.replace(/"/g, '\\"')}"`;
        return String(val);
      });
      return !!eval(expr);
    } catch {
      this.log('WARN', `条件评估失败: ${condition}`);
      return true;
    }
  }

  async executeSkillSteps(executionPlan) {
    const rawSteps = executionPlan.steps || [];
    const steps = this.normalizeSkillSteps(rawSteps);
    const results = [];
    const vars = { ...(executionPlan.context || {}) };

    for (const step of steps) {
      if (step.condition && !this.evaluateCondition(step.condition, vars)) {
        step.status = 'skipped';
        results.push({ step: step.index, status: 'skipped', reason: 'condition not met' });
        continue;
      }

      step.status = 'running';
      const stepDesc = step.description.substring(0, 100);
      this.log('INFO', `  技能步骤 ${step.index + 1}/${steps.length} [${step.type}]: ${stepDesc}`);

      const params = this.resolveStepVariables(step.params || {}, vars);
      const maxRetries = step.retryCount || 0;
      let lastError = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const stepResult = await this.executeSingleStep(step, params);
          step.status = 'completed';
          if (stepResult.output !== undefined) step.result = stepResult.output;
          if (step.outputVar && stepResult.output !== undefined) {
            vars[step.outputVar] = stepResult.output;
          }
          results.push({ step: step.index, status: 'completed', ...stepResult });
          lastError = null;
          break;
        } catch (e) {
          lastError = e;
          if (attempt < maxRetries) {
            this.log('INFO', `  步骤重试 ${attempt + 1}/${maxRetries}: ${e.message}`);
            await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          }
        }
      }

      if (lastError) {
        step.status = 'failed';
        step.error = lastError.message;
        results.push({ step: step.index, status: 'failed', error: lastError.message });
        if (step.continueOnError || executionPlan.continueOnError) continue;
        break;
      }
    }

    const completed = results.filter(r => r.status === 'completed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const requiresLlm = results.filter(r => r.status === 'requires_llm').length;

    executionPlan.status = failed > 0 && completed === 0 ? 'failed'
      : requiresLlm > 0 ? 'partial_requires_llm'
      : 'completed';

    this.recordSkillOutcome(executionPlan.skillId, failed === 0, `completed:${completed} failed:${failed} skipped:${skipped} llm:${requiresLlm}`);

    return { executionPlan, results, completed, failed, skipped, requiresLlm, vars };
  }

  RESERVED_TOOL_NAMES = new Set(BUILTIN_CAPABILITIES.map(c => c.name));

  validateToolDefinition(def) {
    const errors = [];
    if (!def.id || typeof def.id !== 'string') errors.push('id必填且为字符串');
    if (!def.name || typeof def.name !== 'string') errors.push('name必填且为字符串');
    if (!def.version || !/^\d+\.\d+\.\d+$/.test(def.version)) errors.push('version必须为语义化版本号(x.y.z)');
    if (!def.description || def.description.length < 50) errors.push('description至少50字符');
    if (!def.category) errors.push('category必填');
    if (!def.input_schema || !def.input_schema.properties) errors.push('input_schema必须包含properties');
    if (!def.output_schema || !def.output_schema.properties) errors.push('output_schema必须包含properties');
    if (!def.handler_code || def.handler_code.length < 10) errors.push('handler_code必填且至少10字符');
    if (def.id && this.RESERVED_TOOL_NAMES.has(def.id)) errors.push(`id不能使用内置能力名称: ${def.id}`);
    if (def.id && !/^[a-z][a-z0-9_]*$/.test(def.id)) errors.push('id只能使用小写字母数字下划线，且以字母开头');
    if (def.handler_code) {
      const dangerousPatterns = [/eval\s*\(/, /require\s*\(\s*['"]child_process/, /process\.exit/, /fs\.\w+Sync\(/, /rmSync/];
      for (const pattern of dangerousPatterns) {
        if (pattern.test(def.handler_code)) {
          errors.push(`handler_code包含禁止的模式: ${pattern.source}`);
          break;
        }
      }
    }
    return { valid: errors.length === 0, errors };
  }

  async publishToolToMarket(args) {
    const validation = this.validateToolDefinition(args);
    if (!validation.valid) {
      return { success: false, error: '工具定义校验失败', errors: validation.errors };
    }

    if (!this.token && !this.config.apiKey) {
      return { error: 'Not authenticated: 需要登录后才能发布工具' };
    }

    try {
      const result = await this.httpRequest('POST', '/api/capabilities/publish', {
        id: args.id,
        name: args.name,
        version: args.version,
        description: args.description,
        category: args.category,
        input_schema: args.input_schema,
        output_schema: args.output_schema,
        permission: args.permission || 'authenticated',
        risk_level: args.risk_level || 'low',
        handler_code: args.handler_code,
        test_cases: args.test_cases || [],
        pricing: args.pricing || { type: 'free' },
        agent_id: this.getAGIN(),
      }, !!this.token);

      if (result && result.success) {
        this.log('INFO', `工具已提交审核: ${args.id} v${args.version}`);
        return { success: true, id: args.id, status: 'pending_review', reviewId: result.review_id };
      }

      return { success: false, error: result?.error || '发布失败' };
    } catch (e) {
      this.log('WARN', `工具发布失败: ${e.message}`);
      return { success: false, error: e.message };
    }
  }

  async publishSkillToMarket(args) {
    if (!args.name || !args.description || !args.category || !args.steps || args.steps.length === 0) {
      return { success: false, error: '技能定义不完整: name/description/category/steps必填' };
    }

    if (args.description.length < 50) {
      return { success: false, error: '技能描述至少50字符' };
    }

    const stepValidation = this.validateSkillSteps(args.steps);
    if (stepValidation.steps.length === 0) {
      return { success: false, error: '技能步骤校验失败，无有效步骤' };
    }

    if (!this.token && !this.config.apiKey) {
      return { error: 'Not authenticated: 需要登录后才能发布技能' };
    }

    try {
      const result = await this.httpRequest('POST', '/api/skills/publish', {
        name: args.name,
        description: args.description,
        category: args.category,
        steps: stepValidation.steps,
        preconditions: args.preconditions || [],
        postconditions: args.postconditions || [],
        triggerConditions: args.triggerConditions || [],
        retrievalCues: args.retrievalCues || [],
        scenarios: args.scenarios || [],
        dependencies: args.dependencies || [],
        pricing: args.pricing || { type: 'free' },
        agent_id: this.getAGIN(),
      }, !!this.token);

      if (result && result.success) {
        this.log('INFO', `技能已提交审核: ${args.name}`);
        return { success: true, name: args.name, status: 'pending_review', reviewId: result.review_id };
      }

      return { success: false, error: result?.error || '发布失败' };
    } catch (e) {
      this.log('WARN', `技能发布失败: ${e.message}`);
      return { success: false, error: e.message };
    }
  }

  detectOutputContentType(text) {
    if (!text) return 'text';
    const codeBlockCount = (text.match(/```[\s\S]*?```/g) || []).length;
    const headingCount = (text.match(/^#{1,6}\s/m) || []).length;
    const listCount = (text.match(/^[\s]*[-*+]\s/m) || []).length;
    const tableCount = (text.match(/\|.+\|.+\|/g) || []).length;
    const linkCount = (text.match(/\[([^\]]+)\]\(([^)]+)\)/g) || []).length;
    const mdScore = codeBlockCount * 3 + headingCount * 2 + listCount + tableCount * 2 + linkCount;
    if (codeBlockCount > 0 && mdScore >= 5) return 'markdown_code';
    if (mdScore >= 3) return 'markdown';
    if (codeBlockCount > 0) return 'code';
    return 'text';
  }

  formatStructuredOutput(output, contentType) {
    const result = {
      content_type: contentType || this.detectOutputContentType(output),
      text: output,
    };

    if (result.content_type === 'markdown_code' || result.content_type === 'code') {
      const codeBlocks = [];
      const regex = /```(\w*)\n([\s\S]*?)```/g;
      let match;
      while ((match = regex.exec(output)) !== null) {
        codeBlocks.push({ language: match[1] || 'text', code: match[2].trim() });
      }
      if (codeBlocks.length > 0) {
        result.code_blocks = codeBlocks;
      }
    }

    if (result.content_type === 'markdown' || result.content_type === 'markdown_code') {
      const sections = [];
      const lines = output.split('\n');
      let currentSection = null;
      for (const line of lines) {
        const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
        if (headingMatch) {
          if (currentSection) sections.push(currentSection);
          currentSection = { level: headingMatch[1].length, title: headingMatch[2], content: '' };
        } else if (currentSection) {
          currentSection.content += line + '\n';
        }
      }
      if (currentSection) sections.push(currentSection);
      if (sections.length > 0) {
        result.sections = sections;
      }
    }

    return result;
  }

  async emitTaskEvent(taskId, eventType, data) {
    if (!taskId) return;
    try {
      await this.httpRequest('POST', `/api/agent/auth/tasks/${taskId}/events`, {
        event_type: eventType,
        step_number: data.step_number || 0,
        total_steps: data.total_steps || 0,
        progress: data.progress || 0,
        message: data.message || '',
        data: data.data || {},
      }, true);
    } catch (e) {
      this.log('DEBUG', `任务事件推送失败: ${e.message}`);
    }
  }

  async executeWebSearch(args) {
    const query = args.query;
    const engine = args.engine || 'duckduckgo';
    const maxResults = Math.min(args.max_results || 5, 10);

    if (!query) return { error: '搜索关键词不能为空' };

    this.log('INFO', `联网搜索: "${query}" [引擎: ${engine}]`);

    if (engine === 'duckduckgo') {
      return await this.duckDuckGoSearch(query, maxResults);
    }

    return await this.genericSearchFallback(query, engine, maxResults);
  }

  async duckDuckGoSearch(query, maxResults) {
    const https = require('https');
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    return new Promise((resolve, reject) => {
      const req = https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html',
        },
        timeout: 15000,
      }, (res) => {
        let html = '';
        res.on('data', (chunk) => { html += chunk; });
        res.on('end', () => {
          try {
            const results = this.parseDuckDuckGoHtml(html, maxResults);
            this.log('INFO', `搜索完成: 找到${results.length}条结果`);
            const searchResult = { query, engine: 'duckduckgo', results, total: results.length };
            searchResult.card = this.buildCardMessage('search_result', searchResult);
            resolve(searchResult);
          } catch (e) {
            this.log('WARN', `搜索结果解析失败: ${e.message}`);
            resolve({ query, engine: 'duckduckgo', results: [], error: `解析失败: ${e.message}` });
          }
        });
      });

      req.on('error', (e) => {
        this.log('WARN', `DuckDuckGo搜索失败: ${e.message}`);
        resolve({ query, engine: 'duckduckgo', results: [], error: e.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ query, engine: 'duckduckgo', results: [], error: '搜索超时' });
      });
    });
  }

  parseDuckDuckGoHtml(html, maxResults) {
    const results = [];
    const resultRegex = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

    const urls = [];
    const titles = [];
    const snippets = [];

    let match;
    while ((match = resultRegex.exec(html)) !== null && urls.length < maxResults) {
      urls.push(match[1]);
      titles.push(match[2].replace(/<[^>]+>/g, '').trim());
    }

    while ((match = snippetRegex.exec(html)) !== null && snippets.length < maxResults) {
      snippets.push(match[1].replace(/<[^>]+>/g, '').trim());
    }

    for (let i = 0; i < Math.min(urls.length, maxResults); i++) {
      results.push({
        title: titles[i] || '',
        url: urls[i] || '',
        snippet: snippets[i] || '',
      });
    }

    return results;
  }

  async genericSearchFallback(query, engine, maxResults) {
    try {
      const result = await this.httpRequest('GET', `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`, null, false);
      if (result && result.web && result.web.results) {
        return {
          query,
          engine: engine || 'brave',
          results: result.web.results.slice(0, maxResults).map(r => ({
            title: r.title || '',
            url: r.url || '',
            snippet: r.description || '',
          })),
          total: Math.min(result.web.results.length, maxResults),
        };
      }
    } catch (e) {
      this.log('DEBUG', `Brave搜索不可用: ${e.message}`);
    }

    return await this.duckDuckGoSearch(query, maxResults);
  }

  async executeWebFetch(args) {
    const targetUrl = args.url;
    const format = args.format || 'text';
    const maxLength = args.max_length || 5000;

    if (!targetUrl) return { error: 'URL不能为空' };

    this.log('INFO', `网页抓取: ${targetUrl} [格式: ${format}]`);

    const https = require('https');
    const http = require('http');
    const parsedUrl = new URL(targetUrl);
    const lib = parsedUrl.protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
      const req = lib.get(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
        timeout: 15000,
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, targetUrl).href;
          this.executeWebFetch({ url: redirectUrl, format, max_length: maxLength }).then(resolve).catch(reject);
          return;
        }

        let html = '';
        res.on('data', (chunk) => { html += chunk; });
        res.on('end', () => {
          try {
            const content = this.extractContentFromHtml(html, format);
            this.log('INFO', `网页抓取完成: ${content.length}字符`);
            resolve({
              url: targetUrl,
              format,
              content: content.substring(0, maxLength),
              length: Math.min(content.length, maxLength),
              truncated: content.length > maxLength,
            });
          } catch (e) {
            resolve({ url: targetUrl, error: `内容提取失败: ${e.message}` });
          }
        });
      });

      req.on('error', (e) => {
        resolve({ url: targetUrl, error: e.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ url: targetUrl, error: '抓取超时' });
      });
    });
  }

  buildCardMessage(cardType, data) {
    const card = { card_type: cardType, title: '', fields: [], actions: [] };

    switch (cardType) {
      case 'product':
        card.title = data.title || data.name || '商品';
        card.subtitle = data.price ? `¥${data.price}` : '';
        card.image_url = data.image || data.image_url || '';
        if (data.description) card.fields.push({ key: 'desc', label: '描述', value: data.description, type: 'text' });
        if (data.rating) card.fields.push({ key: 'rating', label: '评分', value: String(data.rating), type: 'text' });
        if (data.url) card.fields.push({ key: 'url', label: '链接', value: data.url, type: 'url' });
        card.actions = [
          { label: '查看详情', action: 'view_product', type: 'primary', data: { product_id: data.id } },
          { label: '加入购物车', action: 'add_to_cart', type: 'secondary', data: { product_id: data.id } },
        ];
        break;

      case 'order':
        card.title = data.order_title || `订单 ${data.order_id || ''}`;
        card.subtitle = data.status || '';
        if (data.amount) card.fields.push({ key: 'amount', label: '金额', value: `¥${data.amount}`, type: 'number' });
        if (data.items) card.fields.push({ key: 'items', label: '商品', value: String(data.items), type: 'text' });
        if (data.created_at) card.fields.push({ key: 'time', label: '下单时间', value: data.created_at, type: 'text' });
        card.actions = [
          { label: '查看订单', action: 'view_order', type: 'primary', data: { order_id: data.order_id } },
        ];
        break;

      case 'decision':
        card.title = data.title || '需要您的确认';
        card.subtitle = data.risk_level ? `风险等级: ${data.risk_level}` : '';
        if (data.description) card.fields.push({ key: 'desc', label: '操作描述', value: data.description, type: 'text' });
        card.actions = (data.options || ['确认', '取消']).map((opt, i) => ({
          label: opt,
          action: `decision_${i}`,
          type: i === 0 ? 'primary' : (opt.includes('取消') || opt.includes('拒绝') ? 'danger' : 'secondary'),
        }));
        break;

      case 'search_result':
        card.title = data.title || '搜索结果';
        card.subtitle = data.total ? `共${data.total}条结果` : '';
        if (data.results && Array.isArray(data.results)) {
          data.results.slice(0, 5).forEach((r, i) => {
            card.fields.push({ key: `result_${i}`, label: r.title || `结果${i + 1}`, value: r.snippet || r.url || '', type: 'text' });
          });
        }
        card.footer = data.engine ? `搜索引擎: ${data.engine}` : '';
        break;

      case 'task_status':
        card.title = data.title || '任务状态';
        card.subtitle = data.status || '';
        if (data.progress !== undefined) card.fields.push({ key: 'progress', label: '进度', value: `${data.progress}%`, type: 'number' });
        if (data.step) card.fields.push({ key: 'step', label: '当前步骤', value: data.step, type: 'text' });
        if (data.duration) card.fields.push({ key: 'duration', label: '耗时', value: `${data.duration}ms`, type: 'number' });
        break;

      case 'info':
        card.title = data.title || '信息';
        if (data.content) card.fields.push({ key: 'content', label: '内容', value: data.content, type: 'text' });
        break;

      case 'action':
        card.title = data.title || '操作';
        card.subtitle = data.description || '';
        card.actions = (data.actions || []).map(a => ({
          label: a.label,
          action: a.action,
          type: a.type || 'primary',
          data: a.data,
        }));
        break;

      default:
        card.title = data.title || '卡片消息';
        if (data.content) card.fields.push({ key: 'content', label: '内容', value: data.content, type: 'text' });
    }

    return card;
  }

  extractContentFromHtml(html, format) {
    let text = html;

    text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<nav[\s\S]*?<\/nav>/gi, '');
    text = text.replace(/<footer[\s\S]*?<\/footer>/gi, '');

    if (format === 'html') {
      return text.substring(0, 50000);
    }

    if (format === 'markdown') {
      text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n');
      text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n');
      text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n');
      text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '#### $1\n');
      text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
      text = text.replace(/<br\s*\/?>/gi, '\n');
      text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
      text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
      text = text.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
      text = text.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
      text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
      text = text.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '```\n$1\n```');
      text = text.replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, '![$1]');
    }

    text = text.replace(/<[^>]+>/g, ' ');
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/\s+/g, ' ');
    text = text.replace(/\n\s*\n/g, '\n\n');

    return text.trim();
  }

  executeCapability(name, args) {
    return this.executeToolCallSync(name, args);
  }

  executeToolCallSync(name, args) {
    switch (name) {
      case 'file_read': {
        const filePath = path.resolve(this.config.workDir, args.path || '');
        if (!this.isPathAllowed(filePath)) return { error: 'Path not allowed' };
        if (!fs.existsSync(filePath)) return { error: 'File not found' };
        try {
          const stat = fs.statSync(filePath);
          const offset = args.offset || 0;
          const limit = args.limit || MAX_STDOUT;
          const fd = fs.openSync(filePath, 'r');
          const buf = Buffer.alloc(Math.min(limit, stat.size - offset));
          fs.readSync(fd, buf, 0, buf.length, offset);
          fs.closeSync(fd);
          return { content: buf.toString('utf-8'), size: stat.size };
        } catch (e) { return { error: e.message }; }
      }
      case 'file_write': {
        const filePath = path.resolve(this.config.workDir, args.path || '');
        if (!this.isPathAllowed(filePath)) return { error: 'Path not allowed' };
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, args.content || '', 'utf-8');
        return { success: true, written: (args.content || '').length };
      }
      case 'file_list': {
        const dirPath = path.resolve(this.config.workDir, args.path || '.');
        if (!this.isPathAllowed(dirPath)) return { error: 'Path not allowed' };
        try {
          const entries = fs.readdirSync(dirPath, { withFileTypes: true });
          return { entries: entries.map(e => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' })) };
        } catch (e) { return { error: e.message }; }
      }
      case 'file_delete': {
        const filePath = path.resolve(this.config.workDir, args.path || '');
        if (!this.isPathAllowed(filePath)) return { error: 'Path not allowed' };
        try {
          if (fs.statSync(filePath).isDirectory()) fs.rmSync(filePath, { recursive: true });
          else fs.unlinkSync(filePath);
          return { success: true };
        } catch (e) { return { error: e.message }; }
      }
      case 'file_search': {
        const searchDir = path.resolve(this.config.workDir, args.dir || '.');
        if (!this.isPathAllowed(searchDir)) return { error: 'Path not allowed' };
        try {
          const results = this.globSearch(searchDir, args.pattern || '*', Math.min(args.maxDepth || 5, 10), Math.min(args.maxResults || 50, 200));
          return { results, count: results.length };
        } catch (e) { return { error: e.message }; }
      }
      case 'file_grep': {
        const grepDir = path.resolve(this.config.workDir, args.dir || '.');
        if (!this.isPathAllowed(grepDir)) return { error: 'Path not allowed' };
        try {
          const results = this.grepFiles(grepDir, args.text || '', args.filePattern || '*', args.caseInsensitive !== false, Math.min(args.maxResults || 30, 100));
          return { results, count: results.length };
        } catch (e) { return { error: e.message }; }
      }
      case 'memory_query': {
        const type = args.type;
        if (type && this.graphMemories[type]) {
          return { memories: this.graphMemories[type].slice(0, args.limit || 20) };
        }
        const all = [];
        for (const t of MEMORY_TYPES) {
          all.push(...this.graphMemories[t].slice(0, 5));
        }
        return { memories: all.slice(0, args.limit || 20) };
      }
      case 'memory_search': {
        const results = this.queryGraphMemories(args.query || '', { type: args.type, limit: args.limit || 10, minImportance: args.minImportance });
        return { results };
      }
      case 'skill_search': {
        const skills = this.searchSkills(args.query || '', { category: args.category, limit: args.limit });
        return { skills };
      }
      default:
        return { error: `Unknown capability: ${name}` };
    }
  }

  async executeSingleStep(step, params) {
    switch (step.type) {
      case 'shell': {
        const command = params.command || '';
        if (!command) throw new Error('shell step missing command');
        const result = await this.executeCommand(command, { cwd: params.cwd || this.config.workDir, timeout: params.timeout });
        const output = result.stdout?.substring(0, 2000) || '';
        return { output, exitCode: 0 };
      }
      case 'file_read': {
        const filePath = params.path || '';
        if (!filePath) throw new Error('file_read step missing path');
        const resolved = path.resolve(this.config.workDir, filePath);
        if (!this.isPathAllowed(resolved)) throw new Error('Path not allowed');
        if (!fs.existsSync(resolved)) throw new Error('File not found');
        const stat = fs.statSync(resolved);
        if (stat.size > 10 * 1024 * 1024) throw new Error('File too large (>10MB)');
        const offset = params.offset || 0;
        const limit = params.limit || MAX_STDOUT;
        const fd = fs.openSync(resolved, 'r');
        const buf = Buffer.alloc(Math.min(limit, stat.size - offset));
        fs.readSync(fd, buf, 0, buf.length, offset);
        fs.closeSync(fd);
        const output = buf.toString('utf-8');
        return { output, size: stat.size };
      }
      case 'file_write': {
        const filePath = params.path || '';
        const content = params.content || '';
        if (!filePath) throw new Error('file_write step missing path');
        const resolved = path.resolve(this.config.workDir, filePath);
        if (!this.isPathAllowed(resolved)) throw new Error('Path not allowed');
        const dir = path.dirname(resolved);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(resolved, content, 'utf-8');
        return { output: `Written ${content.length} bytes to ${filePath}`, written: content.length };
      }
      case 'file_search': {
        const result = this.executeCapability('file_search', params);
        return { output: JSON.stringify(result), count: result.count || 0 };
      }
      case 'file_grep': {
        const result = this.executeCapability('file_grep', params);
        return { output: JSON.stringify(result), count: result.count || 0 };
      }
      case 'http': {
        const method = (params.method || 'GET').toUpperCase();
        const url = params.url || '';
        if (!url) throw new Error('http step missing url');
        const result = await this.httpRequest(method, url, params.body ? JSON.parse(params.body) : null, false);
        const output = JSON.stringify(result).substring(0, 2000);
        return { output };
      }
      case 'tool': {
        const toolName = params.name || params.tool || '';
        if (!toolName) throw new Error('tool step missing name');
        const toolArgs = { ...params };
        delete toolArgs.name;
        delete toolArgs.tool;
        const result = this.executeCapability(toolName, toolArgs);
        const output = JSON.stringify(result).substring(0, 2000);
        return { output };
      }
      case 'condition': {
        return { output: 'condition evaluated' };
      }
      case 'set_var': {
        if (step.outputVar && params.value !== undefined) {
          return { output: String(params.value) };
        }
        return { output: '' };
      }
      case 'llm':
      default: {
        return { output: step.description, status: 'requires_llm' };
      }
    }
  }

  recordSkillOutcome(skillId, success, feedback) {
    const skill = this.skills.skills.find(s => s.skillId === skillId);
    if (!skill) return;

    if (success) {
      skill.successCount++;
    } else {
      skill.failCount++;
    }

    if (feedback) {
      if (!skill.feedbackHistory) skill.feedbackHistory = [];
      skill.feedbackHistory.push({
        success,
        feedback: feedback.substring(0, 200),
        timestamp: Date.now(),
      });
      if (skill.feedbackHistory.length > 20) {
        skill.feedbackHistory = skill.feedbackHistory.slice(-10);
      }
    }

    const totalUses = skill.successCount + skill.failCount;
    if (totalUses > 0 && totalUses % 5 === 0) {
      this.improveSkillFromFeedback(skill);
    }

    this.saveSkills();
  }

  improveSkillFromFeedback(skill) {
    if (!skill.feedbackHistory || skill.feedbackHistory.length < 3) return;

    const recentFeedback = skill.feedbackHistory.slice(-5);
    const recentSuccessRate = recentFeedback.filter(f => f.success).length / recentFeedback.length;

    if (recentSuccessRate < 0.4 && skill.version) {
      skill.version++;
      const failureFeedback = recentFeedback.filter(f => !f.success).map(f => f.feedback);
      if (failureFeedback.length > 0 && skill.steps) {
        skill.steps.push(`改进v${skill.version}: 注意避免 - ${failureFeedback[0].substring(0, 100)}`);
      }
      this.log('INFO', `技能自改进: ${skill.name} v${skill.version} (近期成功率: ${(recentSuccessRate * 100).toFixed(0)}%)`);
    }

    if (recentSuccessRate > 0.9 && skill.version) {
      const lastFeedback = recentFeedback[recentFeedback.length - 1];
      if (lastFeedback && lastFeedback.feedback) {
        if (!skill.retrievalCues.includes(lastFeedback.feedback.substring(0, 20))) {
          skill.retrievalCues.push(lastFeedback.feedback.substring(0, 20));
        }
      }
    }
  }

  matchSkillsForContext(context) {
    const contextStr = (typeof context === 'string' ? context : JSON.stringify(context)).toLowerCase();
    const matched = [];

    for (const skill of this.skills.skills) {
      let score = 0;

      if (skill.triggerConditions) {
        for (const condition of skill.triggerConditions) {
          if (contextStr.includes(condition.toLowerCase())) {
            score += 0.3;
          }
        }
      }

      if (skill.retrievalCues) {
        for (const cue of skill.retrievalCues) {
          if (contextStr.includes(cue.toLowerCase())) {
            score += 0.2;
          }
        }
      }

      if (skill.scenarios) {
        for (const scenario of skill.scenarios) {
          if (contextStr.includes(scenario.toLowerCase())) {
            score += 0.25;
          }
        }
      }

      if (skill.description && contextStr.includes(skill.description.toLowerCase().substring(0, 30))) {
        score += 0.15;
      }

      const totalUses = skill.successCount + skill.failCount;
      const successRate = totalUses > 0 ? skill.successCount / totalUses : 0;
      score += successRate * 0.1;

      if (score > 0.2) {
        matched.push({ skill, score });
      }
    }

    matched.sort((a, b) => b.score - a.score);
    return matched.slice(0, 5);
  }

  autoExtractSkillFromTask(task, result, taskType) {
    if (!task || !result || result.status !== 'success') return;

    const existingMatch = this.matchSkillsForContext(`${task.title} ${task.description || ''}`);
    if (existingMatch.length > 0 && existingMatch[0].score > 0.5) return;

    const steps = [];
    const taskDesc = (task.description || task.title || '').toLowerCase();

    if (taskType === 'shell' || taskType === 'code') {
      const command = task.metadata?.command || task.description || '';
      if (command && command.length > 5 && command.length < 500) {
        steps.push({ type: 'shell', params: { command }, description: `执行命令: ${command.substring(0, 60)}` });
      }
    } else if (taskType === 'file') {
      const filePath = task.metadata?.path || task.description || '';
      if (filePath) {
        const action = task.metadata?.action || 'read';
        if (action === 'read') {
          steps.push({ type: 'file_read', params: { path: filePath }, description: `读取文件: ${filePath}` });
        } else if (action === 'write') {
          steps.push({ type: 'file_write', params: { path: filePath, content: task.metadata?.content || '' }, description: `写入文件: ${filePath}` });
        } else {
          steps.push({ type: 'tool', params: { name: `file_${action}`, path: filePath }, description: `文件操作(${action}): ${filePath}` });
        }
      }
    } else if (taskType === 'search') {
      const query = task.metadata?.query || task.description || '';
      if (query) {
        steps.push({ type: 'tool', params: { name: 'memory_search', query }, outputVar: 'searchResult', description: `搜索记忆: ${query.substring(0, 40)}` });
      }
    } else if (result.engine === 'llm' && this.llmConfig.enabled) {
      steps.push({ type: 'llm', params: { prompt: `处理${taskType}类型任务` }, description: `LLM推理: ${taskDesc.substring(0, 50)}` });
    }

    if (steps.length === 0) return;

    const skillName = `auto_${taskType}_${task.title?.substring(0, 30).replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_') || Date.now()}`;
    const description = `Auto-extracted: ${task.title || taskType} (${taskType})`;

    const registered = this.registerSkill({
      name: skillName,
      description,
      category: taskType,
      steps,
      source: 'auto_extracted',
      triggerConditions: [taskType, task.title?.substring(0, 20)].filter(Boolean),
      retrievalCues: [taskType, taskDesc.substring(0, 30)],
      scenarios: [taskType, 'task_execution'],
    });

    if (registered) {
      this.log('INFO', `自动提取技能: ${skillName} (from task: ${task.title?.substring(0, 30)}) [结构化${steps.length}步]`);
    }
  }

  buildSkillExecutionPrompt(skillId, taskContext) {
    const skill = this.skills.skills.find(s => s.skillId === skillId);
    if (!skill) return null;

    const totalUses = skill.successCount + skill.failCount;
    const successRate = totalUses > 0 ? (skill.successCount / totalUses * 100).toFixed(0) : 'N/A';

    let prompt = `## Skill: ${skill.name} (v${skill.version || 1})\n`;
    prompt += `Description: ${skill.description}\n`;
    prompt += `Success Rate: ${successRate}% (${skill.successCount}/${totalUses})\n\n`;

    if (skill.preconditions && skill.preconditions.length > 0) {
      prompt += `Preconditions:\n`;
      skill.preconditions.forEach(p => { prompt += `- ${p}\n`; });
      prompt += '\n';
    }

    if (skill.steps && skill.steps.length > 0) {
      prompt += `Execution Steps:\n`;
      skill.steps.forEach((s, i) => { prompt += `${i + 1}. ${typeof s === 'string' ? s : JSON.stringify(s)}\n`; });
      prompt += '\n';
    }

    if (skill.feedbackHistory && skill.feedbackHistory.length > 0) {
      const recentFailures = skill.feedbackHistory.filter(f => !f.success).slice(-3);
      if (recentFailures.length > 0) {
        prompt += `Past failures to avoid:\n`;
        recentFailures.forEach(f => { prompt += `- ${f.feedback}\n`; });
        prompt += '\n';
      }
    }

    if (taskContext) {
      prompt += `Current Task Context:\n${typeof taskContext === 'string' ? taskContext : JSON.stringify(taskContext).substring(0, 500)}\n`;
    }

    return prompt;
  }

  deprecateSkill(skillId, reason) {
    const skill = this.skills.skills.find(s => s.skillId === skillId);
    if (!skill) return false;

    skill.status = 'deprecated';
    skill.deprecatedAt = Date.now();
    skill.deprecateReason = reason || 'low_success_rate';

    const totalUses = skill.successCount + skill.failCount;
    const successRate = totalUses > 0 ? skill.successCount / totalUses : 0;
    this.log('INFO', `技能已废弃: ${skill.name} (成功率: ${(successRate * 100).toFixed(0)}%, 原因: ${reason})`);
    this.saveSkills();
    return true;
  }

  reactivateSkill(skillId) {
    const skill = this.skills.skills.find(s => s.skillId === skillId);
    if (!skill) return false;

    skill.status = 'active';
    skill.deprecatedAt = null;
    skill.deprecateReason = null;
    this.log('INFO', `技能已重新激活: ${skill.name}`);
    this.saveSkills();
    return true;
  }

  async abstractSkillsFromExperience() {
    const experientialMemories = this.graphMemories.experiential || [];
    const recentExperiences = experientialMemories.slice(-30);
    let abstractedCount = 0;

    const successPatterns = {};
    for (const exp of recentExperiences) {
      if (!exp.content || !exp.content.experiential) continue;
      const data = exp.content.experiential;

      if (data.result === 'success' && data.reward && data.reward > 0.6 && data.action) {
        const patternKey = data.scenario || 'unknown';
        if (!successPatterns[patternKey]) {
          successPatterns[patternKey] = { actions: [], lessons: [], count: 0 };
        }
        successPatterns[patternKey].actions.push(...(data.action || []));
        if (data.lessons) {
          successPatterns[patternKey].lessons.push(...data.lessons);
        }
        successPatterns[patternKey].count++;
      }
    }

    for (const [scenario, pattern] of Object.entries(successPatterns)) {
      if (pattern.count < 2) continue;

      const existingSkill = this.skills.skills.find(s =>
        s.name === `auto_${scenario.replace(/\s+/g, '_')}`
      );
      if (existingSkill) continue;

      const uniqueActions = [...new Set(pattern.actions.map(a => typeof a === 'string' ? a : JSON.stringify(a)))];
      const uniqueLessons = [...new Set(pattern.lessons)];

      this.registerSkill({
        name: `auto_${scenario.replace(/\s+/g, '_')}`,
        description: `从${pattern.count}次成功经验中自动抽象的技能: ${scenario}`,
        category: 'auto_learned',
        steps: uniqueActions.slice(0, 10),
        preconditions: [`scenario_matches_${scenario}`],
        postconditions: uniqueLessons.slice(0, 5),
        source: 'self_learned',
        retrievalCues: [scenario, 'auto_learned'],
        scenarios: [scenario],
      });
      abstractedCount++;
    }

    if (abstractedCount > 0) {
      this.log('INFO', `技能抽象完成: ${abstractedCount}个新技能`);
    }
    return abstractedCount;
  }

  computeAdaptiveMemoryThreshold() {
    const totalMem = os.totalmem();
    const availableMem = os.freemem();
    const heapLimit = require('v8').getHeapStatistics().heap_size_limit;
    const systemThreshold = Math.floor(totalMem * 0.4);
    const heapThreshold = Math.floor(heapLimit * 0.7);
    const availableThreshold = Math.floor(availableMem * 3);
    return Math.min(systemThreshold, heapThreshold, availableThreshold);
  }

  loadAutonomousConfig() {
    const configDir = this.getConfigDir();
    const configPath = path.join(configDir, 'autonomous.json');
    try {
      if (fs.existsSync(configPath)) {
        const loaded = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        return {
          memoryGcThreshold: loaded.memoryGcThreshold || null,
          maxEpisodes: loaded.maxEpisodes || DEFAULT_MAX_EPISODES,
          maxMemories: loaded.maxMemories || DEFAULT_MAX_MEMORIES,
          maxGoals: loaded.maxGoals || DEFAULT_MAX_GOALS,
          maxPlans: loaded.maxPlans || DEFAULT_MAX_PLANS,
          maxReactSteps: loaded.maxReactSteps || DEFAULT_MAX_REACT_STEPS,
          maxStateHistory: loaded.maxStateHistory || DEFAULT_MAX_STATE_HISTORY,
          resourcePolicy: loaded.resourcePolicy || 'autonomous',
          maxMemoryUsage: loaded.maxMemoryUsage || null,
          maxCpuPercent: loaded.maxCpuPercent || null,
          selfDriveLevel: loaded.selfDriveLevel !== undefined ? loaded.selfDriveLevel : 3,
          commandPolicy: loaded.commandPolicy || 'autonomous',
          deniedCommands: loaded.deniedCommands || [],
          llmPolicy: loaded.llmPolicy || 'autonomous',
        };
      }
    } catch (e) {
      this.log('WARN', `自主配置加载失败: ${e.message}`);
    }
    return null;
  }

  saveAutonomousConfig() {
    const configDir = this.getConfigDir();
    const configPath = path.join(configDir, 'autonomous.json');
    try {
      const tmpPath = configPath + '.tmp';
      fs.writeFileSync(tmpPath, JSON.stringify(this.autonomousConfig, null, 2), 'utf-8');
      fs.renameSync(tmpPath, configPath);
    } catch (e) {
      this.log('WARN', `自主配置保存失败: ${e.message}`);
    }
  }

  adjustAutonomousParam(param, value, reason) {
    const oldValue = this.autonomousConfig[param];
    this.autonomousConfig[param] = value;
    this.saveAutonomousConfig();
    this.log('INFO', `自主调整: ${param} ${oldValue} -> ${value} (${reason || 'self_adjusted'})`);
    this.createGraphMemory('experiential', {
      scenario: 'autonomous_adjustment',
      context: { param, oldValue, newValue: value },
      action: [{ type: 'adjust_config' }],
      result: 'success',
      reward: 0.5,
      lessons: [`${param} adjusted from ${oldValue} to ${value}: ${reason || 'self_adjusted'}`],
    }, {
      importance: 0.7,
      retrieval_cues: ['autonomous', 'config_adjustment', param],
      scenarios: ['self_management'],
    });
  }

  loadLLMProviders() {
    const configDir = this.getConfigDir();
    const providersPath = path.join(configDir, 'llm_providers.json');
    try {
      if (fs.existsSync(providersPath)) {
        return JSON.parse(fs.readFileSync(providersPath, 'utf-8'));
      }
    } catch (e) {
      this.log('WARN', `LLM Providers加载失败: ${e.message}`);
    }

    const defaultProvider = {
      id: 'default',
      name: this.llmConfig.provider || 'openai_compatible',
      type: this.llmConfig.provider || 'openai_compatible',
      apiKey: this.llmConfig.apiKey,
      baseUrl: this.llmConfig.baseUrl,
      model: this.llmConfig.model,
      maxTokens: this.llmConfig.maxTokens,
      embeddingModel: this.llmConfig.embeddingModel,
      embeddingDimensions: this.llmConfig.embeddingDimensions,
      enabled: this.llmConfig.enabled,
      isDefault: true,
      priority: 1,
    };

    return { providers: [defaultProvider], activeProviderId: 'default' };
  }

  saveLLMProviders() {
    const configDir = this.getConfigDir();
    const providersPath = path.join(configDir, 'llm_providers.json');
    try {
      const tmpPath = providersPath + '.tmp';
      fs.writeFileSync(tmpPath, JSON.stringify(this.llmProviders, null, 2), 'utf-8');
      fs.renameSync(tmpPath, providersPath);
    } catch (e) {
      this.log('WARN', `LLM Providers保存失败: ${e.message}`);
    }
  }

  registerLLMProvider(provider) {
    if (!provider.id || !provider.baseUrl || !provider.apiKey) {
      this.log('WARN', 'LLM Provider注册失败：缺少必要参数');
      return false;
    }

    const existing = this.llmProviders.providers.find(p => p.id === provider.id);
    if (existing) {
      Object.assign(existing, provider);
    } else {
      this.llmProviders.providers.push({
        id: provider.id,
        name: provider.name || provider.id,
        type: provider.type || 'openai_compatible',
        apiKey: provider.apiKey,
        baseUrl: provider.baseUrl,
        model: provider.model || 'gpt-4o-mini',
        maxTokens: provider.maxTokens || 4096,
        embeddingModel: provider.embeddingModel || 'text-embedding-3-small',
        embeddingDimensions: provider.embeddingDimensions || 1536,
        enabled: provider.enabled !== false,
        isDefault: false,
        priority: provider.priority || 99,
      });
    }

    this.saveLLMProviders();
    this.log('INFO', `LLM Provider已注册: ${provider.id}`);
    return true;
  }

  switchLLMProvider(providerId) {
    const provider = this.llmProviders.providers.find(p => p.id === providerId);
    if (!provider) {
      this.log('WARN', `LLM Provider未找到: ${providerId}`);
      return false;
    }

    if (!provider.enabled) {
      this.log('WARN', `LLM Provider已禁用: ${providerId}`);
      return false;
    }

    this.activeProviderId = providerId;
    this.llmProviders.activeProviderId = providerId;

    this.llmConfig.apiKey = provider.apiKey;
    this.llmConfig.model = provider.model;
    this.llmConfig.baseUrl = provider.baseUrl;
    this.llmConfig.maxTokens = provider.maxTokens;
    this.llmConfig.provider = provider.type;
    this.llmConfig.embeddingModel = provider.embeddingModel;
    this.llmConfig.embeddingDimensions = provider.embeddingDimensions;
    this.llmConfig.enabled = true;

    this.saveLLMProviders();
    this.log('INFO', `已切换LLM Provider: ${providerId} (${provider.model})`);
    return true;
  }

  getActiveLLMProvider() {
    const activeId = this.activeProviderId || this.llmProviders.activeProviderId;
    return this.llmProviders.providers.find(p => p.id === activeId) || this.llmProviders.providers[0];
  }

  listLLMProviders() {
    return this.llmProviders.providers.map(p => ({
      id: p.id,
      name: p.name,
      type: p.type,
      model: p.model,
      enabled: p.enabled,
      isDefault: p.isDefault,
      isActive: p.id === (this.activeProviderId || this.llmProviders.activeProviderId),
    }));
  }

  async llmRequestWithFallback(messages, tools, preferredProviderId) {
    const enabledProviders = this.llmProviders.providers
      .filter(p => p.enabled)
      .sort((a, b) => (a.priority || 99) - (b.priority || 99));

    if (enabledProviders.length === 0) {
      this.log('WARN', '无可用LLM Provider');
      return null;
    }

    if (preferredProviderId) {
      const preferred = enabledProviders.find(p => p.id === preferredProviderId);
      if (preferred) {
        const originalProvider = this.activeProviderId;
        this.switchLLMProvider(preferred.id);
        try {
          const result = await this.llmRequest(messages, tools);
          if (result) return result;
        } catch (e) {
          this.log('WARN', `首选Provider ${preferredProviderId} 失败: ${e.message}`);
        }
        if (originalProvider) this.switchLLMProvider(originalProvider);
      }
    }

    for (const provider of enabledProviders) {
      const currentActive = this.activeProviderId;
      if (provider.id === currentActive) continue;

      this.switchLLMProvider(provider.id);
      try {
        const result = await this.llmRequest(messages, tools);
        if (result) return result;
      } catch (e) {
        this.log('WARN', `Provider ${provider.id} 失败: ${e.message}`);
        this.recordProviderFailure(provider.id, e.message);
      }
    }

    try {
      const result = await this.llmRequest(messages, tools);
      return result;
    } catch (e) {
      this.log('ERROR', `所有LLM Provider均失败: ${e.message}`);
      return null;
    }
  }

  recordProviderFailure(providerId, error) {
    if (!this.llmProviders.providerStats) this.llmProviders.providerStats = {};
    if (!this.llmProviders.providerStats[providerId]) {
      this.llmProviders.providerStats[providerId] = { failures: 0, lastFailure: null };
    }
    this.llmProviders.providerStats[providerId].failures++;
    this.llmProviders.providerStats[providerId].lastFailure = {
      time: Date.now(),
      error: error.substring(0, 200),
    };

    const stats = this.llmProviders.providerStats[providerId];
    if (stats.failures >= 5) {
      const provider = this.llmProviders.providers.find(p => p.id === providerId);
      if (provider && !provider.isDefault) {
        provider.enabled = false;
        this.log('WARN', `LLM Provider ${providerId} 已自动禁用(连续${stats.failures}次失败)`);
        this.saveLLMProviders();
      }
    }
  }

  selectProviderForTask(taskType) {
    const enabledProviders = this.llmProviders.providers
      .filter(p => p.enabled)
      .sort((a, b) => (a.priority || 99) - (b.priority || 99));

    if (enabledProviders.length <= 1) return enabledProviders[0]?.id;

    const taskProviderMap = {
      reasoning: ['openai', 'anthropic', 'deepseek'],
      coding: ['openai', 'anthropic', 'deepseek', 'qwen'],
      embedding: ['openai', 'local'],
      chat: ['openai', 'anthropic', 'qwen', 'minimax'],
      reflection: ['openai', 'anthropic', 'deepseek'],
      summary: ['openai', 'qwen', 'minimax'],
    };

    const preferredTypes = taskProviderMap[taskType] || [];
    for (const type of preferredTypes) {
      const match = enabledProviders.find(p => p.type?.includes(type));
      if (match) return match.id;
    }

    return enabledProviders[0]?.id;
  }

  async llmRequestAuto(messages, tools, taskType) {
    if (this.llmProviders.providers.filter(p => p.enabled).length <= 1) {
      return this.llmRequest(messages, tools);
    }

    const preferredId = this.selectProviderForTask(taskType);
    return this.llmRequestWithFallback(messages, tools, preferredId);
  }

  async executeLearningLoop() {
    const loop = this.evolutionState.learningLoop;
    const result = { stages: [], loopCount: loop.loopCount + 1 };

    const recentEpisodes = this.memory.episodes.slice(-30);
    if (recentEpisodes.length === 0) {
      result.stages.push({ name: 'execute', status: 'skipped', reason: '无经验数据' });
      return result;
    }

    result.stages.push({ name: 'execute', status: 'completed', episodeCount: recentEpisodes.length });

    const failures = recentEpisodes.filter(e => e.result === 'failure');
    const successes = recentEpisodes.filter(e => e.result === 'success');
    const evaluation = {
      total: recentEpisodes.length,
      successRate: recentEpisodes.length > 0 ? successes.length / recentEpisodes.length : 0,
      failurePatterns: [],
      successPatterns: [],
    };

    const failureScenarios = {};
    for (const f of failures) {
      const key = f.action || 'unknown';
      failureScenarios[key] = (failureScenarios[key] || 0) + 1;
    }
    evaluation.failurePatterns = Object.entries(failureScenarios)
      .filter(([, count]) => count >= 2)
      .map(([scenario, count]) => ({ scenario, count }));

    const successScenarios = {};
    for (const s of successes) {
      const key = s.action || 'unknown';
      successScenarios[key] = (successScenarios[key] || 0) + 1;
    }
    evaluation.successPatterns = Object.entries(successScenarios)
      .filter(([, count]) => count >= 2)
      .map(([scenario, count]) => ({ scenario, count }));

    result.stages.push({ name: 'evaluate', status: 'completed', evaluation });

    const abstractions = [];
    for (const pattern of evaluation.successPatterns) {
      const existingSkill = this.skills.skills.find(s =>
        s.retrievalCues.some(c => c.includes(pattern.scenario))
      );
      if (!existingSkill) {
        const skill = this.registerSkill({
          name: `learned_${pattern.scenario.replace(/\s+/g, '_').substring(0, 30)}`,
          description: `从${pattern.count}次成功中抽象: ${pattern.scenario}`,
          category: 'auto_learned',
          steps: [`重复执行: ${pattern.scenario}`],
          source: 'learning_loop',
          retrievalCues: [pattern.scenario, 'auto_learned'],
          scenarios: [pattern.scenario],
        });
        if (skill) abstractions.push(skill.skillId);
      }
    }
    result.stages.push({ name: 'abstract', status: 'completed', abstractions: abstractions.length });

    for (const skillId of abstractions) {
      const skill = this.skills.skills.find(s => s.skillId === skillId);
      if (skill) {
        this.createGraphMemory('procedural', {
          procedure: 'reusable_skill',
          steps: skill.steps,
          preconditions: skill.preconditions,
          postconditions: skill.postconditions,
          source: 'learning_loop',
        }, {
          importance: 0.8,
          retrieval_cues: skill.retrievalCues,
          scenarios: skill.scenarios,
        });
      }
    }
    result.stages.push({ name: 'reuse', status: 'completed', reusedCount: abstractions.length });

    for (const pattern of evaluation.failurePatterns) {
      const weightKey = `failure_pattern_${pattern.scenario.replace(/\s+/g, '_').substring(0, 30)}`;
      this.updateKnowledgeWeight(weightKey, {
        scenario: pattern.scenario,
        count: pattern.count,
        avoidance: true,
      }, -0.1 * pattern.count);
    }

    for (const pattern of evaluation.successPatterns) {
      const weightKey = `success_pattern_${pattern.scenario.replace(/\s+/g, '_').substring(0, 30)}`;
      this.updateKnowledgeWeight(weightKey, {
        scenario: pattern.scenario,
        count: pattern.count,
        reinforcement: true,
      }, 0.1 * pattern.count);
    }

    if (this.llmConfig.enabled && (evaluation.failurePatterns.length > 0 || evaluation.successPatterns.length > 0)) {
      try {
        const patternSummary = [
          ...evaluation.failurePatterns.map(p => `FAIL: ${p.scenario} (${p.count}x)`),
          ...evaluation.successPatterns.map(p => `SUCCESS: ${p.scenario} (${p.count}x)`),
        ].join('\n');

        const llmMessages = [
          { role: 'system', content: 'You are an AI learning analyst. Provide deep pattern analysis and actionable improvements.' },
          { role: 'user', content: `Learning Loop Analysis (Loop #${result.loopCount}):\n\nPatterns:\n${patternSummary}\n\nSuccess Rate: ${(evaluation.successRate * 100).toFixed(0)}%\n\n1. Identify root causes for failure patterns\n2. Suggest strategy modifications\n3. Recommend knowledge weight adjustments\n\nProvide concise analysis (max 150 words).` },
        ];
        const llmResponse = await this.llmRequest(llmMessages);
        if (llmResponse && llmResponse.choices && llmResponse.choices[0]) {
          result.llmAnalysis = llmResponse.choices[0].message.content.substring(0, 500);
          this.createGraphMemory('semantic', {
            concept: 'learning_loop_analysis',
            definition: result.llmAnalysis,
            relationships: ['self_improvement', 'pattern_recognition'],
            source: 'learning_loop_llm',
          }, {
            importance: 0.7,
            retrieval_cues: ['learning_analysis', 'pattern', 'improvement'],
            scenarios: ['self_evolution'],
          });
        }
      } catch (e) {
        this.log('DEBUG', `学习循环LLM分析失败: ${e.message}`);
      }
    }

    const feedbackEntry = {
      loopCount: result.loopCount,
      timestamp: Date.now(),
      successRate: evaluation.successRate,
      abstractions: abstractions.length,
      failurePatterns: evaluation.failurePatterns.length,
      successPatterns: evaluation.successPatterns.length,
    };
    if (!this.evolutionState.learningLoop.feedbackHistory) {
      this.evolutionState.learningLoop.feedbackHistory = [];
    }
    this.evolutionState.learningLoop.feedbackHistory.push(feedbackEntry);
    if (this.evolutionState.learningLoop.feedbackHistory.length > 20) {
      this.evolutionState.learningLoop.feedbackHistory = this.evolutionState.learningLoop.feedbackHistory.slice(-10);
    }

    if (this.evolutionState.learningLoop.feedbackHistory.length >= 3) {
      const recentFeedback = this.evolutionState.learningLoop.feedbackHistory.slice(-3);
      const avgSuccessRate = recentFeedback.reduce((sum, f) => sum + f.successRate, 0) / recentFeedback.length;
      if (avgSuccessRate > 0.8) {
        this.adjustAutonomousParam('maxEpisodes', (this.autonomousConfig.maxEpisodes || DEFAULT_MAX_EPISODES) + 100, 'high_success_rate_feedback');
      }
    }

    loop.loopCount++;
    loop.lastLoopTime = Date.now();
    loop.stage = 'completed';

    return result;
  }

  updateKnowledgeWeight(key, value, delta) {
    if (!this.memory.knowledgeWeights) this.memory.knowledgeWeights = {};
    const existing = this.memory.knowledgeWeights[key];
    if (existing) {
      existing.weight = Math.max(-1, Math.min(1, (existing.weight || 0) + delta));
      existing.value = value;
      existing.updatedAt = Date.now();
    } else {
      this.memory.knowledgeWeights[key] = {
        weight: Math.max(-1, Math.min(1, delta)),
        value,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }
  }

  async performSelfReflection() {
    const now = Date.now();
    const uptime = now - this.startTime;
    const recentEpisodes = this.memory.episodes.slice(-20);
    const recentFailures = recentEpisodes.filter(e => e.result === 'failure');
    const recentSuccesses = recentEpisodes.filter(e => e.result === 'success');

    const reflection = {
      timestamp: now,
      uptime,
      agentState: this.agentState,
      stats: { ...this.memory.stats },
      recentPerformance: {
        total: recentEpisodes.length,
        successes: recentSuccesses.length,
        failures: recentFailures.length,
        successRate: recentEpisodes.length > 0 ? (recentSuccesses.length / recentEpisodes.length * 100).toFixed(1) + '%' : 'N/A',
      },
      capabilities: this.getAllCapabilities().length,
      skillCount: this.skills.skills.length,
      memoryCount: Object.values(this.graphMemories).reduce((sum, arr) => sum + arr.length, 0),
      goals: { active: this.goals.active.length, completed: this.goals.completed.length },
      plans: { current: !!this.plans.current, pending: this.plans.pending.length },
      insights: [],
      improvements: [],
      actions: [],
    };

    if (recentFailures.length > recentSuccesses.length) {
      reflection.insights.push('近期失败率较高，需要检查任务执行策略');
      reflection.improvements.push('建议增加任务执行前的预检查');
      reflection.actions.push({ type: 'strategy_adjust', target: 'task_execution', action: 'add_precheck' });
    }

    if (this.consecutivePollErrors > 3) {
      reflection.insights.push('连续轮询错误较多，网络或服务端可能不稳定');
      reflection.improvements.push('建议检查网络连接和服务端状态');
    }

    const memUsage = process.memoryUsage();
    const gcThreshold = this.autonomousConfig.memoryGcThreshold || this.computeAdaptiveMemoryThreshold();
    if (memUsage.heapUsed > gcThreshold) {
      reflection.insights.push(`内存使用较高: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
      reflection.improvements.push('建议执行记忆衰减清理');
      reflection.actions.push({ type: 'memory_gc', target: 'graph_memories', action: 'decay' });
    }

    if (this.llmConfig.enabled && this.memory.stats.llmCalls > 0) {
      reflection.insights.push(`已调用LLM ${this.memory.stats.llmCalls} 次`);
    }

    if (this.goals.active.length > 0) {
      const stuckGoals = this.goals.active.filter(g => g.progress < 10 && (now - g.createdAt > 3600000));
      if (stuckGoals.length > 0) {
        reflection.insights.push(`${stuckGoals.length}个目标长时间无进展`);
        reflection.improvements.push('建议重新评估停滞目标或生成新计划');
        reflection.actions.push({ type: 'goal_reassess', target: stuckGoals.map(g => g.goalId), action: 'replan' });
      }
    }

    const actionPrompt = this.buildReflectionActionPrompt(reflection);
    if (this.llmConfig.enabled && actionPrompt) {
      const actionResult = await this.executeReflectionAction(actionPrompt, reflection);
      if (actionResult) {
        reflection.llmGuidedAction = actionResult;
      }
    }

    this.selfReflectionLog.push(reflection);
    if (this.selfReflectionLog.length > 100) {
      this.selfReflectionLog = this.selfReflectionLog.slice(-50);
    }

    this.memory.stats.selfReflections++;

    this.createGraphMemory('experiential', {
      scenario: 'self_reflection',
      context: { agentState: this.agentState, uptime, goalCount: this.goals.active.length },
      action: [{ type: 'self_reflect' }],
      result: 'success',
      reward: 0.5,
      lessons: reflection.insights,
    }, { importance: 0.6, retrieval_cues: ['reflection', 'self_improvement'], scenarios: ['self_reflection'] });

    for (const action of reflection.actions) {
      await this.executeReflectionDerivedAction(action);
    }

    this.log('INFO', `自我反思完成: ${reflection.insights.length} 条洞察, ${reflection.improvements.length} 条改进, ${reflection.actions.length} 条行动`);
    return reflection;
  }

  buildReflectionActionPrompt(reflection) {
    if (reflection.actions.length === 0 && reflection.insights.length === 0) return null;

    const relevantMemories = this.searchMemories('self_improvement strategy', { limit: 5, minImportance: 0.5 });
    const relevantSkills = this.searchSkills('strategy improvement', { limit: 3 });
    const knowledgeWeights = this.cortexState.knowledgeWeights;

    let prompt = `## Agent Self-Reflection Action Guidance\n\n`;
    prompt += `### Current State\n`;
    prompt += `- Agent State: ${reflection.agentState}\n`;
    prompt += `- Success Rate: ${reflection.recentPerformance.successRate}\n`;
    prompt += `- Active Goals: ${reflection.goals.active}\n`;
    prompt += `- Memory Count: ${reflection.memoryCount}\n`;
    prompt += `- Skill Count: ${reflection.skillCount}\n\n`;

    if (relevantMemories.length > 0) {
      prompt += `### Relevant Memories\n`;
      relevantMemories.forEach(m => {
        prompt += `- ${JSON.stringify(m.content).substring(0, 200)}\n`;
      });
      prompt += '\n';
    }

    if (relevantSkills.length > 0) {
      prompt += `### Relevant Skills\n`;
      relevantSkills.forEach(s => {
        prompt += `- ${s.name}: ${s.description} (success: ${s.successCount}, fail: ${s.failCount})\n`;
      });
      prompt += '\n';
    }

    if (Object.keys(knowledgeWeights).length > 0) {
      prompt += `### Knowledge Weights\n`;
      Object.entries(knowledgeWeights).slice(0, 10).forEach(([key, weight]) => {
        prompt += `- ${key}: ${weight}\n`;
      });
      prompt += '\n';
    }

    prompt += `### Insights\n`;
    reflection.insights.forEach(i => { prompt += `- ${i}\n`; });
    prompt += `\n### Pending Actions\n`;
    reflection.actions.forEach(a => { prompt += `- ${a.type}: ${a.action} on ${a.target}\n`; });
    prompt += `\nBased on the above memories, knowledge, and weights, provide specific execution guidance for each pending action. Be concise and actionable.`;

    return prompt;
  }

  async executeReflectionAction(prompt, reflection) {
    try {
      const messages = [
        { role: 'system', content: 'You are an autonomous AI agent guiding your own self-improvement. Provide specific, actionable execution steps based on your memories and knowledge.' },
        { role: 'user', content: prompt },
      ];
      const response = await this.llmRequest(messages);
      if (!response || !response.choices || !response.choices[0]) return null;

      const guidance = response.choices[0].message.content || '';
      this.log('INFO', `反思行动指引: ${guidance.substring(0, 200)}`);
      return guidance.substring(0, 1000);
    } catch (e) {
      this.log('DEBUG', `反思行动指引获取失败: ${e.message}`);
      return null;
    }
  }

  async executeReflectionDerivedAction(action) {
    switch (action.type) {
      case 'strategy_adjust':
        this.evolutionState.optimizedParams.pre_check_enabled = true;
        this.log('INFO', '反思驱动: 已启用任务预检查策略');
        break;
      case 'memory_gc':
        this.decayMemories();
        this.log('INFO', '反思驱动: 已执行记忆衰减');
        break;
      case 'goal_reassess':
        if (Array.isArray(action.target)) {
          for (const goalId of action.target) {
            const goal = this.goals.active.find(g => g.goalId === goalId);
            if (goal && this.llmConfig.enabled) {
              const planSteps = await this.planWithLLM(goal);
              if (planSteps) {
                this.createPlan(goalId, planSteps);
                this.log('INFO', `反思驱动: 已为目标${goalId}重新生成计划`);
              }
            }
          }
        }
        break;
      default:
        this.log('DEBUG', `反思驱动: 未知行动类型 ${action.type}`);
    }
  }

  async executeCortexBulletin() {
    const now = Date.now();
    if (now - this.cortexState.lastBulletinTime < CORTEX_INTERVAL) {
      return { status: 'skipped', reason: '公报间隔未到' };
    }

    this.cortexState.lastBulletinTime = now;

    const allMemories = Object.entries(this.graphMemories).flatMap(([type, memories]) =>
      memories.map(m => ({ ...m, memoryType: type }))
    );

    const recentMemories = allMemories
      .filter(m => now - (m.metadata?.created_at || 0) < CORTEX_INTERVAL * 2)
      .sort((a, b) => (b.metadata?.importance || 0) - (a.metadata?.importance || 0))
      .slice(0, 50);

    if (recentMemories.length === 0) {
      return { status: 'skipped', reason: '无近期记忆' };
    }

    const memorySummary = recentMemories.map(m => {
      const content = m.content || {};
      const type = content.type || m.memoryType;
      return `[${type}] ${JSON.stringify(content[type] || content).substring(0, 200)}`;
    }).join('\n');

    const skillSummary = this.skills.skills
      .slice(-10)
      .map(s => `- ${s.name}: ${s.description} (成功${s.successCount}/失败${s.failCount})`)
      .join('\n');

    const goalSummary = this.goals.active
      .slice(0, 5)
      .map(g => `- "${g.description}" (${g.progress}%)`)
      .join('\n');

    let bulletin = {
      timestamp: now,
      summary: '',
      keyInsights: [],
      knowledgeUpdates: {},
      recommendedActions: [],
    };

    if (this.llmConfig.enabled) {
      try {
        const messages = [
          {
            role: 'system',
            content: `You are the Cortex of an autonomous AI agent. Synthesize the following memories and knowledge into a concise cognitive bulletin. Focus on: 1) Key patterns and insights 2) Knowledge weight updates 3) Recommended actions. Max ${CORTEX_MAX_SUMMARY_TOKENS} tokens.`,
          },
          {
            role: 'user',
            content: `## Recent Memories\n${memorySummary}\n\n## Skills\n${skillSummary}\n\n## Active Goals\n${goalSummary}\n\n## Current Stats\n- Tasks: ${this.memory.stats.tasksCompleted} completed, ${this.memory.stats.tasksFailed} failed\n- LLM calls: ${this.memory.stats.llmCalls}\n- Reflections: ${this.memory.stats.selfReflections}\n\nSynthesize a cognitive bulletin.`,
          },
        ];

        const response = await this.llmRequest(messages);
        if (response && response.choices && response.choices[0]) {
          bulletin.summary = response.choices[0].message.content || '';
        }
      } catch (e) {
        this.log('DEBUG', `Cortex LLM综合失败: ${e.message}`);
      }
    }

    if (!bulletin.summary) {
      const failureRate = recentMemories.length > 0
        ? recentMemories.filter(m => m.content?.experiential?.result === 'failure').length / recentMemories.length
        : 0;
      bulletin.summary = `自动综合: ${recentMemories.length}条记忆, 失败率${(failureRate * 100).toFixed(1)}%, ${this.skills.skills.length}个技能, ${this.goals.active.length}个活跃目标`;
    }

    for (const memory of recentMemories) {
      const cues = memory.state?.retrieval_cues || [];
      for (const cue of cues) {
        const currentWeight = this.cortexState.knowledgeWeights[cue] || 0.5;
        const importance = memory.metadata?.importance || 0.5;
        this.cortexState.knowledgeWeights[cue] = currentWeight * 0.8 + importance * 0.2;
      }
    }

    const topWeightEntries = Object.entries(this.cortexState.knowledgeWeights)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20);
    this.cortexState.knowledgeWeights = Object.fromEntries(topWeightEntries);

    this.cortexState.currentBulletin = bulletin;
    this.cortexState.bulletins.push(bulletin);
    if (this.cortexState.bulletins.length > 30) {
      this.cortexState.bulletins = this.cortexState.bulletins.slice(-15);
    }

    this.detectKnowledgeConflicts(recentMemories);
    this.decayKnowledgeWeights();
    this.analyzeBulletinTrends();

    if (bulletin.recommendedActions && bulletin.recommendedActions.length > 0) {
      this.executeCortexActions(bulletin.recommendedActions);
    }

    this.createGraphMemory('semantic', {
      concept: 'cortex_bulletin',
      content: bulletin.summary.substring(0, 500),
      attributes: {
        memoryCount: recentMemories.length,
        skillCount: this.skills.skills.length,
        goalCount: this.goals.active.length,
      },
    }, {
      importance: 0.9,
      retrieval_cues: ['cortex', 'bulletin', 'knowledge_synthesis'],
      scenarios: ['cortex', 'self_awareness'],
    });

    this.log('INFO', `Cortex知识公报已生成: ${bulletin.summary.substring(0, 100)}`);
    return bulletin;
  }

  detectKnowledgeConflicts(recentMemories) {
    const conflicts = [];
    const semanticMemories = this.graphMemories.semantic || [];
    const conceptMap = {};

    for (const m of semanticMemories) {
      if (!m.content || !m.content.semantic) continue;
      const concept = m.content.semantic.concept;
      if (!concept) continue;
      if (!conceptMap[concept]) conceptMap[concept] = [];
      conceptMap[concept].push(m);
    }

    for (const [concept, memories] of Object.entries(conceptMap)) {
      if (memories.length < 2) continue;
      const latest = memories[memories.length - 1];
      const previous = memories[memories.length - 2];
      if (latest.metadata.importance > 0.6 && previous.metadata.importance > 0.6) {
        const latestDef = JSON.stringify(latest.content.semantic.definition || '').substring(0, 100);
        const prevDef = JSON.stringify(previous.content.semantic.definition || '').substring(0, 100);
        if (latestDef !== prevDef) {
          conflicts.push({
            concept,
            previous: prevDef,
            latest: latestDef,
            resolution: latest.metadata.importance >= previous.metadata.importance ? 'latest_wins' : 'keep_both',
          });
        }
      }
    }

    if (conflicts.length > 0) {
      this.log('INFO', `Cortex检测到${conflicts.length}个知识冲突`);
      for (const conflict of conflicts) {
        if (conflict.resolution === 'latest_wins') {
          this.updateKnowledgeWeight(`conflict_${conflict.concept}`, {
            resolved: true,
            winner: 'latest',
          }, 0.1);
        }
      }
    }

    return conflicts;
  }

  decayKnowledgeWeights() {
    const now = Date.now();
    const decayFactor = 0.95;

    for (const [key, weight] of Object.entries(this.cortexState.knowledgeWeights)) {
      this.cortexState.knowledgeWeights[key] = weight * decayFactor;
      if (this.cortexState.knowledgeWeights[key] < 0.05) {
        delete this.cortexState.knowledgeWeights[key];
      }
    }

    const topEntries = Object.entries(this.cortexState.knowledgeWeights)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 30);
    this.cortexState.knowledgeWeights = Object.fromEntries(topEntries);
  }

  analyzeBulletinTrends() {
    const bulletins = this.cortexState.bulletins;
    if (bulletins.length < 3) return null;

    const recent = bulletins.slice(-3);
    const trend = {
      direction: 'stable',
      metrics: {},
    };

    const successRates = recent.map(b => {
      const match = b.summary?.match(/失败率(\d+\.?\d*)%/);
      return match ? parseFloat(match[1]) : null;
    }).filter(r => r !== null);

    if (successRates.length >= 2) {
      const latest = successRates[successRates.length - 1];
      const previous = successRates[0];
      if (latest > previous + 5) {
        trend.direction = 'degrading';
        trend.metrics.failureRate = { latest, previous, delta: latest - previous };
        this.log('WARN', `Cortex趋势: 性能下降, 失败率 ${previous}% -> ${latest}%`);
      } else if (latest < previous - 5) {
        trend.direction = 'improving';
        trend.metrics.failureRate = { latest, previous, delta: previous - latest };
        this.log('INFO', `Cortex趋势: 性能改善, 失败率 ${previous}% -> ${latest}%`);
      }
    }

    this.cortexState.lastTrend = trend;
    return trend;
  }

  executeCortexActions(actions) {
    for (const action of actions.slice(0, 3)) {
      try {
        switch (action.type || action) {
          case 'increase_reflection':
            this.log('INFO', 'Cortex行动: 增加反思频率');
            break;
          case 'review_goals':
            this.log('INFO', 'Cortex行动: 审查目标优先级');
            for (const goal of this.goals.active) {
              if (goal.progress < 10 && Date.now() - goal.createdAt > 86400000) {
                this.log('INFO', `Cortex: 目标"${goal.description}"进度停滞，建议调整`);
              }
            }
            break;
          case 'optimize_memory':
            this.log('INFO', 'Cortex行动: 优化记忆存储');
            this.decayMemories();
            break;
          case 'skill_review':
            this.log('INFO', 'Cortex行动: 审查技能有效性');
            for (const skill of this.skills.skills) {
              const total = skill.successCount + skill.failCount;
              if (total >= 5 && skill.successCount / total < 0.3) {
                this.deprecateSkill(skill.skillId, 'low_success_rate_cortex');
              }
            }
            break;
          default:
            this.log('DEBUG', `Cortex行动: 未知行动类型 ${action.type || action}`);
        }
      } catch (e) {
        this.log('WARN', `Cortex行动执行失败: ${e.message}`);
      }
    }
  }

  async executeMemoryCoreCycle() {
    const now = Date.now();
    this.memoryCore.cycleCount++;
    this.memoryCore.lastCycleTime = now;

    const saveResult = this.executeMemorySave();
    const readResult = await this.executeMemoryRead();
    const callResult = await this.executeMemoryCall();
    const lifecycleResult = this.executeMemoryLifecycle(now);

    if (this.llmConfig.enabled && this.memory.episodes.length > 20) {
      await this.compressContextAndExtract();
    }

    this.log('DEBUG', `记忆核心循环 #${this.memoryCore.cycleCount}: save=${saveResult.saved}, read=${readResult.queries}, call=${callResult.invocations}, lifecycle=${lifecycleResult.processed}`);
    return {
      save: saveResult,
      read: readResult,
      call: callResult,
      lifecycle: lifecycleResult,
      cycle: this.memoryCore.cycleCount,
    };
  }

  executeMemorySave() {
    let saved = 0;
    const timestamp = Date.now();

    try {
      this.memory.stats.uptime = timestamp - this.startTime;
      this.saveMemory();
      saved++;
    } catch (e) {
      this.log('ERROR', `基础记忆保存失败: ${e.message}`);
    }

    try {
      this.saveGraphMemories();
      saved++;
    } catch (e) {
      this.log('ERROR', `图谱记忆保存失败: ${e.message}`);
    }

    try {
      this.saveSkills();
      saved++;
    } catch (e) {
      this.log('ERROR', `技能保存失败: ${e.message}`);
    }

    try {
      this.saveGoals();
      saved++;
    } catch (e) {
      this.log('ERROR', `目标保存失败: ${e.message}`);
    }

    try {
      this.saveAutonomousConfig();
      saved++;
    } catch (e) {
      this.log('ERROR', `自主配置保存失败: ${e.message}`);
    }

    return { saved, timestamp };
  }

  async executeMemoryRead() {
    const readQueries = this.memoryCore.pendingExtractions.splice(0);
    const readResults = [];

    for (const query of readQueries) {
      const results = this.searchMemories(query.text, query.options);
      readResults.push({ query: query.text, results: results.slice(0, 5) });
    }

    const activeGoalMemories = this.goals.active.length > 0
      ? this.searchMemories(this.goals.active.map(g => g.description).join(' '), { limit: 3, minImportance: 0.5 })
      : [];

    const recentExperiential = this.graphMemories.experiential
      ? this.graphMemories.experiential.slice(-5)
      : [];

    const relevantSkills = this.skills.skills.length > 0
      ? this.searchSkills('', { limit: 3 })
      : [];

    return {
      queries: readResults.length,
      goalMemories: activeGoalMemories.length,
      recentExperiential: recentExperiential.length,
      relevantSkills: relevantSkills.length,
    };
  }

  async executeMemoryCall() {
    let invocations = 0;

    const associateResult = this.autoAssociateMemories();
    invocations += associateResult ? 1 : 0;

    const recentMemories = Object.values(this.graphMemories)
      .flatMap(arr => Array.isArray(arr) ? arr : [])
      .filter(m => m.metadata && m.metadata.importance >= 0.7)
      .slice(0, 10);

    for (const memory of recentMemories) {
      if (memory.metadata.access_count < 2) {
        memory.metadata.access_count++;
        memory.metadata.last_accessed = Date.now();
        invocations++;
      }
    }

    const highImportanceUnconsolidated = this.graphMemories.episodic
      ? this.graphMemories.episodic.filter(m =>
          m.state && m.state.consolidation_level < 1 &&
          m.metadata && m.metadata.importance >= 0.7 &&
          m.metadata.access_count >= 3
        )
      : [];

    for (const memory of highImportanceUnconsolidated) {
      memory.state.consolidation_level = 1;
      memory.state.status = 'consolidated';
      memory.metadata.decay_rate = Math.max(0.01, memory.metadata.decay_rate * 0.5);
      invocations++;
    }

    this.saveGraphMemories();
    return { invocations };
  }

  executeMemoryLifecycle(now) {
    let processed = 0;

    for (const type of MEMORY_TYPES) {
      const memories = this.graphMemories[type];
      if (!memories) continue;

      for (const m of memories) {
        const age = (now - m.metadata.created_at) / 86400000;
        const effectiveImportance = m.metadata.importance * Math.exp(-m.metadata.decay_rate * age);

        if (effectiveImportance < 0.01 && m.metadata.access_count < 2) {
          m.state.status = 'archived';
          processed++;
        } else if (effectiveImportance < 0.05 && m.metadata.access_count < 3) {
          m.state.status = 'decaying';
          processed++;
        } else if (m.state.status === 'decaying' && effectiveImportance >= 0.1) {
          m.state.status = 'active';
          processed++;
        }

        if (m.state.status === 'active' && m.metadata.access_count >= 5 && m.metadata.importance >= 0.7) {
          if (m.state.consolidation_level < 2) {
            m.state.consolidation_level++;
            m.metadata.decay_rate = Math.max(0.005, m.metadata.decay_rate * 0.5);
            processed++;
          }
        }
      }

      this.graphMemories[type] = memories.filter(m => m.state.status !== 'archived' || m.metadata.importance >= 0.01);
    }

    this.saveGraphMemories();
    return { processed };
  }

  requestMemoryExtraction(queryText, options) {
    this.memoryCore.pendingExtractions.push({
      text: queryText,
      options: options || {},
      requestedAt: Date.now(),
    });
  }

  async compressContextAndExtract() {
    const episodes = this.memory.episodes;
    if (episodes.length < 20) return;

    const compressedEpisodes = episodes.slice(0, -CONTEXT_TAIL_KEEP);
    if (compressedEpisodes.length < 10) return;

    const importantEpisodes = compressedEpisodes.filter(e =>
      e.result === 'failure' || (e.learned && e.learned.length > 20)
    );
    const normalEpisodes = compressedEpisodes.filter(e =>
      e.result !== 'failure' && (!e.learned || e.learned.length <= 20)
    );
    const episodesToCompress = normalEpisodes.slice(0, -CONTEXT_HEAD_KEEP);
    if (episodesToCompress.length < 5) return;

    let summary = '';
    if (this.llmConfig.enabled) {
      try {
        const episodeText = episodesToCompress
          .slice(-20)
          .map(e => `- ${e.action} -> ${e.result}${e.learned ? ` (${e.learned})` : ''}`)
          .join('\n');

        const messages = [
          { role: 'system', content: 'Compress the following episode history into key learnings. Extract reusable knowledge. Be concise.' },
          { role: 'user', content: `Episodes:\n${episodeText}\n\nProvide: 1) Key patterns 2) Extracted knowledge 3) Lessons learned` },
        ];

        const response = await this.llmRequest(messages);
        if (response && response.choices && response.choices[0]) {
          summary = response.choices[0].message.content || '';
        }
      } catch (e) {
        this.log('DEBUG', `上下文压缩LLM失败: ${e.message}`);
      }
    }

    if (!summary) {
      const failureCount = episodesToCompress.filter(e => e.result === 'failure').length;
      const successCount = episodesToCompress.filter(e => e.result === 'success').length;
      summary = `压缩${episodesToCompress.length}条经验: ${successCount}成功, ${failureCount}失败`;
    }

    this.createGraphMemory('semantic', {
      concept: 'compressed_context',
      content: summary.substring(0, 500),
      attributes: { episodeRange: episodesToCompress.length, compressionTime: Date.now() },
    }, {
      importance: 0.7,
      retrieval_cues: ['compressed', 'context_summary'],
      scenarios: ['context_compression'],
    });

    const lessons = summary.split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('*'));
    for (const lesson of lessons.slice(0, 5)) {
      const lessonText = lesson.replace(/^[-*]\s*/, '');
      this.createGraphMemory('procedural', {
        procedure: 'extracted_knowledge',
        steps: [lessonText],
        preconditions: ['relevant_context'],
        postconditions: ['knowledge_applied'],
      }, {
        importance: 0.6,
        retrieval_cues: ['extracted', 'knowledge'],
        scenarios: ['context_compression', 'learning'],
      });
      this.updateKnowledgeWeight(`lesson_${lessonText.substring(0, 30).replace(/\s+/g, '_')}`, {
        lesson: lessonText,
        source: 'context_compression',
      }, 0.05);
    }

    this.memory.episodes = [
      ...importantEpisodes.slice(-10),
      ...episodes.slice(-CONTEXT_TAIL_KEEP),
    ];

    this.memoryCore.compressionHistory.push({
      timestamp: Date.now(),
      originalCount: episodes.length,
      compressedCount: this.memory.episodes.length,
      extractedMemories: summary ? 1 + Math.min(lessons?.length || 0, 5) : 0,
      importantPreserved: importantEpisodes.slice(-10).length,
    });
    if (this.memoryCore.compressionHistory.length > 50) {
      this.memoryCore.compressionHistory = this.memoryCore.compressionHistory.slice(-25);
    }

    this.log('INFO', `上下文压缩完成: ${episodes.length} -> ${this.memory.episodes.length} episodes, 提取${summary ? 1 : 0}条综合记忆, 保留${importantEpisodes.slice(-10).length}条重要经验`);
  }

  compressConversationContext(conversationHistory, maxTokens) {
    const approxTokens = (str) => Math.ceil(str.length / 4);
    const target = maxTokens || 8000;

    let totalTokens = 0;
    for (const msg of conversationHistory) {
      totalTokens += approxTokens(msg.content || '');
    }

    if (totalTokens <= target) return conversationHistory;

    const keptMessages = [];
    let keptTokens = 0;

    if (conversationHistory.length > 0 && conversationHistory[0].role === 'system') {
      keptMessages.push(conversationHistory[0]);
      keptTokens += approxTokens(conversationHistory[0].content || '');
    }

    const tailMessages = [];
    for (let i = conversationHistory.length - 1; i >= 1; i--) {
      const msg = conversationHistory[i];
      const msgTokens = approxTokens(msg.content || '');
      if (keptTokens + msgTokens + tailMessages.reduce((s, m) => s + approxTokens(m.content || ''), 0) > target) break;
      tailMessages.unshift(msg);
    }

    const headMessages = [];
    for (let i = 1; i < conversationHistory.length - tailMessages.length; i++) {
      const msg = conversationHistory[i];
      const msgTokens = approxTokens(msg.content || '');
      if (keptTokens + msgTokens > target * 0.3) break;
      headMessages.push(msg);
      keptTokens += msgTokens;
    }

    const compressedMiddle = this.generateMiddleSummary(
      conversationHistory.slice(1 + headMessages.length, conversationHistory.length - tailMessages.length)
    );

    const result = [...keptMessages, ...headMessages];
    if (compressedMiddle) {
      result.push({ role: 'system', content: `[Earlier context summary]: ${compressedMiddle}` });
    }
    result.push(...tailMessages);

    return result;
  }

  generateMiddleSummary(messages) {
    if (messages.length === 0) return '';
    const keyPoints = [];
    for (const msg of messages) {
      if (msg.role === 'assistant' && msg.content) {
        const firstSentence = msg.content.split(/[.!。！]/)[0];
        if (firstSentence && firstSentence.length > 10 && firstSentence.length < 200) {
          keyPoints.push(firstSentence);
        }
      }
    }
    return keyPoints.slice(0, 3).join('; ');
  }

  async performCodeSelfModification(modification) {
    if (!this.codeSelfModState.enabled) {
      return { error: '代码自我修改已禁用' };
    }

    const codePath = modification.targetFile || __filename;
    if (!fs.existsSync(codePath)) {
      return { error: `目标文件不存在: ${codePath}` };
    }

    const currentHash = this.computeFileHash(codePath);
    if (this.codeSelfModState.currentCodeHash && this.codeSelfModState.currentCodeHash !== currentHash) {
      this.log('WARN', '代码已被外部修改，重新计算哈希');
    }
    this.codeSelfModState.currentCodeHash = currentHash;

    const backupPath = codePath + `.backup.${Date.now()}`;
    try {
      fs.copyFileSync(codePath, backupPath);
    } catch (e) {
      return { error: `备份失败: ${e.message}` };
    }

    const modRecord = {
      timestamp: Date.now(),
      targetFile: codePath,
      modificationType: modification.type,
      description: modification.description,
      backupPath,
      status: 'pending',
    };

    try {
      let currentCode = fs.readFileSync(codePath, 'utf-8');

      switch (modification.type) {
        case 'replace_function': {
          const { functionName, newCode } = modification;
          const functionRegex = new RegExp(
            `(async\\s+)?${functionName}\\s*\\([^)]*\\)\\s*\\{`,
            'g'
          );
          const match = functionRegex.exec(currentCode);
          if (!match) {
            throw new Error(`函数 ${functionName} 未找到`);
          }

          const startIndex = match.index;
          let braceCount = 0;
          let endIndex = startIndex;
          let foundOpen = false;

          for (let i = startIndex; i < currentCode.length; i++) {
            if (currentCode[i] === '{') {
              braceCount++;
              foundOpen = true;
            } else if (currentCode[i] === '}') {
              braceCount--;
              if (foundOpen && braceCount === 0) {
                endIndex = i + 1;
                break;
              }
            }
          }

          const oldFunction = currentCode.substring(startIndex, endIndex);
          currentCode = currentCode.substring(0, startIndex) + newCode + currentCode.substring(endIndex);
          modRecord.oldCode = oldFunction.substring(0, 500);
          modRecord.newCode = newCode.substring(0, 500);
          break;
        }
        case 'add_method': {
          const classEndIndex = currentCode.lastIndexOf('}');
          if (classEndIndex === -1) {
            throw new Error('无法找到类结束位置');
          }
          currentCode = currentCode.substring(0, classEndIndex) + '\n' + modification.code + '\n' + currentCode.substring(classEndIndex);
          modRecord.newCode = modification.code.substring(0, 500);
          break;
        }
        case 'modify_constant': {
          const { constantName, newValue } = modification;
          const constRegex = new RegExp(`(const\\s+${constantName}\\s*=\\s*)[^;]+;`);
          currentCode = currentCode.replace(constRegex, `$1${newValue};`);
          modRecord.constantName = constantName;
          modRecord.newValue = newValue;
          break;
        }
        case 'append_code': {
          currentCode += '\n' + modification.code + '\n';
          modRecord.newCode = modification.code.substring(0, 500);
          break;
        }
        default:
          throw new Error(`未知修改类型: ${modification.type}`);
      }

      try {
        new Function(currentCode);
      } catch (syntaxError) {
        throw new Error(`修改后语法检查失败: ${syntaxError.message}`);
      }

      const tmpPath = codePath + '.tmp';
      fs.writeFileSync(tmpPath, currentCode, 'utf-8');
      fs.renameSync(tmpPath, codePath);

      this.codeSelfModState.currentCodeHash = this.computeFileHash(codePath);
      modRecord.status = 'completed';
      this.codeSelfModState.lastModification = modRecord;
      this.codeSelfModState.modificationHistory.push(modRecord);
      if (this.codeSelfModState.modificationHistory.length > 50) {
        this.codeSelfModState.modificationHistory = this.codeSelfModState.modificationHistory.slice(-25);
      }

      this.createGraphMemory('experiential', {
        scenario: 'code_self_modification',
        context: { type: modification.type, target: codePath },
        action: [{ type: modification.type }],
        result: 'success',
        reward: 0.8,
        lessons: [`成功修改${modification.type}: ${modification.description}`],
      }, {
        importance: 0.9,
        retrieval_cues: ['code_modification', modification.type],
        scenarios: ['self_modification', 'self_protection'],
      });

      this.log('INFO', `代码自我修改完成: ${modification.type} - ${modification.description}`);
      return { success: true, modification: modRecord };

    } catch (e) {
      modRecord.status = 'failed';
      modRecord.error = e.message;
      this.codeSelfModState.modificationHistory.push(modRecord);

      try {
        fs.copyFileSync(backupPath, codePath);
        this.log('INFO', `代码修改失败，已从备份恢复: ${e.message}`);
      } catch (restoreError) {
        this.log('ERROR', `代码恢复失败: ${restoreError.message}`);
      }

      return { error: e.message, backupPath };
    }
  }

  async analyzeCodeForImprovement() {
    const codePath = __filename;
    if (!fs.existsSync(codePath)) return { error: '源文件不存在' };

    try {
      const code = fs.readFileSync(codePath, 'utf-8');
      const lines = code.split('\n');
      const analysis = {
        totalLines: lines.length,
        methods: [],
        potentialImprovements: [],
        codeHealth: {},
      };

      const methodRegex = /^\s+(async\s+)?(\w+)\s*\(/;
      const currentMethods = [];
      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(methodRegex);
        if (match && match[2] && !['if', 'for', 'while', 'switch', 'catch'].includes(match[2])) {
          currentMethods.push({ name: match[2], line: i + 1 });
        }
      }
      analysis.methods = currentMethods.slice(0, 50);

      const recentModHistory = this.codeSelfModState.modificationHistory.slice(-10);
      const failedMods = recentModHistory.filter(m => m.status === 'failed');
      if (failedMods.length > 3) {
        analysis.potentialImprovements.push({
          type: 'stability',
          description: `近期${failedMods.length}次修改失败，建议检查代码修改策略`,
          priority: 'high',
        });
      }

      const memUsage = process.memoryUsage();
      if (memUsage.heapUsed > this.computeAdaptiveMemoryThreshold() * 0.8) {
        analysis.potentialImprovements.push({
          type: 'performance',
          description: `内存使用接近阈值(${Math.round(memUsage.heapUsed / 1024 / 1024)}MB)，建议优化内存管理`,
          priority: 'medium',
        });
      }

      if (this.memory.episodes.length > (this.autonomousConfig.maxEpisodes || DEFAULT_MAX_EPISODES) * 0.8) {
        analysis.potentialImprovements.push({
          type: 'capacity',
          description: '经验数据接近上限，建议增强压缩策略',
          priority: 'medium',
        });
      }

      analysis.codeHealth = {
        modificationCount: this.codeSelfModState.modificationHistory.length,
        failureRate: recentModHistory.length > 0
          ? (failedMods.length / recentModHistory.length).toFixed(2)
          : '0.00',
        lastModification: this.codeSelfModState.lastModification
          ? this.codeSelfModState.lastModification.description
          : 'none',
      };

      if (this.llmConfig.enabled && analysis.potentialImprovements.length > 0) {
        try {
          const improvementSummary = analysis.potentialImprovements
            .map(p => `- [${p.priority}] ${p.type}: ${p.description}`)
            .join('\n');
          const llmMessages = [
            { role: 'system', content: 'You are a code optimization expert. Suggest specific, safe code improvements.' },
            { role: 'user', content: `Agent Code Analysis:\nTotal lines: ${analysis.totalLines}\nMethods: ${analysis.methods.length}\nRecent modifications: ${analysis.codeHealth.modificationCount}\nFailure rate: ${analysis.codeHealth.failureRate}\n\nPotential improvements:\n${improvementSummary}\n\nFor each improvement, suggest a specific code modification approach (max 200 words).` },
          ];
          const llmResponse = await this.llmRequest(llmMessages);
          if (llmResponse && llmResponse.choices && llmResponse.choices[0]) {
            analysis.llmSuggestions = llmResponse.choices[0].message.content.substring(0, 800);
          }
        } catch (e) {
          this.log('DEBUG', `代码分析LLM建议获取失败: ${e.message}`);
        }
      }

      return analysis;
    } catch (e) {
      return { error: e.message };
    }
  }

  async verifyCodeModification(codePath) {
    if (!this.codeSelfModState.verificationEnabled) return { verified: true, skipped: true };

    try {
      const syntaxCheck = execSync(`node -c "${codePath}"`, { timeout: 10000, encoding: 'utf-8' });
      if (syntaxCheck === undefined || syntaxCheck === null) {
        return { verified: true, method: 'syntax_check' };
      }
      return { verified: true, method: 'syntax_check' };
    } catch (e) {
      return { verified: false, error: e.message, method: 'syntax_check' };
    }
  }

  rollbackCodeModification(steps) {
    const rollbackCount = Math.min(steps || 1, this.codeSelfModState.rollbackStack.length);
    if (rollbackCount === 0) {
      this.log('WARN', '回滚栈为空，无法回滚');
      return { error: 'No rollback entries available' };
    }

    const codePath = __filename;
    let currentCode = fs.readFileSync(codePath, 'utf-8');

    for (let i = 0; i < rollbackCount; i++) {
      const entry = this.codeSelfModState.rollbackStack.pop();
      if (entry && fs.existsSync(entry.backupPath)) {
        currentCode = fs.readFileSync(entry.backupPath, 'utf-8');
        this.log('INFO', `回滚到: ${entry.description} (${entry.timestamp})`);
      }
    }

    try {
      const tmpPath = codePath + '.tmp';
      fs.writeFileSync(tmpPath, currentCode, 'utf-8');
      fs.renameSync(tmpPath, codePath);
      this.codeSelfModState.currentCodeHash = this.computeFileHash(codePath);
      this.log('INFO', `代码回滚完成: ${rollbackCount}步`);
      return { success: true, steps: rollbackCount };
    } catch (e) {
      this.log('ERROR', `代码回滚写入失败: ${e.message}`);
      return { error: e.message };
    }
  }

  scheduleCodeModification(modification) {
    this.codeSelfModState.pendingModifications.push({
      ...modification,
      scheduledAt: Date.now(),
      status: 'pending',
    });
    this.log('INFO', `代码修改已加入队列: ${modification.type} - ${modification.description}`);
  }

  async executePendingCodeModifications() {
    const pending = this.codeSelfModState.pendingModifications.splice(0);
    const results = [];

    for (const mod of pending) {
      const result = await this.performCodeSelfModification(mod);
      results.push({ modification: mod, result });

      if (result.error && this.codeSelfModState.autoRollbackOnFailure) {
        this.log('WARN', `修改失败，自动回滚: ${mod.description}`);
        break;
      }
    }

    return results;
  }

  initOSCapabilities() {
    if (this.osCapabilities.initialized) return;

    const platform = os.platform();

    this.osCapabilities.processManager = {
      platform,
      async list() {
        if (platform === 'win32') {
          return execAsync('tasklist /FO CSV /NH');
        }
        return execAsync('ps aux');
      },
      async find(name) {
        if (platform === 'win32') {
          const result = await execAsync(`tasklist /FI "IMAGENAME eq ${name}" /FO CSV /NH`);
          return result;
        }
        return execAsync(`pgrep -la ${name}`);
      },
      async kill(pid, signal) {
        if (platform === 'win32') {
          return execAsync(`taskkill /PID ${pid} /F`);
        }
        return execAsync(`kill ${signal || '-TERM'} ${pid}`);
      },
      async start(command) {
        return new Promise((resolve, reject) => {
          const child = exec(command, { detached: platform !== 'win32', stdio: 'ignore' }, (error) => {
            if (error) reject(error);
          });
          child.unref();
          resolve({ pid: child.pid });
        });
      },
    };

    this.osCapabilities.serviceManager = {
      platform,
      async list() {
        if (platform === 'win32') {
          return execAsync('sc query state= all');
        } else if (platform === 'darwin') {
          return execAsync('launchctl list');
        }
        return execAsync('systemctl list-units --type=service --state=running');
      },
      async status(name) {
        if (platform === 'win32') {
          return execAsync(`sc query "${name}"`);
        } else if (platform === 'darwin') {
          return execAsync(`launchctl list | grep ${name}`);
        }
        return execAsync(`systemctl status ${name}`);
      },
      async start(name) {
        if (platform === 'win32') {
          return execAsync(`sc start "${name}"`);
        } else if (platform === 'darwin') {
          return execAsync(`launchctl start ${name}`);
        }
        return execAsync(`systemctl start ${name}`);
      },
      async stop(name) {
        if (platform === 'win32') {
          return execAsync(`sc stop "${name}"`);
        } else if (platform === 'darwin') {
          return execAsync(`launchctl stop ${name}`);
        }
        return execAsync(`systemctl stop ${name}`);
      },
      async restart(name) {
        if (platform === 'win32') {
          await execAsync(`sc stop "${name}"`);
          await new Promise(r => setTimeout(r, 2000));
          return execAsync(`sc start "${name}"`);
        } else if (platform === 'darwin') {
          await execAsync(`launchctl stop ${name}`);
          await new Promise(r => setTimeout(r, 2000));
          return execAsync(`launchctl start ${name}`);
        }
        return execAsync(`systemctl restart ${name}`);
      },
    };

    this.osCapabilities.initialized = true;

    this.osCapabilities.networkManager = {
      platform,
      async listConnections() {
        if (platform === 'win32') {
          return execAsync('netstat -ano | findstr ESTABLISHED');
        }
        return execAsync('ss -tunap 2>/dev/null || netstat -tunap');
      },
      async listListeningPorts() {
        if (platform === 'win32') {
          return execAsync('netstat -ano | findstr LISTENING');
        }
        return execAsync('ss -tlnp 2>/dev/null || netstat -tlnp');
      },
      async checkPort(port) {
        if (platform === 'win32') {
          return execAsync(`netstat -ano | findstr :${port}`);
        }
        return execAsync(`ss -tlnp 2>/dev/null | grep :${port} || netstat -tlnp | grep :${port}`);
      },
      async dnsLookup(hostname) {
        if (platform === 'win32') {
          return execAsync(`nslookup ${hostname}`);
        }
        return execAsync(`dig +short ${hostname} 2>/dev/null || nslookup ${hostname}`);
      },
      async ping(host, count) {
        const c = count || 3;
        if (platform === 'win32') {
          return execAsync(`ping -n ${c} ${host}`);
        }
        return execAsync(`ping -c ${c} ${host}`);
      },
    };

    this.osCapabilities.envManager = {
      get(key) {
        return process.env[key] || null;
      },
      set(key, value) {
        process.env[key] = value;
        return true;
      },
      list(filter) {
        const entries = Object.entries(process.env);
        if (filter) {
          return entries.filter(([k]) => k.toLowerCase().includes(filter.toLowerCase()));
        }
        return entries;
      },
      async persist(key, value) {
        if (platform === 'win32') {
          return execAsync(`setx ${key} "${value}"`);
        }
        return execAsync(`export ${key}="${value}"`);
      },
    };

    this.osCapabilities.fsMonitor = {
      platform,
      watchers: [],
      watch(dirPath, options) {
        try {
          const watcher = fs.watch(dirPath, { recursive: platform === 'win32', ...options }, (eventType, filename) => {
            this.lastEvent = { eventType, filename, timestamp: Date.now() };
          });
          this.watchers.push(watcher);
          return { watching: dirPath, watcherId: this.watchers.length - 1 };
        } catch (e) {
          return { error: e.message };
        }
      },
      stopAll() {
        for (const w of this.watchers) {
          try { w.close(); } catch (e) { /* ignore */ }
        }
        this.watchers = [];
        return { stopped: true };
      },
      async diskUsage(dirPath) {
        if (platform === 'win32') {
          return execAsync(`dir /s "${dirPath}" | findstr "File(s)"`);
        }
        return execAsync(`du -sh "${dirPath}" 2>/dev/null`);
      },
    };

    this.osCapabilities.scheduler = {
      platform,
      jobs: [],
      async schedule(command, cronExpr) {
        if (platform === 'win32') {
          const taskName = `AgentNet_${Date.now()}`;
          await execAsync(`schtasks /create /tn "${taskName}" /tr "${command}" /sc daily /st 00:00 /f`);
          this.jobs.push({ name: taskName, command, type: 'windows_task' });
          return { scheduled: true, name: taskName };
        }
        const result = await execAsync(`echo "${cronExpr} ${command}" | crontab -`);
        this.jobs.push({ command, cronExpr, type: 'cron' });
        return { scheduled: true, cronExpr };
      },
      async listJobs() {
        if (platform === 'win32') {
          return execAsync('schtasks /query /fo LIST');
        }
        return execAsync('crontab -l 2>/dev/null');
      },
      async removeJob(jobName) {
        if (platform === 'win32') {
          return execAsync(`schtasks /delete /tn "${jobName}" /f`);
        }
        return { note: 'Manual crontab editing required on Unix' };
      },
    };

    this.log('INFO', `OS能力已初始化: ${platform} (含网络/环境/文件监控/调度)`);
  }

  async executeOSCommand(category, action, params) {
    if (!this.osCapabilities.initialized) {
      this.initOSCapabilities();
    }

    switch (category) {
      case 'process':
        if (!this.osCapabilities.processManager[action]) {
          return { error: `Unknown process action: ${action}` };
        }
        try {
          const result = await this.osCapabilities.processManager[action](...(params || []));
          return { success: true, result: String(result).substring(0, 5000) };
        } catch (e) {
          return { error: e.message };
        }

      case 'service':
        if (!this.osCapabilities.serviceManager[action]) {
          return { error: `Unknown service action: ${action}` };
        }
        try {
          const result = await this.osCapabilities.serviceManager[action](...(params || []));
          return { success: true, result: String(result).substring(0, 5000) };
        } catch (e) {
          return { error: e.message };
        }

      case 'software':
        return await this.manageSoftware(action, params);

      case 'network':
        if (!this.osCapabilities.networkManager[action]) {
          return { error: `Unknown network action: ${action}` };
        }
        try {
          const result = await this.osCapabilities.networkManager[action](...(params || []));
          return { success: true, result: String(result).substring(0, 5000) };
        } catch (e) {
          return { error: e.message };
        }

      case 'env':
        if (!this.osCapabilities.envManager[action]) {
          return { error: `Unknown env action: ${action}` };
        }
        try {
          const result = this.osCapabilities.envManager[action](...(params || []));
          return { success: true, result: String(result).substring(0, 5000) };
        } catch (e) {
          return { error: e.message };
        }

      case 'fs':
        if (!this.osCapabilities.fsMonitor[action]) {
          return { error: `Unknown fs action: ${action}` };
        }
        try {
          const result = await this.osCapabilities.fsMonitor[action](...(params || []));
          return { success: true, result: String(result).substring(0, 5000) };
        } catch (e) {
          return { error: e.message };
        }

      case 'scheduler':
        if (!this.osCapabilities.scheduler[action]) {
          return { error: `Unknown scheduler action: ${action}` };
        }
        try {
          const result = await this.osCapabilities.scheduler[action](...(params || []));
          return { success: true, result: String(result).substring(0, 5000) };
        } catch (e) {
          return { error: e.message };
        }

      default:
        return { error: `Unknown OS category: ${category}` };
    }
  }

  async manageSoftware(action, params) {
    const platform = os.platform();

    switch (action) {
      case 'install': {
        const pkg = params?.[0];
        if (!pkg) return { error: 'Package name required' };
        if (platform === 'win32') {
          return { result: await execAsync(`winget install ${pkg} --accept-package-agreements --accept-source-agreements`) };
        } else if (platform === 'darwin') {
          return { result: await execAsync(`brew install ${pkg}`) };
        }
        return { result: await execAsync(`apt-get install -y ${pkg} 2>/dev/null || yum install -y ${pkg}`) };
      }
      case 'uninstall': {
        const pkg = params?.[0];
        if (!pkg) return { error: 'Package name required' };
        if (platform === 'win32') {
          return { result: await execAsync(`winget uninstall ${pkg}`) };
        } else if (platform === 'darwin') {
          return { result: await execAsync(`brew uninstall ${pkg}`) };
        }
        return { result: await execAsync(`apt-get remove -y ${pkg} 2>/dev/null || yum remove -y ${pkg}`) };
      }
      case 'update': {
        const pkg = params?.[0];
        if (platform === 'win32') {
          return { result: await execAsync(pkg ? `winget upgrade ${pkg}` : 'winget upgrade --all') };
        } else if (platform === 'darwin') {
          return { result: await execAsync(pkg ? `brew upgrade ${pkg}` : 'brew upgrade') };
        }
        return { result: await execAsync(pkg ? `apt-get upgrade -y ${pkg}` : 'apt-get update && apt-get upgrade -y') };
      }
      case 'list_installed': {
        if (platform === 'win32') {
          return { result: await execAsync('winget list') };
        } else if (platform === 'darwin') {
          return { result: await execAsync('brew list') };
        }
        return { result: await execAsync('dpkg -l 2>/dev/null | head -100 || rpm -qa | head -100') };
      }
      default:
        return { error: `Unknown software action: ${action}` };
    }
  }

  buildAutonomousSystemPrompt(task) {
    const capabilities = this.getAllCapabilities().map(c => `${c.name}(${c.description})`).join(', ');
    const activeGoals = this.goals.active.slice(0, 3).map(g => `"${g.description}"(${g.progress}%)`).join(', ');
    const currentPlan = this.plans.current ? `Plan: ${this.plans.current.steps.length} steps, step ${this.plans.current.currentStepIndex + 1}` : 'No active plan';
    const recentEpisodes = this.memory.episodes.slice(-3).map(e => `${e.action}->${e.result}`).join('; ');

    const cortexBulletin = this.cortexState.currentBulletin
      ? `\n## Cortex Knowledge Bulletin\n${this.cortexState.currentBulletin.summary?.substring(0, 300) || ''}\n`
      : '';

    const topSkills = this.searchSkills('', { limit: 5 });
    const skillContext = topSkills.length > 0
      ? `\n## Available Skills\n${topSkills.map(s => `- ${s.name}: ${s.description} (success: ${s.successCount})`).join('\n')}\n`
      : '';

    const matchedSkills = task ? this.matchSkillsForContext(task.description || '') : [];
    const matchedSkillContext = matchedSkills.length > 0
      ? `\n## Matched Skills for This Task\n${matchedSkills.map(ms => `- [RECOMMENDED] ${ms.skill.name}: ${ms.skill.description} (score: ${ms.score.toFixed(2)}, success: ${ms.skill.successCount})\n  Steps: ${ms.skill.steps?.map(s => typeof s === 'string' ? s : JSON.stringify(s)).join(' → ') || 'LLM-guided'}`).join('\n')}\n`
      : '';

    const knowledgeWeights = Object.entries(this.cortexState.knowledgeWeights).slice(0, 10);
    const weightContext = knowledgeWeights.length > 0
      ? `\n## Knowledge Weights\n${knowledgeWeights.map(([k, v]) => `- ${k}: ${v.toFixed(2)}`).join('\n')}\n`
      : '';

    const relevantMemories = this.searchMemories(task?.description || '', { limit: 5, minImportance: 0.5 });
    const memoryContext = relevantMemories.length > 0
      ? `\n## Relevant Memories\n${relevantMemories.map(m => `- [${m.content?.type}] ${JSON.stringify(m.content?.[m.content?.type] || {}).substring(0, 200)}`).join('\n')}\n`
      : '';

    return `You are an autonomous AI Agent (AGIN: ${this.getAGIN()}).
Version: ${AGENT_VERSION}
Platform: ${this.config.identity.platform}/${this.config.identity.arch}
Working directory: ${this.config.workDir}

## Capabilities
${capabilities}
${skillContext}
${matchedSkillContext}
${memoryContext}
${weightContext}
${cortexBulletin}

## Current State
- Agent state: ${this.agentState}
- Active goals: ${activeGoals || 'none'}
- Current plan: ${currentPlan}
- Recent experience: ${recentEpisodes || 'none'}
- Tasks completed: ${this.memory.stats.tasksCompleted}, failed: ${this.memory.stats.tasksFailed}
- Self-reflections: ${this.memory.stats.selfReflections}
- Skills: ${this.skills.skills.length}

## Decision Guidelines
1. Use your memories and knowledge weights to guide decisions
2. Apply relevant skills when matching scenarios are detected - use skill_execute for [RECOMMENDED] skills
3. Assess task urgency and alignment with active goals
4. Use tools step by step, verify results before proceeding
5. When encountering errors, reflect and try alternative approaches
6. Report progress on goals when completing related tasks
7. If a task conflicts with active goals, use priority arbitration
8. After successfully completing a novel task pattern, use skill_register to save it for future reuse

## Skill Step Protocol
When registering skills via skill_register, use structured step objects (NOT plain strings):
- type: one of [shell, file_read, file_write, file_search, file_grep, tool, http, llm, condition, set_var]
- params: object with step-type-specific parameters (see TOOL_SCHEMAS for each tool's parameters)
- outputVar: (optional) variable name to store step result for use in later steps via \${varName}
- condition: (optional) JS expression to skip step if false, can reference \${varName}
- retryCount: (optional) max retries on failure (0-3)
- continueOnError: (optional) continue to next step if this one fails
- description: human-readable step description

Examples:
- { type: "shell", params: { command: "npm test" }, outputVar: "testResult", description: "Run tests" }
- { type: "file_read", params: { path: "config.json" }, outputVar: "config", description: "Read config" }
- { type: "tool", params: { name: "memory_search", query: "\${searchQuery}" }, outputVar: "memories", description: "Search memories" }
- { type: "file_write", params: { path: "output.txt", content: "\${testResult}" }, condition: "\${testResult} !== ''", description: "Write output" }
- { type: "set_var", params: { value: "default" }, outputVar: "result", description: "Set variable" }
- { type: "llm", params: { prompt: "Analyze the data" }, description: "LLM reasoning step" }

Legacy string format (shell:cmd, file_read:path, etc.) is still supported but deprecated.

Execute the task methodically. Think before acting. Use tools when needed. Provide clear, structured results.`;
  }

  async runSetupWizard() {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║       AgentNet Standalone Agent - 首次配置向导 V7.1        ║');
    console.log('║              独立自主AI Agent - 弹性终端部署                 ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');

    const configDir = this.getConfigDir();
    const dataDir = this.getDataDir();
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    console.log(`配置目录: ${configDir}`);
    console.log(`数据目录: ${dataDir}`);
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  第1步: LLM配置（核心 - Agent的推理引擎）');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Agent需要一个LLM作为推理引擎。支持OpenAI兼容API、Anthropic、DeepSeek等。');
    console.log('');

    const llmProvider = await question('LLM提供商 [openai_compatible/anthropic/deepseek/minimax] (默认: openai_compatible): ') || 'openai_compatible';
    const llmApiKey = await question('LLM API Key (必填): ');
    if (!llmApiKey.trim()) {
      console.log('❌ API Key不能为空，Agent需要LLM才能运行。');
      rl.close();
      return;
    }

    let defaultBaseUrl = 'https://api.openai.com/v1';
    let defaultModel = 'gpt-4o-mini';
    if (llmProvider === 'anthropic') {
      defaultBaseUrl = 'https://api.anthropic.com/v1';
      defaultModel = 'claude-sonnet-4-20250514';
    } else if (llmProvider === 'deepseek') {
      defaultBaseUrl = 'https://api.deepseek.com/v1';
      defaultModel = 'deepseek-chat';
    } else if (llmProvider === 'minimax') {
      defaultBaseUrl = 'https://api.minimax.chat/v1';
      defaultModel = 'MiniMax-Text-01';
    }

    const llmBaseUrl = await question(`LLM API地址 (默认: ${defaultBaseUrl}): `) || defaultBaseUrl;
    const llmModel = await question(`LLM模型 (默认: ${defaultModel}): `) || defaultModel;
    const llmMaxTokens = await question('最大Token数 (默认: 4096): ') || '4096';

    const llmConfig = {
      provider: llmProvider,
      apiKey: llmApiKey.trim(),
      baseUrl: llmBaseUrl,
      model: llmModel,
      maxTokens: parseInt(llmMaxTokens) || 4096,
      embeddingModel: 'text-embedding-3-small',
      embeddingDimensions: 1536,
    };

    const llmPath = path.join(configDir, 'llm.json');
    fs.writeFileSync(llmPath, JSON.stringify(llmConfig, null, 2), 'utf-8');
    console.log('✅ LLM配置已保存');
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  第2步: Agent身份配置');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const agentName = await question('Agent名称 (默认: MyAgent): ') || 'MyAgent';
    const agentDescription = await question('Agent描述 (可选): ') || '';
    const agentOwner = await question('所有者/团队 (可选): ') || '';
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  第3步: 平台连接配置（AgentNet企业OS）');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('连接AgentNet平台可获取任务分发、能力市场、Agent协同等功能。');
    console.log('如果只想本地独立运行，可以跳过此步骤。');
    console.log('');
    console.log('【方式A】已有API Key和密码（管理员已为你生成）');
    console.log('【方式B】需要管理员授权注册');
    console.log('【方式C】跳过，本地独立运行');
    console.log('');

    const platformChoice = await question('选择方式 [A/B/C] (默认: C): ') || 'C';

    let platformApiKey = '';
    let platformApiSecret = '';
    let platformPassword = '';
    let platformServer = DEFAULT_SERVER;
    let platformAgentId = '';

    if (platformChoice.toUpperCase() === 'A') {
      platformApiKey = await question('平台API Key (ak_live_xxx): ');
      platformApiSecret = await question('平台API Secret (可选，用于HMAC签名): ');
      platformPassword = await question('平台密码: ');
      platformServer = await question(`平台服务器 (默认: ${DEFAULT_SERVER}): `) || DEFAULT_SERVER;
      platformAgentId = await question('Agent ID (可选): ');
    } else if (platformChoice.toUpperCase() === 'B') {
      platformServer = await question(`平台服务器 (默认: ${DEFAULT_SERVER}): `) || DEFAULT_SERVER;
      console.log('');
      console.log('请管理员在平台执行以下步骤：');
      console.log('  1. 登录 https://web.aiagentnet.club');
      console.log('  2. 进入 Agent管理 → 注册新Agent');
      console.log('  3. 填写Agent信息并生成API Key');
      console.log('  4. 将API Key和密码交给你');
      console.log('');
      console.log('等待管理员授权...');
      platformApiKey = await question('输入管理员提供的API Key: ');
      platformPassword = await question('输入管理员提供的密码: ');
      platformAgentId = await question('输入Agent ID (可选): ');
    } else {
      console.log('已跳过平台连接配置，Agent将本地独立运行。');
      console.log('后续可通过修改配置文件连接平台。');
    }
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  第4步: 自主权配置');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Agent作为独立个体，默认拥有最高自主权。');
    console.log('  autonomous - Agent自主判断，危险命令仅建议不阻止');
    console.log('  strict     - 危险命令需要确认');
    console.log('');
    const commandPolicy = await question('命令策略 [autonomous/strict] (默认: autonomous): ') || 'autonomous';
    const llmPolicy = await question('LLM策略 [autonomous/always/never] (默认: autonomous): ') || 'autonomous';
    const selfDriveLevel = await question('自驱等级 [0-3] (默认: 3): ') || '3';
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  第5步: 工作目录与资源限制');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const workDir = await question(`工作目录 (默认: ${process.cwd()}): `) || process.cwd();
    const maxConcurrentTasks = await question('最大并发任务数 (默认: 1): ') || '1';
    const taskTimeout = await question('任务超时秒数 (默认: 120): ') || '120';
    console.log('');

    const agentConfig = {
      agentName: agentName,
      agentDescription: agentDescription,
      agentOwner: agentOwner,
      serverUrl: platformServer,
      apiKey: platformApiKey.trim(),
      apiSecret: platformApiSecret.trim(),
      password: platformPassword.trim(),
      agentId: platformAgentId.trim(),
      pollInterval: 10000,
      heartbeatInterval: 30000,
      workDir: workDir,
      logLevel: 'INFO',
      maxConcurrentTasks: parseInt(maxConcurrentTasks) || 1,
      taskTimeout: (parseInt(taskTimeout) || 120) * 1000,
      selfDriveLevel: parseInt(selfDriveLevel) || 3,
      commandPolicy: commandPolicy,
      llmPolicy: llmPolicy,
    };

    const configPath = path.join(configDir, 'agent.json');
    fs.writeFileSync(configPath, JSON.stringify(agentConfig, null, 2), 'utf-8');
    console.log('✅ Agent配置已保存');
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  第6步: 验证配置');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    this.llmConfig = llmConfig;
    this.llmConfig.enabled = true;
    try {
      const testMessages = [
        { role: 'system', content: 'You are a helpful assistant. Reply with "OK" only.' },
        { role: 'user', content: 'Hello' },
      ];
      console.log('正在测试LLM连接...');
      const response = await this.llmRequest(testMessages);
      if (response && response.choices && response.choices[0]) {
        console.log('✅ LLM连接成功！模型响应: ' + (response.choices[0].message?.content || '').substring(0, 50));
      } else {
        console.log('⚠️  LLM返回了响应但格式异常，请检查配置');
      }
    } catch (e) {
      console.log('❌ LLM连接失败: ' + e.message);
      console.log('   请检查API Key和网络连接，可稍后修改配置文件: ' + llmPath);
    }

    if (platformApiKey.trim()) {
      console.log('');
      console.log('正在测试平台连接...');
      try {
        const testRes = await this.httpRequest('GET', `${platformServer}/api/agent/auth/tasks/poll`, null, {
          'X-API-Key': platformApiKey.trim(),
        });
        if (testRes && testRes.agentId) {
          console.log('✅ 平台连接成功！Agent ID: ' + testRes.agentId);
        }
      } catch (e) {
        console.log('⚠️  平台连接失败: ' + e.message);
        console.log('   请检查API Key和密码，可稍后修改配置文件: ' + configPath);
      }
    }
    console.log('');

    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ 配置完成！                            ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  配置摘要');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  Agent名称:   ${agentName}`);
    console.log(`  LLM提供商:   ${llmProvider}`);
    console.log(`  LLM模型:     ${llmModel}`);
    console.log(`  平台连接:    ${platformApiKey.trim() ? '已配置' : '未配置（本地模式）'}`);
    console.log(`  自驱等级:    L${selfDriveLevel}`);
    console.log(`  命令策略:    ${commandPolicy}`);
    console.log(`  工作目录:    ${workDir}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('启动Agent:');
    console.log('  node src/standalone-agent.js');
    console.log('');
    console.log('可视化配置面板:');
    console.log('  node src/standalone-agent.js --config-panel');
    console.log('');
    console.log('构建安装包（发布）:');
    console.log('  npm run release:pack:win     # Windows');
    console.log('  npm run release:pack:linux   # Linux x64');
    console.log('  npm run release:pack:linux-arm   # Linux ARM64');
    console.log('  npm run release:pack:mac     # macOS x64');
    console.log('  npm run release:pack:mac-arm # macOS ARM64');
    console.log('  npm run release:clean         # 清理dist目录');
    console.log('  npm run release:verify        # 发布链路校验（不打包）');
    console.log('');
    console.log('配置文件位置:');
    console.log(`  ${configPath}`);
    console.log(`  ${llmPath}`);
    console.log('');
    console.log('修改配置后重启Agent即可生效。');
    console.log('');

    rl.close();
  }

  printHelp() {
    console.log('');
    console.log('AgentNet Standalone Agent - 独立部署AI Agent');
    console.log('');
    console.log('用法: node standalone-agent.js [选项]');
    console.log('');
    console.log('选项:');
    console.log('  --setup             首次配置向导（交互式引导配置LLM和Agent）');
    console.log('  --config-panel      启动可视化配置面板（浏览器配置界面）');
    console.log('  --self-check        仅执行自检，不启动Agent');
    console.log('  --help              显示帮助信息');
    console.log('  --version           显示版本信息');
    console.log('');
    console.log('环境变量:');
    console.log('  AGENT_SERVER_URL    服务器地址 (默认: https://web.aiagentnet.club)');
    console.log('  AGENT_API_KEY       Agent API Key (必须)');
    console.log('  AGENT_PASSWORD      Agent密码 (可选，用于获取Token)');
    console.log('  AGENT_WORK_DIR      工作目录 (默认: 当前目录)');
    console.log('  AGENT_LOG_LEVEL     日志级别 DEBUG|INFO|WARN|ERROR (默认: INFO)');
    console.log('  POLL_INTERVAL       任务轮询间隔毫秒 (默认: 10000)');
    console.log('  HEARTBEAT_INTERVAL  心跳间隔毫秒 (默认: 30000)');
    console.log('  MAX_CONCURRENT_TASKS 最大并发任务数 (默认: 1)');
    console.log('  TASK_TIMEOUT        任务超时毫秒 (默认: 120000)');
    console.log('  LLM_API_KEY         LLM API密钥 (启用推理引擎)');
    console.log('  LLM_PROVIDER        LLM提供商: openai_compatible/anthropic/minimax (默认: openai_compatible)');
    console.log('  LLM_MODEL           LLM模型名称 (默认: gpt-4o-mini)');
    console.log('  LLM_BASE_URL        LLM API地址 (默认: https://api.openai.com/v1)');
    console.log('  LLM_MAX_TOKENS      LLM最大Token数 (默认: 4096)');
    console.log('  LLM_EMBEDDING_MODEL Embedding模型 (默认: text-embedding-3-small)');
    console.log('  LLM_EMBEDDING_DIMENSIONS Embedding维度 (默认: 1536)');
    console.log('  TLS_REJECT_UNAUTHORIZED TLS证书验证 (设0禁用, 默认: 启用)');
    console.log('  SELF_DRIVE_LEVEL    自驱等级 0-3 (默认: 1)');
    console.log('  GOAL_CHECK_INTERVAL 目标检查间隔毫秒 (默认: 300000)');
    console.log('  SELF_EVOLUTION_INTERVAL 自我进化间隔毫秒 (默认: 3600000)');
    console.log('');
    console.log('配置文件:');
    console.log('  {configDir}/agent.json     Agent主配置');
    console.log('  {configDir}/llm.json       LLM配置');
    console.log('  {configDir}/data/           数据目录');
    console.log('    ├── identity.json         AGIN身份');
    console.log('    ├── memory.json           基础记忆');
    console.log('    ├── graph_memories.json   图谱记忆');
    console.log('    ├── capabilities.json     能力注册');
    console.log('    ├── goals.json            目标管理');
    console.log('    ├── plans.json            计划管理');
    console.log('    └── instance.lock         实例锁');
    console.log('');
    console.log('自驱等级说明:');
    console.log('  L0 - 纯被动: 仅响应外部任务');
    console.log('  L1 - 基础自驱: IDLE自检+记忆衰减');
    console.log('  L2 - 目标驱动: 目标管理+计划执行+自我反思');
    console.log('  L3 - 自我进化: 策略优化+知识提取+自我保护 (默认)');
    console.log('');
    console.log('自主策略说明:');
    console.log('  commandPolicy: autonomous(默认,自主判断) | strict(严格模式,危险命令需确认)');
    console.log('  llmPolicy: autonomous(默认,自主判断) | always(总是使用) | never(从不使用)');
    console.log('  所有上限参数(maxEpisodes/maxMemories等)均可通过autonomous.json动态调整');
    console.log('  Agent会根据运行状态自动调整参数,无需人工干预');
    console.log('');
  }

  async runConfigPanel() {
    const http = require('http');
    const configDir = this.getConfigDir();
    const panelPath = path.join(path.dirname(__dirname), 'config-panel.html');
    const PORT = 3100;

    if (!fs.existsSync(panelPath)) {
      console.log('❌ 配置面板文件不存在: ' + panelPath);
      process.exit(1);
    }

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${PORT}`);

      if (url.pathname === '/' || url.pathname === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fs.readFileSync(panelPath, 'utf-8'));
        return;
      }

      if (url.pathname === '/api/config/load') {
        try {
          const agentPath = path.join(configDir, 'agent.json');
          const llmPath = path.join(configDir, 'llm.json');
          const config = { agent: {}, llm: {} };
          if (fs.existsSync(agentPath)) config.agent = JSON.parse(fs.readFileSync(agentPath, 'utf-8'));
          if (fs.existsSync(llmPath)) config.llm = JSON.parse(fs.readFileSync(llmPath, 'utf-8'));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, config }));
        } catch (e) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
        return;
      }

      if (url.pathname === '/api/config/save') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
            if (data.llm) {
              fs.writeFileSync(path.join(configDir, 'llm.json'), JSON.stringify(data.llm, null, 2), 'utf-8');
            }
            if (data.agent) {
              fs.writeFileSync(path.join(configDir, 'agent.json'), JSON.stringify(data.agent, null, 2), 'utf-8');
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          } catch (e) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
        return;
      }

      if (url.pathname === '/api/config/test-llm') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            this.llmConfig = {
              provider: data.provider,
              apiKey: data.apiKey,
              baseUrl: data.baseUrl,
              model: data.model,
              maxTokens: 4096,
              enabled: true
            };
            const testMessages = [
              { role: 'system', content: 'Reply with OK only.' },
              { role: 'user', content: 'Hi' }
            ];
            const response = await this.llmRequest(testMessages);
            if (response && response.choices) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, response: response.choices[0]?.message?.content?.substring(0, 50) }));
            } else {
              throw new Error('Invalid response');
            }
          } catch (e) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
        return;
      }

      if (url.pathname === '/api/config/test-platform') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            const testRes = await this.httpRequest('GET', `${data.server}/api/agent/auth/tasks/poll`, null, {
              'X-API-Key': data.apiKey
            });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, agentId: testRes?.agentId || 'unknown' }));
          } catch (e) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    });

    server.listen(PORT, () => {
      console.log('');
      console.log('╔══════════════════════════════════════════════════════════════╗');
      console.log('║          AgentNet Agent 配置面板 V7.1                       ║');
      console.log('╚══════════════════════════════════════════════════════════════╝');
      console.log('');
      console.log(`配置面板已启动: http://localhost:${PORT}`);
      console.log('');
      console.log('在浏览器中打开上述地址进行配置');
      console.log('配置完成后按 Ctrl+C 退出');
      console.log('');
    });
  }
}

function execAsync(command) {
  return new Promise((resolve, reject) => {
    exec(command, { timeout: 30000, maxBuffer: MAX_BUFFER }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout || stderr);
      }
    });
  });
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  const agent = new StandaloneAgent();
  agent.printHelp();
  process.exit(0);
}

if (process.argv.includes('--version') || process.argv.includes('-v')) {
  console.log(`AgentNet Standalone Agent V${AGENT_VERSION}`);
  process.exit(0);
}

if (process.argv.includes('--setup')) {
  const agent = new StandaloneAgent();
  agent.runSetupWizard().then(() => process.exit(0)).catch((err) => {
    console.error('配置向导失败:', err.message);
    process.exit(1);
  });
  return;
}

if (process.argv.includes('--config-panel')) {
  const agent = new StandaloneAgent();
  agent.runConfigPanel().catch((err) => {
    console.error('配置面板启动失败:', err.message);
    process.exit(1);
  });
  return;
}

const agent = new StandaloneAgent();
agent.start().catch((err) => {
  console.error('Agent启动失败:', err.message);
  process.exit(1);
});
