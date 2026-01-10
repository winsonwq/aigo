# 对话功能

## 概述

对话功能是应用的核心功能，提供类似 **Gemini Chat / ChatGPT** 的对话交互体验。与传统的 AI 聊天工具不同，**所有对话都基于 ReAct Agent 模式**，这意味着 AI 可以自动调用 MCP 工具和自定义 Skills 来完成复杂任务。

参考了 **Manus** 的设计思路，将 Agent 能力无缝集成到对话体验中。

## 核心特性

### 对话体验
- **类似 ChatGPT/Gemini 的界面**: 简洁的对话界面，消息气泡式布局
- **实时对话交互**: 支持多轮对话，保持上下文
- **流式响应**: 实时显示 AI 回复，提升用户体验
- **消息历史**: 完整的对话历史记录

### ReAct Agent 能力
- **自动工具调用**: AI 可以根据对话内容自动决定是否需要调用工具
- **MCP 工具集成**: 自动使用已配置的 MCP Server 工具
- **Skills 扩展**: 支持使用自定义 Skills 增强能力
- **透明化展示**: 显示 AI 的思考过程（Thought）和工具调用过程

## 实现要点

### 技术架构
- **LangGraph**: 使用 LangGraph 实现 ReAct 循环
  - Thought -> Tool Call -> Observation -> Thought
- **@langchain/mcp-adapters**: 将 MCP Server 工具转换为 LangChain DynamicTool
- **流式输出**: 支持流式输出 Thought、Tool Call 和最终回复

### 工作流程
1. 用户输入消息
2. AI 进入 ReAct 循环：
   - **Thought**: AI 思考需要做什么
   - **Tool Call**: 如果需要，调用相关工具（MCP 工具或 Skills）
   - **Observation**: 获取工具执行结果
   - **Thought**: 基于结果继续思考
   - 重复直到得出最终答案
3. 流式输出最终回复给用户

### 工具调用展示
- 在对话中显示工具调用过程（可选，可折叠）
- 显示工具名称、参数、执行结果
- 用户可以看到 AI 的推理过程

## 与 ChatGPT/Gemini 的区别

| 特性 | ChatGPT/Gemini | 本项目 |
|------|---------------|--------|
| 对话模式 | 纯文本对话 | ReAct Agent 模式 |
| 工具调用 | 需要手动触发或特定模式 | 自动智能调用 |
| 能力扩展 | 有限 | 通过 MCP 和 Skills 无限扩展 |
| 推理过程 | 不透明 | 可选的透明化展示 |

## 待补充

- 工具调用的 UI 展示方式
- 思考过程的展示粒度
- 工具调用的权限控制
- 错误处理和重试机制
