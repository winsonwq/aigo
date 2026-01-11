# Agents 定义文档

本文档用于定义项目中的各种 Agents 及其功能，并提供项目文档的索引。

## 项目概述

本项目是一个类似 **Gemini Chat / ChatGPT** 的 AI 聊天工具，核心特点是**所有对话都支持 ReAct Agent 模式**，可以调用 MCP 工具和自定义 Skills。参考了 Manus 的设计思路。

### 核心功能

- **对话功能**: 类似 ChatGPT/Gemini 的对话界面，所有对话都基于 ReAct Agent 模式，支持工具调用
- **Session 管理**: 历史会话管理和切换（类似 ChatGPT 的会话列表）
- **MCP 配置**: 支持配置和管理 MCP Server，将 MCP 工具集成到对话中
- **Skills 配置**: 支持自定义技能扩展，增强 Agent 能力
- **多模型配置**: 支持配置和使用多个 LLM 模型
- **记忆功能**: Session 级别记忆，长期记忆（待定）

## 文档索引

### 功能文档

- [对话功能](./docs/features/chat.md) - 基于 ReAct Agent 模式的对话交互（类似 ChatGPT/Gemini）
- [Session 管理](./docs/features/session-management.md) - 会话管理和历史记录
- [MCP 配置](./docs/features/mcp-config.md) - MCP Server 配置和管理
- [Skills 配置](./docs/features/skills-config.md) - 自定义技能扩展
- [多模型配置](./docs/features/multi-model-config.md) - 多 LLM 模型配置
- [记忆功能](./docs/features/memory.md) - Session 级别和长期记忆

### 架构文档

- [架构概述](./docs/architecture/overview.md) - 项目整体架构
- [技术栈](./docs/architecture/tech-stack.md) - 使用的技术和库

### 设计文档

- [UI/UX 设计规范](./docs/design/ui-ux.md) - 界面布局和交互设计

### 开发文档

- [开发设置](./docs/development/setup.md) - 环境配置和开发指南
- [开发计划](./docs/development/plan.md) - 分阶段开发计划和任务清单
- [代码风格指南](./docs/development/code-styleguide.md) - 代码风格规范和最佳实践
- [测试指南](./docs/development/testing.md) - 功能测试步骤和检查清单

## 开发进度

### 整体进度

- [x] **Phase 1: 项目初始化** 🏗️ (14/14) ✅
- [x] **Phase 2: Agent 引擎核心** 🔧 (18/18) ✅
- [x] **Phase 3: 对话 UI** 💬 (17/17) ✅
- [x] **Phase 4: Session 管理** 📚 (13/13) ✅
- [ ] **Phase 5: 配置功能** ⚙️ (0/35)
  - [ ] MCP 配置 (0/14)
  - [ ] Skills 配置 (0/13)
  - [ ] Models 配置 (0/13)
- [ ] **Phase 6: 记忆功能** 🧠 (0/10)
- [ ] **Phase 7: UI/UX 优化** ✨ (0/13)
- [ ] **Phase 8: 测试和文档** 📝 (0/10)

**总进度**: 62/130 任务完成

### 里程碑状态

- [x] **Milestone 1**: MVP 完成（Phase 1-4）- 基础对话功能可用 ✅
- [ ] **Milestone 2**: 扩展功能完成（Phase 5）- 完整配置功能
- [ ] **Milestone 3**: 项目完成（Phase 6-8）- 生产就绪

### 最近更新

