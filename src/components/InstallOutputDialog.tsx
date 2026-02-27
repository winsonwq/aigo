import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { X, Terminal } from "lucide-react";
import { ConsoleOutputView } from "@/components/ConsoleOutputView";

export type InstallOutputDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 当前要查看的那一次安装的 runId，只显示该条输出，无左侧切换 */
  runId: string | null;
  /** 弹窗标题，由使用方指定，如「安装输出」「终端输出」等 */
  title?: string;
};

export function InstallOutputDialog({
  open,
  onOpenChange,
  runId,
  title = "终端输出",
}: InstallOutputDialogProps) {
  const handleClose = () => onOpenChange(false);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="flex h-[80vh] w-full max-w-4xl flex-col rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            <Terminal className="size-4" />
            {title}
          </h2>
          <Button type="button" variant="ghost" size="icon" className="size-8" onClick={handleClose} aria-label="关闭">
            <X className="size-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <ConsoleOutputView runId={runId} emptyMessage="暂无输出" />
        </div>
      </div>
    </div>,
    document.body
  );
}
