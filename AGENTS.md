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

## 开发进度

### 整体进度

- [x] **Phase 1: 项目初始化** 🏗️ (14/14) ✅
- [ ] **Phase 2: Agent 引擎核心** 🔧 (0/18)
- [ ] **Phase 3: 对话 UI** 💬 (0/17)
- [ ] **Phase 4: Session 管理** 📚 (0/13)
- [ ] **Phase 5: 配置功能** ⚙️ (0/35)
  - [ ] MCP 配置 (0/14)
  - [ ] Skills 配置 (0/13)
  - [ ] Models 配置 (0/13)
- [ ] **Phase 6: 记忆功能** 🧠 (0/10)
- [ ] **Phase 7: UI/UX 优化** ✨ (0/13)
- [ ] **Phase 8: 测试和文档** 📝 (0/10)

**总进度**: 14/130 任务完成

### 里程碑状态

- [ ] **Milestone 1**: MVP 完成（Phase 1-4）- 基础对话功能可用
- [ ] **Milestone 2**: 扩展功能完成（Phase 5）- 完整配置功能
- [ ] **Milestone 3**: 项目完成（Phase 6-8）- 生产就绪

### 最近更新

- **2024-12-XX**: Phase 1 完成 ✅
  - 初始化 Next.js 项目（Tailwind 4 + DaisyUI）
  - 创建基础布局组件（Sidebar + Page）
  - 配置路由（/agents, /settings）
  - 项目构建测试通过

---

*详细任务清单请查看 [开发计划](./docs/development/plan.md)*

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
