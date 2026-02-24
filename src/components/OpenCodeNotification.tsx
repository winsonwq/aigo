import { Loader2 } from "lucide-react";
import { useOpenCode } from "@/context/OpenCodeContext";
import { Button } from "./ui/button";

/**
 * 轻量级 OpenCode 状态通知：连接中 / 未连接或错误时在角落展示，不遮挡主界面。
 */
export function OpenCodeNotification() {
  const { status, errorMessage, connect } = useOpenCode();

  const isConnecting = status === "connecting";
  const isError = status === "error";
  const isIdle = status === "idle";
  const showNotification = isConnecting || isError || isIdle;

  if (!showNotification) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[60] flex max-w-sm items-center gap-3 rounded-lg border border-zinc-700/80 bg-zinc-900/95 px-4 py-3 shadow-lg backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-label={
        isConnecting
          ? "正在连接 OpenCode"
          : isError
            ? "OpenCode 连接失败"
            : "未连接 OpenCode"
      }
    >
      {isConnecting ? (
        <>
          <Loader2
            className="h-5 w-5 shrink-0 animate-spin text-zinc-400"
            aria-hidden
          />
          <span className="text-sm text-zinc-200">正在连接 OpenCode…</span>
        </>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-200">
              {isError ? "OpenCode 未连接" : "未连接 OpenCode"}
            </p>
            {isError && errorMessage && (
              <p
                className="mt-0.5 truncate text-xs text-amber-400/90"
                title={errorMessage}
                role="alert"
              >
                {errorMessage}
              </p>
            )}
          </div>
          <Button type="button" size="sm" onClick={() => void connect()}>
            连接
          </Button>
        </>
      )}
    </div>
  );
}
