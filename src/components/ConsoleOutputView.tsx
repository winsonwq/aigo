import { useRunOutput } from "@/context/RunOutputContext";

type ConsoleOutputViewProps = {
  /** 要显示的运行输出 ID，来自 RunOutputContext 的 runId */
  runId: string | null;
  /** 可选：无内容时的占位文案 */
  emptyMessage?: string;
  className?: string;
};

/**
 * 根据 runId 订阅并展示该次运行的终端输出（stdout + stderr）。
 * 与具体业务解耦，仅依赖 RunOutputContext，可在安装、其他命令输出等场景复用。
 */
export function ConsoleOutputView({
  runId,
  emptyMessage = "暂无输出",
  className = "",
}: ConsoleOutputViewProps) {
  const { getRun } = useRunOutput();
  const run = runId ? getRun(runId) : null;

  if (!runId || !run) {
    return (
      <div
        className={`flex min-h-[120px] items-center justify-center text-sm text-zinc-500 dark:text-zinc-400 ${className}`}
      >
        {runId ? emptyMessage : "选择一项任务查看输出"}
      </div>
    );
  }

  // 统一换行符为 \n，避免 \r\n / \r 导致显示异常
  const normalizeLines = (s: string) => s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const stdout = normalizeLines(run.stdout);
  const stderr = normalizeLines(run.stderr);
  const hasOut = stdout.length > 0;
  const hasErr = stderr.length > 0;

  if (!hasOut && !hasErr) {
    return (
      <div
        className={`flex min-h-[120px] items-center justify-center text-sm text-zinc-500 dark:text-zinc-400 ${className}`}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className={`min-h-0 overflow-auto font-mono text-[13px] leading-[1.6] text-zinc-800 dark:text-zinc-200 ${className}`}
      style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
    >
      {hasOut && (
        <pre className="whitespace-pre-wrap break-words">
          {stdout}
        </pre>
      )}
      {hasErr && (
        <>
          {hasOut && (
            <p className="mt-2 border-t border-zinc-200 pt-2 text-xs font-medium text-zinc-500 dark:border-zinc-600 dark:text-zinc-400">
              stderr:
            </p>
          )}
          <pre
            className={`whitespace-pre-wrap break-words ${hasOut ? "mt-1 text-red-700 dark:text-red-300" : ""}`}
          >
            {stderr}
          </pre>
        </>
      )}
    </div>
  );
}
