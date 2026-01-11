/**
 * LangGraph 事件处理器
 * 
 * 负责将 LangGraph 的 streamEvents 转换为 ReAct 工作流步骤
 * 使用策略模式，易于扩展和维护
 */

import { AIMessage, HumanMessage, BaseMessage, AIMessageChunk } from "@langchain/core/messages";
import { ReActStep, ToolCallInfo, ReActStepType } from "./react-types";

/**
 * LangGraph 事件数据接口
 */
export interface LangGraphEvent {
  event: string;
  name?: string;
  data?: {
    input?: {
      messages?: BaseMessage[];
    };
    output?: {
      messages?: BaseMessage[];
    };
    chunk?: unknown;
  };
}

/**
 * 事件处理器上下文
 */
export interface EventProcessorContext {
  currentStepId: string;
  currentToolCall: ToolCallInfo | null;
}

/**
 * 工具参数解析器
 */
export class ToolArgsParser {
  /**
   * 解析工具参数（处理嵌套 JSON 字符串）
   */
  static parse(args: unknown): Record<string, unknown> {
    if (!args) {
      return {};
    }

    if (typeof args === "string") {
      try {
        const parsed = JSON.parse(args);
        // 如果解析后仍然是字符串，再次尝试解析
        if (typeof parsed === "string") {
          try {
            return JSON.parse(parsed);
          } catch {
            return { input: parsed };
          }
        }
        if (typeof parsed === "object" && parsed !== null) {
          return parsed as Record<string, unknown>;
        }
        return { input: args };
      } catch {
        return { input: args };
      }
    }

    if (typeof args === "object" && args !== null) {
      return args as Record<string, unknown>;
    }

    return {};
  }
}

/**
 * 消息内容提取器
 */
export class MessageContentExtractor {
  /**
   * 从消息中提取文本内容
   * 支持 HumanMessage、AIMessage 和 AIMessageChunk
   */
  static extract(msg: BaseMessage): string {
    // 支持 HumanMessage、AIMessage 和 AIMessageChunk
    if (msg instanceof HumanMessage || msg instanceof AIMessage || msg instanceof AIMessageChunk) {
      const content = msg.content;
      
      if (typeof content === "string") {
        return content;
      }
      
      if (Array.isArray(content)) {
        return content
          .map((item) => {
            if (typeof item === "string") return item;
            if (item && typeof item === "object" && "text" in item) {
              return String(item.text);
            }
            return JSON.stringify(item);
          })
          .join("");
      }
      
      return String(content);
    }
    
    return "";
  }
}

/**
 * LangGraph 事件处理器
 */
export class LangGraphEventProcessor {
  private context: EventProcessorContext;

  constructor() {
    this.context = {
      currentStepId: "",
      currentToolCall: null,
    };
  }

