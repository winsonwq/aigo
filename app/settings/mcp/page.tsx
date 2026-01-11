"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { HiArrowLeft, HiPencil, HiArrowPath } from "react-icons/hi2";
import MCPServerList from "@/components/settings/MCPServerList";
import MCPConfigEditor from "@/components/settings/MCPConfigEditor";

export default function MCPSettingsPage() {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    // 触发子组件刷新，并刷新工具
    window.dispatchEvent(
      new CustomEvent("mcp-refresh", { detail: { refreshTools: true } })
    );
    setTimeout(() => setRefreshing(false), 2000);
  }, []);

  const handleOpenEditor = useCallback(() => {
    setIsEditorOpen(true);
  }, []);

  const handleCloseEditor = useCallback(() => {
    setIsEditorOpen(false);
    // 刷新列表
    handleRefresh();
  }, [handleRefresh]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-base-300 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/settings"
              className="btn btn-ghost btn-sm btn-circle"
              title="返回设置"
            >
              <HiArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold">MCP 配置</h1>
              <p className="text-sm text-base-content/70">配置和管理 MCP Server，集成外部工具</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-sm btn-ghost gap-2"
              onClick={handleRefresh}
              disabled={refreshing}
              title="刷新"
            >
              <HiArrowPath className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              <span>刷新</span>
            </button>
            <button className="btn btn-sm btn-primary gap-2" onClick={handleOpenEditor}>
              <HiPencil className="h-4 w-4" />
              <span>设置</span>
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <MCPServerList />
      </div>

      {/* JSON 配置编辑器 */}
      {isEditorOpen && (
        <MCPConfigEditor
          isOpen={isEditorOpen}
          onClose={handleCloseEditor}
          onSave={handleCloseEditor}
        />
      )}
    </div>
  );
}
