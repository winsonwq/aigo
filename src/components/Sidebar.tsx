import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { MessageSquare, Plus, Settings, Sparkles } from "lucide-react";
import { useOpenCode } from "@/context/OpenCodeContext";
import { useSessions } from "@/hooks/useSessions";

const nav = [
  { to: "/", label: "会话", icon: MessageSquare },
  { to: "/skills", label: "Skills", icon: Sparkles },
  { to: "/settings", label: "设置", icon: Settings },
];

export function Sidebar() {
  const navigate = useNavigate();
  const { status } = useOpenCode();
  const { sessions, isLoading, createSession } = useSessions();
  const [creating, setCreating] = useState(false);
  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

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
                <NavLink
                  key={s.id}
                  to={`/session/${s.id}`}
                  className={({ isActive }) =>
                    `block truncate rounded-md px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
                        : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    }`
                  }
                  title={s.title || s.id}
                >
                  {s.title || "未命名会话"}
                </NavLink>
              ))
            )}
          </>
        )}
      </nav>
    </aside>
  );
}
