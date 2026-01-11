"use client";

// MCP Server 列表组件
// 显示所有 MCP Server，支持查看工具、启用/禁用、删除

import { useState, useEffect, useCallback } from "react";
import { HiTrash, HiChevronDown, HiChevronUp } from "react-icons/hi2";
import type { MCPConfig, MCPServerConfig, MCPServerInfo, MCPTool } from "@/lib/mcp/types";
import { getMCPConfig, saveMCPConfig } from "@/lib/mcp/storage";
import ConfirmModal from "@/components/common/ConfirmModal";

// 重新加载 MCP 工具到注册表
async function reloadMCPTools(config: MCPConfig) {
  try {
    const response = await fetch("/api/mcp/load", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ config }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log("[MCPServerList] MCP tools reloaded:", data);
    } else {
      const errorData = await response.json().catch(() => ({ error: "加载失败" }));
      console.warn("[MCPServerList] Failed to reload MCP tools:", errorData.error);
    }
  } catch (error) {
    console.error("[MCPServerList] Error reloading MCP tools:", error);
  }
}

export default function MCPServerList() {
  const [servers, setServers] = useState<MCPServerInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingServer, setDeletingServer] = useState<string | null>(null);
  const [viewingServer, setViewingServer] = useState<MCPServerInfo | null>(null);

  // 加载配置并转换为 MCPServerInfo，同时获取 tools
  const loadServers = useCallback(async (refreshTools = true) => {
    setLoading(true);
    setError(null);
    
    const result = getMCPConfig();
    if (!result.success) {
      setError(result.error instanceof Error ? result.error.message : "加载失败");
      setLoading(false);
      return;
    }

    const config = result.value;
    const serverInfos: MCPServerInfo[] = [];

    if (config.mcpServers) {
      // 旧格式
      Object.entries(config.mcpServers).forEach(([key, serverConfig]) => {
        serverInfos.push({
          name: serverConfig.name || key,
          key,
          config: serverConfig,
          status: "disconnected",
          tools: [],
        });
      });
    } else {
      // 新格式
      Object.entries(config).forEach(([key, value]) => {
        if (key !== "mcpServers" && value && typeof value === "object") {
          serverInfos.push({
            name: (value as MCPServerConfig).name || key,
            key,
            config: value as MCPServerConfig,
            status: "disconnected",
            tools: [],
          });
        }
      });
    }

    // 如果有服务器配置，总是尝试获取 tools（类似参考项目中的 get_mcp_configs）
    if (serverInfos.length > 0 && refreshTools) {
      try {
        // 将配置信息发送给 API（因为 API 路由无法访问 localStorage）
        const response = await fetch("/api/mcp/tools", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            action: "refresh_all",
            config: config, // 发送配置信息
          }),
        });

        if (response.ok) {
          const data = await response.json();
          // 合并工具信息
          const toolsMap = new Map<string, MCPServerInfo>();
          data.servers.forEach((server: MCPServerInfo) => {
            toolsMap.set(server.key || server.name, server);
          });

          // 更新服务器信息（用 API 返回的完整信息替换）
          serverInfos.length = 0; // 清空
          serverInfos.push(...data.servers);
        } else {
          const errorData = await response.json().catch(() => ({ error: "获取工具失败" }));
          console.error("获取工具失败:", errorData.error);
        }
      } catch (err) {
        console.error("刷新工具失败:", err);
        // 即使失败也显示配置列表，只是没有 tools
      }
    }

    setServers(serverInfos);
    setLoading(false);
  }, []);

  // 初始化加载（自动获取 tools，类似参考项目中的 loadMCPConfigs）
  useEffect(() => {
    loadServers(true); // 默认总是获取 tools
  }, [loadServers]);

  // 监听刷新事件和 localStorage 变化
  useEffect(() => {
    const handleRefresh = (e: Event) => {
      const customEvent = e as CustomEvent<{ refreshTools?: boolean }>;
      const refreshTools = customEvent.detail?.refreshTools ?? false;
      loadServers(refreshTools);
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "aigo_mcp_config") {
        // 配置变化后，自动刷新工具（类似参考项目中的 refreshMCPConfigs）
        loadServers(true);
      }
    };

    window.addEventListener("mcp-refresh", handleRefresh);
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("mcp-refresh", handleRefresh);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [loadServers]);

  // 切换启用状态
  const handleToggleEnabled = useCallback(
    (serverKey: string, enabled: boolean) => {
      const result = getMCPConfig();
      if (!result.success) return;

      const config = result.value;
      let updated = false;

      if (config.mcpServers) {
        // 旧格式
        if (config.mcpServers[serverKey]) {
          config.mcpServers[serverKey] = {
            ...config.mcpServers[serverKey],
            enabled,
          };
          updated = true;
        }
      } else {
        // 新格式
        if (config[serverKey] && typeof config[serverKey] === "object") {
          (config[serverKey] as MCPServerConfig).enabled = enabled;
          updated = true;
        }
      }

      if (updated) {
        saveMCPConfig(config);
        // 切换启用状态后，刷新工具（延迟一下确保配置已保存）
        setTimeout(() => {
          loadServers(true);
          // 重新加载工具到注册表
          reloadMCPTools(config);
        }, 100);
      }
    },
    [loadServers]
  );

  // 删除服务器
  const handleDelete = useCallback(
    (serverKey: string) => {
      setDeletingServer(serverKey);
    },
    []
  );

  // 确认删除
  const handleConfirmDelete = useCallback(() => {
    if (!deletingServer) return;

    const result = getMCPConfig();
    if (!result.success) return;

    const config = result.value;
    let updated = false;

    if (config.mcpServers) {
      // 旧格式
      if (config.mcpServers[deletingServer]) {
        delete config.mcpServers[deletingServer];
        updated = true;
      }
    } else {
      // 新格式
      if (config[deletingServer]) {
        delete config[deletingServer];
        updated = true;
      }
    }

    if (updated) {
      saveMCPConfig(config);
      // 删除后刷新工具（延迟一下确保配置已保存）
      setTimeout(() => {
        loadServers(true);
        // 重新加载工具到注册表
        reloadMCPTools(config);
      }, 100);
    }

    setDeletingServer(null);
  }, [deletingServer, loadServers]);

  // 查看工具列表
  const handleViewTools = useCallback((server: MCPServerInfo) => {
    setViewingServer(server);
  }, []);

  return (
    <>
      <div className="card card-bordered bg-base-100 shadow-sm">
        <div className="card-body">
          {error && (
            <div className="alert alert-error mb-4">
              <span>{error}</span>
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <span className="loading loading-spinner loading-md"></span>
              <span className="ml-2">加载配置列表中...</span>
            </div>
          ) : servers.length === 0 ? (
            <div className="text-center py-8 text-base-content/50">
              <p>暂无 MCP 配置</p>
              <p className="text-sm mt-2">点击【设置】按钮配置 MCP 服务器</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th className="w-full">名称</th>
                    <th className="text-right whitespace-nowrap">工具数量</th>
                    <th className="text-center whitespace-nowrap">启用</th>
                    <th className="text-center whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {servers.map((server) => (
                    <MCPTableRow
                      key={server.key || server.name}
                      server={server}
                      onDelete={() => handleDelete(server.key || server.name)}
                      onViewTools={() => handleViewTools(server)}
                      onToggleEnabled={(enabled) =>
                        handleToggleEnabled(server.key || server.name, enabled)
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 删除确认对话框 */}
      {deletingServer && (
        <ConfirmModal
          isOpen={!!deletingServer}
          title="删除 MCP Server"
          message={`确定要删除 MCP Server "${deletingServer}" 吗？删除后无法恢复。`}
          confirmText="删除"
          cancelText="取消"
          confirmButtonType="error"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingServer(null)}
        />
      )}

      {/* 工具列表弹窗 */}
      {viewingServer && (
        <MCPToolsModal
          isOpen={!!viewingServer}
          server={viewingServer}
          onClose={() => setViewingServer(null)}
        />
      )}
    </>
  );
}

