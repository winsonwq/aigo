import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSessions } from "@/hooks/useSessions";

export type CreateSessionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (sessionId: string) => void;
};

export function CreateSessionDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateSessionDialogProps) {
  const { createSession } = useSessions();
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (creating) return;
    setTitle("");
    setError(null);
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const result = await createSession({ title: title.trim() || undefined });
      if ("id" in result && result.id) {
        handleClose();
        onCreated(result.id);
      } else {
        setError("error" in result ? result.error : "创建会话失败，请重试。");
      }
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-session-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="create-session-title"
          className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
        >
          新建会话
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          为会话起个名字（可选），或直接创建后开始对话。
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="session-title" className="sr-only">
              会话名称
            </label>
            <Input
              id="session-title"
              type="text"
              placeholder="例如：需求分析、代码评审…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={creating}
              className="w-full"
              autoFocus
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={creating}
            >
              取消
            </Button>
            <Button type="submit" size="sm" disabled={creating}>
              {creating ? "创建中…" : "创建并开始"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
