import { useState } from "react";
import { NavLink, useMatch, useNavigate } from "react-router-dom";
import { MessageSquare, Plus, Settings, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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

  const handleDeleteSession = async (
    e: React.MouseEvent<HTMLButtonElement>,
    sessionID: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (deletingId) return;
    if (confirmDeleteId !== sessionID) {
      setConfirmDeleteId(sessionID);
      setDeleteError(null);
      return;
    }
    setConfirmDeleteId(null);
    setDeletingId(sessionID);
    try {
      const deleted = await deleteSession(sessionID);
      if (!deleted) {
        setDeleteError("删除失败，请稍后重试。");
        return;
      }
      setDeleteError(null);
      if (currentSessionId === sessionID) {
        navigate("/", { replace: true });
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <aside className="flex w-64 flex-col bg-transparent">
      <div className="flex h-14 items-center justify-between px-4">
        <span className="text-sm font-semibold tracking-wide text-zinc-900 dark:text-zinc-100">
          ready2work
        </span>
        <Badge variant="secondary" className="text-[11px]">
          AI
        </Badge>
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
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
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
              sessions.map((s) => (
                <div key={s.id} className="group flex items-center gap-1.5">
                  <NavLink
                    to={`/session/${s.id}`}
                    className={({ isActive }) =>
                      cn(
                        "min-w-0 flex-1 truncate rounded-lg border px-3 py-2 text-sm transition-all",
                        isActive
                          ? "border-zinc-900 bg-zinc-900 text-white shadow-sm dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                          : "border-transparent text-zinc-600 hover:border-zinc-200 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      )
                    }
                    title={s.title || s.id}
                  >
                    {s.title || "未命名会话"}
                  </NavLink>
                  <Button
                    type="button"
                    variant={confirmDeleteId === s.id ? "destructive" : "ghost"}
                    size="icon"
                    onClick={(e) => void handleDeleteSession(e, s.id)}
                    disabled={deletingId === s.id}
                    className={cn(
                      "h-8 w-8 shrink-0 opacity-0 transition group-hover:opacity-100 disabled:opacity-50",
                      confirmDeleteId === s.id
                        ? "opacity-100"
                        : "text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
                    )}
                    title={confirmDeleteId === s.id ? "再次点击确认删除" : "删除会话"}
                    aria-label="删除会话"
                  >
                    {deletingId === s.id ? (
                      <span className="text-xs">删除中…</span>
                    ) : confirmDeleteId === s.id ? (
                      <span className="text-xs">确认</span>
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))
            )}
          </>
        )}
      </nav>
    </aside>
  );
}
