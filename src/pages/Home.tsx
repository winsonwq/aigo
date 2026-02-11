import { useOpenCode } from "@/context/OpenCodeContext";

export function Home() {
  const { status, errorMessage, client } = useOpenCode();
  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        会话
      </h1>
      {!isConnected && !isConnecting && (
        <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
          请先在侧栏点击「连接」启动 OpenCode 并连接；需已安装 opencode（如 brew install opencode）。
        </p>
      )}
      {status === "error" && errorMessage && (
        <p className="mb-3 text-sm text-amber-600 dark:text-amber-400">
          {errorMessage}
        </p>
      )}
      {isConnecting && (
        <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
          正在启动 OpenCode 并连接…
        </p>
      )}
      {isConnected && client && (
        <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
          Sessions 列表占位，后续对接 OpenCode 会话 API。
        </p>
      )}
    </div>
  );
}