- **2024-12-XX**: 修正 Skills 实现 - 基于 Anthropic Agent Skills 标准 ✅
  - 更新 `docs/features/skills-config.md`，描述 Anthropic Agent Skills 标准
  - 创建 `lib/skills/types.ts`，定义符合标准的类型
  - 创建 `lib/skills/storage.ts`，实现 Skills 配置存储
  - 创建 `lib/skills/parser.ts`，解析 SKILL.md 文件（YAML frontmatter + Markdown）
  - 创建 `lib/skills/loader.ts`，实现渐进式披露加载机制
  - 创建 API 路由：
    - `/api/skills/load` - 加载技能元数据（启动时）
    - `/api/skills/activate` - 激活技能（加载完整指令）
    - `/api/skills/resource` - 加载技能资源（按需）
  - 创建设置页面和组件：
    - `app/settings/skills/page.tsx` - Skills 设置页面
    - `components/settings/SkillsList.tsx` - Skills 列表组件
    - `components/settings/SkillForm.tsx` - Skills 表单组件
  - 更新 `docs/development/plan.md`，修正 Skills 实现方式
  - **说明**: Skills 不是工具函数，而是文档化的指令集，采用渐进式披露机制（元数据 -> 指令 -> 资源）
  - **测试**: 构建成功，无类型错误 ✅

- **2024-12-XX**: Phase 4 完成 - Session 管理功能 ✅
  - 创建 Session 类型定义和存储层（使用 localStorage）
  - 实现 Session CRUD 操作（创建、读取、更新、删除）
  - 创建 SessionList 组件（会话列表）
  - 在 Sidebar 中集成 SessionList（Chat 页面显示会话列表）
  - 实现新建会话功能（按钮 + 逻辑）
  - 实现会话切换功能（点击切换当前会话，支持跨标签页同步）
  - 实现会话重命名功能（点击编辑按钮）
  - 实现会话删除功能（删除按钮 + 确认对话框）
  - 实现当前会话高亮显示
  - 实现会话持久化（页面刷新后恢复）
  - 在 ChatContainer 中集成 Session（自动加载和保存消息）
  - 实现自动标题生成（根据第一条用户消息）
  - **测试**: 构建成功 ✅

- **2024-12-XX**: Phase 3 完成 - 对话 UI 界面 ✅
  - 创建完整的对话 UI 组件系统
  - 实现消息列表、用户消息、AI 消息组件
  - 实现输入框组件（支持多行输入、快捷键）
  - 实现流式输出显示（实时更新 AI 回复）
  - 实现工具调用可视化组件（可折叠展示）
  - 实现消息操作（复制按钮）、加载状态、错误提示
  - 集成到 `/app/agents/page.tsx`
  - **测试**: 构建成功，页面可访问 ✅

- **2024-12-XX**: Phase 2 完成 + OpenRouter 集成 ✅
  - 实现 ReAct Agent 引擎核心功能
  - 集成 LangGraph 和工具系统
  - 创建 Chat API 端点（支持流式输出）
  - **集成 OpenRouter API**: 替换 OpenAI，使用 OpenRouter 统一接口
    - 当前模型: `google/gemini-3-flash-preview`
    - API Key 已配置在 `.env.local`
  - **修复 DaisyUI 集成**: 升级到 DaisyUI 5.5.14，配置 PostCSS 和 @tailwindcss/postcss
  - **测试**: 运行 `./scripts/test-verification.sh` 所有基础测试通过 ✅
    - ✓ 构建测试通过
    - ✓ 计算器工具测试通过（加法、乘法、除法、除零错误处理）
    - ✓ 工具注册表测试通过（注册、获取、清空）
    - ✓ Agent Graph 创建测试通过
    - ✓ OpenRouter API 集成测试通过（直接测试脚本成功）
    - ✓ Chat API 功能测试通过（使用 Gemini 3 Flash Preview 模型）
  - **配置**: `.env.local` 已配置 OpenRouter API Key 和模型

- **2024-12-XX**: Phase 1 完成 ✅
  - 初始化 Next.js 项目（Tailwind 4 + DaisyUI）
  - 创建基础布局组件（Sidebar + Page）
  - 配置路由（/agents, /settings）
  - **测试**: 运行 `npm run build` 构建成功 ✅
  - **测试**: 所有路由正常工作 ✅

---

*详细任务清单请查看 [开发计划](./docs/development/plan.md)*

## 开发规范

### 代码风格指南

