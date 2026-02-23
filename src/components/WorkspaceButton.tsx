import { FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

/** 与 ModelSelect variant="filled" 风格一致：带图标 + 文案的单按钮，整块可点击 */
export function WorkspaceButton({
  workspacePath,
  onPick,
  disabled,
  className,
}: {
  workspacePath: string | null;
  onPick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const label = workspacePath ?? "选择工作区";
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      title={workspacePath ? `工作区: ${workspacePath}` : "选择工作区文件夹（OpenCode 将以此目录为项目根）"}
      className={cn(
        "flex h-8 min-w-0 max-w-[180px] items-center gap-2 rounded-md px-2.5 py-1 text-left text-xs text-zinc-900",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "border-0 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 dark:focus-visible:ring-zinc-600",
        className
      )}
      aria-label="选择工作区文件夹"
    >
      <FolderOpen className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}
