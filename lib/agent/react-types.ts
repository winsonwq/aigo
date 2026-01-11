/**
 * ReAct Workflow 类型定义
 * 
 * 定义 ReAct Agent 工作流中的步骤类型和数据结构
 */

/**
 * ReAct 步骤类型
 */
export type ReActStepType = "thought" | "tool_call" | "observation" | "final_answer";

/**
 * 工具调用状态
 */
export type ToolCallStatus = "running" | "completed" | "error";

/**
 * 工具调用信息
 */
export interface ToolCallInfo {
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  status: ToolCallStatus;
  error?: string;
}

/**
 * ReAct 工作流步骤
 */
export interface ReActStep {
  id: string;
  type: ReActStepType;
  content: string;
  timestamp: number;
  toolCall?: ToolCallInfo;
}

/**
 * ReAct 步骤事件（用于 SSE 流式传输）
 */
export interface ReActStepEvent {
  type: "react_step";
  step: ReActStep;
}

/**
 * 内容事件（用于 SSE 流式传输）
 */
export interface ContentEvent {
  type: "content";
  content: string;
}

/**
 * 完成事件（用于标记流式处理完成）
 */
export interface DoneEvent {
  type: "done";
}

/**
 * 流式事件类型
 */
export type StreamEvent = ReActStepEvent | ContentEvent | DoneEvent;

/**
 * LangGraph 事件数据（用于内部处理）
 */
export interface LangGraphEventData {
  event: string;
  name?: string;
  data?: {
    input?: {
      messages?: unknown[];
    };
    output?: {
      messages?: unknown[];
    };
    chunk?: unknown;
  };
}
