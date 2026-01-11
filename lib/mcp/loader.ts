// MCP 工具加载器
// 管理 MCP 客户端连接并将工具注册到工具注册表

import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import type { MCPServerConfig, MCPConfig } from "./types";
import { toolRegistry } from "@/lib/tools/registry";
import type { Tool } from "@/lib/tools/types";

// 全局 MCP 客户端管理器
class MCPClientManager {
  private clients: Map<string, MultiServerMCPClient> = new Map();
  private registeredTools: Set<string> = new Set(); // 已注册的工具名称

  /**
   * 加载并注册所有启用的 MCP 工具
   */
  async loadAndRegisterTools(config: MCPConfig): Promise<{ success: number; failed: number; errors: string[] }> {
    const servers: Array<{ key: string; config: MCPServerConfig }> = [];

    // 解析配置
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

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    // 先关闭所有现有连接
    await this.closeAll();

    // 构建启用的服务器配置
    const enabledServers: Array<{ key: string; config: MCPServerConfig }> = [];
    const mcpServersConfig: Record<string, any> = {};

    servers.forEach(({ key, config: serverConfig }) => {
      if (serverConfig.enabled !== false) {
        enabledServers.push({ key, config: serverConfig });

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
          } else if (serverConfig.transport.type === "http") {
            transportConfig = {
              transport: "http",
              url: serverConfig.transport.url,
            };
          }
        } else if (serverConfig.command) {
          // 旧格式 stdio
          transportConfig = {
            transport: "stdio",
            command: serverConfig.command,
            args: serverConfig.args || [],
            env: serverConfig.env,
          };
        } else if (serverConfig.url) {
          // 旧格式 http
          transportConfig = {
            transport: "http",
            url: serverConfig.url,
          };
        }

        if (transportConfig) {
          mcpServersConfig[key] = transportConfig;
        }
      }
    });

    // 如果没有启用的服务器，直接返回
    if (Object.keys(mcpServersConfig).length === 0) {
      console.log("[MCP Loader] No enabled servers to load");
      return { success: 0, failed: 0, errors: [] };
    }

    // 创建统一的 MultiServerMCPClient（管理所有服务器）
    try {
      console.log(`[MCP Loader] Creating client for ${Object.keys(mcpServersConfig).length} servers`);
      const client = new MultiServerMCPClient({
        mcpServers: mcpServersConfig,
      });

      // 初始化连接
      console.log("[MCP Loader] Initializing connections...");
      await client.initializeConnections();
      console.log("[MCP Loader] Connections initialized");

      // 获取所有工具
      console.log("[MCP Loader] Getting tools...");
      const tools = await client.getTools();
      console.log(`[MCP Loader] Got ${tools.length} tools`);

      // 注册所有工具
      for (const tool of tools) {
        try {
          // 检查工具名称是否已注册（避免重复注册）
          if (this.registeredTools.has(tool.name)) {
            console.log(`[MCP Loader] Tool ${tool.name} already registered, skipping`);
            continue;
          }

          toolRegistry.register(tool as Tool);
          this.registeredTools.add(tool.name);
          success++;
          console.log(`[MCP Loader] Registered tool: ${tool.name}`);
        } catch (error) {
          failed++;
          const errorMsg = `Failed to register tool ${tool.name}: ${error instanceof Error ? error.message : "unknown error"}`;
          errors.push(errorMsg);
          console.error(`[MCP Loader] ${errorMsg}`);
        }
      }

      // 保存客户端（保持连接）
      // 使用一个特殊的键来存储统一客户端
      this.clients.set("__unified__", client);

      console.log(`[MCP Loader] Load complete: ${success} tools registered, ${failed} failed`);
      return { success, failed, errors };
    } catch (error) {
      const errorMsg = `Failed to initialize MCP clients: ${error instanceof Error ? error.message : "unknown error"}`;
      errors.push(errorMsg);
      console.error(`[MCP Loader] ${errorMsg}`);
      return { success: 0, failed: enabledServers.length, errors };
    }
  }

  /**
   * 关闭所有 MCP 客户端连接
   */
  async closeAll(): Promise<void> {
    console.log(`[MCP Loader] Closing ${this.clients.size} clients`);
    
    // 清除已注册的工具（从注册表中移除 MCP 工具）
    for (const toolName of this.registeredTools) {
      // 注意：工具注册表没有 unregister 方法，我们只能清除所有工具
      // 但这样会清除所有工具（包括测试工具），所以这里先不清除
      // 如果需要，可以在工具注册表中添加 unregister 方法
    }
    this.registeredTools.clear();

    // 关闭所有客户端
    const closePromises = Array.from(this.clients.values()).map(async (client) => {
      try {
        await client.close();
      } catch (error) {
        console.error("[MCP Loader] Error closing client:", error);
      }
    });

    await Promise.all(closePromises);
    this.clients.clear();
    console.log("[MCP Loader] All clients closed");
  }

  /**
   * 获取客户端（用于工具调用）
   */
  getClient(serverKey?: string): MultiServerMCPClient | undefined {
    // 如果使用统一客户端，返回统一客户端
    return this.clients.get("__unified__");
  }
}

// 单例管理器
export const mcpClientManager = new MCPClientManager();

/**
 * 加载并注册 MCP 工具
 * 从配置中读取启用的服务器，连接并注册工具
 */
export async function loadMCPTools(config: MCPConfig): Promise<{ success: number; failed: number; errors: string[] }> {
  return mcpClientManager.loadAndRegisterTools(config);
}

/**
 * 关闭所有 MCP 连接
 */
export async function closeMCPConnections(): Promise<void> {
  return mcpClientManager.closeAll();
}
