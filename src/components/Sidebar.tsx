import { NavLink } from "react-router-dom";
import { MessageSquare, Settings, Sparkles } from "lucide-react";
import { useOpenCode } from "@/context/OpenCodeContext";

const nav = [
  { to: "/", label: "会话", icon: MessageSquare },
  { to: "/skills", label: "Skills", icon: Sparkles },
  { to: "/settings", label: "设置", icon: Settings },
];

export function Sidebar() {
  const { status, connect, disconnect } = useOpenCode();
  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  return (
    <aside className="flex w-56 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex h-12 items-center border-b border-zinc-200 px-4 dark:border-zinc-800">
        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
          ready2work
        </span>
      </div>
      <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            isConnected ? "bg-emerald-500" : isConnecting ? "bg-amber-500" : "bg-zinc-400"
          }`}
          title={isConnected ? "已连接" : isConnecting ? "连接中" : "未连接"}
        />
        <span className="flex-1 truncate text-xs text-zinc-600 dark:text-zinc-400">
          {isConnected ? "已连接" : isConnecting ? "连接中…" : "未连接"}
        </span>
        {!isConnected && !isConnecting && (
          <button
            type="button"
            onClick={() => void connect()}
            className="rounded bg-zinc-200 px-2 py-1 text-xs text-zinc-800 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
          >
            连接
          </button>
        )}
        {isConnected && (
          <button
            type="button"
            onClick={disconnect}
            className="rounded bg-zinc-200 px-2 py-1 text-xs text-zinc-800 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
          >
            断开
          </button>
        )}
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
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
      </nav>
    </aside>
  );
}
