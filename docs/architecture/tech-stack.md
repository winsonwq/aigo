# 技术栈

## 前端框架

- **Next.js**: React 全栈框架
- **React**: UI 库
- **DaisyUI**: Tailwind CSS 组件库
- **React Icons**: 图标库（具体库待定）

## Agent 核心库

- **@langchain/mcp-adapters**: 官方提供的 MCP Server 桥接库，将 MCP Server 工具转换为 LangChain DynamicTool
- **@langchain/langgraph**: 用于实现 ReAct 循环，相比传统 AgentExecutor 更稳定且易于调试

## 核心能力

- 无需手动重写 ReAct 逻辑，直接使用 LangGraph
- 通过 @langchain/mcp-adapters 一键转换 MCP 工具

## 待补充

（待详细定义）
