import { Outlet } from "react-router-dom";
import { useOpenCode } from "@/context/OpenCodeContext";
import { Sidebar } from "./Sidebar";

function StatusBar() {
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
    <footer className="flex h-6 flex-shrink-0 items-center gap-1.5 border-t border-zinc-200 bg-zinc-50 px-3 text-[11px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
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
      <span className="truncate" title={errorMessage ?? statusLabel}>
        {errorMessage ?? statusLabel}
      </span>
      {status === "error" && (
        <button
          type="button"
          onClick={() => void connect()}
          className="ml-1 shrink-0 rounded px-1.5 py-0.5 text-[11px] text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-700"
        >
          重试
        </button>
      )}
    </footer>
  );
}

export function Layout() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white dark:bg-zinc-950">
      {/* 主内容区：侧栏 + 页面 */}
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      <StatusBar />
    </div>
  );
}
