// MCP 工具加载 API
// 从配置中加载并注册 MCP 工具到工具注册表

import { NextRequest, NextResponse } from "next/server";
import { loadMCPTools } from "@/lib/mcp/loader";
import type { MCPConfig } from "@/lib/mcp/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { config } = body;

    if (!config) {
      return NextResponse.json(
        { error: "配置信息是必需的" },
        { status: 400 }
      );
    }

    const mcpConfig = config as MCPConfig;
    console.log("[MCP Load API] Loading tools from config...");

    const result = await loadMCPTools(mcpConfig);

    return NextResponse.json({
      success: true,
      registered: result.success,
      failed: result.failed,
      errors: result.errors,
    });
  } catch (error) {
    console.error("[MCP Load API] Error:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "加载工具失败",
        success: false 
      },
      { status: 500 }
    );
  }
}
