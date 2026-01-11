/**
 * ReAct Stream 处理器
 * 
 * 负责将 LangGraph 的流式执行转换为 SSE 流式响应
 * 使用清晰的抽象，易于测试和修改
 */

import { BaseMessage, AIMessage, HumanMessage, AIMessageChunk } from "@langchain/core/messages";
import { LangGraphEventProcessor, ToolArgsParser, MessageContentExtractor } from "./event-processor";
import { StreamEvent, ReActStepEvent, ContentEvent } from "./react-types";

/**
 * Stream 处理器配置
 */
export interface StreamHandlerConfig {
  // 配置选项（保留接口以便未来扩展）
}

/**
 * ReAct Stream 处理器
 */
export class ReActStreamHandler {
  private eventProcessor: LangGraphEventProcessor;
  private config: StreamHandlerConfig;

  constructor(config: StreamHandlerConfig = {}) {
    this.eventProcessor = new LangGraphEventProcessor();
    this.config = config;
  }

  /**
   * 处理 LangGraph 流式事件并转换为 StreamEvent
   * @returns 返回 StreamEvent 和最终状态
   */
  private async* processStream(
    streamEvents: AsyncIterable<{
      event: string;
      name?: string;
      data?: {
        input?: { messages?: BaseMessage[] };
        output?: { messages?: BaseMessage[] };
        chunk?: unknown;
      };
    }>
  ): AsyncGenerator<{ event: StreamEvent; finalState: { messages: BaseMessage[] } | null }> {
    // 重置处理器状态
    this.eventProcessor.reset();
    
    // 用于跟踪已生成的思考内容（避免重复）
    const generatedThoughtContents = new Set<string>();

    let accumulatedContent = "";
    let finalState: { messages: BaseMessage[] } | null = null;

    for await (const event of streamEvents) {
      // 处理节点开始事件
      if (event.event === "on_chain_start") {
        // 对于 tools 节点，跳过 processChainStart 中的工具调用步骤
        // 因为我们会在 processChainEnd 中处理所有工具调用
        if (event.name === "tools") {
          // 不处理，等待 chain_end 事件
        } else {
          const step = this.eventProcessor.processChainStart(event);
          if (step) {
            yield { event: { type: "react_step", step }, finalState: null };
          }
        }
      }

      // 处理节点结束事件
      if (event.event === "on_chain_end") {
        
        // 如果是 tools 节点结束，需要提取所有工具调用和观察结果
        if (event.name === "tools") {
          const inputMessages = event.data?.input?.messages;
          const outputMessages = event.data?.output?.messages;
          
          if (inputMessages && outputMessages) {
            // 查找最后一个包含 tool_calls 的 AIMessage
            let lastToolCallMsg: (AIMessage | AIMessageChunk) | null = null;
            for (let i = inputMessages.length - 1; i >= 0; i--) {
              const msg = inputMessages[i];
              const isAIMessage = msg instanceof AIMessage || msg instanceof AIMessageChunk;
              const hasToolCalls = isAIMessage && "tool_calls" in msg && msg.tool_calls && msg.tool_calls.length > 0;
              if (hasToolCalls) {
                lastToolCallMsg = msg;
                break;
              }
            }
            
            if (lastToolCallMsg && lastToolCallMsg.tool_calls) {
              const toolCalls = lastToolCallMsg.tool_calls;
              const resultMsg = outputMessages.find((msg) => msg instanceof HumanMessage);
              const allObservationContent = resultMsg 
                ? MessageContentExtractor.extract(resultMsg)
                : "";
              
              // 先生成所有工具调用步骤
              for (let i = 0; i < toolCalls.length; i++) {
                const toolCall = toolCalls[i];
                const toolArgs = ToolArgsParser.parse(toolCall.args);
                // 使用 toolCall.id 确保唯一性，如果没有则使用索引和时间戳
                const toolCallId = toolCall.id || `tool-${Date.now()}-${Math.random()}-${i}`;
                
                // 生成工具调用步骤
                // 使用 toolCall.id 确保每个工具调用都有唯一的步骤 ID
                const toolStepId = `tool_call-${toolCall.name || "unknown"}-${toolCallId}`;
                
                yield { 
                  event: { 
                    type: "react_step", 
                    step: {
                      id: toolStepId,
                      type: "tool_call",
                      content: `调用工具: ${toolCall.name || "unknown"}`,
                      timestamp: Date.now(),
                      toolCall: {
                        name: toolCall.name || "unknown",
                        arguments: toolArgs,
                        status: "completed" as const,
                      },
                    }
                  }, 
                  finalState: null 
                };
              }
              
              // 所有工具调用完成后，生成一个统一的观察结果步骤
              if (allObservationContent || resultMsg) {
                const observationStepId = `observation-all-${Date.now()}`;
                
                yield { 
                  event: { 
                    type: "react_step", 
                    step: {
                      id: observationStepId,
                      type: "observation",
                      content: `工具执行结果: ${allObservationContent}`,
                      timestamp: Date.now(),
                      toolCall: {
                        name: toolCalls.length > 1 ? `${toolCalls.length} 个工具` : (toolCalls[0]?.name || "unknown"),
                        arguments: {},
                        result: allObservationContent,
                        status: "completed" as const,
                      },
                    }
                  }, 
                  finalState: null 
                };
              }
            }
          }
          
          // 对于 tools 节点，我们已经在上面的逻辑中处理了所有工具调用和统一的观察结果
          // 所以跳过 processChainEnd 的处理，避免生成重复的观察结果
        } else {
          // 对于其他节点（如 thought），正常处理
          const step = this.eventProcessor.processChainEnd(event);
          if (step) {
            // 对于思考步骤，检查是否已经生成过相同内容的思考步骤（避免重复）
            if (step.type === "thought") {
              // 跳过"正在思考..."占位符（现在不会在节点开始时创建）
              if (step.content === "正在思考...") {
                continue;
              }
              
              // 检查是否已经生成过相同内容的思考步骤
              if (step.content && generatedThoughtContents.has(step.content)) {
                continue;
              }
              
              // 记录已生成的思考内容
              if (step.content) {
                generatedThoughtContents.add(step.content);
              }
            }
            
            yield { event: { type: "react_step", step }, finalState: null };
          }
        }
        
        // 尝试从结束事件中提取最终状态
        // LangGraph 的 on_chain_end 事件可能包含最终状态
        // 注意：我们需要找到最后一个节点的结束事件，它应该包含完整的最终状态
        if (event.data?.output?.messages) {
          // 更新最终状态（最后一个节点的结束事件会包含完整的最终状态）
          finalState = { messages: event.data.output.messages };
        }
      }

      // 处理 LLM 流式内容
      // 注意：即使有工具调用，我们也应该捕获流式内容来更新思考步骤
      if (event.event === "on_chat_model_stream" || event.event === "on_llm_stream") {
        const content = this.eventProcessor.processLLMStream(event);
        if (content) {
          accumulatedContent += content;
          
          // 注意：流式内容主要用于最终回答阶段
          // 对于有工具调用的思考步骤，我们会在节点结束时通过 extractThoughtFromOutput 更新
          // 这里只处理最终回答阶段的流式内容
          yield { event: { type: "content", content }, finalState: null };
        }
      }
    }

    // 如果流式事件中没有获取到最终状态，返回 null
    yield { event: { type: "done" }, finalState };
  }

