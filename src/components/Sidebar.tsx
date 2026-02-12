import { useState } from "react";
import { NavLink, useMatch, useNavigate } from "react-router-dom";
import { MessageSquare, Plus, Settings, Sparkles, Trash2 } from "lucide-react";
import { useOpenCode } from "@/context/OpenCodeContext";
import { useSessions } from "@/hooks/useSessions";

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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const isConnected = status === "connected";

  const handleNewSession = async () => {
    if (creating || !isConnected) return;
    setCreating(true);
    try {
      const id = await createSession();
      if (id) navigate(`/session/${id}`);
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
    <aside className="flex w-56 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex h-12 items-center border-b border-zinc-200 px-4 dark:border-zinc-800">
        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
          ready2work
        </span>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
        {isConnected && (
          <>
            <div className="my-1 border-t border-zinc-200 dark:border-zinc-700" />
            {deleteError && (
              <p className="px-3 py-2 text-xs text-red-600 dark:text-red-400">
                {deleteError}
              </p>
            )}
            <button
              type="button"
              onClick={handleNewSession}
              disabled={creating || isLoading}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 disabled:opacity-50"
            >
              <Plus className="h-4 w-4 shrink-0" />
              {creating ? "新建中…" : "新建会话"}
            </button>
            {isLoading && sessions.length === 0 ? (
              <p className="px-3 py-2 text-xs text-zinc-500">加载会话…</p>
            ) : (
              sessions.map((s) => (
                <div key={s.id} className="group flex items-center gap-1">
                  <NavLink
                    to={`/session/${s.id}`}
                    className={({ isActive }) =>
                      `min-w-0 flex-1 truncate rounded-md px-3 py-2 text-sm transition-colors ${
                        isActive
                          ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
                          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                      }`
                    }
                    title={s.title || s.id}
                  >
                    {s.title || "未命名会话"}
                  </NavLink>
                  <button
                    type="button"
                    onClick={(e) => void handleDeleteSession(e, s.id)}
                    disabled={deletingId === s.id}
                    className={
                      "inline-flex h-8 shrink-0 items-center justify-center rounded-md px-2 text-zinc-500 opacity-0 transition group-hover:opacity-100 disabled:opacity-50 " +
                      (confirmDeleteId === s.id
                        ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 opacity-100"
                        : "hover:bg-zinc-200 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-red-400")
                    }
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
                  </button>
                </div>
              ))
            )}
          </>
        )}
      </nav>
    </aside>
  );
}
