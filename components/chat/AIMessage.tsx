"use client";

// AI 消息组件
// 显示在左侧，支持加载状态、错误显示、工具调用展示、Markdown 渲染

import { useState } from "react";
import { FiCopy } from "react-icons/fi";
import ReactMarkdown from "react-markdown";
import ToolCall from "./ToolCall";
import ReActStepComponent from "./ReActStep";
import type { ChatMessage } from "./types";

interface AIMessageProps {
  message: ChatMessage;
}

export default function AIMessage({ message }: AIMessageProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!message.content) return;
    
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="flex justify-start">
      <div className="flex max-w-[80%] flex-col items-start gap-2">
        {/* 错误显示 */}
        {message.error && (
          <div className="rounded-lg bg-base-200 px-4 py-2 text-error">
            <p className="font-semibold">错误</p>
            <p className="text-sm">{message.error}</p>
          </div>
        )}

        {/* ReAct 步骤展示（所有内容都显示在这里，顺序显示） */}
        {message.reactSteps && message.reactSteps.length > 0 ? (
          <div className="w-full">
            {(() => {
              const filteredSteps = message.reactSteps.filter(
                step => step.content !== "正在思考..." || message.isLoading
              );
              
              // 检查最后一个步骤是否是思考步骤
              const lastStep = filteredSteps[filteredSteps.length - 1];
              const isLastStepThought = lastStep && 
                lastStep.type === "thought" && 
                lastStep.content && 
                lastStep.content !== "正在思考..." &&
                lastStep.content.trim().length > 0;
              
              // 如果最后一个步骤是思考步骤，且内容与 message.content 相同或包含，则不显示流式内容
              // 这样可以避免重复显示最终回答
              const lastStepContent = isLastStepThought ? lastStep.content.trim() : "";
              const messageContent = message.content ? message.content.trim() : "";
              const contentMatches = lastStepContent && messageContent && 
                (lastStepContent === messageContent || 
                 lastStepContent.includes(messageContent) || 
                 messageContent.includes(lastStepContent));
              
              const shouldShowStreamContent = message.content && 
                message.content.trim().length > 0 && 
                (!isLastStepThought || !contentMatches);
              
              return (
                <>
                  {filteredSteps.map((step, index) => {
                    // 最后一个 Thought 步骤应该显示 Markdown（这是最终回答）
                    const isLastThought = step.type === "thought" && 
                      index === filteredSteps.length - 1 &&
                      step.content && 
                      step.content !== "正在思考..." &&
                      step.content.trim().length > 0;
                    
                    // Observation 步骤也应该显示 Markdown
                    const isObservation = step.type === "observation";
                    
                    return (
                      <ReActStepComponent 
                        key={step.id}
                        step={step} 
                        showMarkdown={isLastThought || isObservation ? true : undefined}
                      />
                    );
                  })}
                  
                  {/* 显示流式内容（只有在最后一个步骤不是思考步骤，或者内容不同时才显示） */}
                  {shouldShowStreamContent && (
                    <div className="mt-2 rounded-lg bg-base-200 px-4 py-2">
                      <div className="prose prose-sm max-w-none break-words">
                        <ReactMarkdown
                          components={{
                            code: ({ className, children, ...props }) => {
                              const isInline = !className?.includes("language-");
                              return isInline ? (
                                <code className="bg-base-300 px-1 py-0.5 rounded text-sm" {...props}>
                                  {children}
                                </code>
                              ) : (
                                <code className="block bg-base-300 p-2 rounded text-sm overflow-x-auto" {...props}>
                                  {children}
                                </code>
                              );
                            },
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                        {message.isLoading && (
                          <span className="inline-block w-2 h-2 bg-primary rounded-full ml-1 animate-pulse"></span>
                        )}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
            
            {/* 加载指示器（如果正在加载且没有最终回答） */}
            {message.isLoading && (
              <div className="flex items-center gap-2 text-base-content/60 mt-2">
                <span className="loading loading-spinner loading-sm"></span>
                <span className="text-sm">AI 正在思考...</span>
              </div>
            )}
          </div>
        ) : (
          /* 没有 ReAct 步骤时的回退显示（兼容旧格式或简单回答） */
          <div className="rounded-lg bg-base-200 px-4 py-2">
            <div className="prose prose-sm max-w-none break-words">
              {message.content && message.content.trim().length > 0 ? (
                <>
                  <ReactMarkdown
                    components={{
                      code: ({ className, children, ...props }) => {
                        const isInline = !className?.includes("language-");
                        return isInline ? (
                          <code className="bg-base-300 px-1 py-0.5 rounded text-sm" {...props}>
                            {children}
                          </code>
                        ) : (
                          <code className="block bg-base-300 p-2 rounded text-sm overflow-x-auto" {...props}>
                            {children}
                          </code>
                        );
                      },
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
                      li: ({ children }) => <li className="mb-1">{children}</li>,
                      h1: ({ children }) => <h1 className="text-xl font-bold mb-2 mt-4 first:mt-0">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-lg font-bold mb-2 mt-4 first:mt-0">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h3>,
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-primary pl-4 italic my-2">
                          {children}
                        </blockquote>
                      ),
                      a: ({ children, href }) => (
                        <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                  {message.isLoading && (
                    <span className="inline-block w-2 h-2 bg-primary rounded-full ml-1 animate-pulse"></span>
                  )}
                </>
              ) : (
                message.isLoading && (
                  <div className="flex items-center gap-2">
                    <span className="loading loading-spinner loading-sm"></span>
                    <span className="text-sm text-base-content/60">AI 正在思考...</span>
                  </div>
                )
              )}
            </div>
          </div>
        )}
        
        {/* 调试：如果没有步骤但应该显示，输出警告 */}
        {process.env.NODE_ENV === "development" && !message.isLoading && !message.error && (
          <div className="text-xs text-warning/60">
            {message.reactSteps?.length === 0 && "⚠️ 没有 ReAct 步骤"}
          </div>
        )}

        {/* 工具调用展示（兼容旧格式） */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="w-full space-y-2 mt-2">
            {message.toolCalls.map((toolCall) => (
              <ToolCall key={toolCall.id} toolCall={toolCall} />
            ))}
          </div>
        )}

        {/* 操作按钮 */}
        {!message.isLoading && !message.error && message.content && (
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
        )}
      </div>
    </div>
  );
}
