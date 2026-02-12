import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowUp,
  Brain,
  ChevronDown,
  ChevronRight,
  Loader2,
  Paperclip,
  Square,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ModelSelect } from "@/components/ui/model-select";
import { useOpenCode } from "@/context/OpenCodeContext";
import { MODEL_OPTIONS, persistDefaultModel, readDefaultModel } from "@/config/models";
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

type Attachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  excerpt?: string;
  truncated?: boolean;
};

type MessageGroup = {
  id: string;
  user?: MessageWithParts;
  assistant: MessageWithParts[];
};

function groupMessagesByTurn(list: MessageWithParts[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const msg of list) {
    if (msg.info.role === "user") {
      groups.push({
        id: msg.info.id || `group-${groups.length + 1}`,
        user: msg,
        assistant: [],
      });
      continue;
    }
    const last = groups[groups.length - 1];
    if (!last) {
      groups.push({
        id: `orphan-${msg.info.id || groups.length + 1}`,
        assistant: [msg],
      });
      continue;
    }
    last.assistant.push(msg);
  }
  return groups;
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isLikelyTextFile(file: File): boolean {
  if (file.type.startsWith("text/")) return true;
  const lower = file.name.toLowerCase();
  return [
    ".md",
    ".txt",
    ".json",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".css",
    ".html",
    ".xml",
    ".yaml",
    ".yml",
    ".py",
    ".java",
    ".go",
    ".rs",
    ".sh",
    ".sql",
  ].some((ext) => lower.endsWith(ext));
}

function buildAttachmentContext(attachments: Attachment[]): string {
  if (attachments.length === 0) return "";
  const lines = ["[上传文件]"];
  attachments.forEach((file, idx) => {
    lines.push(`- ${idx + 1}. ${file.name} (${formatBytes(file.size)})`);
    if (file.excerpt) {
      lines.push("```");
      lines.push(file.excerpt);
      if (file.truncated) lines.push("...（文件内容过长，已截断）");
      lines.push("```");
    } else {
      lines.push("（二进制或较大文件，仅传递文件元信息）");
    }
  });
  return lines.join("\n");
}

function getObjectValue(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function isThinkingLikePart(part: Record<string, unknown>): boolean {
  const type = String(part.type ?? "").toLowerCase();
  if (type.includes("thinking") || type.includes("reasoning")) return true;
  const text = getObjectValue(part, ["thinking", "reasoning", "content", "text"]);
  return typeof text === "string" && text.length > 0 && type !== "text";
}

/** 将 assistant 消息的 parts 按语义分段：文本 / thinking / 连续工具为一组 */
type AssistantSegment =
  | { kind: "text"; key: string; text: string }
  | { kind: "thinking"; key: string; part: Record<string, unknown> }
  | { kind: "tools"; key: string; parts: ToolPart[] }
  | { kind: "other"; key: string; part: MessagePart };

function buildAssistantSegments(parts: MessagePart[]): AssistantSegment[] {
  const segments: AssistantSegment[] = [];
  let i = 0;
  while (i < parts.length) {
    const part = parts[i];
    const key = (part as { id?: string }).id ?? `seg-${i}`;
    if (isTextPart(part)) {
      segments.push({ kind: "text", key, text: getPartText(part) });
      i++;
      continue;
    }
    if (part && typeof part === "object" && isThinkingLikePart(part as Record<string, unknown>)) {
      segments.push({ kind: "thinking", key, part: part as Record<string, unknown> });
      i++;
      continue;
    }
    if (isToolPart(part)) {
      const toolParts: ToolPart[] = [part];
      while (i + 1 < parts.length && isToolPart(parts[i + 1] as MessagePart)) {
        i++;
        toolParts.push(parts[i] as ToolPart);
      }
      segments.push({ kind: "tools", key: `tools-${key}`, parts: toolParts });
      i++;
      continue;
    }
    segments.push({ kind: "other", key, part });
    i++;
  }
  return segments;
}

/** 用户消息：独立 padding，单独成块 */
function UserMessageBlock({ msg }: { msg: MessageWithParts }) {
  const text = msg.parts
    .filter((p): p is { type: "text"; text?: string; content?: string } => isTextPart(p))
    .map(getPartText)
    .join("\n");
  return (
    <div className="user mb-3">
      <div className="w-full rounded-xl bg-zinc-200 px-3 py-2 text-base dark:bg-zinc-700/90">
        <p className="whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}

/** 助手单轮内的工具调用：每个一行气泡，可展开详情 */
function AssistantToolCallGroup({ parts }: { parts: ToolPart[] }) {
  return (
    <div className="tool flex flex-col gap-1">
      {parts.map((part, idx) => (
        <ToolPartBlock key={(part as { id?: string }).id ?? `tool-${idx}`} part={part} />
      ))}
    </div>
  );
}

function ThinkingPartBlock({ part }: { part: Record<string, unknown> }) {
  const type = String(part.type ?? "unknown");
  const text = getObjectValue(part, ["thinking", "reasoning", "content", "text", "summary"]) ?? "";

  return (
    <details className="mt-2 rounded-lg border border-zinc-200/80 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-300" open={!!text}>
      <summary className="flex cursor-pointer list-none items-center gap-2 py-0.5">
        <Brain className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
        <span className="font-medium">Thinking</span>
        <Badge variant="secondary" className="text-[10px]">{type}</Badge>
      </summary>
      {text && (
        <div className="markdown-content mt-2 text-zinc-700 dark:text-zinc-300">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>
      )}
    </details>
  );
}

function MessageBubble({
  msg,
  isUser,
}: {
  msg: MessageWithParts;
  isUser: boolean;
}) {
  if (isUser) {
    return <UserMessageBlock msg={msg} />;
  }

  const assistantError = getAssistantError(msg);
  const segments = buildAssistantSegments(msg.parts);

  return (
    <div className="assistant mb-1 w-full text-base">
      {segments.map((seg) => {
        if (seg.kind === "text") {
          return (
            <div key={seg.key} className="markdown-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{seg.text}</ReactMarkdown>
            </div>
          );
        }
        if (seg.kind === "thinking") {
          return <ThinkingPartBlock key={seg.key} part={seg.part} />;
        }
        if (seg.kind === "tools") {
          return <AssistantToolCallGroup key={seg.key} parts={seg.parts} />;
        }
        // 未知 part 类型不直接 String()，避免 [object Object]
        const part = seg.part as Record<string, unknown>;
        const fallbackText =
          typeof part?.content === "string"
            ? part.content
            : typeof part?.text === "string"
              ? part.text
              : null;
        if (fallbackText) {
          return (
            <div key={seg.key} className="markdown-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{fallbackText}</ReactMarkdown>
            </div>
          );
        }
        return null;
      })}
      {assistantError && (
        <p className="whitespace-pre-wrap text-red-600 dark:text-red-400">{assistantError}</p>
      )}
    </div>
  );
}

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
  const statusVariant =
    status === "error"
      ? "destructive"
      : status === "running"
        ? "warning"
        : status === "completed"
          ? "success"
          : "secondary";
  const toolInput = part.state?.input;
  const inputUrl =
    toolInput && typeof toolInput === "object" && "url" in toolInput
      ? String((toolInput as { url?: unknown }).url ?? "")
      : "";
  const isSubagentCall =
    part.tool.toLowerCase().includes("subagent") ||
    part.tool.toLowerCase().includes("task") ||
    (toolInput &&
      typeof toolInput === "object" &&
      "subagent_type" in toolInput &&
      typeof (toolInput as { subagent_type?: unknown }).subagent_type === "string");
  const summaryText = part.state?.error
    ? String(part.state.error)
    : inputUrl || String(part.state?.title ?? "");
  const outputText = (part.state?.output ?? "").trim();

  return (
    <div className="tool">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs"
      >
        <span className="shrink-0 text-zinc-500 dark:text-zinc-400">
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </span>
        <span className="shrink-0">
          {status === "running" ? (
            <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
          ) : (
            <Wrench className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
          )}
        </span>
        <span className="shrink-0 text-[11px] text-zinc-500 dark:text-zinc-400">
          {statusLabel}
        </span>
        <span className="shrink-0 font-mono font-medium text-zinc-800 dark:text-zinc-200">
          {part.tool}
        </span>
        {isSubagentCall && (
          <span className="shrink-0 text-[10px] text-zinc-500 dark:text-zinc-400">subagent</span>
        )}
        {!!summaryText && (
          <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
            {summaryText}
          </span>
        )}
      </button>
      {expanded && hasDetails && (
        <div className="space-y-2 border-t border-zinc-200/60 px-2 pb-2 pt-1.5 dark:border-zinc-700/60">
          {isSubagentCall && (
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">子代理调用详情</p>
          )}
          {part.state?.input && Object.keys(part.state.input).length > 0 && (
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">输入</div>
              <pre className="max-h-32 overflow-auto rounded-md bg-zinc-200/60 p-2 text-xs dark:bg-zinc-700/60">
                {JSON.stringify(part.state.input, null, 2)}
              </pre>
            </div>
          )}
          {outputText !== "" && (
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">输出</div>
              <pre className="max-h-40 overflow-auto rounded-md bg-zinc-200/60 p-2 text-xs dark:bg-zinc-700/60">
                {outputText}
              </pre>
            </div>
          )}
          {part.state?.error != null && part.state.error !== "" && (
            <p className="text-xs text-red-600 dark:text-red-400">{String(part.state.error)}</p>
          )}
        </div>
      )}
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
    stopSession,
  } = useSessionMessages(id);
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState(() => readDefaultModel());
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, isSessionBusy]);

  const submitCurrentPrompt = async () => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || isSessionBusy || !isConnected) return;
    const attachmentContext = buildAttachmentContext(attachments);
    setInput("");
    const ok = await sendPrompt(text || "请结合附件进行分析。", {
      modelRaw: selectedModel,
      attachmentContext: attachmentContext || undefined,
    });
    if (ok) {
      setAttachments([]);
      setAttachmentError(null);
    }
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitCurrentPrompt();
  };

  const handlePickFiles = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const list = Array.from(files).slice(0, 6);
    const next: Attachment[] = [];
    for (const file of list) {
      const id = `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`;
      if (isLikelyTextFile(file) && file.size <= 300 * 1024) {
        try {
          const raw = await file.text();
          const excerpt = raw.slice(0, 8000);
          next.push({
            id,
            name: file.name,
            size: file.size,
            type: file.type || "text/plain",
            excerpt,
            truncated: raw.length > excerpt.length,
          });
        } catch {
          next.push({
            id,
            name: file.name,
            size: file.size,
            type: file.type || "application/octet-stream",
          });
        }
      } else {
        next.push({ id, name: file.name, size: file.size, type: file.type || "application/octet-stream" });
      }
    }
    setAttachments((prev) => [...prev, ...next].slice(0, 10));
    setAttachmentError(
      list.some((f) => !isLikelyTextFile(f) || f.size > 300 * 1024)
        ? "部分文件仅附带元信息（非文本或体积较大）。"
        : null
    );
    e.target.value = "";
  };

  const isConnected = openCodeStatus === "connected";
  const groupedMessages = useMemo(() => groupMessagesByTurn(messages), [messages]);
  const canSend = useMemo(() => {
    if (!isConnected || isSessionBusy) return false;
    return input.trim().length > 0 || attachments.length > 0;
  }, [attachments.length, input, isConnected, isSessionBusy]);

  if (!id) {
    return (
      <div className="p-6">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">缺少会话 ID，请从左侧选择会话。</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 pb-3 pt-5">
        <div className="mx-auto w-full max-w-4xl">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">对话</h1>
        </div>
      </div>
      {!isConnected && (
        <div className="px-6">
          <p className="mx-auto mb-3 w-full max-w-4xl rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
            请先连接 OpenCode（侧栏连接状态）。
          </p>
        </div>
      )}
      {error && (
        <div className="px-6">
          <p className="mx-auto mb-3 w-full max-w-4xl rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </p>
        </div>
      )}
      {sendError && (
        <div className="px-6">
          <p className="mx-auto mb-3 w-full max-w-4xl rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            {sendError}
          </p>
        </div>
      )}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-6">
        <div className="mx-auto w-full max-w-4xl pb-6">
          {isLoading && messages.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">加载消息…</p>
          ) : groupedMessages.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">暂无消息，在下方输入并发送开始对话。</p>
          ) : (
            <>
              {groupedMessages.map((group) => (
                <section key={group.id} className="mb-5">
                  {group.user && <MessageBubble msg={group.user} isUser />}
                  <div className="space-y-0">
                    {group.assistant.map((msg) => (
                      <MessageBubble key={msg.info.id} msg={msg} isUser={false} />
                    ))}
                  </div>
                </section>
              ))}
              {isSessionBusy && (
                <div className="mb-3 flex justify-start">
                  <div className="flex items-center gap-2 rounded-lg border border-zinc-200/80 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400">
                    <Brain className="h-3.5 w-3.5 shrink-0" />
                    <span>Thinking…</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div className="pb-2 abs">
        <form
          onSubmit={handleSubmit}
          className="mx-auto w-full max-w-4xl rounded-2xl border border-zinc-300/90 bg-white/95 dark:border-zinc-700 dark:bg-zinc-900/95"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                if ((e.nativeEvent as KeyboardEvent).isComposing) return;
                e.preventDefault();
                void submitCurrentPrompt();
              }
            }}
            placeholder="输入消息…"
            disabled={!isConnected || isSessionBusy}
            rows={4}
            className="min-h-[80px] w-full resize-none bg-transparent px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-400 outline-none disabled:opacity-60 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-3 pb-2">
              {attachments.map((file) => (
                <Badge key={file.id} variant="secondary" className="gap-1">
                  <span className="max-w-[180px] truncate">{file.name}</span>
                  <span className="text-[10px] opacity-70">{formatBytes(file.size)}</span>
                </Badge>
              ))}
            </div>
          )}
          {attachmentError && (
            <p className="px-3 pb-2 text-xs text-zinc-500 dark:text-zinc-400">{attachmentError}</p>
          )}
          <div className="flex items-center justify-between px-2 py-2">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFilesSelected}
              />
              <Button type="button" size="icon" variant="ghost" onClick={handlePickFiles}>
                <Paperclip className="h-4 w-4" />
              </Button>
              <ModelSelect
                value={selectedModel}
                options={MODEL_OPTIONS}
                onChange={(v) => setSelectedModel(persistDefaultModel(v))}
                disabled={isSessionBusy}
              />
            </div>
            {isSessionBusy ? (
              <Button
                type="button"
                size="icon"
                variant="destructive"
                onClick={() => void stopSession()}
                title="停止回复"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </Button>
            ) : (
              <Button type="submit" size="icon" disabled={!canSend} title="发送">
                <ArrowUp className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