// MCP 表格行组件
interface MCPTableRowProps {
  server: MCPServerInfo;
  onDelete: () => void;
  onViewTools: () => void;
  onToggleEnabled: (enabled: boolean) => void;
}

function MCPTableRow({
  server,
  onDelete,
  onViewTools,
  onToggleEnabled,
}: MCPTableRowProps) {
  const toolsCount = server.tools?.length || 0;
  const isEnabled = server.config.enabled ?? true;
  const isDefault = server.is_default ?? false;

  // 获取状态点的颜色
  const getStatusDotColor = () => {
    switch (server.status) {
      case "connected":
        return "bg-success";
      case "error":
        return "bg-error";
      default:
        return "bg-base-content/30";
    }
  };

  const handleToggle = () => {
    if (isDefault) {
      return; // 默认服务不允许修改
    }
    onToggleEnabled(!isEnabled);
  };

  return (
    <tr>
      <td>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${getStatusDotColor()}`}
            title={
              server.status === "connected"
                ? "已连接"
                : server.status === "error"
                  ? `连接错误: ${server.error || "未知错误"}`
                  : "未连接"
            }
          />
          <span className="font-medium">
            {server.config.name || server.name}
          </span>
        </div>
      </td>
      <td className="text-right whitespace-nowrap">
        {(toolsCount > 0 || server.error) ? (
          <button className="btn btn-ghost btn-xs" onClick={onViewTools}>
            {server.error ? "查看错误" : `${toolsCount} 个工具`}
          </button>
        ) : (
          <span className="text-base-content/50">0</span>
        )}
      </td>
      <td className="text-center whitespace-nowrap">
        {!isDefault && (
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={isEnabled}
            onChange={handleToggle}
            title={isEnabled ? "点击禁用" : "点击启用"}
          />
        )}
      </td>
      <td className="text-center whitespace-nowrap">
        {!server.is_default && (
          <button
            className="btn btn-sm btn-ghost text-error"
            onClick={onDelete}
            title="删除"
          >
            <HiTrash className="h-4 w-4" />
          </button>
        )}
      </td>
    </tr>
  );
}

// MCP 工具列表弹窗
interface MCPToolsModalProps {
  isOpen: boolean;
  server: MCPServerInfo;
  onClose: () => void;
}

function MCPToolsModal({ isOpen, server, onClose }: MCPToolsModalProps) {
  const [expandedTools, setExpandedTools] = useState<Set<number>>(new Set());

  // 切换工具展开/折叠
  const toggleTool = (index: number) => {
    setExpandedTools((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg mb-4">
          {server.config.name || server.name} - {server.error ? "连接错误" : "工具列表"}
        </h3>

        <div className="space-y-4">
          {server.error ? (
            <div className="bg-error/10 border border-error/20 rounded-lg p-4">
              <div className="font-medium text-error mb-2">连接错误</div>
              <div className="text-sm text-error/70">{server.error}</div>
            </div>
          ) : server.tools && server.tools.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {server.tools.map((tool, index) => {
                const isExpanded = expandedTools.has(index);
                const hasParams =
                  tool.inputSchema.properties &&
                  Object.keys(tool.inputSchema.properties).length > 0;

                return (
                  <div
                    key={index}
                    className="bg-base-200 rounded-lg border border-base-300"
                  >
                    {/* 工具标题区域 - 可点击 */}
                    <button
                      className={`w-full text-left p-4 flex items-center justify-between transition-colors ${
                        hasParams ? "hover:bg-base-300/50 cursor-pointer" : "cursor-default"
                      }`}
                      onClick={() => hasParams && toggleTool(index)}
                    >
                      <div className="flex-1">
                        <div className="font-medium text-base">{tool.name}</div>
                        {tool.description && (
                          <div className="text-sm text-base-content/70 mt-1">
                            {tool.description}
                          </div>
                        )}
                      </div>
                      {hasParams && (
                        <div className="ml-2 flex-shrink-0">
                          {isExpanded ? (
                            <HiChevronUp className="h-5 w-5 text-base-content/50" />
                          ) : (
                            <HiChevronDown className="h-5 w-5 text-base-content/50" />
                          )}
                        </div>
                      )}
                    </button>

                    {/* 参数详情区域 - 可展开/折叠 */}
                    {isExpanded &&
                      hasParams &&
                      tool.inputSchema.properties && (
                        <div className="px-4 pb-4 pt-2 border-t border-base-300">
                          <div className="text-xs font-semibold text-base-content/60 mb-2">
                            参数：
                          </div>
                          <div className="space-y-2">
                            {Object.entries(tool.inputSchema.properties).map(
                              ([paramName, param]) => (
                                <div
                                  key={paramName}
                                  className="text-xs bg-base-300 rounded p-2"
                                >
                                  <div className="font-mono font-medium text-primary">
                                    {paramName}
                                    {tool.inputSchema.required?.includes(paramName) && (
                                      <span className="text-error ml-1">*</span>
                                    )}
                                  </div>
                                  <div className="text-base-content/70 mt-1">
                                    <span className="text-base-content/50">类型: </span>
                                    {param.type}
                                  </div>
                                  {param.description && (
                                    <div className="text-base-content/70 mt-1">
                                      {param.description}
                                    </div>
                                  )}
                                  {param.enum && (
                                    <div className="text-base-content/70 mt-1">
                                      <span className="text-base-content/50">可选值: </span>
                                      {param.enum.join(", ")}
                                    </div>
                                  )}
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-base-content/50">
              <p>该服务器没有可用工具</p>
            </div>
          )}
        </div>

        <div className="modal-action">
          <button className="btn" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onClick={onClose}>
        <button type="submit">close</button>
      </form>
    </div>
  );
}
