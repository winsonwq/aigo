import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { markdownLinkComponents } from "@/components/MarkdownLink";
import remarkGfm from "remark-gfm";
import { ArrowUp, Paperclip, Square } from "lucide-react";
import { MessageInput, type MessageInputRef } from "@/components/MessageInput";
import {
  AttachmentChips,
  formatBytes,
  parseAttachmentBlockFromMessageText,
} from "@/components/AttachmentChips";
import {
  renderToolSegment,
  type ToolRenderContext,
} from "@/components/AssistantToolRenderers";
import { ThinkingBlock } from "@/components/ThinkingBlock";
import { Button } from "@/components/ui/button";
import { ModelSelect } from "@/components/ui/model-select";
import { useOpenCode } from "@/context/OpenCodeContext";
import { persistDefaultModel, readDefaultModel } from "@/config/models";
import { useModelOptions } from "@/hooks/useModelOptions";
import { useSessions } from "@/hooks/useSessions";
import {
  useSessionMessages,
  type MessageWithParts,
  type MessagePart,
  type ToolPart,
} from "@/hooks/useSessionMessages";
import { PermissionDialog } from "@/components/PermissionDialog";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";

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
  path?: string;
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

function getMessageText(msg: MessageWithParts): string {
  return msg.parts
    .filter((p): p is { type: "text"; text?: string; content?: string } => isTextPart(p))
    .map(getPartText)
    .join("\n")
    .trim();
}

/** 用户消息：独立 padding，单独成块；附件区与输入框样式一致（芯片展示），有路径时可点击用系统默认打开 */
function UserMessageBlock({ msg }: { msg: MessageWithParts }) {
  const text = getMessageText(msg);
  const { mainText, attachmentItems } = parseAttachmentBlockFromMessageText(text);
  const paths = msg.info.attachmentPaths ?? [];
  const displayItems = attachmentItems.map((a, i) => ({
    name: a.name,
    sizeLabel: a.sizeLabel,
    path: paths[i],
  }));
  return (
    <div className="user my-8">
      <div className="w-full rounded-sm bg-zinc-200 px-3 py-2 text-base dark:bg-zinc-700/90">
        {mainText ? (
          <p className="whitespace-pre-wrap">{mainText}</p>
        ) : null}
        {attachmentItems.length > 0 ? (
          <div className={mainText ? "mt-2" : ""}>
            <AttachmentChips
              items={displayItems}
              variant="display"
              onOpen={(path) => void openPath(path).catch((e) => console.warn("打开附件失败:", e))}
            />
          </div>
        ) : null}
        {!mainText && attachmentItems.length === 0 ? (
          <p className="whitespace-pre-wrap text-zinc-500">{text || "(空)"}</p>
        ) : null}
      </div>
    </div>
  );
}

/** 助手单轮内的工具调用：按分组渲染（写文件/读文件/终端/执行计划/向您确认/网络检索/技能等） */
function AssistantToolCallGroup({
  messageId,
  segmentIndex,
  parts,
  context,
}: {
  messageId: string;
  segmentIndex: number;
  parts: ToolPart[];
  context: ToolRenderContext;
}) {
  return renderToolSegment(parts, context, messageId, segmentIndex);
}

function MessageBubble({
  msg,
  isUser,
  isStreaming = false,
  onQuestionAnswer,
  nextUserMessageText,
  onRefetchForIncompleteQuestion,
}: {
  msg: MessageWithParts;
  isUser: boolean;
  isStreaming?: boolean;
  onQuestionAnswer?: (answerText: string) => void;
  nextUserMessageText?: string;
  onRefetchForIncompleteQuestion?: () => void;
}) {
  if (isUser) {
    return <UserMessageBlock msg={msg} />;
  }

  const assistantError = getAssistantError(msg);
  const segments = buildAssistantSegments(msg.parts);

  return (
    <div className="assistant w-full text-base">
      <div className="w-full px-3 py-1">
        {segments.map((seg, segIndex) => {
          if (seg.kind === "text") {
            return (
              <div key={seg.key} className="markdown-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownLinkComponents}>{seg.text}</ReactMarkdown>
              </div>
            );
          }
          if (seg.kind === "thinking") {
            return <ThinkingBlock key={seg.key} part={seg.part} isStreaming={isStreaming} />;
          }
          if (seg.kind === "tools") {
            return (
              <AssistantToolCallGroup
                key={`${msg.info.id ?? ""}-tools-${segIndex}`}
                messageId={msg.info.id ?? ""}
                segmentIndex={segIndex}
                parts={seg.parts}
                context={{
                  onQuestionAnswer,
                  nextUserMessageText,
                  onRefetchForIncompleteQuestion,
                }}
              />
            );
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
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownLinkComponents}>{fallbackText}</ReactMarkdown>
              </div>
            );
          }
          return null;
        })}
        {assistantError && (
          <p className="whitespace-pre-wrap text-red-600 dark:text-red-400">{assistantError}</p>
        )}
      </div>
    </div>
  );
}

