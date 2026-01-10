# 开发计划

## 开发任务清单

### Phase 1: 项目初始化 🏗️

- [x] 使用 `npx create-next-app@latest` 初始化 Next.js 项目（App Router）
- [x] 配置 TypeScript（tsconfig.json）
- [x] 安装和配置 Tailwind CSS（Tailwind 4，无需配置文件）
- [x] 安装和配置 DaisyUI（在 CSS 中使用 @plugin）
- [x] 安装 React Icons（react-icons）
- [x] 配置 ESLint 和 Prettier
- [x] 创建项目目录结构（components, lib, app, types 等）
- [x] 创建基础布局组件 `components/layout/Sidebar.tsx`
- [x] 创建基础布局组件 `components/layout/Page.tsx`
- [x] 创建主布局 `app/layout.tsx`（包含 Sidebar + Page）
- [x] 创建路由 `/app/agents/page.tsx`（对话页面占位）
- [x] 创建路由 `/app/settings/page.tsx`（设置页面占位）
- [x] 配置 Sidebar 菜单项（Agents、设置）
- [x] 测试基础布局和路由

---

### Phase 2: Agent 引擎核心 🔧

- [ ] 安装 `@langchain/langgraph`
- [ ] 安装 `@langchain/mcp-adapters`
- [ ] 安装 LangChain 核心包（@langchain/core）
- [ ] 创建 `lib/agent/types.ts`（定义 Agent 相关类型）
- [ ] 创建 `lib/llm/client.ts`（LLM 客户端封装，支持多模型）
- [ ] 实现基础的 LLM 调用（至少支持 OpenAI）
- [ ] 创建 `lib/agent/graph.ts`（LangGraph ReAct 循环）
- [ ] 实现 Thought 节点（思考步骤）
- [ ] 实现 Tool Call 节点（工具调用）
- [ ] 实现 Observation 节点（观察结果）
- [ ] 实现 ReAct 循环逻辑（Thought -> Tool Call -> Observation -> Thought）
- [ ] 创建 `lib/tools/types.ts`（工具类型定义）
- [ ] 创建 `lib/tools/registry.ts`（工具注册表）
- [ ] 实现工具调用逻辑（支持动态工具）
- [ ] 创建 `app/api/chat/route.ts`（API Route）
- [ ] 实现流式输出支持（Server-Sent Events）
- [ ] 实现错误处理和重试机制
- [ ] 测试 Agent 引擎（简单对话测试）

---

### Phase 3: 对话 UI 💬

- [ ] 创建 `components/chat/ChatContainer.tsx`（对话容器）
- [ ] 创建 `components/chat/MessageList.tsx`（消息列表）
- [ ] 创建 `components/chat/MessageItem.tsx`（单条消息）
- [ ] 创建 `components/chat/UserMessage.tsx`（用户消息组件）
- [ ] 创建 `components/chat/AIMessage.tsx`（AI 消息组件）
- [ ] 实现消息气泡样式（用户靠右，AI 靠左）
- [ ] 创建 `components/chat/ChatInput.tsx`（输入框组件）
- [ ] 实现多行输入支持
- [ ] 实现发送按钮和快捷键（Enter/Cmd+Enter）
- [ ] 实现流式输出显示（实时更新 AI 回复）
- [ ] 创建 `components/chat/ToolCall.tsx`（工具调用可视化组件）
- [ ] 实现工具调用过程展示（可折叠）
- [ ] 显示 Thought、Tool Call、Observation
- [ ] 实现消息操作（复制按钮）
- [ ] 实现加载状态显示
- [ ] 实现错误提示显示
- [ ] 完善 `/app/agents/page.tsx`（集成所有组件）
- [ ] 测试对话 UI（连接 Agent API）

---

### Phase 4: Session 管理 📚

