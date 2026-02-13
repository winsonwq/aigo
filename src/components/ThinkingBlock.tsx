import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AssistantCollapsibleBlock,
  getBlockLabel,
} from "@/components/AssistantCollapsibleBlock";

function getThinkingText(part: Record<string, unknown>): string {
  const keys = ["thinking", "reasoning", "content", "text", "summary"];
  for (const key of keys) {
    const value = part[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

export type ThinkingBlockProps = {
  part: Record<string, unknown>;
  /** 当前消息是否仍在流式输出（未结束） */
  isStreaming: boolean;
};

/**
 * Thinking 区块：输出时默认展开，输出结束后自动折叠，标签变为 Thought。
 * 若用户曾手动展开/折叠，则保持用户操作状态，不再自动折叠。
 */
export function ThinkingBlock({ part, isStreaming }: ThinkingBlockProps) {
  const text = getThinkingText(part);
  const [userHasToggled, setUserHasToggled] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  const open = userHasToggled ? userOpen : isStreaming;

  const onSummaryClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setUserHasToggled(true);
    setUserOpen((prev) => !prev);
  }, []);

  const label = getBlockLabel("Thinking", "Thought", isStreaming);

  return (
    <AssistantCollapsibleBlock
      label={label}
      open={open}
      onSummaryClick={onSummaryClick}
    >
      {text ? (
        <div className="assistant-thinking-content markdown-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>
      ) : undefined}
    </AssistantCollapsibleBlock>
  );
}