  /**
   * 从最终状态中提取工具调用和观察步骤，以及最终思考步骤
   */
  private async* extractStepsFromFinalState(finalState: { messages: BaseMessage[] }): AsyncGenerator<StreamEvent> {
    const processedToolCallIds = new Set<string>();
    let lastAIMessage: (AIMessage | AIMessageChunk) | null = null;

    for (let i = 0; i < finalState.messages.length; i++) {
      const msg = finalState.messages[i];

      // 检查是否有工具调用（AIMessage 或 AIMessageChunk with tool_calls）
      const isAIMessage = msg instanceof AIMessage || msg instanceof AIMessageChunk;
      const hasToolCalls = isAIMessage && "tool_calls" in msg && msg.tool_calls && msg.tool_calls.length > 0;
      
      // 记录最后一个 AI 消息（可能是最终回答）
      if (isAIMessage) {
        lastAIMessage = msg;
      }
      
      if (hasToolCalls) {
        const toolCalls = msg.tool_calls || [];
        
        // 查找对应的观察结果（下一个 HumanMessage 通常包含工具结果）
        // 注意：如果有多个工具调用，它们的结果都在同一个 HumanMessage 中（用换行符分隔）
        let observationMsg: HumanMessage | null = null;
        if (i + 1 < finalState.messages.length) {
          const nextMsg = finalState.messages[i + 1];
          if (nextMsg instanceof HumanMessage) {
            observationMsg = nextMsg;
          }
        }
        
        // 获取所有观察结果（合并所有工具调用的结果）
        const allObservationContent = observationMsg 
          ? MessageContentExtractor.extract(observationMsg)
          : "";
        
        // 遍历所有工具调用，生成工具调用步骤
        for (let toolIndex = 0; toolIndex < toolCalls.length; toolIndex++) {
          const toolCall = toolCalls[toolIndex];
          
          // 使用原始的 toolCall.id（如果存在），这样可以与流式事件中的步骤匹配
          const toolCallId = toolCall.id || `tool-${i}-${toolIndex}`;
          if (processedToolCallIds.has(toolCallId)) {
            continue; // 已经处理过
          }
          processedToolCallIds.add(toolCallId);

          // 提取工具参数
          const toolArgs = ToolArgsParser.parse(toolCall.args);

          // 发送工具调用步骤
          // 使用 toolCall.id 作为 ID 的一部分，这样可以与流式事件中的步骤匹配
          // 格式：tool_call-{toolName}-{toolCall.id}，与流式事件格式一致
          const toolStepId = `tool_call-${toolCall.name || "unknown"}-${toolCallId}`;
          yield {
            type: "react_step",
            step: {
              id: toolStepId,
              type: "tool_call",
              content: `调用工具: ${toolCall.name || "unknown"}`,
              timestamp: Date.now(),
              toolCall: {
                name: toolCall.name || "unknown",
                arguments: toolArgs,
                status: "completed" as const,
              },
            }
          };
        }
        
        // 所有工具调用完成后，生成一个统一的观察结果步骤
        if (allObservationContent || observationMsg) {
          const observationStepId = `observation-all-${i}-${Date.now()}`;
          yield {
            type: "react_step",
            step: {
              id: observationStepId,
              type: "observation",
              content: `工具执行结果: ${allObservationContent}`,
              timestamp: Date.now(),
              toolCall: {
                name: toolCalls.length > 1 ? `${toolCalls.length} 个工具` : (toolCalls[0]?.name || "unknown"),
                arguments: {},
                result: allObservationContent,
                status: "completed" as const,
              },
            }
          };
        }
      }
    }

    // 提取最终思考步骤（最后一个没有 tool_calls 的 AIMessage）
    // 这是 ReAct 工作流的最后一步：基于观察结果给出最终回答
    // 注意：我们需要找到最后一个没有工具调用的 AI 消息，这通常是最终回答
    // 但要注意：如果流式事件中已经有了这个思考步骤，就不要重复提取
    if (lastAIMessage) {
      const hasToolCalls = "tool_calls" in lastAIMessage && lastAIMessage.tool_calls && lastAIMessage.tool_calls.length > 0;
      
      if (!hasToolCalls) {
        const finalContent = MessageContentExtractor.extract(lastAIMessage);
        
        // 只有在有内容且内容不是"正在思考..."时才提取
        if (finalContent && finalContent.trim().length > 0 && finalContent !== "正在思考...") {
          const finalThoughtStep = {
            type: "react_step" as const,
            step: {
              id: `thought-final-${Date.now()}-${Math.random()}`,
              type: "thought" as const,
              content: finalContent,
              timestamp: Date.now(),
            }
          };
          yield finalThoughtStep;
        }
      }
    }
  }

