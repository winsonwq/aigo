"use client";

// 用户消息组件
// 显示在左侧，使用 sticky 样式固定在顶部

import { useState } from "react";
import { FiCopy } from "react-icons/fi";
import type { ChatMessage } from "./types";

interface UserMessageProps {
  message: ChatMessage;
  isLastUserMessage?: boolean;
}

export default function UserMessage({ message, isLastUserMessage = false }: UserMessageProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className={`flex justify-start ${isLastUserMessage ? "sticky top-0 z-10 bg-base-100/95 backdrop-blur-sm border-b border-base-300 pb-2 mb-2" : ""}`}>
      <div className="flex max-w-[80%] flex-col items-start gap-2">
        {/* 消息内容 */}
        <div className="px-2 py-1">
          <p className="whitespace-pre-wrap break-words text-base-content">{message.content}</p>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2">
          <button
            className="btn btn-ghost btn-xs"
            onClick={handleCopy}
            title="复制"
          >
            <FiCopy className="h-3 w-3" />
            {copied && <span className="ml-1 text-xs">已复制</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
