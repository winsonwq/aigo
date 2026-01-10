// 通用类型定义

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
}

export interface ChatRequest {
  message: string;
  sessionId?: string;
  modelId?: string;
}

export interface ChatResponse {
  content: string;
  toolCalls?: ToolCall[];
  thoughts?: string[];
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}
