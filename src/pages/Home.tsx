import { useNavigate } from "react-router-dom";
import { useOpenCode } from "@/context/OpenCodeContext";
import { useSessions } from "@/hooks/useSessions";

export function Home() {
  const navigate = useNavigate();
  const { status, errorMessage, client } = useOpenCode();
  const { sessions, isLoading, error: sessionsError } = useSessions();
  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        会话
      </h1>
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
        <>
          <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
            左侧为会话列表，可新建或选择会话进入。
          </p>
          {sessionsError && (
            <p className="mb-2 text-sm text-amber-600 dark:text-amber-400">
              {sessionsError}
            </p>
          )}
          {isLoading && sessions.length === 0 ? (
            <p className="text-sm text-zinc-500">加载会话列表…</p>
          ) : sessions.length > 0 ? (
            <ul className="list-inside list-disc text-sm text-zinc-600 dark:text-zinc-400">
              {sessions.slice(0, 20).map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/session/${s.id}`)}
                    className="text-left hover:underline"
                  >
                    {s.title || "未命名会话"}
                  </button>
                </li>
              ))}
              {sessions.length > 20 && (
                <li className="text-zinc-500">
                  …共 {sessions.length} 个会话，见左侧列表
                </li>
              )}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">暂无会话，请在左侧新建。</p>
          )}
        </>
      )}
    </div>
  );
}
