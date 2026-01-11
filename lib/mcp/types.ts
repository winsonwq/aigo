// MCP Server 类型定义

/**
 * MCP 传输类型
 */
export type MCPTransportType = "stdio" | "http";

/**
 * MCP HTTP 传输配置
 */
export interface MCPHTTPTransport {
  type: "http";
  url: string;
}

/**
 * MCP Stdio 传输配置
 */
export interface MCPStdioTransport {
  type: "stdio";
  command: string;
  args?: string[];
  workingDir?: string;
  env?: Record<string, string>;
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * MCP 传输配置（联合类型）
 */
export type MCPTransport = MCPHTTPTransport | MCPStdioTransport;

/**
 * MCP Server 配置（支持多种格式）
 * 格式1（旧格式）：直接包含 command/args/env 或 transport/url
 * 格式2（新格式）：包含 name, description, type, enabled, transport 等字段
 */
export interface MCPServerConfig {
  // 新格式的元数据字段
  name?: string;
  description?: string;
  type?: "stdio" | "http";
  enabled?: boolean;

  // 新格式的传输配置
  transport?: MCPTransport;

  // 旧格式的 stdio 传输配置（向后兼容）
  command?: string;
  args?: string[];
  env?: Record<string, string>;

  // 旧格式的 HTTP 传输配置（向后兼容）
  url?: string;
}

/**
 * MCP 配置（整个配置文件格式）
 * 支持两种格式：
 * 1. 旧格式：{ mcpServers: { "server-name": { ... } } }
 * 2. 新格式：{ "server-name": { name: "...", transport: { ... } } }
 */
export interface MCPConfig {
  // 旧格式
  mcpServers?: Record<string, MCPServerConfig>;

  // 新格式：服务器配置直接作为顶层对象
  [serverName: string]: MCPServerConfig | Record<string, MCPServerConfig> | undefined;
}

/**
 * MCP 工具参数
 */
export interface MCPToolParameter {
  type: string;
  description?: string;
  enum?: string[];
  [key: string]: unknown;
}

/**
 * MCP 工具定义
 */
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: string;
    properties?: Record<string, MCPToolParameter>;
    required?: string[];
  };
}

/**
 * MCP Server 信息（包含连接状态和工具列表）
 */
export interface MCPServerInfo {
  name: string; // 显示名称（优先使用配置中的 name 字段）
  key?: string; // 原始配置键名（用于删除等操作）
  config: MCPServerConfig;
  status: "connected" | "disconnected" | "error";
  tools?: MCPTool[];
  error?: string;
  is_default?: boolean; // 是否为系统默认服务
}

/**
 * MCP Server 连接状态
 */
export type MCPConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

/**
 * MCP 配置存储键名
 */
export const MCP_STORAGE_KEY = "aigo_mcp_config";
