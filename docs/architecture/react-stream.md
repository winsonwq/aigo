# ReAct Stream 架构文档

## 概述

ReAct workflow 的流式处理是本项目的核心功能。本文档描述了流式处理的架构设计，使用最佳实践，合理抽象，易于修改和扩展。

## 架构层次

### 1. 类型定义层 (`lib/agent/react-types.ts`)

定义所有 ReAct 工作流相关的类型：

- `ReActStepType`: 步骤类型（thought, tool_call, observation, final_answer）
- `ToolCallInfo`: 工具调用信息
- `ReActStep`: ReAct 工作流步骤
- `StreamEvent`: 流式事件（react_step 或 content）

### 2. 事件处理层 (`lib/agent/event-processor.ts`)

负责将 LangGraph 的原始事件转换为 ReAct 步骤：

- `ToolArgsParser`: 工具参数解析器（处理嵌套 JSON 字符串）
- `MessageContentExtractor`: 消息内容提取器
- `LangGraphEventProcessor`: LangGraph 事件处理器
  - `processChainStart()`: 处理节点开始事件
  - `processChainEnd()`: 处理节点结束事件
  - `processLLMStream()`: 处理 LLM 流式内容

### 3. 流式处理层 (`lib/agent/stream-handler.ts`)

负责将事件处理器的输出转换为 SSE 流式响应：

- `ReActStreamHandler`: 流式处理器
  - `processStream()`: 处理 LangGraph 流式事件
  - `formatSSE()`: 格式化 SSE 事件
  - `createReadableStream()`: 创建 ReadableStream

### 4. API 路由层 (`app/api/chat/route.ts`)

简洁的 API 路由，使用流式处理器：

```typescript
const streamHandler = new ReActStreamHandler({
  enableDebugLogs: process.env.NODE_ENV === "development",
});

const streamEvents = await agent.streamEvents(initialState, {
  version: "v2",
});

const stream = streamHandler.createReadableStream(streamEvents);
```

## 数据流

```
LangGraph Agent
    ↓ streamEvents()
LangGraphEventProcessor
    ↓ processChainStart/End()
ReActStep[]
    ↓ formatSSE()
SSE Stream
    ↓
Frontend (ChatContainer)
```

## 设计原则

1. **单一职责**: 每个类/函数只负责一个功能
2. **易于测试**: 每个组件都可以独立测试
3. **易于扩展**: 新增事件类型只需扩展 `EventProcessor`
4. **类型安全**: 使用 TypeScript 严格类型
5. **错误处理**: 统一的错误处理机制

## 扩展指南

### 添加新的事件类型

1. 在 `react-types.ts` 中添加新的 `ReActStepType`
2. 在 `event-processor.ts` 中添加处理逻辑
3. 在 `stream-handler.ts` 中确保新事件被正确处理

### 修改事件处理逻辑

只需修改 `LangGraphEventProcessor` 中的相应方法，不影响其他层。

### 添加新的流式格式

扩展 `StreamEvent` 类型，并在 `stream-handler.ts` 中添加格式化逻辑。

## 最佳实践

1. **参数解析**: 使用 `ToolArgsParser` 统一处理工具参数
2. **内容提取**: 使用 `MessageContentExtractor` 统一提取消息内容
3. **错误处理**: 在流式处理中通过 SSE 发送错误事件
4. **调试日志**: 使用 `enableDebugLogs` 配置控制日志输出

## 测试建议

1. **单元测试**: 测试 `EventProcessor` 的各个方法
2. **集成测试**: 测试完整的流式处理流程
3. **端到端测试**: 测试前端接收和显示流式数据
