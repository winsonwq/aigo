import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2, Wrench } from "lucide-react";
import { useOpenCode } from "@/context/OpenCodeContext";
import {
  useSessionMessages,
  type MessageWithParts,
  type MessagePart,
  type ToolPart,
} from "@/hooks/useSessionMessages";

function isTextPart(p: MessagePart): p is { type: "text"; text?: string; content?: string } {
  return p && typeof p === "object" && "type" in p && p.type === "text";
}

function getPartText(part: { type: "text"; text?: string; content?: string }): string {
  return (part.text ?? (part as { content?: string }).content ?? "") || "";
}

function isToolPart(p: MessagePart): p is ToolPart {
  return p && typeof p === "object" && "type" in p && p.type === "tool";
}

function getAssistantError(msg: MessageWithParts): string | null {
  const err = msg.info.error;
  if (!err) return null;
  return err.data?.message ?? err.message ?? err.name ?? "助手执行失败";
}

function MessageBubble({
  msg,
  isUser,
}: {
  msg: MessageWithParts;
  isUser: boolean;
}) {
  const assistantError = !isUser ? getAssistantError(msg) : null;
  const hasRenderableParts = msg.parts.some((part) => isTextPart(part) || isToolPart(part));

  return (
    <div
      className={
        "mb-4 flex " + (isUser ? "justify-end" : "justify-start")
      }
    >
      <div
        className={
          "max-w-[85%] rounded-lg px-4 py-2 text-sm " +
          (isUser
            ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
            : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200")
        }
      >
        {msg.parts.map((part, idx) => {
          const key = (part as { id?: string }).id ?? `part-${idx}`;
          if (isTextPart(part)) {
            const text = getPartText(part);
            if (isUser) {
              return (
                <p key={key} className="whitespace-pre-wrap">
                  {text}
                </p>
              );
            }
            return (
              <div
                key={key}
                className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:my-2 prose-ul:my-1 prose-ol:my-1"
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {text}
                </ReactMarkdown>
              </div>
            );
          }
          if (isToolPart(part)) {
            return <ToolPartBlock key={key} part={part} />;
          }
          return null;
        })}
        {!isUser && !hasRenderableParts && assistantError && (
          <p className="whitespace-pre-wrap text-red-600 dark:text-red-400">
            {assistantError}
          </p>
        )}
        {!isUser && !hasRenderableParts && !assistantError && (
          <p className="text-zinc-500 dark:text-zinc-400">助手未返回可展示内容。</p>
        )}
      </div>
    </div>
  );
}

/** 工具调用：时间线样式（参考 OpenWork execution plan / Claude Code 步骤展示） */
function ToolPartBlock({ part }: { part: ToolPart }) {
  const [expanded, setExpanded] = useState(false);
  const status = part.state?.status ?? "pending";
  const statusLabel =
    status === "pending"
      ? "等待"
      : status === "running"
        ? "执行中"
        : status === "completed"
          ? "完成"
          : "错误";
  const hasDetails =
    (part.state?.input && Object.keys(part.state.input).length > 0) ||
    (part.state?.output != null && part.state.output !== "") ||
    (part.state?.error != null && part.state.error !== "");
  const statusColor =
    status === "error"
      ? "text-red-600 dark:text-red-400"
      : status === "running"
        ? "text-amber-600 dark:text-amber-400"
        : status === "completed"
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-zinc-500 dark:text-zinc-400";

  return (
    <div className="mt-3 flex gap-3">
      {/* 时间线竖线 + 圆点 */}
      <div className="flex flex-col items-center">
        <div
          className={
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 " +
            (status === "running"
              ? "border-amber-500 bg-amber-500/20 text-amber-600 dark:text-amber-400"
              : status === "completed"
                ? "border-emerald-500 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                : status === "error"
                  ? "border-red-500 bg-red-500/20 text-red-600 dark:text-red-400"
                  : "border-zinc-400 bg-zinc-100 dark:border-zinc-500 dark:bg-zinc-700")
          }
        >
          {status === "running" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Wrench className="h-3.5 w-3.5" />
          )}
        </div>
        <div className="mt-1 h-2 w-px bg-zinc-200 dark:bg-zinc-600" />
      </div>
      <div className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50/80 dark:border-zinc-600 dark:bg-zinc-800/80">
        <div className="flex flex-wrap items-center gap-2 p-2">
          <span className="font-mono text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {part.tool}
          </span>
          <span className={`text-xs font-medium ${statusColor}`}>
            {statusLabel}
          </span>
          {part.state?.title && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {String(part.state.title)}
            </span>
          )}
          {hasDetails && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="text-xs text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            >
              {expanded ? "收起" : "详情"}
            </button>
          )}
        </div>
        {expanded && hasDetails && (
          <div className="border-t border-zinc-200 p-2 space-y-2 dark:border-zinc-600">
            {part.state?.input &&
              Object.keys(part.state.input).length > 0 && (
                <div>
                  <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">
                    输入
                  </div>
                  <pre className="max-h-32 overflow-auto rounded bg-zinc-200/60 p-2 text-xs dark:bg-zinc-700/60">
                    {JSON.stringify(part.state.input, null, 2)}
                  </pre>
                </div>
              )}
            {part.state?.output != null && part.state.output !== "" && (
              <div>
                <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">
                  输出
                </div>
                <pre className="max-h-40 overflow-auto rounded bg-zinc-200/60 p-2 text-xs dark:bg-zinc-700/60">
                  {String(part.state.output)}
                </pre>
              </div>
            )}
            {part.state?.error != null && part.state.error !== "" && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {String(part.state.error)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function Session() {
  const { id } = useParams<{ id: string }>();
  const { status: openCodeStatus } = useOpenCode();
  const {
    messages,
    isLoading,
    error,
    sendError,
    isSessionBusy,
    sendPrompt,
  } = useSessionMessages(id);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, isSessionBusy]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isSessionBusy) return;
    setInput("");
    await sendPrompt(text);
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  };

  const isConnected = openCodeStatus === "connected";

  if (!id) {
    return (
      <div className="p-6">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          缺少会话 ID，请从左侧选择会话。
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-6">
      <h1 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        会话
      </h1>
      {!isConnected && (
        <p className="mb-3 text-sm text-amber-600 dark:text-amber-400">
          请先连接 OpenCode（侧栏连接状态）。
        </p>
      )}
      {error && (
        <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {sendError && (
        <p className="mb-3 text-sm text-red-600 dark:text-red-400">{sendError}</p>
      )}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
      >
        {isLoading && messages.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            加载消息…
          </p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            暂无消息，在下方输入并发送开始对话。
          </p>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.info.id}
                msg={msg}
                isUser={msg.info.role === "user"}
              />
            ))}
            {isSessionBusy && (
              <div className="mb-4 flex justify-start">
                <div className="flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  <span>思考中…</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <form
        onSubmit={handleSubmit}
        className="mt-4 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入消息…"
          disabled={!isConnected || isSessionBusy}
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
        <button
          type="submit"
          disabled={!isConnected || isSessionBusy || !input.trim()}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-700 dark:hover:bg-zinc-600"
        >
          {isSessionBusy ? "思考中…" : "发送"}
        </button>
      </form>
    </div>
  );
}
