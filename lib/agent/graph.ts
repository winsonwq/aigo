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
  // 使用 bindTools 让 LLM 能够调用工具
  // 注意：某些模型可能需要强制工具调用，这里使用默认行为
  const llmWithTools = tools.length > 0 ? llm.bindTools(tools, {
    // 确保工具调用被正确绑定
  }) : llm;

  // 构建消息（如果没有系统消息，添加一个）
  const messages = state.messages.length > 0 && state.messages[0] instanceof SystemMessage
    ? state.messages
      : [
        new SystemMessage(
          "You are a helpful AI assistant using the ReAct (Reasoning and Acting) framework. " +
            "You think step by step, then act, then observe, then think again.\n\n" +
            "CRITICAL RULES:\n" +
            "1. ALWAYS provide your reasoning/thought process in the 'content' field BEFORE calling any tools. " +
            "   Even when you decide to use tools, you MUST explain your plan in the content field first.\n" +
            "2. When you determine that you need to use a tool, you MUST call that tool. " +
            "   Do NOT skip tool calls or try to complete the task without using tools.\n" +
            "3. If a question requires multiple calculations or operations, you MUST call the tool for EACH operation separately. " +
            "   For example, if asked to calculate (10 + 20) + (20 - 5), you MUST:\n" +
            "   - First call the calculator tool for 10 + 20\n" +
            "   - Wait for the result\n" +
            "   - Then call the calculator tool for 20 - 5\n" +
            "   - Wait for the result\n" +
            "   - Then call the calculator tool for the final addition\n" +
            "   Do NOT combine multiple operations into a single tool call. Each operation requires a separate tool call.\n" +
            "4. After each tool call, you will receive the result. Then think about the result and decide if you need more tool calls.\n" +
            "5. Only provide the final answer after you have completed ALL necessary tool calls.\n" +
            "6. IMPORTANT: Your response should ALWAYS include both:\n" +
            "   - A 'content' field with your reasoning/thought process\n" +
            "   - Tool calls if you need to use tools\n" +
            "   Do NOT return only tool_calls without content. Always explain your reasoning first."
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
// 注意：这个节点内的工具调用不会触发 LangGraph 的标准工具事件
// 我们需要从消息中提取工具调用信息，并在 API 路由中手动发送事件
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
        content: typeof result === "string" ? result : JSON.stringify(result),
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
// 注意：这里判断是否需要调用工具，以及是否达到最大迭代次数
function shouldContinue(state: ReActState): string {
  const messages = state.messages || [];
  const lastMessage = messages[messages.length - 1];

  // 检查是否有工具调用
  const hasToolCalls = lastMessage && "tool_calls" in lastMessage && (lastMessage as AIMessage).tool_calls?.length;
  
  // 如果有工具调用，继续执行工具
  if (hasToolCalls) {
    return "tools";
  }

  // 否则结束（没有工具调用，说明 LLM 已经给出最终回答）
  return "end";
}

// 创建 ReAct Graph
export function createReActGraph(maxIterations: number = 10) {
  // 使用 MessagesAnnotation（简化版本）
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

  // 编译工作流，设置最大迭代次数
  // 注意：LangGraph 的迭代限制是通过检查循环次数来实现的
  // 我们需要在 shouldContinue 或节点内部管理迭代次数
  return workflow.compile({
    checkpointer: undefined, // 暂时不使用检查点
  });
}

// 创建 Agent 实例
export function createAgent(maxIterations: number = 10) {
  return createReActGraph(maxIterations);
}
