import { Outlet } from "react-router-dom";
import { useOpenCode } from "@/context/OpenCodeContext";
import { Button } from "@/components/ui/button";
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
    <footer className="flex h-8 flex-shrink-0 items-center gap-2 px-3 text-[11px] text-zinc-600 dark:text-zinc-400">
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void connect()}
          className="ml-1 h-6 px-2 text-[11px]"
        >
          重试
        </Button>
      )}
    </footer>
  );
}

export function Layout() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* 主内容区：侧栏 + 页面 */}
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <main className="min-h-0 flex-1 overflow-auto bg-transparent">
            <Outlet />
          </main>
        </div>
        <StatusBar />
      </div>
    </div>
  );
}
