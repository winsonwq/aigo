import { useRunOutput } from "@/context/RunOutputContext";
import { AnsiHtml } from "fancy-ansi/react";
import { Terminal } from "lucide-react";

type ConsoleOutputViewProps = {
  /** 要显示的运行输出 ID，来自 RunOutputContext 的 runId */
  runId: string | null;
  /** 可选：无内容时的占位文案 */
  emptyMessage?: string;
  className?: string;
};

/** 将 Unicode 画框字符转为 ASCII，避免终端编码不一致时出现乱码，提升可读性 */
function sanitizeBoxDrawing(text: string): string {
  const map: Record<string, string> = {
    "─": "-", "━": "-", "═": "=",
    "│": "|", "┃": "|", "║": "|",
    "┌": "+", "┐": "+", "└": "+", "┘": "+",
    "├": "|", "┤": "|", "┬": "+", "┴": "+", "┼": "+",
    "╔": "+", "╗": "+", "╚": "+", "╝": "+",
    "╠": "|", "╣": "|", "╦": "+", "╩": "+", "╬": "+",
    "╭": "+", "╮": "+", "╰": "+", "╯": "+",
    "╱": "/", "╲": "\\", "▀": "#", "▄": "#", "█": "#", "░": ".", "▒": ".", "▓": "#",
  };
  return text.replace(/./gu, (c) => map[c] ?? (c >= "\u2500" && c <= "\u257F" ? " " : c));
}

const preClassName = "whitespace-pre-wrap break-words";

/**
 * 根据 runId 订阅并展示该次运行的终端输出（stdout + stderr）。
 * 展示当前执行的命令（若有），并用简约样式区分命令与输出。
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

  const normalizeLines = (s: string) => s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const stdout = sanitizeBoxDrawing(normalizeLines(run.stdout));
  const stderr = sanitizeBoxDrawing(normalizeLines(run.stderr));
  const hasOut = stdout.length > 0;
  const hasErr = stderr.length > 0;
  const hasContent = hasOut || hasErr;
  const showCommand = run.command && run.command.length > 0;

  if (!hasContent && !showCommand) {
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
      className={`flex min-h-0 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-800/50 ${className}`}
      style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
    >
      {showCommand && (
        <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 bg-zinc-100/80 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/80">
          <Terminal className="size-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden />
          <span className="text-[12px] text-zinc-600 dark:text-zinc-300">
            <span className="select-none text-zinc-400 dark:text-zinc-500">$ </span>
            <span className="break-all">{run.command}</span>
          </span>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto px-3 py-2.5 text-[13px] leading-[1.55] text-zinc-800 dark:text-zinc-200">
        {hasOut && <AnsiHtml className={preClassName} text={stdout} />}
        {hasErr && (
          <>
            {hasOut && (
              <div className="mt-2 border-t border-zinc-200/80 pt-2 dark:border-zinc-600/80">
                <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  stderr
                </span>
              </div>
            )}
            <AnsiHtml className={`${preClassName} ${hasOut ? "mt-1" : ""}`} text={stderr} />
          </>
        )}
        {hasContent === false && showCommand && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">等待输出…</p>
        )}
      </div>
    </div>
  );
}
