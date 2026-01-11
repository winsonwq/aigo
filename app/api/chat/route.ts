// Chat API Route - 支持流式输出

import { NextRequest, NextResponse } from "next/server";
import { tryCatch } from "@/lib/api-handler";
import { ApiError } from "@/lib/api-error";
import { createAgent } from "@/lib/agent/graph";
import { HumanMessage, BaseMessage } from "@langchain/core/messages";
import { toolRegistry } from "@/lib/tools/registry";
import { calculatorTool } from "@/lib/tools/test-tool";
import type { MessagesAnnotation } from "@langchain/langgraph";
import { ReActStreamHandler } from "@/lib/agent/stream-handler";

// 注册测试工具（只在首次导入时注册一次）
if (toolRegistry.getAllTools().length === 0) {
  toolRegistry.register(calculatorTool);
}

/**
 * POST /api/chat
 * Body: { message: string, sessionId?: string, stream?: boolean }
 */
export const POST = tryCatch(async function (request: NextRequest) {
  let body: {
    message?: string;
    sessionId?: string;
    stream?: boolean;
  };

  try {
    body = await request.json();
  } catch (error) {
    throw ApiError.badRequest("Invalid JSON in request body", "INVALID_JSON");
  }

  const { message, sessionId, stream: shouldStream } = body;

  // 验证必需参数
  if (!message || typeof message !== "string") {
    throw ApiError.badRequest("Message is required and must be a string", "MISSING_MESSAGE");
  }

  // 创建 ReAct Agent（使用 LangGraph 实现的 ReAct workflow）
  // ReAct 模式：Thought -> Tool Call -> Observation -> Thought (循环)
  const agent = createAgent(10);

  // 创建初始状态（只包含 messages，其他字段使用默认值）
  const initialState = {
    messages: [new HumanMessage(message)],
  };

  // 如果请求流式输出，直接返回流式响应（流式响应内部有自己的错误处理）
  if (shouldStream) {
    return streamResponse(agent, initialState);
  }

  // 非流式响应
  try {
    const finalState = (await agent.invoke(initialState)) as typeof MessagesAnnotation.State;
    const lastMessage = finalState.messages[finalState.messages.length - 1];

    return NextResponse.json({
      content: lastMessage && "content" in lastMessage ? lastMessage.content : "",
      messages: finalState.messages.map((msg) => ({
        role: msg.constructor.name.replace("Message", "").toLowerCase(),
        content: "content" in msg ? msg.content : "",
      })),
    });
  } catch (error) {
    // Agent 调用失败
    const errorMessage =
      error instanceof Error ? error.message : "Failed to invoke agent";
    throw ApiError.internal(`Agent invocation failed: ${errorMessage}`, "AGENT_INVOCATION_ERROR", {
      originalError: errorMessage,
    });
  }
});

/**
 * 流式响应函数
 * 使用 ReActStreamHandler 处理 LangGraph 流式事件
 */
async function streamResponse(
  agent: ReturnType<typeof createAgent>,
  initialState: { messages: BaseMessage[] }
): Promise<Response> {
  const streamHandler = new ReActStreamHandler();

  try {
    // 创建 ReadableStream
    const stream = streamHandler.createReadableStream(agent, initialState);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    // 流式响应创建失败，返回错误响应
    const errorMessage = error instanceof Error ? error.message : "Stream creation failed";
    throw ApiError.internal(`Failed to create stream: ${errorMessage}`, "STREAM_ERROR", {
      originalError: errorMessage,
    });
  }
}
