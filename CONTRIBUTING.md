# 贡献指南

感谢您对 AgentNet Protocol 的关注！我们欢迎所有形式的贡献。

---

## 🐛 如何提交 Bug 报告

请通过 [GitHub Issues](https://github.com/agentnet/protocol/issues) 提交 Bug，模板如下：

```markdown
## 🐛 Bug 描述
[简明描述问题和现象]

## 🔄 复现步骤
1. 打开 '...'
2. 执行 '...'
3. 出现 '...'

## ✅ 期望行为
[描述你期望的行为]

## ❌ 实际行为
[描述实际发生的行为]

## 🖥️ 环境信息
- Node.js 版本: v20.x.x
- Python 版本: 3.10+
- 操作系统: Windows/macOS/Linux
- SDK 版本: @agentnet/sdk@1.0.0

## 📎 相关日志
[粘贴相关错误日志]
```

---

## ✨ 如何提交功能建议

```markdown
## ✨ 功能描述
[描述你希望新增的功能]

## 🤔 使用场景
[描述这个功能解决什么问题]

## 💡 可能的实现方案
[如果你有想法，描述一下实现思路]

## 📝 参考资料
[相关的文档、链接等]
```

---

## 🔀 Pull Request 流程

### Step 1: Fork & Clone

```bash
# Fork 本仓库到你的 GitHub 账号
git clone https://github.com/YOUR_USERNAME/protocol.git
cd protocol
git checkout -b feature/amazing-feature
```

### Step 2: 安装依赖

```bash
# Node.js SDK 开发
cd sdk/node
npm install

# Python SDK 开发
cd sdk/python
pip install -e .

# 参考实现开发
cd reference-implementation
pip install -r requirements.txt
```

### Step 3: 编写代码

```bash
# 运行代码规范检查
npm run lint    # Node.js
# 或
python -m flake8 .  # Python

# 运行测试
npm test        # Node.js
# 或
pytest tests/ -v  # Python

# 确保测试覆盖率 > 80%
npm run test:coverage
```

### Step 4: 提交并推送

```bash
git add .
git commit -m "feat: add amazing feature"
git push origin feature/amazing-feature
```

### Step 5: 创建 Pull Request

在 GitHub 上创建 PR，填写以下信息：

- **变更描述**：描述修改了什么，为什么修改
- **关联 Issue**：关联相关的 Issue（格式：`Closes #123`）
- **Breaking Changes**：如果有破坏性变更，说明原因和处理方式
- **测试结果**：附上测试截图或输出

---

## 📋 代码规范

### TypeScript (Node SDK)

| 规则 | 说明 |
|------|------|
| `strict: true` | 严格 TypeScript 模式 |
| 禁止使用 `any` | 必须显式类型 |
| 公共 API JSDoc | 所有公开方法必须有注释 |
| 函数长度 | 每个函数 < 50 行 |
| 命名规范 | camelCase(变量) / PascalCase(类) / UPPER_SNAKE_CASE(常量) |

### Python (Python SDK)

| 规则 | 说明 |
|------|------|
| Python 版本 | >= 3.10（使用 type unions / pattern matching） |
| 数据校验 | 使用 Pydantic v2 |
| 类型注解 | 覆盖率 > 90% |
| 代码风格 | 遵循 PEP 8 |
| Docstring | 使用 Google / Numpy 风格 |

### 提交信息规范

采用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<type>(<scope>): <subject>

feat(protocol): add Task Protocol DAG support
fix(sdk): correct decision event emission
docs(guides): update quickstart tutorial
test(runtime): add state machine unit tests
refactor(gateway): simplify message routing
```

**类型前缀**：

| 前缀 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档变更 |
| `style` | 代码格式（不影响功能） |
| `refactor` | 重构 |
| `test` | 测试相关 |
| `chore` | 构建/工具变更 |

---

## 🧪 测试规范

### 测试文件命名

```
# 命名规则
<模块名>.test.ts      # TypeScript
<模块名>_test.py       # Python
```

### 测试覆盖率要求

- **核心模块**（Task Engine、Decision Engine）：> 90%
- **Gateway / Adapter**：> 80%
- **工具类**：> 70%

---

## 📝 协议变更流程（RFC）

如果你要修改协议规范，请遵循以下 RFC 流程：

1. **Proposal**：在 `docs/rfc/` 目录下创建 RFC 文档
2. **Discussion**：在 GitHub Discussions 中讨论
3. **Review**：至少两位核心维护者审核
4. **Approval**：获得 Approval 后合并
5. **Implementation**：按批准内容实现

RFC 文档模板：

```markdown
# RFC: <功能名称>

## 状态
[Proposed | Discussing | Approved | Rejected | Implemented]

## 背景
[问题描述和动机]

## 提案
[详细描述解决方案]

## 权衡
[方案优缺点分析]

## 实现计划
[分阶段实施计划]
```

---

## 🏷️ 版本发布

采用 [Semantic Versioning](https://semver.org/lang/zh-CN/)：

- **MAJOR** (X.0.0)：破坏性变更
- **MINOR** (x.Y.0)：新增功能（向后兼容）
- **PATCH** (x.y.Z)：Bug 修复（向后兼容）

发布流程：
1. 更新 `CHANGELOG.md`
2. 创建 GitHub Release
3. NPM/PyPI 自动发布

---

## 📞 联系我们

- **GitHub Issues**: https://github.com/agentnet/protocol/issues
- **邮件列表**: dev@agentnet.ai
