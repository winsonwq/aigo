"use client";

// 对话容器组件
// 管理对话状态、消息列表和输入框

import { useState, useRef, useEffect } from "react";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import type { ChatMessage } from "./types";

export default function ChatContainer() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 发送消息
  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) {
      return;
    }

    // 添加用户消息
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: content.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    // 添加占位的 AI 消息
    const aiMessageId = `ai-${Date.now()}`;
    const aiMessage: ChatMessage = {
      id: aiMessageId,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      isLoading: true,
      reactSteps: [], // 初始化空数组，流式过程中会逐步添加步骤
    };

    setMessages((prev) => [...prev, aiMessage]);

    try {
      // 调用 API（流式输出）
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: content.trim(),
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get response");
      }

      // 检查是否是流式响应
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("text/event-stream")) {
        // 流式处理
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("Failed to get response reader");
        }

        let buffer = "";
        let accumulatedContent = "";

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              
              if (data === "[DONE]") {
                // 流结束
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === aiMessageId
                      ? {
                          ...msg,
                          isLoading: false,
                        }
                      : msg
                  )
                );
                return;
              }

              try {
                const parsed = JSON.parse(data);
                
                // 处理内容更新（实时流式更新）
                if (parsed.type === "content" && parsed.content) {
                  accumulatedContent += parsed.content;
                  
                  // 使用函数式更新确保获取最新状态
                  setMessages((prev) => {
                    return prev.map((msg) => {
                      if (msg.id === aiMessageId) {
                        return {
                          ...msg,
                          content: accumulatedContent,
                          isLoading: true,
                        };
                      }
                      return msg;
                    });
                  });
                }

                // 处理 ReAct 步骤事件
                if (parsed.type === "react_step" && parsed.step) {
                  setMessages((prev) => {
                    return prev.map((msg) => {
                      if (msg.id === aiMessageId) {
                        const existingSteps = msg.reactSteps || [];
                        
                        // 检查是否已存在相同 ID 的步骤（更新）或添加新步骤
                        const stepIndex = existingSteps.findIndex((s) => s.id === parsed.step.id);
                        const newSteps = stepIndex >= 0
                          ? existingSteps.map((s, i) => i === stepIndex ? parsed.step : s)
                          : [...existingSteps, parsed.step];
                        
                        return {
                          ...msg,
                          reactSteps: newSteps,
                        };
                      }
                      return msg;
                    });
                  });
                }

                // 处理错误
                if (parsed.type === "error") {
                  throw new Error(parsed.error || "Stream error");
                }
              } catch (parseError) {
                // 忽略 JSON 解析错误（可能是部分数据）
                if (data !== "[DONE]") {
                  console.error("[SSE Parse Error]:", {
                    error: parseError,
                    errorMessage: parseError instanceof Error ? parseError.message : String(parseError),
                    errorStack: parseError instanceof Error ? parseError.stack : undefined,
                    data: data.substring(0, 200),
                    line: line.substring(0, 200),
                  });
                }
              }
            }
          }
        }

        // 流结束，标记为完成
        setMessages((prev) => {
          return prev.map((msg) => {
            if (msg.id === aiMessageId) {
              return {
                ...msg,
                content: accumulatedContent || msg.content,
                isLoading: false,
              };
            }
            return msg;
          });
        });
      } else {
        // 非流式响应（回退）
        const data = await response.json();
        
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId
              ? {
                  ...msg,
                  content: data.content || "",
                  isLoading: false,
                }
              : msg
          )
        );
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      
      // 更新 AI 消息显示错误
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId
            ? {
                ...msg,
                content: "",
                isLoading: false,
                error: errorMessage,
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* 消息列表区域 */}
      <div className="flex-1 overflow-y-auto">
        <MessageList messages={messages} />
        <div ref={messagesEndRef} />
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="border-t border-base-300 bg-error/10 px-4 py-2">
          <div className="flex items-center gap-2 text-sm text-error">
            <span>⚠️</span>
            <span>{error}</span>
            <button
              className="ml-auto text-error/70 hover:text-error"
              onClick={() => setError(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 输入区域 */}
      <div className="border-t border-base-300 bg-base-100">
        <ChatInput onSend={handleSendMessage} disabled={isLoading} />
      </div>
    </div>
  );
}
