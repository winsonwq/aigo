// 工具类型定义

import { DynamicStructuredTool } from "@langchain/core/tools";

export type Tool = DynamicStructuredTool;

export interface ToolDefinition {
  name: string;
  description: string;
  schema: Record<string, unknown>;
}

export interface ToolRegistry {
  register(tool: Tool): void;
  getTool(name: string): Tool | undefined;
  getAllTools(): Tool[];
  clear(): void;
}
