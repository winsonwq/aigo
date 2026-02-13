import { useState } from "react";
import { NavLink, useMatch, useNavigate } from "react-router-dom";
import { MessageSquare, MoreVertical, Plus, Settings, Sparkles, Trash2 } from "lucide-react";
import { useConfirmModal } from "@/components/ConfirmModal";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useOpenCode } from "@/context/OpenCodeContext";
import { useSessions } from "@/hooks/useSessions";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "会话", icon: MessageSquare },
  { to: "/skills", label: "Skills", icon: Sparkles },
  { to: "/settings", label: "设置", icon: Settings },
];

export function Sidebar() {
  const navigate = useNavigate();
  const sessionMatch = useMatch("/session/:id");
  const currentSessionId = sessionMatch?.params?.id;
  const { status } = useOpenCode();
  const { sessions, isLoading, createSession, deleteSession } = useSessions();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { confirm: confirmModal } = useConfirmModal();
  const isConnected = status === "connected";

  const handleNewSession = async () => {
    if (creating || !isConnected) return;
    setCreating(true);
    setCreateError(null);
    try {
      const result = await createSession();
      if ("id" in result && result.id) {
        navigate(`/session/${result.id}`);
      } else {
        setCreateError(
          "error" in result ? result.error : "创建会话失败，请检查 OpenCode 连接或重试。"
        );
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSession = async (sessionID: string) => {
    if (deletingId) return;
    const confirmed = await confirmModal({
      title: "删除会话",
      message: "确定要删除该会话吗？此操作不可恢复。",
      confirmLabel: "删除",
      cancelLabel: "取消",
      variant: "destructive",
    });
    if (!confirmed) return;
    setDeletingId(sessionID);
    setDeleteError(null);
    try {
      const deleted = await deleteSession(sessionID);
      if (!deleted) {
        setDeleteError("删除失败，请稍后重试。");
        return;
      }
      if (currentSessionId === sessionID) {
        navigate("/", { replace: true });
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <aside className="flex w-64 flex-col bg-transparent">
      <div className="flex h-14 items-center px-4">
        <span className="text-sm font-semibold tracking-wide text-zinc-900 dark:text-zinc-100">
          ready2work
        </span>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2.5">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all",
                isActive
                  ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/90 dark:hover:text-zinc-100"
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
        {isConnected && (
          <>
            <Separator className="mx-2 my-2 w-auto bg-zinc-200/90 dark:bg-zinc-700/80" />
            {createError && (
              <p className="mb-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
                {createError}
              </p>
            )}
            {deleteError && (
              <p className="mb-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                {deleteError}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={handleNewSession}
              disabled={creating || isLoading}
              className="mb-1 justify-start rounded-lg"
            >
              <Plus className="h-4 w-4 shrink-0" />
              {creating ? "新建中…" : "新建会话"}
            </Button>
            {isLoading && sessions.length === 0 ? (
              <p className="px-3 py-2 text-xs text-zinc-500">加载会话…</p>
            ) : (
              sessions.map((s) => {
                const isActive = currentSessionId === s.id;
                return (
                <div
                  key={s.id}
                  className={cn(
                    "group flex min-h-[2.5rem] w-full items-center gap-0 rounded-lg px-1 transition-colors",
                    isActive
                      ? "bg-zinc-900 dark:bg-zinc-100"
                      : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  )}
                >
                  <NavLink
                    to={`/session/${s.id}`}
                    className={cn(
                      "min-w-0 flex-1 truncate rounded-l-lg px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "text-white dark:text-zinc-900"
                        : "text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100"
                    )}
                    title={s.title || s.id}
                  >
                    {s.title || "未命名会话"}
                  </NavLink>
                  <DropdownMenu
                    align="end"
                    className="shrink-0"
                    trigger={
                      <button
                        type="button"
                        onClick={(e) => e.preventDefault()}
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md opacity-0 transition-[color,opacity,background-color] group-hover:opacity-100",
                          isActive
                            ? "text-white/80 hover:bg-white/20 hover:text-white dark:text-zinc-900/80 dark:hover:bg-zinc-900/20 dark:hover:text-zinc-900"
                            : "text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                        )}
                        aria-label="会话菜单"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    }
                  >
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => void handleDeleteSession(s.id)}
                    >
                      <Trash2 className="h-4 w-4 shrink-0" />
                      删除
                    </DropdownMenuItem>
                  </DropdownMenu>
                </div>
                );
              })
            )}
          </>
        )}
      </nav>
    </aside>
  );
}
