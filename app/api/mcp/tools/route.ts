// MCP Tools API 路由
// 连接 MCP Server 并获取工具列表

import { NextRequest, NextResponse } from "next/server";
import { connectMCPServer, connectMCPServers } from "@/lib/mcp/adapter";
import { getMCPConfig } from "@/lib/mcp/storage";
import type { MCPServerConfig, MCPServerInfo, MCPConfig } from "@/lib/mcp/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, serverKey } = body;

    if (action === "refresh_all") {
      // 刷新所有服务器
      // 优先使用请求体中的配置（因为服务器端无法访问 localStorage）
      let config: MCPConfig;
      if (body.config) {
        config = body.config as MCPConfig;
      } else {
        // 如果没有提供配置，尝试从 localStorage 读取（可能失败）
        const configResult = getMCPConfig();
        if (!configResult.success) {
          return NextResponse.json(
            { error: "获取配置失败，请提供配置信息" },
            { status: 500 }
          );
        }
        config = configResult.value;
      }

      const servers: Array<{ key: string; config: MCPServerConfig }> = [];

      if (config.mcpServers) {
        // 旧格式
        Object.entries(config.mcpServers).forEach(([key, serverConfig]) => {
          servers.push({ key, config: serverConfig });
        });
      } else {
        // 新格式
        Object.entries(config).forEach(([key, value]) => {
          if (key !== "mcpServers" && value && typeof value === "object") {
            servers.push({ key, config: value as MCPServerConfig });
          }
        });
      }

      console.log(`[MCP API] Refreshing all servers, count: ${servers.length}`);
      const serverInfos = await connectMCPServers(servers);
      console.log(`[MCP API] Refresh complete, got ${serverInfos.length} server infos`);
      return NextResponse.json({ servers: serverInfos });
    } else if (action === "refresh_one" && serverKey) {
      // 刷新单个服务器
      // 优先使用请求体中的配置（因为服务器端无法访问 localStorage）
      let config: MCPConfig;
      if (body.config) {
        config = body.config as MCPConfig;
      } else {
        // 如果没有提供配置，尝试从 localStorage 读取（可能失败）
        const configResult = getMCPConfig();
        if (!configResult.success) {
          return NextResponse.json(
            { error: "获取配置失败，请提供配置信息" },
            { status: 500 }
          );
        }
        config = configResult.value;
      }

      let serverConfig: MCPServerConfig | undefined;

      if (config.mcpServers) {
        serverConfig = config.mcpServers[serverKey];
      } else {
        serverConfig = config[serverKey] as MCPServerConfig | undefined;
      }

      if (!serverConfig) {
        return NextResponse.json(
          { error: "服务器配置不存在" },
          { status: 404 }
        );
      }

      console.log(`[MCP API] Refreshing single server: ${serverKey}`);
      const { tools, error } = await connectMCPServer(serverKey, serverConfig);
      console.log(`[MCP API] Server ${serverKey} refresh complete, tools: ${tools.length}, error: ${error || 'none'}`);
      const serverInfo: MCPServerInfo = {
        name: serverConfig.name || serverKey,
        key: serverKey,
        config: serverConfig,
        status: error ? "error" : tools.length > 0 ? "connected" : "disconnected",
        tools: tools.length > 0 ? tools : undefined,
        error,
      };

      return NextResponse.json({ server: serverInfo });
    } else {
      return NextResponse.json(
        { error: "无效的操作" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("MCP Tools API Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "服务器错误" },
      { status: 500 }
    );
  }
}
