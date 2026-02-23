import { Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { useOpenCode } from "@/context/OpenCodeContext";
import { Button } from "./ui/button";

export function Layout() {
  const { status, connect } = useOpenCode();
  const notConnected = status !== "connected";
  const isConnecting = status === "connecting";

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="flex min-h-0 flex-1 flex-col overflow-auto bg-transparent">
          <Outlet />
        </main>
      </div>
      {notConnected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm"
          role="status"
          aria-live="polite"
          aria-label={isConnecting ? "正在连接 OpenCode" : "未连接 OpenCode"}
        >
          <div className="flex flex-col items-center gap-4">
            {isConnecting ? (
              <>
                <Loader2
                  className="h-10 w-10 shrink-0 animate-spin text-zinc-300"
                  aria-hidden
                />
                <p className="text-sm font-medium text-zinc-200">
                  正在连接 OpenCode…
                </p>
              </>
            ) : (
              <>
                <p className="text-center text-sm font-medium text-zinc-200">
                  未连接 OpenCode
                </p>
                <p className="text-center text-xs text-zinc-400">
                  请点击下方按钮连接后再使用会话与 Skills。
                </p>
                <Button
                  type="button"
                  onClick={() => void connect()}
                  className="mt-1"
                >
                  连接 OpenCode
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
