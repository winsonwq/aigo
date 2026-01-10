// LangGraph ReAct 循环实现

import { StateGraph, END, START, MessagesAnnotation, Annotation } from "@langchain/langgraph";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { toolRegistry } from "../tools/registry";

// 定义 Agent 状态（使用 MessagesAnnotation，暂时不扩展额外字段）
// 迭代次数通过节点内部管理
type ReActState = typeof MessagesAnnotation.State;

// 创建 LLM（优先使用 OpenRouter）
function createLLM() {
  // 优先使用 OpenRouter
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    // OpenRouter 配置：使用 configuration 字段
    return new ChatOpenAI({
      model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
      apiKey: openRouterKey,
      temperature: 0.7,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": process.env.OPENROUTER_REFERER || "https://github.com/aigo",
          "X-Title": process.env.OPENROUTER_TITLE || "AIGO",
        },
      },
    });
  }

  // 回退到 OpenAI
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY or OPENAI_API_KEY environment variable is required");
  }

  return new ChatOpenAI({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    apiKey: apiKey,
    temperature: 0.7,
  });
}

// Thought 节点：AI 思考需要做什么
async function thoughtNode(state: ReActState): Promise<Partial<ReActState>> {
  const llm = createLLM();
  const tools = toolRegistry.getAllTools();

  // 绑定工具到 LLM
  const llmWithTools = tools.length > 0 ? llm.bindTools(tools) : llm;

  // 构建消息（如果没有系统消息，添加一个）
  const messages = state.messages.length > 0 && state.messages[0] instanceof SystemMessage
    ? state.messages
    : [
        new SystemMessage(
          "You are a helpful AI assistant. You can use tools to help answer questions. " +
            "Think step by step about what you need to do, then use tools if needed."
        ),
        ...state.messages,
      ];

  // 调用 LLM
  const response = await llmWithTools.invoke(messages);

  return {
    messages: [response],
  };
}

// Tool Call 节点：执行工具调用
async function toolCallNode(state: ReActState): Promise<Partial<ReActState>> {
  const messages = state.messages || [];
  const lastMessage = messages[messages.length - 1];

  if (!lastMessage || !("tool_calls" in lastMessage) || !(lastMessage as AIMessage).tool_calls?.length) {
    // 没有工具调用，直接返回
    return {};
  }

  const toolCalls = (lastMessage as AIMessage).tool_calls!;
  const toolResults = [];

  for (const toolCall of toolCalls) {
    const tool = toolRegistry.getTool(toolCall.name);
    if (!tool) {
      toolResults.push({
        tool_call_id: toolCall.id,
        content: `Tool ${toolCall.name} not found`,
      });
      continue;
    }

    try {
      const result = await tool.invoke(toolCall.args);
      toolResults.push({
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    } catch (error) {
      toolResults.push({
        tool_call_id: toolCall.id,
        content: `Error: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  // 返回工具结果消息（LangGraph 会自动合并到 messages）
  return {
    messages: [
      new HumanMessage({
        content: toolResults.map((r) => r.content).join("\n"),
      }),
    ],
  };
}

// 判断是否需要继续（条件路由）
// 注意：迭代次数限制由 LangGraph 的配置管理，这里只判断是否需要调用工具
function shouldContinue(state: ReActState): string {
  const messages = state.messages || [];
  const lastMessage = messages[messages.length - 1];

  // 如果有工具调用，继续执行工具
  if (lastMessage && "tool_calls" in lastMessage && (lastMessage as AIMessage).tool_calls?.length) {
    return "tools";
  }

  // 否则结束
  return "end";
}

// 创建 ReAct Graph
export function createReActGraph(maxIterations: number = 10) {
  // 使用 MessagesAnnotation（简化版本）
  // 注意：maxIterations 参数保留用于未来扩展，当前由 LangGraph 内部管理迭代
  // 使用链式调用让 TypeScript 正确推断节点类型
  const workflow = new StateGraph(MessagesAnnotation)
    .addNode("thought", thoughtNode)
    .addNode("tools", toolCallNode)
    .addEdge(START, "thought")
    .addConditionalEdges("thought", shouldContinue, {
      tools: "tools",
      end: END,
    })
    .addEdge("tools", "thought");

  return workflow.compile();
}

// 创建 Agent 实例
export function createAgent(maxIterations: number = 10) {
  return createReActGraph(maxIterations);
}
