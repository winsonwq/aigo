"use client";

// 对话容器组件
// 管理对话状态、消息列表和输入框，集成 Session 管理

import { useState, useRef, useEffect, useCallback } from "react";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import type { ChatMessage } from "./types";
import {
  getCurrentSessionId,
  getSession,
  createSession,
  updateSession,
  setCurrentSessionId,
} from "@/lib/session/storage";

export default function ChatContainer() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentSessionId, setCurrentSessionIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  // 加载当前 Session 的消息
  const loadSessionMessages = useCallback(async (sessionId: string | null) => {
    if (!sessionId) {
      // 如果没有当前会话，创建新会话
      const result = createSession();
      if (result.success) {
        setCurrentSessionId(result.value.id);
        setCurrentSessionIdState(result.value.id);
        setMessages([]);
      }
      return;
    }

    const result = getSession(sessionId);
    if (result.success && result.value) {
      setMessages(result.value.messages);
      setCurrentSessionIdState(sessionId);
    } else {
      // Session 不存在，创建新会话
      const newResult = createSession();
      if (newResult.success) {
        setCurrentSessionId(newResult.value.id);
        setCurrentSessionIdState(newResult.value.id);
        setMessages([]);
      }
    }
  }, []);

  // 保存消息到 Session
  const saveMessagesToSession = useCallback(
    (sessionId: string | null, newMessages: ChatMessage[]) => {
      if (!sessionId) return;

      const result = getSession(sessionId);
      if (!result.success || !result.value) return;

      const updatedSession = {
        ...result.value,
        messages: newMessages,
      };

      updateSession(updatedSession);

      // 如果是第一条用户消息，自动更新标题
      const firstUserMessage = newMessages.find((msg) => msg.role === "user");
      if (firstUserMessage && result.value.messages.length === 0) {
        const title = firstUserMessage.content.slice(0, 30).trim();
        if (title) {
          updateSession({
            ...updatedSession,
            title: title.length < firstUserMessage.content.length ? `${title}...` : title,
          });
        }
      }
    },
    []
  );

  // 初始化：加载当前 Session
  useEffect(() => {
    const currentId = getCurrentSessionId();
    loadSessionMessages(currentId);
  }, [loadSessionMessages]);

  // 监听 localStorage 变化（跨标签页同步和 Session 切换）
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "aigo_current_session_id") {
        const newSessionId = e.newValue;
        if (newSessionId !== currentSessionId) {
          loadSessionMessages(newSessionId);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [currentSessionId, loadSessionMessages]);

  // 监听自定义事件（同标签页内 Session 切换）
  useEffect(() => {
    const handleSessionChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{ sessionId: string | null }>;
      const newSessionId = customEvent.detail?.sessionId ?? null;
      if (newSessionId !== currentSessionId) {
        loadSessionMessages(newSessionId);
      }
    };

    window.addEventListener("session-changed", handleSessionChanged);
    return () => window.removeEventListener("session-changed", handleSessionChanged);
  }, [currentSessionId, loadSessionMessages]);

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 取消当前请求
  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (readerRef.current) {
      readerRef.current.cancel().catch(() => {
        // 忽略取消错误
      });
      readerRef.current = null;
    }
    
    // 更新 AI 消息状态为已取消
    setMessages((prev) => {
      const updated = prev.map((msg) => {
        if (msg.isLoading) {
          return {
            ...msg,
            isLoading: false,
            content: msg.content || "[已取消]",
          };
        }
        return msg;
      });
      
      // 保存到 Session
      saveMessagesToSession(currentSessionId, updated);
      
      return updated;
    });
    
    setIsLoading(false);
    abortControllerRef.current = null;
  }, [currentSessionId, saveMessagesToSession]);

  // 发送消息
  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) {
      return;
    }

    // 如果已有进行中的请求，先取消
    if (abortControllerRef.current) {
      handleCancel();
    }

    // 创建新的 AbortController
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // 添加用户消息
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: content.trim(),
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    
    // 立即保存用户消息
    saveMessagesToSession(currentSessionId, newMessages);
    
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

    const messagesWithAI = [...newMessages, aiMessage];
    setMessages(messagesWithAI);

    try {
      // 准备历史消息（转换为 API 格式）
      const historyMessages = messages
        .filter((msg) => msg.role === "user" || msg.role === "assistant")
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

      // 调用 API（流式输出）
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: content.trim(),
          history: historyMessages,
          stream: true,
        }),
        signal: abortController.signal,
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

        // 保存 reader 引用以便取消
        readerRef.current = reader;

        let buffer = "";
        let accumulatedContent = "";

        while (true) {
          // 检查是否已取消
          if (abortController.signal.aborted) {
            reader.cancel().catch(() => {
              // 忽略取消错误
            });
            readerRef.current = null;
            break;
          }

          const { done, value } = await reader.read();
          
          // 再次检查是否已取消（在 read 之后）
          if (abortController.signal.aborted) {
            reader.cancel().catch(() => {
              // 忽略取消错误
            });
            readerRef.current = null;
            break;
          }
          
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            // 在处理每行数据前检查是否已取消
            if (abortController.signal.aborted) {
              break;
            }

            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              
              if (data === "[DONE]") {
                // 流结束
                readerRef.current = null;
                setMessages((prev) => {
                  const updated = prev.map((msg) =>
                    msg.id === aiMessageId
                      ? {
                          ...msg,
                          isLoading: false,
                        }
                      : msg
                  );
                  
                  // 保存最终消息到 Session
                  saveMessagesToSession(currentSessionId, updated);
                  
                  return updated;
                });
                return;
              }

              try {
                const parsed = JSON.parse(data);
                
                // 处理内容更新（实时流式更新）
                if (parsed.type === "content" && parsed.content) {
                  accumulatedContent += parsed.content;
                  
                  // 使用函数式更新确保获取最新状态，并保持 isLoading 状态
                  setMessages((prev) => {
                    const updated = prev.map((msg) => {
                      if (msg.id === aiMessageId) {
                        return {
                          ...msg,
                          content: accumulatedContent,
                          isLoading: true, // 保持加载状态，直到收到 [DONE]
                        };
                      }
                      return msg;
                    });
                    
                    // 实时保存到 Session
                    saveMessagesToSession(currentSessionId, updated);
                    
                    return updated;
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
        readerRef.current = null;
        setMessages((prev) => {
          const updated = prev.map((msg) => {
            if (msg.id === aiMessageId) {
              return {
                ...msg,
                content: accumulatedContent || msg.content,
                isLoading: false,
              };
            }
            return msg;
          });
          
          // 保存最终消息到 Session
          saveMessagesToSession(currentSessionId, updated);
          
          return updated;
        });
      } else {
        // 非流式响应（回退）
        const data = await response.json();
        
        setMessages((prev) => {
          const updated = prev.map((msg) =>
            msg.id === aiMessageId
              ? {
                  ...msg,
                  content: data.content || "",
                  isLoading: false,
                }
              : msg
          );
          
          // 保存消息到 Session
          saveMessagesToSession(currentSessionId, updated);
          
          return updated;
        });
      }
    } catch (err) {
      // 如果是取消操作，不显示错误
      if (err instanceof Error && err.name === "AbortError") {
        // 取消操作已在 handleCancel 中处理
        return;
      }
      
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      
      // 更新 AI 消息显示错误
      setMessages((prev) => {
        const updated = prev.map((msg) =>
          msg.id === aiMessageId
            ? {
                ...msg,
                content: "",
                isLoading: false,
                error: errorMessage,
              }
            : msg
        );
        
        // 保存错误状态到 Session
        saveMessagesToSession(currentSessionId, updated);
        
        return updated;
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
      readerRef.current = null;
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
        <div className="flex justify-center w-full">
          <div className="w-full max-w-[60%]">
            <ChatInput 
              onSend={handleSendMessage} 
              onCancel={handleCancel}
              isLoading={isLoading}
              disabled={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