- [ ] 创建 `lib/session/types.ts`（Session 数据类型）
- [ ] 创建 `lib/session/storage.ts`（Session 存储层，使用 localStorage）
- [ ] 实现 Session CRUD 操作（创建、读取、更新、删除）
- [ ] 实现对话历史存储（保存到 Session）
- [ ] 创建 `components/sidebar/SessionList.tsx`（会话列表组件）
- [ ] 在 Sidebar 中集成 SessionList
- [ ] 实现新建会话功能（按钮 + 逻辑）
- [ ] 实现会话切换功能（点击切换当前会话）
- [ ] 实现会话重命名功能（双击或右键菜单）
- [ ] 实现会话删除功能（右键菜单或删除按钮）
- [ ] 实现当前会话高亮显示
- [ ] 实现会话持久化（页面刷新后恢复）
- [ ] 在对话页面加载时恢复会话历史
- [ ] 测试 Session 管理功能

---

### Phase 5: 配置功能（MCP + Skills + Models）⚙️

#### MCP 配置
- [ ] 创建 `lib/mcp/types.ts`（MCP Server 类型定义）
- [ ] 创建 `lib/mcp/storage.ts`（MCP 配置存储）
- [ ] 创建 `app/settings/mcp/page.tsx`（MCP 设置页面）
- [ ] 创建 `components/settings/MCPServerList.tsx`（MCP Server 列表）
- [ ] 创建 `components/settings/MCPServerForm.tsx`（添加/编辑表单）
- [ ] 实现 MCP Server 列表展示
- [ ] 实现添加 MCP Server 功能
- [ ] 实现编辑 MCP Server 功能
- [ ] 实现删除 MCP Server 功能
- [ ] 实现 MCP Server 连接测试
- [ ] 实现可用工具列表展示
- [ ] 实现 MCP Server 启用/禁用功能
- [ ] 创建 `lib/mcp/adapter.ts`（MCP 工具适配器）
- [ ] 使用 @langchain/mcp-adapters 转换 MCP 工具
- [ ] 将 MCP 工具注册到 Agent 工具注册表
- [ ] 测试 MCP 工具调用

#### Skills 配置
- [ ] 创建 `lib/skills/types.ts`（Skills 类型定义）
- [ ] 创建 `lib/skills/storage.ts`（Skills 配置存储）
- [ ] 创建 `app/settings/skills/page.tsx`（Skills 设置页面）
- [ ] 创建 `components/settings/SkillsList.tsx`（Skills 列表）
- [ ] 创建 `components/settings/SkillForm.tsx`（添加/编辑表单）
- [ ] 设计 Skills 接口规范（函数签名、参数等）
- [ ] 实现 Skills 列表展示
- [ ] 实现添加 Skills 功能
- [ ] 实现编辑 Skills 功能
- [ ] 实现删除 Skills 功能
- [ ] 实现 Skills 启用/禁用功能
- [ ] 实现 Skills 权限配置（可选）
- [ ] 创建 `lib/skills/loader.ts`（Skills 加载器）
- [ ] 将 Skills 转换为 LangChain 工具
- [ ] 将 Skills 注册到 Agent 工具注册表
- [ ] 测试 Skills 工具调用

#### Models 配置
- [ ] 创建 `lib/models/types.ts`（模型类型定义）
- [ ] 创建 `lib/models/storage.ts`（模型配置存储）
- [ ] 创建 `app/settings/models/page.tsx`（模型设置页面）
- [ ] 创建 `components/settings/ModelList.tsx`（模型列表）
- [ ] 创建 `components/settings/ModelForm.tsx`（添加/编辑表单）
- [ ] 实现模型列表展示
- [ ] 实现添加模型功能（支持 OpenAI、Anthropic 等）
- [ ] 实现编辑模型功能（配置参数、API Key）
- [ ] 实现删除模型功能
- [ ] 实现默认模型设置
- [ ] 创建 `components/chat/ModelSelector.tsx`（模型选择器）
- [ ] 在对话界面添加模型切换功能
- [ ] 更新 LLM 客户端以支持多模型切换
- [ ] 测试模型切换功能

