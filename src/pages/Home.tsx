import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
      <h1 className="mb-4 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        对话首页
      </h1>
      {status === "error" && errorMessage && (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
          {errorMessage}
        </p>
      )}
      {isConnecting && (
        <p className="mb-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          正在启动 OpenCode 并连接…
        </p>
      )}
      {isConnected && client && (
        <Card className="rounded-2xl border-zinc-200/90 bg-white/90 shadow-[0_8px_30px_rgba(24,24,27,0.06)] dark:border-zinc-800/90 dark:bg-zinc-950/85 dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
          <CardContent className="p-5">
          <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
            左侧为会话列表，可新建或选择会话进入。
          </p>
          {sessionsError && (
            <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
              {sessionsError}
            </p>
          )}
          {isLoading && sessions.length === 0 ? (
            <p className="text-sm text-zinc-500">加载会话列表…</p>
          ) : sessions.length > 0 ? (
            <ul className="space-y-1.5 text-sm text-zinc-600 dark:text-zinc-400">
              {sessions.slice(0, 20).map((s) => (
                <li key={s.id}>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(`/session/${s.id}`)}
                    className="h-auto w-full justify-start whitespace-normal py-2 text-left"
                  >
                    {s.title || "未命名会话"}
                  </Button>
                </li>
              ))}
              {sessions.length > 20 && (
                <li className="px-1 text-zinc-500">
                  …共 {sessions.length} 个会话，见左侧列表
                </li>
              )}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">暂无会话，请在左侧新建。</p>
          )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
