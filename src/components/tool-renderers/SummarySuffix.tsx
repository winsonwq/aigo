import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type BadgeVariant = "destructive" | "warning" | "success" | "secondary";

/**
 * 已搜索、已获取、已浏览、已写入等工具块共用的摘要行右侧：可选的 spinner + 状态 Badge + 可选的摘要文案。
 * 统一展示模式，避免各块重复写 Loader2 + Badge + span。
 */
export function SummarySuffix({
  isRunning,
  statusLabel,
  statusVariant,
  summaryText,
  children,
}: {
  isRunning: boolean;
  statusLabel: string;
  statusVariant: BadgeVariant;
  summaryText?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <>
      {isRunning && (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-400 dark:text-zinc-500" />
      )}
      <Badge variant={statusVariant} className="shrink-0 text-[10px]">
        {statusLabel}
      </Badge>
      {summaryText != null && summaryText !== "" && (
        <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
          {summaryText}
        </span>
      )}
      {children}
    </>
  );
}