  /**
   * 将 StreamEvent 转换为 SSE 格式的字符串
   */
  formatSSE(event: StreamEvent): string {
    return `data: ${JSON.stringify(event)}\n\n`;
  }

  /**
   * 创建 ReadableStream 用于 Next.js Response
   */
  createReadableStream(
    agent: ReturnType<any>,
    initialState: { messages: BaseMessage[] }
  ): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    const handler = this;

    return new ReadableStream({
      async start(controller) {
        try {
          // 获取 LangGraph 流式事件
          const streamEvents = await agent.streamEvents(initialState, {
            version: "v2",
          });

          // 收集所有流式事件，同时处理
          const events: StreamEvent[] = [];
          let finalState: { messages: BaseMessage[] } | null = null;
          const processedStepIds = new Set<string>();

          // 处理流式事件
          let eventCount = 0;
          for await (const { event: streamEvent, finalState: stateFromStream } of handler.processStream(streamEvents)) {
            // 如果获取到最终状态，保存它
            if (stateFromStream) {
              finalState = stateFromStream;
            }
            
            // 跳过 done 事件（它只是用来传递最终状态）
            if (streamEvent.type === "done") {
              continue;
            }
            
            // 检查是否重复（通过 step.id 和 step.type + toolCall.name 组合）
            if (streamEvent.type === "react_step") {
              // 对于思考步骤，如果已经存在相同 ID 的步骤，更新它而不是跳过
              // 注意：现在不会在节点开始时创建"正在思考..."，所以这个更新逻辑主要用于处理相同 ID 的步骤
              if (streamEvent.step.type === "thought") {
                const existingIndex = events.findIndex(
                  e => e.type === "react_step" && e.step.id === streamEvent.step.id
                );
                if (existingIndex >= 0) {
                  // 更新已存在的思考步骤
                  events[existingIndex] = streamEvent;
                  // 发送更新后的步骤
                  const sseData = handler.formatSSE(streamEvent);
                  controller.enqueue(encoder.encode(sseData));
                  continue;
                }
              }
              
              // 对于工具调用和观察步骤，使用 step.id 作为去重键
              // 因为每个工具调用都有唯一的 toolCall.id，所以 step.id 应该是唯一的
              // 注意：统一的观察结果使用 `observation-all-` 前缀，不会被误判为重复
              let duplicateKey = streamEvent.step.id;
              let toolCallId: string | undefined;
              
              if (streamEvent.step.type === "tool_call" || streamEvent.step.type === "observation") {
                // 统一的观察结果使用特殊格式：observation-all-{timestamp}
                // 这种格式不会被误判为重复
                if (streamEvent.step.id.startsWith("observation-all-")) {
                  // 统一的观察结果，直接使用 step.id 作为去重键
                  duplicateKey = streamEvent.step.id;
                } else {
                  // 尝试从 step.id 中提取 toolCall.id（用于日志）
                  // 格式：tool_call-{toolName}-{toolCall.id} 或 observation-{toolName}-{toolCall.id}
                  const stepIdMatch = streamEvent.step.id.match(/^(tool_call|observation)-[^-]+-(.+)$/);
                  if (stepIdMatch && stepIdMatch[2]) {
                    toolCallId = stepIdMatch[2];
                  }
                  // 使用完整的 step.id 作为去重键（因为每个工具调用都有唯一的 toolCall.id）
                  duplicateKey = streamEvent.step.id;
                }
              }
              
              if (processedStepIds.has(duplicateKey) || processedStepIds.has(streamEvent.step.id)) {
                continue;
              }
              
              processedStepIds.add(duplicateKey);
              processedStepIds.add(streamEvent.step.id);
            }
            
            eventCount++;
            events.push(streamEvent);
            const sseData = handler.formatSSE(streamEvent);
            controller.enqueue(encoder.encode(sseData));
          }

          // 流式事件处理完成后，从最终状态提取工具调用步骤
          // 注意：我们不再调用 agent.invoke()，而是从流式事件中收集的最终状态提取
          // 如果流式事件中没有最终状态，我们需要手动执行一次（但这是最后的选择）
          if (!finalState) {
            try {
              finalState = (await agent.invoke(initialState)) as { messages: BaseMessage[] };
            } catch (error) {
              console.error("[Stream Handler] Failed to get final state:", {
                error,
                errorMessage: error instanceof Error ? error.message : String(error),
              });
            }
          }
          
          // 检查是否已经有工具调用步骤和最终思考步骤（避免重复）
          const hasToolSteps = events.some(e => e.type === "react_step" && e.step.type === "tool_call");
          const hasObservations = events.some(e => e.type === "react_step" && e.step.type === "observation");
          // 检查是否有最终思考步骤（不是"正在思考..."的思考步骤）
          // 注意：我们需要找到最后一个思考步骤，它应该是最终回答
          const thoughtSteps: ReActStepEvent[] = [];
          for (const e of events) {
            if (e.type === "react_step" && 
                e.step.type === "thought" && 
                e.step.content && 
                e.step.content !== "正在思考..." &&
                e.step.content.trim().length > 0) {
              thoughtSteps.push(e);
            }
          }
          // 过滤掉"正在思考..."的步骤，只保留有实际内容的步骤
          const validThoughtSteps = thoughtSteps.filter(
            e => e.step.content && e.step.content !== "正在思考..."
          );
          const hasFinalThought = validThoughtSteps.length > 0;
          // 获取最后一个思考步骤的内容，用于去重检查
          const lastThoughtContent = thoughtSteps.length > 0 ? thoughtSteps[thoughtSteps.length - 1].step.content : null;
          
          // 只有在流式事件中缺少必要步骤时，才从最终状态提取
          // 注意：如果流式事件中已经有了工具步骤和观察步骤，就不再从最终状态提取（避免重复）
          // 特别地，如果已经有统一的观察结果（observation-all-），就不再提取
          const hasUnifiedObservation = events.some(
            e => e.type === "react_step" && 
            e.step.type === "observation" && 
            e.step.id.startsWith("observation-all-")
          );
          
          if (finalState && (!hasToolSteps || (!hasObservations && !hasUnifiedObservation) || !hasFinalThought)) {
            
            // 从最终状态提取工具调用、观察步骤和最终思考步骤
            let extractedCount = 0;
            for await (const event of handler.extractStepsFromFinalState(finalState)) {
              // 检查是否重复（通过 step.id 和 step.type + toolCall.name + toolCall.id 组合）
              if (event.type === "react_step") {
                // 如果已经有统一的观察结果，跳过从最终状态提取的观察结果
                if (event.step.type === "observation" && hasUnifiedObservation) {
                  continue;
                }
                
                // 对于思考步骤，检查是否与已有的思考步骤重复
                if (event.step.type === "thought") {
                  const extractedContent = event.step.content?.trim() || "";
                  
                  // 如果内容为空或只是"正在思考..."，跳过（避免显示占位符）
                  if (!extractedContent || extractedContent === "正在思考...") {
                    continue;
                  }
                  
                  // 如果内容与最后一个思考步骤相同，跳过（避免重复）
                  if (lastThoughtContent && extractedContent === lastThoughtContent.trim()) {
                    continue;
                  }
                  
                  // 检查是否已经有相同 ID 的思考步骤（可能是从流式事件中已经提取的）
                  const existingThoughtIndex = events.findIndex(
                    e => e.type === "react_step" && e.step.id === event.step.id
                  );
                  if (existingThoughtIndex >= 0) {
                    continue;
                  }
                }
                
                // 对于工具调用和观察步骤，使用 toolCall.name 和 toolCall.id 作为额外的去重标识
                let duplicateKey = event.step.id;
                let toolCallId: string | undefined;
                
                if (event.step.type === "tool_call" || event.step.type === "observation") {
                  const toolName = event.step.toolCall?.name || "unknown";
                  // 尝试从 step.id 中提取 toolCall.id（如果存在）
                  // 流式事件格式：tool_call-{toolName}-{toolCall.id} 或 tool-{toolCall.id}-{random}
                  // 最终状态格式：tool-{toolName}-{toolCall.id}-{index}
                  // 匹配格式：tool_call-{toolName}-{toolCall.id} 或 tool-{toolName}-{toolCall.id}-{index}
                  const idMatch = event.step.id.match(/(?:tool_call|tool)[_-](?:[^-_]+-)?([^-_]+(?:-[^-_]+)*)/);
                  if (idMatch && idMatch[1]) {
                    toolCallId = idMatch[1];
                  }
                  
                  // 使用工具名称和 toolCall.id 生成去重键（如果 toolCall.id 存在）
                  if (toolCallId) {
                    duplicateKey = `${event.step.type}-${toolName}-${toolCallId}`;
                  } else {
                    duplicateKey = `${event.step.type}-${toolName}-${event.step.id}`;
                  }
                }
                
                if (processedStepIds.has(duplicateKey) || processedStepIds.has(event.step.id)) {
                  continue;
                }
                
                processedStepIds.add(duplicateKey);
                processedStepIds.add(event.step.id);
              }
              
              extractedCount++;
              const sseData = handler.formatSSE(event);
              controller.enqueue(encoder.encode(sseData));
            }
          }

          // 发送结束标记
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          // 发送错误信息
          const errorEvent: ReActStepEvent = {
            type: "react_step",
            step: {
              id: `error-${Date.now()}`,
              type: "observation",
              content: `错误: ${error instanceof Error ? error.message : String(error)}`,
              timestamp: Date.now(),
              toolCall: {
                name: "system",
                arguments: {},
                status: "error",
                error: error instanceof Error ? error.message : String(error),
              },
            },
          };
          controller.enqueue(encoder.encode(handler.formatSSE(errorEvent)));
          controller.close();
        }
      },
    });
  }
}
