import { useOpenCode } from "@/context/OpenCodeContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSkills } from "@/hooks/useSkills";

export function Skills() {
  const { status } = useOpenCode();
  const { skills, isLoading, error, refetch } = useSkills();
  const isConnected = status === "connected";

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        Skills 管理
      </h1>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        当前会被 OpenCode 检索到的 skills（来自 .opencode/skills、.claude/skills、~/.config/opencode/skills 等）。通过 zip 安装等功能按 PLAN 后续实现。
      </p>
      {!isConnected && (
        <p className="mb-3 text-sm text-amber-600 dark:text-amber-400">
          请先连接 OpenCode 以加载列表。
        </p>
      )}
      {error && (
        <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {isConnected && (
        <div className="flex items-center gap-2 mb-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => void refetch()}
            disabled={isLoading}
          >
            {isLoading ? "加载中…" : "刷新"}
          </Button>
        </div>
      )}
      {isLoading && skills.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">加载 Skills…</p>
      ) : skills.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          暂无 skills，或尚未连接 OpenCode。
        </p>
      ) : (
        <ul className="space-y-3">
          {skills.map((s) => (
            <Card
              key={s.name + (s.location || "")}
              className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
            >
              <CardContent className="p-4">
                <div className="font-medium text-zinc-900 dark:text-zinc-100">
                  {s.name}
                </div>
                {s.description && (
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {s.description}
                  </p>
                )}
                {s.location && (
                  <p className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-500">
                    {s.location}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