**所有代码必须遵循 [代码风格指南](./docs/development/code-styleguide.md)**

代码风格指南包含以下核心规范：

1. **TypeScript 类型安全**
   - 不轻易使用 `any` 和 lint disable
   - 保持类型严谨性
   - 详细规范请查看 [代码风格指南 - TypeScript 规范](./docs/development/code-styleguide.md#typescript-规范)

2. **错误处理机制**
   - 使用统一的 Result 模式处理错误（`lib/utils/errors.ts`）
   - 避免频繁使用 try-catch
   - 详细规范请查看 [代码风格指南 - 错误处理](./docs/development/code-styleguide.md#错误处理)

3. **函数设计**
   - 函数不超过 100 行
   - 单一职责原则
   - 详细规范请查看 [代码风格指南 - 函数设计](./docs/development/code-styleguide.md#函数设计)

4. **代码可读性**
   - 清晰的命名
   - 合理的代码组织
   - 有意义的注释
   - 详细规范请查看 [代码风格指南 - 代码可读性](./docs/development/code-styleguide.md#代码可读性)

5. **其他规范**
   - 命名规范、文件组织、导入顺序、类型定义、测试规范等
   - 详细内容请查看 [代码风格指南](./docs/development/code-styleguide.md)

### Git 提交规范

**提交信息格式**：
- 使用英文提交信息
- 只写简洁的 message，不需要详细描述
- 格式：`<动词> <对象>: <简要描述>`
- 示例：
  - `Improve chat UI: remove sticky, add memory, update styles`
  - `Fix markdown rendering: unify styles and fix spacing`
  - `Add multi-turn conversation memory support`

---

### 测试要求

**重要原则：每个功能完成后必须测试通过才能继续下一个功能或阶段**

#### 测试流程

1. **功能完成时**
   - 必须提供可测试的方式（例如：启动开发服务器、运行测试命令、手动测试步骤等）
   - 必须自己完成测试验证
   - 测试通过后才能标记任务为完成

2. **测试内容**
   - 功能是否按预期工作
   - 是否有明显的错误或 Bug
   - 是否影响现有功能
   - 代码是否能正常构建

3. **测试记录**
   - 在完成功能时，记录测试方式和测试结果
   - 在 `AGENTS.md` 的"最近更新"中记录测试情况
   - 如有问题，必须先修复再继续

4. **阶段完成时**
   - 整个 Phase 完成后，必须进行完整的集成测试
   - 确保所有功能协同工作正常
   - 测试通过后才能进入下一个 Phase

#### 测试方式示例

- **前端功能**: 启动 `npm run dev`，在浏览器中手动测试
- **API 功能**: 使用 curl、Postman 或编写简单测试脚本
- **构建测试**: 运行 `npm run build` 确保构建成功
- **类型检查**: 运行 TypeScript 类型检查确保无类型错误

---

## 需求变更管理

### 变更流程

当需求发生变化时，需要同步更新以下文档：

1. **功能文档** (`docs/features/*.md`)
   - 更新相关功能描述
   - 更新实现要点
   - 更新待补充内容

2. **设计文档** (`docs/design/*.md`)
   - 更新 UI/UX 设计规范
   - 更新界面布局和交互设计

3. **架构文档** (`docs/architecture/*.md`)
   - 更新架构概述
   - 更新技术栈选择

4. **开发计划** (`docs/development/plan.md`)
   - 更新任务清单（添加/删除/修改任务）
   - 调整开发顺序（如有必要）
   - 更新任务描述

5. **本文档** (`AGENTS.md`)
   - 更新项目概述和核心功能
   - 更新文档索引
   - 记录变更历史（见下方）

### 变更记录

| 日期 | 变更内容 | 影响文档 | 更新人 |
|------|---------|---------|--------|
| - | - | - | - |

---

*需求变更时，请按照上述流程更新所有相关文档，确保文档一致性。*

## Agents 列表

（待补充具体 Agent 定义）

---

*本文档将随着功能定义的增加而持续更新。*
