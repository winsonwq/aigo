"use client";

// 用户消息组件
// 显示在左侧，带边框和圆角

import { useState } from "react";
import { FiCopy } from "react-icons/fi";
import type { ChatMessage } from "./types";

interface UserMessageProps {
  message: ChatMessage;
  userMessageIndex?: number;
}

export default function UserMessage({ message }: UserMessageProps) {
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
    <div className="flex justify-start w-full">
      <div className="flex w-full max-w-[80%] flex-col items-start gap-2 border border-base-300 rounded-lg px-4 py-2">
        {/* 消息内容 */}
        <div>
          <p className="break-words text-base-content" style={{ whiteSpace: 'normal' }}>{message.content}</p>
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
