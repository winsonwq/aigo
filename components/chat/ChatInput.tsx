"use client";

// 输入框组件
// 支持多行输入、发送快捷键（Enter/Cmd+Enter）

import { useState, KeyboardEvent, useRef, useEffect } from "react";
import { FiSend } from "react-icons/fi";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动调整高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (input.trim() && !disabled) {
      onSend(input);
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl + Enter 发送
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
      return;
    }

    // Enter 发送（Shift+Enter 换行）
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-end gap-2 rounded-lg border border-base-300 bg-base-100 p-2">
        <textarea
          ref={textareaRef}
          className="textarea textarea-ghost flex-1 resize-none border-0 focus:outline-none"
          placeholder="输入消息..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          style={{ maxHeight: "200px", overflowY: "auto" }}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          title="发送 (Enter)"
        >
          <FiSend className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 text-xs text-base-content/40">
        <span>Enter 发送</span>
        <span className="mx-2">·</span>
        <span>Shift+Enter 换行</span>
        <span className="mx-2">·</span>
        <span>Cmd/Ctrl+Enter 发送</span>
      </div>
    </div>
  );
}
