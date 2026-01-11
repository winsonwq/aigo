// 对话 UI 相关类型定义

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  isLoading?: boolean;
  toolCalls?: ToolCallInfo[];
  reactSteps?: ReActStep[];
  error?: string;
}

export interface ToolCallInfo {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  status: "pending" | "running" | "completed" | "error";
  error?: string;
}

// ReAct 步骤类型
export type ReActStepType = "thought" | "tool_call" | "observation" | "final_answer";

export interface ReActStep {
  id: string;
  type: ReActStepType;
  content: string;
  timestamp: number;
  toolCall?: {
    name: string;
    arguments: Record<string, unknown>;
    result?: unknown;
    status: "running" | "completed" | "error";
    error?: string;
  };
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
}
