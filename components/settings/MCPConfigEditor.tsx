"use client";

// MCP 配置 JSON 编辑器组件

import { useState, useEffect } from "react";
import { HiXMark } from "react-icons/hi2";
import type { MCPConfig, MCPServerConfig } from "@/lib/mcp/types";
import { getMCPConfig, saveMCPConfig } from "@/lib/mcp/storage";

interface MCPConfigEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function MCPConfigEditor({
  isOpen,
  onClose,
  onSave,
}: MCPConfigEditorProps) {
  const [jsonContent, setJsonContent] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  // 加载配置
  useEffect(() => {
    if (isOpen) {
      const result = getMCPConfig();
      if (result.success) {
        setJsonContent(JSON.stringify(result.value, null, 2));
      } else {
        // 使用默认模板
        const defaultConfig: MCPConfig = {};
        setJsonContent(JSON.stringify(defaultConfig, null, 2));
      }
      setJsonError(null);
    }
  }, [isOpen]);

  // 验证 JSON
  const validateJson = (content: string): boolean => {
    try {
      const parsed = JSON.parse(content) as any;

      // 检查是否是旧格式（包含 mcpServers）
      if (parsed.mcpServers) {
        if (typeof parsed.mcpServers !== "object") {
          setJsonError("mcpServers 必须是对象");
          return false;
        }
      } else {
        // 新格式：服务器配置直接作为顶层对象
        // 验证每个服务器配置
        const serverKeys = Object.keys(parsed).filter((key) => key !== "mcpServers");
        for (const key of serverKeys) {
          const serverConfig = parsed[key];
          if (!serverConfig || typeof serverConfig !== "object") {
            setJsonError(`服务器配置 "${key}" 必须是对象`);
            return false;
          }

          // 检查是否有 transport 字段
          if (serverConfig.transport) {
            const transport = serverConfig.transport;
            if (transport.type === "stdio" && !transport.command) {
              setJsonError(`服务器 "${key}": transport.command 是必需的（stdio 传输）`);
              return false;
            } else if (transport.type === "http" && !transport.url) {
              setJsonError(`服务器 "${key}": transport.url 是必需的（http 传输）`);
              return false;
            } else if (transport.type !== "stdio" && transport.type !== "http") {
              setJsonError(`服务器 "${key}": transport.type 必须是 "stdio" 或 "http"`);
              return false;
            }
          } else if (!serverConfig.command && !serverConfig.url) {
            setJsonError(`服务器 "${key}": 必须包含 command（stdio）或 transport/url（http）字段`);
            return false;
          }
        }
      }

      setJsonError(null);
      return true;
    } catch (e) {
      setJsonError(`JSON 格式错误: ${e instanceof Error ? e.message : "未知错误"}`);
      return false;
    }
  };

  const handleSave = async () => {
    if (!validateJson(jsonContent)) {
      return;
    }

    try {
      const parsed = JSON.parse(jsonContent) as MCPConfig;
      const result = saveMCPConfig(parsed);
      if (result.success) {
        // 重新加载工具到注册表
        try {
          const response = await fetch("/api/mcp/load", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ config: parsed }),
          });

          if (response.ok) {
            const data = await response.json();
            console.log("[MCPConfigEditor] MCP tools reloaded:", data);
          } else {
            console.warn("[MCPConfigEditor] Failed to reload MCP tools");
          }
        } catch (error) {
          console.error("[MCPConfigEditor] Error reloading MCP tools:", error);
        }

        onSave();
        onClose();
      } else {
        setJsonError(result.error instanceof Error ? result.error.message : "保存失败");
      }
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : "保存失败");
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="card card-bordered bg-base-100 w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="card-body overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="card-title">MCP 配置</h2>
            <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
              <HiXMark className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="label">
                <span className="label-text">配置 JSON</span>
              </label>
              <textarea
                className={`textarea textarea-bordered w-full font-mono text-sm ${
                  jsonError ? "textarea-error" : ""
                }`}
                value={jsonContent}
                onChange={(e) => {
                  setJsonContent(e.target.value);
                  validateJson(e.target.value);
                }}
                rows={20}
                placeholder={`{
  "server-name": {
    "name": "MCP Server",
    "type": "stdio",
    "enabled": true,
    "transport": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"],
      "workingDir": ".",
      "env": {}
    }
  }
}

或旧格式：

{
  "mcpServers": {
    "server-name": {
      "command": "node",
      "args": ["server.js"]
    }
  }
}`}
              />
              {jsonError && (
                <div className="label">
                  <span className="label-text-alt text-error">{jsonError}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              取消
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
