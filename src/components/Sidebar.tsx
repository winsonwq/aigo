import { useEffect, useState } from "react";
import { NavLink, useMatch, useNavigate } from "react-router-dom";
import { MessageSquare, MoreVertical, Settings, Sparkles, Trash2 } from "lucide-react";
import { useConfirmModal } from "@/components/ConfirmModal";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useOpenCode } from "@/context/OpenCodeContext";
import { useSessions, type SessionItem } from "@/hooks/useSessions";
import { cn } from "@/lib/utils";

function SidebarStatusBar() {
  const { status, errorMessage, connect } = useOpenCode();
  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  const statusLabel =
    status === "connected"
      ? "已连接"
      : isConnecting
        ? "连接中…"
        : status === "error"
          ? "连接异常"
          : "未连接";

  return (
    <footer className="flex h-8 flex-shrink-0 items-center gap-2 px-3 py-1.5 text-[11px] text-zinc-600 dark:text-zinc-400">
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          isConnected
            ? "bg-emerald-500"
            : isConnecting
              ? "bg-amber-500"
              : status === "error"
                ? "bg-red-500"
                : "bg-zinc-400"
        }`}
        title={statusLabel}
      />
      <span className="min-w-0 flex-1 truncate" title={errorMessage ?? statusLabel}>
        {errorMessage ?? statusLabel}
      </span>
      {status === "error" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void connect()}
          className="ml-1 h-6 shrink-0 px-2 text-[11px]"
        >
          重试
        </Button>
      )}
    </footer>
  );
}

const NAV_ITEMS = [
  { to: "/", label: "新建会话", icon: MessageSquare },
  { to: "/skills", label: "Skills", icon: Sparkles },
  { to: "/settings", label: "设置", icon: Settings },
];

function SidebarHeader() {
  return (
    <div className="flex h-14 shrink-0 items-center px-4">
      <span className="text-sm font-semibold tracking-wide text-zinc-900 dark:text-zinc-100">
        AIGO
      </span>
    </div>
  );
}

interface SidebarNavProps {
  isConnected: boolean;
  deleteError: string | null;
}

function SidebarNav({ isConnected, deleteError }: SidebarNavProps) {
  return (
    <nav className="flex shrink-0 flex-col gap-0.5 overflow-y-auto p-2.5">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
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
      {isConnected && deleteError && (
        <>
          <Separator className="mx-2 my-2 w-auto bg-zinc-200/90 dark:bg-zinc-700/80" />
          <p className="mb-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            {deleteError}
          </p>
        </>
      )}
    </nav>
  );
}

interface SidebarSessionItemProps {
  session: SessionItem;
  isActive: boolean;
  onDelete: (sessionId: string) => void;
}

function SidebarSessionItem({ session, isActive, onDelete }: SidebarSessionItemProps) {
  return (
    <div
      className={cn(
        "group flex w-full items-center gap-0 rounded-lg px-1 transition-colors",
        isActive
          ? "bg-zinc-900 dark:bg-zinc-100"
          : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
      )}
    >
      <NavLink
        to={`/session/${session.id}`}
        className={cn(
          "min-w-0 flex-1 truncate rounded-l-lg px-3 py-2 text-sm transition-colors",
          isActive
            ? "text-white dark:text-zinc-900"
            : "text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100"
        )}
        title={session.title || session.id}
      >
        {session.title || "未命名会话"}
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
        <DropdownMenuItem variant="destructive" onClick={() => void onDelete(session.id)}>
          <Trash2 className="h-4 w-4 shrink-0" />
          删除
        </DropdownMenuItem>
      </DropdownMenu>
    </div>
  );
}

interface SidebarSessionListProps {
  isConnected: boolean;
  sessions: SessionItem[];
  isLoading: boolean;
  currentSessionId: string | undefined;
  onDeleteSession: (sessionId: string) => void;
}

function SidebarSessionList({
  isConnected,
  sessions,
  isLoading,
  currentSessionId,
  onDeleteSession,
}: SidebarSessionListProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col px-2">
      {!isConnected ? null : (
        <>
          <p className="shrink-0 px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            会话历史
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto pb-2">
            {isLoading && sessions.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-zinc-500">加载会话…</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {sessions.map((s) => (
                  <SidebarSessionItem
                    key={s.id}
                    session={s}
                    isActive={currentSessionId === s.id}
                    onDelete={onDeleteSession}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function Sidebar() {
  const navigate = useNavigate();
  const sessionMatch = useMatch("/session/:id");
  const currentSessionId = sessionMatch?.params?.id;
  const { status } = useOpenCode();
  const { sessions, isLoading, deleteSession, refetch: refetchSessions } = useSessions();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 进入会话页或切换会话时刷新左侧列表，使新建会话能立即出现在侧栏
  useEffect(() => {
    if (currentSessionId) void refetchSessions();
  }, [currentSessionId, refetchSessions]);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { confirm: confirmModal } = useConfirmModal();
  const isConnected = status === "connected";

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
    <aside className="flex w-64 min-h-0 flex-col bg-zinc-50 dark:bg-zinc-900/80">
      <SidebarHeader />
      <SidebarNav isConnected={isConnected} deleteError={deleteError} />
      <div className="w-full shrink-0 border-t border-zinc-200/90 py-1 dark:border-zinc-700/80" />
      <SidebarSessionList
        isConnected={isConnected}
        sessions={sessions}
        isLoading={isLoading}
        currentSessionId={currentSessionId}
        onDeleteSession={handleDeleteSession}
      />
      <SidebarStatusBar />
    </aside>
  );
}