#### 设置页面导航
- [ ] 在 Sidebar 中实现设置二级菜单展开（方案 A）
- [ ] 或实现设置主页面卡片导航（方案 B）
- [ ] 创建 `/app/settings/general/page.tsx`（基础设置页面占位）
- [ ] 测试所有设置页面路由

---

### Phase 6: 记忆功能 🧠

- [ ] 创建 `lib/memory/types.ts`（记忆数据类型）
- [ ] 设计记忆数据结构（Session 级别）
- [ ] 创建 `lib/memory/storage.ts`（记忆存储）
- [ ] 实现记忆保存功能（从对话中提取关键信息）
- [ ] 实现记忆检索功能（根据上下文检索相关记忆）
- [ ] 创建 `lib/memory/extractor.ts`（记忆提取器）
- [ ] 实现自动记忆提取（从对话中提取）
- [ ] 创建 `lib/memory/injector.ts`（记忆注入器）
- [ ] 实现记忆注入机制（在对话开始时注入相关记忆）
- [ ] 在 Agent 引擎中集成记忆功能
- [ ] 测试记忆功能（创建记忆、检索记忆、使用记忆）

---

### Phase 7: UI/UX 优化 ✨

- [ ] 实现 Sidebar 收缩/展开功能
- [ ] 添加 Sidebar 收缩/展开动画
- [ ] 实现响应式设计（移动端适配）
- [ ] 移动端：Sidebar 改为抽屉式显示
- [ ] 实现主题切换功能（明暗主题）
- [ ] 优化加载状态显示（骨架屏或加载动画）
- [ ] 添加过渡动画（页面切换、组件显示）
- [ ] 完善错误提示样式和交互
- [ ] 优化工具调用可视化展示（更好的 UI）
- [ ] 实现键盘快捷键支持（Cmd+K 搜索、Cmd+N 新建等）
- [ ] 优化消息列表滚动行为
- [ ] 优化输入框体验（自动聚焦、清空等）
- [ ] 性能优化（代码分割、懒加载等）
- [ ] 测试所有 UI 交互

---

### Phase 8: 测试和文档 📝

- [ ] 编写核心功能单元测试（Agent 引擎）
- [ ] 编写工具调用集成测试
- [ ] 编写 Session 管理测试
- [ ] 手动测试所有功能流程
- [ ] 修复发现的 Bug
- [ ] 完善代码注释（关键函数和类）
- [ ] 更新开发文档（setup.md）
- [ ] 编写用户使用文档（README.md）
- [ ] 性能测试和优化
- [ ] 最终代码审查和清理

---

## 里程碑

- **Milestone 1**: Phase 1-4 完成（MVP - 基础对话功能）
- **Milestone 2**: Phase 5 完成（完整配置功能）
- **Milestone 3**: Phase 6-8 完成（生产就绪）

---

## 需求变更管理

### 重要提醒

**当需求发生变化时，必须同步更新以下文档：**

1. **功能文档** (`docs/features/*.md`) - 更新功能描述和实现要点
2. **设计文档** (`docs/design/*.md`) - 更新 UI/UX 设计规范
3. **架构文档** (`docs/architecture/*.md`) - 更新架构和技术栈
4. **开发计划** (`docs/development/plan.md`) - 更新任务清单和开发顺序
5. **主文档** (`AGENTS.md`) - 更新项目概述和变更记录

### 更新流程

1. 识别需求变更影响的范围
2. 更新相关的功能/设计/架构文档
3. 在本文档中更新任务清单（添加/删除/修改任务）
4. 在 `AGENTS.md` 中记录变更历史
5. 确保所有文档保持一致

---

*按顺序执行，每完成一项任务就勾选 `- [ ]` 为 `- [x]`，并同步更新 `AGENTS.md` 中的进度。*
