import { Loader2 } from "lucide-react";
import { useOpenCode } from "@/context/OpenCodeContext";
import { Button } from "./ui/button";

/**
 * OpenCode 连接状态 overlay：未连接时全屏遮罩，连接中显示 loading，否则显示错误/未连接与连接按钮。
 */
export function OpenCodeNotification() {
  const { status, errorMessage, connect } = useOpenCode();

  const notConnected = status !== "connected";
  const isConnecting = status === "connecting";

  if (!notConnected) return null;

  return (
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
              {status === "error" ? "OpenCode 未连接" : "未连接 OpenCode"}
            </p>
            {status === "error" && errorMessage && (
              <p
                className="mt-1 max-w-md text-center text-xs text-amber-400/90"
                role="alert"
              >
                {errorMessage}
              </p>
            )}
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
  );
}
