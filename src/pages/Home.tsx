import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquarePlus } from "lucide-react";
import { CreateSessionDialog } from "@/components/CreateSessionDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useOpenCode } from "@/context/OpenCodeContext";
import { useSessions } from "@/hooks/useSessions";

export function Home() {
  const navigate = useNavigate();
  const { status, errorMessage, client } = useOpenCode();
  const { error: sessionsError } = useSessions();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  const handleSessionCreated = (sessionId: string) => {
    navigate(`/session/${sessionId}`);
  };

  return (
    <div className="flex h-full flex-col p-6">
      <h1 className="mb-4 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        会话
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
        <>
          {/* 引导创建会话：主 CTA */}
          <Card className="mb-6 rounded-2xl border-zinc-200/90 bg-white/90 shadow-[0_8px_30px_rgba(24,24,27,0.06)] dark:border-zinc-800/90 dark:bg-zinc-950/85 dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
            <CardContent className="flex flex-col items-center justify-center gap-3 p-8 text-center sm:flex-row sm:gap-4 sm:text-left">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
                <MessageSquarePlus className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  开始新对话
                </p>
                <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                  创建会话后即可与 AI 对话，支持多轮对话与工具调用。
                </p>
              </div>
              <Button
                className="shrink-0"
                onClick={() => setCreateDialogOpen(true)}
              >
                新建会话
              </Button>
            </CardContent>
          </Card>

          {sessionsError && (
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
              {sessionsError}
            </p>
          )}

          {/* 最近会话功能已暂时移除，会话列表见左侧边栏 */}
        </>
      )}

      <CreateSessionDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={handleSessionCreated}
      />
    </div>
  );
}