export type InitialMessageState = {
  text: string;
  modelRaw?: string;
  attachmentContext?: string;
  attachmentPaths?: string[];
};

export function Session() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { status: openCodeStatus, client } = useOpenCode();
  const { sessions, refetch: refetchSessions, setSessionTitle } = useSessions();
  const initialMessageSentRef = useRef(false);
  const state = location.state as { initialMessage?: InitialMessageState } | undefined;
  const {
    messages,
    isLoading,
    error,
    sendError,
    isSessionBusy,
    sendPrompt,
    stopSession,
    refetch: refetchMessages,
    pendingPermission,
    respondToPermission,
  } = useSessionMessages(id);
  const { optionsGrouped: modelOptions } = useModelOptions();

  const sessionTitle =
    (id && sessions.length > 0 ? sessions.find((s) => s.id === id)?.title : null) ?? "新会话";
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState(() => readDefaultModel());
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<MessageInputRef>(null);

  // 从「新建会话」页带着 initialMessage 跳转过来时，在首轮拉取完成后再发送首条消息，避免被 fetchMessages 的 setMessages([]) 覆盖乐观更新
  useEffect(() => {
    const initial = state?.initialMessage;
    if (
      !id ||
      !initial?.text?.trim() ||
      initialMessageSentRef.current ||
      isLoading ||
      !client
    ) return;
    // 新会话首轮拉取完成后 messages 仍为空，此时再发可避免与 fetchMessages 竞态
    if (messages.length > 0) return;
    initialMessageSentRef.current = true;
    (async () => {
      void setSessionTitle(id, initial.text.trim());
      const ok = await sendPrompt(initial.text.trim(), {
        modelRaw: initial.modelRaw,
        attachmentContext: initial.attachmentContext,
        attachmentPaths: initial.attachmentPaths,
      });
      if (ok) {
        navigate(location.pathname, { replace: true, state: {} });
        void refetchSessions();
      }
    })();
  }, [
    id,
    state?.initialMessage,
    isLoading,
    messages.length,
    client,
    sendPrompt,
    setSessionTitle,
    navigate,
    location.pathname,
    refetchSessions,
  ]);

  const onQuestionAnswer = useCallback(
    async (answerText: string): Promise<boolean> => {
      try {
        const ok = await sendPrompt(answerText, { modelRaw: selectedModel });
        if (ok) void refetchSessions();
        return ok;
      } catch {
        return false;
      }
    },
    [sendPrompt, selectedModel, refetchSessions]
  );

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, isSessionBusy]);

  const submitCurrentPrompt = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if ((!text && attachments.length === 0) || isSessionBusy || !isConnected) return;
    const isFirstMessage = messages.filter((m) => m.info.role === "user").length === 0;
    const attachmentContext = buildAttachmentContext(attachments);
    setInput("");
    messageInputRef.current?.clearContent();
    // 首条消息时在发出请求前就更新标题，无需等 AI 回复
    if (id && isFirstMessage) {
      const titleText = text.trim() || "附件对话";
      if (titleText) void setSessionTitle(id, titleText);
    }
    const attachmentPaths = attachments
      .map((a) => a.path)
      .filter((p): p is string => p != null);
    const ok = await sendPrompt(text || "请结合附件进行分析。", {
      modelRaw: selectedModel,
      attachmentContext: attachmentContext || undefined,
      attachmentPaths: attachmentPaths.length ? attachmentPaths : undefined,
    });
    if (ok) {
      setAttachments([]);
      void refetchSessions();
    }
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = messageInputRef.current?.getPlainText() ?? input;
    await submitCurrentPrompt(text.trim() ? text : undefined);
  };

  const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  const handlePickFiles = async () => {
    if (isTauri) {
      try {
        const paths = await openDialog({
          multiple: true,
          directory: false,
          title: "选择附件",
        });
        if (paths === null || (Array.isArray(paths) && paths.length === 0)) return;
        const pathList = Array.isArray(paths) ? paths : [paths];
        const next: Attachment[] = [];
        for (const path of pathList.slice(0, 6)) {
          try {
            const r = await invoke<{ name: string; size: number; excerpt?: string; truncated?: boolean }>(
              "read_attachment_file",
              { path }
            );
            next.push({
              id: `${r.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              name: r.name,
              size: r.size,
              type: "application/octet-stream",
              path,
              excerpt: r.excerpt,
              truncated: r.truncated ?? false,
            });
          } catch (e) {
            console.warn("[Session] read_attachment_file failed:", path, e);
          }
        }
        setAttachments((prev) => [...prev, ...next].slice(0, 10));
      } catch (e) {
        console.warn("[Session] dialog.open failed, fallback to file input:", e);
        fileInputRef.current?.click();
      }
    } else {
      fileInputRef.current?.click();
    }
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
    e.target.value = "";
  };

  const isConnected = openCodeStatus === "connected";
  const groupedMessages = useMemo(() => groupMessagesByTurn(messages), [messages]);
  const streamingMessageId = useMemo(() => {
    const all = groupedMessages.flatMap((g) => g.assistant);
    const last = all[all.length - 1];
    return isSessionBusy && last ? last.info.id : null;
  }, [groupedMessages, isSessionBusy]);
  const canSend = useMemo(() => {
    if (!isConnected || isSessionBusy) return false;
    return input.trim().length > 0 || attachments.length > 0;
  }, [attachments.length, input, isConnected, isSessionBusy]);

  useEffect(() => {
    if (!id) navigate("/", { replace: true });
  }, [id, navigate]);

  // client 为空时 messages 的 thunk 会派发 disconnectOpencode，与 OpenCodeContext 的 effect 一起保证「已连接」与 client 一致，避免卡在不可操作状态

  if (!id) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">跳转到新建会话…</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col">
      {pendingPermission && (
        <PermissionDialog
          request={pendingPermission}
          onRespond={respondToPermission}
        />
      )}
      <div className="px-6 pb-3 pt-5 shrink-0">
        <div className="w-full max-w-3xl">
          <h1 className="page-header mb-0 truncate" title={sessionTitle}>
            {sessionTitle}
          </h1>
        </div>
      </div>
      {error && (
        <div className="px-6 shrink-0">
          <p className="mx-auto mb-3 w-full max-w-3xl rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </p>
        </div>
      )}
      {sendError && (
        <div className="px-6 shrink-0">
          <p className="mx-auto mb-3 w-full max-w-3xl rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            {sendError}
          </p>
        </div>
      )}
      {/* 消息区 z-index:1 确保在渐变层之上，question 选项/提交按钮可点击 */}
      <div ref={scrollRef} className="relative z-[1] min-h-0 flex-1 overflow-y-auto px-6">
        <div className="mx-auto w-full max-w-3xl pb-[220px]">
          {isLoading && messages.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">加载消息…</p>
          ) : groupedMessages.length === 0 && !isSessionBusy ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">暂无消息，在下方输入并发送开始对话。</p>
          ) : (
            <>
              {groupedMessages.map((group, groupIndex) => {
                const nextUserMessageText =
                  groupedMessages[groupIndex + 1]?.user != null
                    ? getMessageText(groupedMessages[groupIndex + 1].user!)
                    : undefined;
                return (
                  <section key={group.id} className="mb-5">
                    {group.user && <MessageBubble msg={group.user} isUser />}
                    <div className="space-y-0">
                      {group.assistant.map((msg) => (
                        <MessageBubble
                          key={msg.info.id}
                          msg={msg}
                          isUser={false}
                          isStreaming={msg.info.id === streamingMessageId}
                          onQuestionAnswer={onQuestionAnswer}
                          nextUserMessageText={nextUserMessageText}
                          onRefetchForIncompleteQuestion={refetchMessages}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
              {isSessionBusy && (
                <div className="mb-3 flex justify-start">
                  <span className="thinking-cursor text-zinc-500 dark:text-zinc-400">|</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {/* 整个输入区为 absolute，背景为自下而上的渐变（与页面背景衔接） */}
      <div className="absolute bottom-0 left-0 right-0 z-[2] bg-gradient-to-t from-[var(--color-bg)] to-transparent px-6 pb-4 pt-24">
        <form
          onSubmit={handleSubmit}
          className="mx-auto w-full max-w-3xl rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700/60 dark:bg-zinc-900"
        >
          <MessageInput
            ref={messageInputRef}
            placeholder="输入消息…"
            disabled={!isConnected || isSessionBusy}
            onSubmit={(plainText) => void submitCurrentPrompt(plainText)}
            onContentChange={(plainText) => setInput(plainText)}
          />
          {attachments.length > 0 && (
            <div className="px-3 pb-2">
              <AttachmentChips
                items={attachments.map((a) => ({
                  id: a.id,
                  name: a.name,
                  size: a.size,
                  path: a.path,
                }))}
                variant="input"
                onRemove={(item) =>
                  setAttachments((prev) => prev.filter((a) => a.id !== item.id))
                }
                onOpen={(path) => void openPath(path).catch((e) => console.warn("打开附件失败:", e))}
              />
            </div>
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
              <button
                type="button"
                onClick={handlePickFiles}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-0 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 dark:focus-visible:ring-zinc-600"
                aria-label="添加附件"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <ModelSelect
                variant="filled"
                value={selectedModel}
                options={modelOptions}
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