  /**
   * 处理节点开始事件
   */
  processChainStart(event: LangGraphEvent): ReActStep | null {
    const nodeName = event.name || "";

    // Thought 节点开始
    // 不在节点开始时创建"正在思考..."步骤，而是在节点结束时创建
    // 这样可以避免多次显示"正在思考..."，并且只在有实际内容时才显示思考步骤
    if (nodeName === "thought") {
      // 为这个 thought 节点分配一个 stepId，但不创建步骤
      // 节点结束时如果有实际内容，会创建或更新步骤
      if (!this.context.currentStepId) {
        this.context.currentStepId = `thought-${Date.now()}-${Math.random()}`;
      }
      // 不返回步骤，等待节点结束时再创建
      return null;
    }

    // Tools 节点开始 - 尝试从输入中提取工具调用信息
    // 注意：工具调用信息可能在 thought 节点的输出中，而不是 tools 节点的输入中
    if (nodeName === "tools") {
      // 首先尝试从输入中提取
      const step = this.extractToolCallFromInput(event);
      if (step) {
        return step;
      }
      
      // 如果输入中没有，尝试从状态中提取（tools 节点的输入是完整状态）
      // LangGraph 的 tools 节点输入包含完整的 messages 数组
      const stateMessages = event.data?.input?.messages;
      if (stateMessages && stateMessages.length > 0) {
        // 查找最后一个包含 tool_calls 的 AIMessage 或 AIMessageChunk
        for (let i = stateMessages.length - 1; i >= 0; i--) {
          const msg = stateMessages[i];
          const isAIMessage = msg instanceof AIMessage || msg instanceof AIMessageChunk;
          const hasToolCalls = isAIMessage && "tool_calls" in msg && msg.tool_calls && msg.tool_calls.length > 0;
          if (hasToolCalls) {
            const toolCalls = msg.tool_calls || [];
            if (toolCalls.length === 0) {
              continue;
            }
            // 处理所有工具调用（不只是第一个）
            // 注意：这里我们只返回第一个工具调用，因为 processChainStart 只能返回一个步骤
            // 多个工具调用会在最终状态提取时处理
            const toolCall = toolCalls[0];
            const toolArgs = ToolArgsParser.parse(toolCall.args);
            
            this.context.currentToolCall = {
              name: toolCall.name || "unknown",
              arguments: toolArgs,
              status: "running",
            };

            const stepId = `tool_call-${toolCall.name || "unknown"}-${toolCall.id || Date.now()}`;

            return {
              id: stepId,
              type: "tool_call",
              content: `调用工具: ${toolCall.name || "unknown"}`,
              timestamp: Date.now(),
              toolCall: { ...this.context.currentToolCall },
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * 处理节点结束事件
   */
  processChainEnd(event: LangGraphEvent): ReActStep | null {
    const nodeName = event.name || "";

    // Thought 节点结束
    if (nodeName === "thought") {
      return this.extractThoughtFromOutput(event);
    }

    // Tools 节点结束 - 提取观察结果
    if (nodeName === "tools") {
      return this.extractObservationFromOutput(event);
    }

    return null;
  }

  /**
   * 从输入中提取工具调用信息
   */
  private extractToolCallFromInput(event: LangGraphEvent): ReActStep | null {
    const inputMessages = event.data?.input?.messages;
    if (!inputMessages || inputMessages.length === 0) {
      return null;
    }

    const lastMsg = inputMessages[inputMessages.length - 1];
    
    // 处理 AIMessage 和 AIMessageChunk
    const isAIMessage = lastMsg instanceof AIMessage || lastMsg instanceof AIMessageChunk;
    if (!isAIMessage) {
      return null;
    }

    const hasToolCalls = "tool_calls" in lastMsg && lastMsg.tool_calls && lastMsg.tool_calls.length > 0;
    if (!hasToolCalls) {
      return null;
    }

    // 处理第一个工具调用（通常一次只调用一个工具）
    // 注意：如果有多个工具调用，它们会在最终状态提取时处理
    const toolCalls = lastMsg.tool_calls || [];
    if (toolCalls.length === 0) {
      return null;
    }
    const toolCall = toolCalls[0];
    const toolArgs = ToolArgsParser.parse(toolCall.args);
    
    this.context.currentToolCall = {
      name: toolCall.name || "unknown",
      arguments: toolArgs,
      status: "running",
    };

    // 使用 toolCall.id 作为 stepId 的一部分，确保唯一性和可匹配性
    const stepId = `tool_call-${toolCall.name || "unknown"}-${toolCall.id || Date.now()}`;

    return {
      id: stepId,
      type: "tool_call",
      content: `调用工具: ${toolCall.name || "unknown"}`,
      timestamp: Date.now(),
      toolCall: { ...this.context.currentToolCall },
    };
  }

  /**
   * 从输出中提取思考内容
   */
  private extractThoughtFromOutput(event: LangGraphEvent): ReActStep | null {
    const outputMessages = event.data?.output?.messages;
    if (!outputMessages || outputMessages.length === 0) {
      return null;
    }

    const thoughtMsg = outputMessages[0];
    
    // 处理 AIMessage 和 AIMessageChunk（流式输出时可能是 Chunk 类型）
    const isAIMessage = thoughtMsg instanceof AIMessage || thoughtMsg instanceof AIMessageChunk;
    if (!isAIMessage) {
      return null;
    }

    // 提取思考内容（无论是否有工具调用，都应该显示思考内容）
    const content = MessageContentExtractor.extract(thoughtMsg);
    
    // 检查是否有工具调用
    const hasToolCalls = "tool_calls" in thoughtMsg && thoughtMsg.tool_calls && thoughtMsg.tool_calls.length > 0;
    
    if (!this.context.currentStepId) {
      // 如果没有 currentStepId，创建一个新的
      this.context.currentStepId = `thought-${Date.now()}-${Math.random()}`;
    }

    // 提取思考内容
    // 注意：根据 LangChain 的行为，当 LLM 有 tool_calls 时，content 字段通常是空的
    // 但我们的系统提示词要求 LLM 在调用工具前先说明推理过程
    // 如果 content 为空，我们从 tool_calls 生成一个描述性的思考内容
    let finalContent = content && content.trim().length > 0 ? content : null;
    
    // 如果没有内容但有工具调用，生成一个描述性的思考内容
    if (!finalContent && hasToolCalls) {
      const toolCalls = thoughtMsg.tool_calls || [];
      const toolNames = toolCalls.map((tc: { name?: string }) => tc.name || "工具").join("、");
      finalContent = `我需要使用 ${toolNames} 来完成这个任务。`;
    }

    // 如果仍然没有内容，返回 null（不创建步骤，避免显示"正在思考..."）
    if (!finalContent) {
      // 清除 currentStepId，以便下一个 thought 节点可以创建新步骤
      this.context.currentStepId = "";
      return null; // 不创建步骤
    }

    // 返回思考步骤（使用 currentStepId）
    // 更新后，清除 currentStepId，以便下一个 thought 节点可以创建新步骤
    const stepId = this.context.currentStepId;
    this.context.currentStepId = ""; // 清除，以便下一个 thought 节点可以创建新步骤
    
    return {
      id: stepId,
      type: "thought",
      content: finalContent,
      timestamp: Date.now(),
    };
  }

  /**
   * 从输出中提取观察结果
   */
  private extractObservationFromOutput(event: LangGraphEvent): ReActStep | null {
    const inputMessages = event.data?.input?.messages;
    const outputMessages = event.data?.output?.messages;

    if (!inputMessages || !outputMessages || outputMessages.length === 0) {
      return null;
    }

    // 从输入中获取工具调用信息
    const lastInputMsg = inputMessages[inputMessages.length - 1];
    const isAIMessage = lastInputMsg instanceof AIMessage || lastInputMsg instanceof AIMessageChunk;
    const hasToolCalls = isAIMessage && "tool_calls" in lastInputMsg && lastInputMsg.tool_calls && lastInputMsg.tool_calls.length > 0;
    
    if (!hasToolCalls) {
      return null;
    }

    const toolCalls = lastInputMsg.tool_calls || [];
    if (toolCalls.length === 0) {
      return null;
    }
    const toolCall = toolCalls[0];
    const toolArgs = ToolArgsParser.parse(toolCall.args);

    // 从输出中提取工具执行结果
    const resultMsg = outputMessages.find((msg) => msg instanceof HumanMessage);
    if (!resultMsg) {
      return null;
    }

    const observationContent = MessageContentExtractor.extract(resultMsg);

    // 使用与工具调用步骤相同的 ID 格式，确保它们可以匹配
    const stepId = `observation-${toolCall.name || "unknown"}-${toolCall.id || Date.now()}`;

    return {
      id: stepId,
      type: "observation",
      content: `工具执行结果: ${observationContent}`,
      timestamp: Date.now(),
      toolCall: {
        name: toolCall.name || "unknown",
        arguments: toolArgs,
        result: observationContent,
        status: "completed",
      },
    };
  }

  /**
   * 处理 LLM 流式内容
   * 注意：ReAct 工作流中，每次 thought 节点都会调用 LLM
   * - 第一次调用：决定是否调用工具（应该捕获思考内容，即使有工具调用）
   * - 后续调用：基于观察结果给出最终回答（应该流式显示）
   * 
   * 我们通过检查当前上下文是否有工具调用来判断：
   * - 如果有 currentToolCall：说明这是第一次思考，但我们仍然应该捕获内容来更新"正在思考..."
   * - 如果没有 currentToolCall：说明这是最终回答，应该流式显示
   */
  processLLMStream(event: LangGraphEvent): string | null {
    // 检查是否是 thought 节点内的 LLM 调用
    // event.name 可能是 "ChatOpenAI" 或其他 LLM 名称
    // 我们需要通过其他方式判断（比如检查当前上下文）
    
    // 注意：即使有工具调用，我们也应该捕获流式内容来更新思考步骤
    // 这样可以避免一直显示"正在思考..."
    // 但我们需要将这些内容累积起来，在节点结束时更新思考步骤
    
    const chunk = event.data?.chunk;
    if (!chunk) {
      return null;
    }

    // 处理不同类型的 chunk
    let content: string | null = null;
    
    if (typeof chunk === "string") {
      content = chunk;
    } else if (chunk && typeof chunk === "object" && "content" in chunk) {
      if (typeof chunk.content === "string") {
        content = chunk.content;
      } else if (Array.isArray(chunk.content)) {
        content = chunk.content
          .map((item) => {
            if (typeof item === "string") return item;
            if (item && typeof item === "object" && "text" in item) {
              return String(item.text);
            }
            return "";
          })
          .join("");
      }
    }

    // 如果有内容，返回它（即使有工具调用，也返回内容以便更新思考步骤）
    if (content) {
      return content;
    }

    return null;
  }

  /**
   * 重置上下文（用于新的对话）
   */
  reset(): void {
    this.context = {
      currentStepId: "",
      currentToolCall: null,
    };
  }
}
