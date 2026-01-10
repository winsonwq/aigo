// Agent 相关类型定义

import { BaseMessage } from "@langchain/core/messages";

export interface AgentState {
  messages: BaseMessage[];
  next: string;
}

export interface AgentConfig {
  modelId?: string;
  temperature?: number;
  maxIterations?: number;
}

export interface ThoughtStep {
  thought: string;
  action?: ToolCallStep;
  observation?: string;
}

export interface ToolCallStep {
  tool: string;
  input: Record<string, unknown>;
}
