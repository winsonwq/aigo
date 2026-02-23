import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUp, Paperclip } from "lucide-react";
import { MessageInput, type MessageInputRef } from "@/components/MessageInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ModelSelect } from "@/components/ui/model-select";
import { useOpenCode } from "@/context/OpenCodeContext";
import { MODEL_OPTIONS, persistDefaultModel, readDefaultModel } from "@/config/models";
import { useSessions } from "@/hooks/useSessions";

type Attachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  excerpt?: string;
  truncated?: boolean;
};

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isLikelyTextFile(file: File): boolean {
  if (file.type.startsWith("text/")) return true;
  const lower = file.name.toLowerCase();
  return [
    ".md", ".txt", ".json", ".js", ".jsx", ".ts", ".tsx", ".css",
    ".html", ".xml", ".yaml", ".yml", ".py", ".java", ".go", ".rs", ".sh", ".sql",
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

export function Home() {
  const navigate = useNavigate();
  const { status } = useOpenCode();
  const { createSession } = useSessions();
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState(() => readDefaultModel());
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const messageInputRef = useRef<MessageInputRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isConnected = status === "connected";
  const canSend =
    isConnected &&
    !creating &&
    (input.trim().length > 0 || attachments.length > 0);

  const doSubmit = async (textOverride?: string) => {
    const text = (textOverride ?? messageInputRef.current?.getPlainText() ?? input).trim();
    if ((!text && attachments.length === 0) || creating || !isConnected) return;

    setCreating(true);
    setCreateError(null);
    const attachmentContext = buildAttachmentContext(attachments);
    const body = text || "请结合附件进行分析。";
    const modelRaw = selectedModel;

    try {
      const result = await createSession();
      if ("error" in result) {
        setCreateError(result.error ?? "创建会话失败，请重试。");
        return;
      }
      const sessionId = result.id;
      setInput("");
      messageInputRef.current?.clearContent();
      setAttachments([]);
      setAttachmentError(null);
      navigate(`/session/${sessionId}`, {
        replace: false,
        state: {
          initialMessage: {
            text: body,
            modelRaw,
            attachmentContext: attachmentContext || undefined,
          },
        },
      });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "创建会话失败，请重试。");
    } finally {
      setCreating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void doSubmit();
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
        next.push({
          id,
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
        });
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

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center px-6 py-8">
      {createError && (
        <p className="mb-3 w-full max-w-2xl rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
          {createError}
        </p>
      )}
      <form
        onSubmit={handleSubmit}
        className="mx-auto w-full max-w-2xl rounded-2xl border border-zinc-300 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      >
        <MessageInput
          ref={messageInputRef}
          placeholder="输入消息开始新会话…"
          disabled={!isConnected || creating}
          onSubmit={(plainText) => void doSubmit(plainText)}
          onContentChange={(plainText) => setInput(plainText)}
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
              disabled={creating}
            />
          </div>
          <Button type="submit" size="icon" disabled={!canSend} title="发送">
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
