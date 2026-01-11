"use client";

// ReAct 步骤可视化组件
// 简单显示思考、工具调用、观察等步骤

import React, { useState } from "react";
import { FiChevronDown, FiChevronRight, FiZap, FiTool, FiEye } from "react-icons/fi";
import ReactMarkdown, { type Components } from "react-markdown";
import type { ReActStep } from "./types";

interface ReActStepProps {
  step: ReActStep;
  defaultExpanded?: boolean;
  showMarkdown?: boolean;
}

// Markdown 组件配置（复用）
const markdownComponents: Partial<Components> = {
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
  p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
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
  hr: () => (
    <hr className="border-0 border-t border-base-content/20 my-6" />
  ),
};

// 渲染 Markdown 内容的辅助函数
function renderMarkdownContent(content: string, showMarkdown: boolean): React.ReactNode {
  if (!showMarkdown) {
    return content;
  }
  
  return (
    <div className="prose max-w-none break-words">
      <ReactMarkdown components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default function ReActStepComponent({ step, defaultExpanded = false, showMarkdown = false }: ReActStepProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  const getStepLabel = () => {
    switch (step.type) {
      case "thought":
        return "思考";
      case "tool_call":
        return "工具调用";
      case "observation":
        return "观察结果";
      case "final_answer":
        return "最终回答";
      default:
        return "步骤";
    }
  };

  const getStepIcon = () => {
    switch (step.type) {
      case "thought":
        return <FiZap className="h-3 w-3" />;
      case "tool_call":
        return <FiTool className="h-3 w-3" />;
      case "observation":
        return <FiEye className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    if (!step.toolCall) return "text-base-content/60";
    switch (step.toolCall.status) {
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
    if (!step.toolCall) return "";
    switch (step.toolCall.status) {
      case "running":
        return "执行中";
      case "completed":
        return "已完成";
      case "error":
        return "错误";
      default:
        return "";
    }
  };

  // 只有工具调用使用折叠方式显示，观察结果直接展示
  const isCollapsible = step.type === "tool_call";

  return (
    <div className="mb-3">
      {/* 观察结果：直接展示，不折叠，样式与 Thought 一致 */}
      {step.type === "observation" ? (
        <div>
          {/* 步骤标签 */}
          <div className="flex items-center gap-1.5 text-xs font-semibold text-base-content/70 mb-1">
            {getStepIcon()}
            <span>{getStepLabel()}</span>
            {step.toolCall && step.toolCall.name && (
              <span className="text-base-content/50 ml-1">
                ({step.toolCall.name})
              </span>
            )}
          </div>
          
          {/* 步骤内容 */}
          {step.toolCall && step.toolCall.result !== undefined && (
            <div className="text-base-content/90 break-words" style={{ whiteSpace: 'normal' }}>
              {renderMarkdownContent(
                typeof step.toolCall.result === "string" 
                  ? step.toolCall.result 
                  : JSON.stringify(step.toolCall.result, null, 2),
                showMarkdown
              )}
            </div>
          )}
          
          {/* 如果没有 toolCall.result，显示 content */}
          {(!step.toolCall || step.toolCall.result === undefined) && step.content && step.content.trim() && (
            <div className="text-base-content/90 break-words" style={{ whiteSpace: 'normal' }}>
              {renderMarkdownContent(
                step.content.replace(/^工具执行结果:\s*/, ""),
                showMarkdown
              )}
            </div>
          )}

          {/* 错误 */}
          {step.toolCall && step.toolCall.error && (
            <div className="text-sm text-error mt-1">
              {step.toolCall.error}
            </div>
          )}
        </div>
      ) : isCollapsible ? (
        // 折叠式显示（仅工具调用）
        <div className="rounded-md border border-base-300 bg-base-200/30 overflow-hidden">
          {/* 折叠头部 */}
          <button
            className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-base-200/50 transition-colors cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {isExpanded ? (
                <FiChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-base-content/50" />
              ) : (
                <FiChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-base-content/50" />
              )}
              <span className="flex items-center gap-1.5 text-xs font-medium text-base-content/80 truncate">
                {getStepIcon()}
                <span>
                  {getStepLabel()}
                  {step.toolCall && `: ${step.toolCall.name}`}
                </span>
              </span>
            </div>
            {/* 只显示非完成状态（执行中、错误），已完成状态不显示 */}
            {step.toolCall && step.toolCall.status && step.toolCall.status !== "completed" && (
              <span className={`text-xs font-medium ${getStatusColor()} flex-shrink-0 ml-2`}>
                {getStatusText()}
              </span>
            )}
          </button>

          {/* 折叠内容 */}
          {isExpanded && (
            <div className="border-t border-base-300 bg-base-100/50">
              <div className="p-3 space-y-3">
                {/* 步骤内容（如果有） */}
                {step.content && step.content.trim() && (
                  <div className="text-xs text-base-content/80 whitespace-pre-wrap break-words leading-relaxed">
                    {step.content}
                  </div>
                )}

                {/* 工具调用详情 */}
                {step.toolCall && (
                  <div className="space-y-2.5">
                    {/* 参数 */}
                    {step.toolCall.arguments && Object.keys(step.toolCall.arguments).length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-base-content/50 mb-1.5 uppercase tracking-wide">
                          参数
                        </p>
                        <pre className="text-xs bg-base-200 rounded p-2.5 overflow-x-auto font-mono text-base-content/90 border border-base-300">
                          {JSON.stringify(step.toolCall.arguments, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* 结果 */}
                    {step.toolCall.result !== undefined && (
                      <div>
                        <p className="text-xs font-semibold text-base-content/50 mb-1.5 uppercase tracking-wide">
                          结果
                        </p>
                        <pre className="text-xs bg-base-200 rounded p-2.5 overflow-x-auto font-mono text-base-content/90 border border-base-300 break-words whitespace-pre-wrap">
                          {typeof step.toolCall.result === "string" 
                            ? step.toolCall.result 
                            : JSON.stringify(step.toolCall.result, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* 错误 */}
                    {step.toolCall.error && (
                      <div>
                        <p className="text-xs font-semibold text-error mb-1.5 uppercase tracking-wide">
                          错误
                        </p>
                        <div className="text-xs text-error bg-error/10 rounded p-2.5 break-words border border-error/20">
                          {step.toolCall.error}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        // 普通显示（思考步骤）
        <div>
          {/* 步骤标签 */}
          <div className="flex items-center gap-1.5 text-xs font-semibold text-base-content/70 mb-1">
            {getStepIcon()}
            <span>{getStepLabel()}</span>
          </div>
          
          {/* 步骤内容 */}
          {step.content && (
            <div className="text-base-content/90 break-words" style={{ whiteSpace: 'normal' }}>
              {renderMarkdownContent(step.content, showMarkdown)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
