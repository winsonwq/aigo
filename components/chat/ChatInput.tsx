"use client";

// 输入框组件
// 支持多行输入、发送快捷键（Enter/Cmd+Enter）、取消按钮

import { useState, KeyboardEvent, useRef, useEffect } from "react";
import { FiSend } from "react-icons/fi";
import { HiStop } from "react-icons/hi2";

interface ChatInputProps {
  onSend: (message: string) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export default function ChatInput({ 
  onSend, 
  onCancel, 
  isLoading = false,
  disabled = false 
}: ChatInputProps) {
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
    // 如果正在加载，ESC 键取消
    if (isLoading && e.key === "Escape") {
      e.preventDefault();
      onCancel?.();
      return;
    }

    // Cmd/Ctrl + Enter 发送
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (!isLoading) {
        handleSend();
      }
      return;
    }

    // Enter 发送（Shift+Enter 换行）
    if (e.key === "Enter" && !e.shiftKey && !isLoading) {
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
          className="textarea textarea-ghost flex-1 resize-none border-0 focus:outline-none text-base"
          placeholder={isLoading ? "AI 正在回复..." : "输入消息..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isLoading}
          rows={1}
          style={{ maxHeight: "200px", overflowY: "auto" }}
        />
        {isLoading ? (
          <button
            className="btn btn-error btn-sm"
            onClick={onCancel}
            title="取消 (ESC)"
          >
            <HiStop className="h-4 w-4" />
          </button>
        ) : (
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSend}
            disabled={disabled || !input.trim()}
            title="发送 (Enter)"
          >
            <FiSend className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
