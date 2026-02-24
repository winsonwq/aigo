import { useSelector } from "react-redux";
import { FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RootState } from "@/store";

/** 工作区按钮：路径来自 store，整块点击可更换文件夹。 */
export function WorkspaceButton({
  onPick,
  disabled,
  className,
}: {
  onPick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const workspacePath = useSelector((s: RootState) => s.workspace.workspacePath);
  const label = workspacePath ?? "~";
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      title={workspacePath ? `工作区: ${workspacePath}；点击可更换` : "工作区: ~（主目录）；点击可更换"}
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
