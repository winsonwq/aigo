"use client";

// 工具调用可视化组件
// 显示工具调用过程（可折叠）

import { useState } from "react";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";
import type { ToolCallInfo } from "./types";

interface ToolCallProps {
  toolCall: ToolCallInfo;
}

export default function ToolCall({ toolCall }: ToolCallProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusColor = () => {
    switch (toolCall.status) {
      case "pending":
        return "text-base-content/40";
      case "running":
        return "text-info";
      case "completed":
        return "text-success";
      case "error":
        return "text-error";
      default:
        return "text-base-content/60";
    }
  };

  const getStatusText = () => {
    switch (toolCall.status) {
      case "pending":
        return "等待中";
      case "running":
        return "执行中";
      case "completed":
        return "已完成";
      case "error":
        return "错误";
      default:
        return "未知";
    }
  };

  return (
    <div className="rounded-lg border border-base-300 bg-base-200">
      {/* 工具调用头部 */}
      <button
        className="flex w-full items-center justify-between p-3 text-left"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <FiChevronDown className="h-4 w-4" />
          ) : (
            <FiChevronRight className="h-4 w-4" />
          )}
          <span className="font-semibold">{toolCall.name}</span>
          <span className={`text-xs ${getStatusColor()}`}>
            ({getStatusText()})
          </span>
        </div>
      </button>

      {/* 工具调用详情（可折叠） */}
      {isExpanded && (
        <div className="border-t border-base-300 p-3 space-y-2">
          {/* 参数 */}
          <div>
            <p className="text-xs font-semibold text-base-content/60 mb-1">参数:</p>
            <pre className="text-xs bg-base-300 rounded p-2 overflow-x-auto">
              {JSON.stringify(toolCall.arguments, null, 2)}
            </pre>
          </div>

          {/* 结果 */}
          {toolCall.result !== undefined && (
            <div>
              <p className="text-xs font-semibold text-base-content/60 mb-1">结果:</p>
              <pre className="text-xs bg-base-300 rounded p-2 overflow-x-auto">
                {JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          )}

          {/* 错误 */}
          {toolCall.error && (
            <div>
              <p className="text-xs font-semibold text-error mb-1">错误:</p>
              <p className="text-xs text-error bg-error/10 rounded p-2">
                {toolCall.error}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
