// MCP 工具适配器
// 使用 @langchain/mcp-adapters 连接 MCP Server 并获取工具

import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import type { MCPServerConfig, MCPServerInfo, MCPTool, MCPConfig } from "./types";

/**
 * 连接 MCP Server 并获取工具列表
 */
export async function connectMCPServer(
  serverKey: string,
  serverConfig: MCPServerConfig
): Promise<{ tools: MCPTool[]; error?: string }> {
  try {
    // 检查是否启用
    if (serverConfig.enabled === false) {
      console.log(`[MCP] Server ${serverKey} is disabled, skipping`);
      return { tools: [] };
    }

    // 构建传输配置
    let transportConfig: any;

    if (serverConfig.transport) {
      // 新格式
      if (serverConfig.transport.type === "stdio") {
        transportConfig = {
          transport: "stdio",
          command: serverConfig.transport.command,
          args: serverConfig.transport.args || [],
          env: serverConfig.transport.env,
        };
        console.log(`[MCP] Configuring stdio transport for ${serverKey}:`, {
          command: transportConfig.command,
          args: transportConfig.args,
        });
      } else if (serverConfig.transport.type === "http") {
        transportConfig = {
          transport: "http", // 使用 Streamable HTTP（不是 SSE）
          url: serverConfig.transport.url,
        };
        console.log(`[MCP] Configuring HTTP transport for ${serverKey}:`, {
          url: transportConfig.url,
        });
      }
    } else if (serverConfig.command) {
      // 旧格式 stdio
      transportConfig = {
        transport: "stdio",
        command: serverConfig.command,
        args: serverConfig.args || [],
        env: serverConfig.env,
      };
      console.log(`[MCP] Configuring stdio transport (legacy) for ${serverKey}:`, {
        command: transportConfig.command,
        args: transportConfig.args,
      });
    } else if (serverConfig.url) {
      // 旧格式 http
      transportConfig = {
        transport: "http", // 使用 Streamable HTTP（不是 SSE）
        url: serverConfig.url,
      };
      console.log(`[MCP] Configuring HTTP transport (legacy) for ${serverKey}:`, {
        url: transportConfig.url,
      });
    } else {
      console.error(`[MCP] Invalid transport config for ${serverKey}`);
      return { tools: [], error: "无效的传输配置" };
    }

    console.log(`[MCP] Creating MultiServerMCPClient for ${serverKey}...`);
    // 创建 MultiServerMCPClient
    const client = new MultiServerMCPClient({
      mcpServers: {
        [serverKey]: transportConfig,
      },
    });

    console.log(`[MCP] Initializing connections for ${serverKey}...`);
    // 初始化连接（这会实际连接到服务器）
    await client.initializeConnections();
    console.log(`[MCP] Connections initialized for ${serverKey}`);

    console.log(`[MCP] Getting tools from ${serverKey}...`);
    // 获取工具列表（这会从实际连接的服务器获取工具）
    const tools = await client.getTools();
    console.log(`[MCP] Got ${tools.length} tools from ${serverKey}`);

    // 转换为我们的 MCPTool 格式
    const mcpTools: MCPTool[] = tools.map((tool) => {
      // tool 是 LangChain Tool，需要提取信息
      const schema = (tool as any).schema;
      return {
        name: tool.name,
        description: tool.description,
        inputSchema: {
          type: schema?.type || "object",
          properties: schema?.properties || {},
          required: schema?.required || [],
        },
      };
    });

    console.log(`[MCP] Closing connection for ${serverKey}...`);
    // 关闭连接
    await client.close();
    console.log(`[MCP] Connection closed for ${serverKey}`);

    return { tools: mcpTools };
  } catch (error) {
    console.error(`[MCP] Error connecting to ${serverKey}:`, error);
    return {
      tools: [],
      error: error instanceof Error ? error.message : "连接失败",
    };
  }
}

/**
 * 批量连接 MCP Server 并获取工具列表
 */
export async function connectMCPServers(
  servers: Array<{ key: string; config: MCPServerConfig }>
): Promise<MCPServerInfo[]> {
  const results: MCPServerInfo[] = [];

  // 构建完整的 MCP 配置（转换为 MultiServerMCPClient 格式）
  const mcpServersConfig: Record<string, any> = {};
  
  servers.forEach(({ key, config }) => {
    if (config.enabled !== false) {
      // 构建传输配置
      if (config.transport) {
        // 新格式
        if (config.transport.type === "stdio") {
          mcpServersConfig[key] = {
            transport: "stdio",
            command: config.transport.command,
            args: config.transport.args || [],
            env: config.transport.env,
          };
        } else if (config.transport.type === "http") {
          mcpServersConfig[key] = {
            transport: "http", // 使用 Streamable HTTP（不是 SSE）
            url: config.transport.url,
          };
        }
      } else if (config.command) {
        // 旧格式 stdio
        mcpServersConfig[key] = {
          transport: "stdio",
          command: config.command,
          args: config.args || [],
          env: config.env,
        };
      } else if (config.url) {
        // 旧格式 http
        mcpServersConfig[key] = {
          transport: "http", // 使用 Streamable HTTP（不是 SSE）
          url: config.url,
        };
      }
    }
  });

  // 如果没有启用的服务器，直接返回
  if (Object.keys(mcpServersConfig).length === 0) {
    return servers.map(({ key, config }) => ({
      name: config.name || key,
      key,
      config,
      status: "disconnected" as const,
      tools: [],
    }));
  }

  // 为每个启用的服务器单独连接并获取工具
  const serverPromises = servers.map(async ({ key, config }): Promise<MCPServerInfo> => {
    if (config.enabled === false) {
      return {
        name: config.name || key,
        key,
        config,
        status: "disconnected",
        tools: [],
      };
    }

    // 为每个服务器单独连接
    const { tools, error } = await connectMCPServer(key, config);
    
    return {
      name: config.name || key,
      key,
      config,
      status: error ? ("error" as const) : tools.length > 0 ? ("connected" as const) : ("disconnected" as const),
      tools: tools.length > 0 ? tools : undefined,
      error,
    };
  });

  // 等待所有服务器连接完成
  const serverResults = await Promise.all(serverPromises);
  results.push(...serverResults);

  return results;
}
