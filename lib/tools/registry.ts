// 工具注册表

import type { Tool, ToolRegistry } from "./types";
import { DynamicStructuredTool } from "@langchain/core/tools";

export class ToolRegistryImpl implements ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  clear(): void {
    this.tools.clear();
  }
}

// 单例工具注册表
export const toolRegistry = new ToolRegistryImpl();
