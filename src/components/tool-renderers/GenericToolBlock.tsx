import {
  AssistantCollapsibleBlock,
  getBlockLabel,
} from "@/components/AssistantCollapsibleBlock";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import type { ToolPart, ToolRenderContext } from "./types";
import { getPartStatus } from "./statusHelpers";
import { useExpandedWithAutoCollapse } from "./useExpandedWithAutoCollapse";

export function GenericToolBlock({
  part,
  defaultOpen,
}: {
  part: ToolPart;
  context: ToolRenderContext;
  defaultOpen: boolean;
}) {
  const { status, isCalling, statusLabel, statusVariant } = getPartStatus(part);
  const [expanded, setExpanded] = useExpandedWithAutoCollapse(defaultOpen, !isCalling);
  const hasDetails =
    (part.state?.input && Object.keys(part.state.input).length > 0) ||
    (part.state?.output != null && part.state.output !== "") ||
    (part.state?.error != null && part.state.error !== "");
  const toolInput = part.state?.input;
  const inputUrl =
    toolInput && typeof toolInput === "object" && "url" in toolInput
      ? String((toolInput as { url?: unknown }).url ?? "")
      : "";
  const isSubagentCall =
    part.tool.toLowerCase().includes("subagent") ||
    part.tool.toLowerCase().includes("task") ||
    (toolInput &&
      typeof toolInput === "object" &&
      "subagent_type" in toolInput &&
      typeof (toolInput as { subagent_type?: unknown }).subagent_type === "string");
  const summaryText = part.state?.error
    ? String(part.state.error)
    : inputUrl || String(part.state?.title ?? "");
  const outputText = (part.state?.output ?? "").trim();
  const label = getBlockLabel("Calling", "Called", isCalling);

  return (
    <AssistantCollapsibleBlock
      label={label}
      open={expanded}
      onSummaryClick={() => setExpanded((e) => !e)}
      summarySuffix={
        <>
          {status === "running" && (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-400 dark:text-zinc-500" />
          )}
          <Badge variant={statusVariant} className="shrink-0 text-[10px]">
            {statusLabel}
          </Badge>
          <span className="shrink-0 font-mono font-medium text-zinc-800 dark:text-zinc-200">
            {part.tool}
          </span>
          {isSubagentCall && (
            <span className="shrink-0 text-[10px] text-zinc-500 dark:text-zinc-400">subagent</span>
          )}
          {!!summaryText && (
            <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
              {summaryText}
            </span>
          )}
        </>
      }
    >
      {hasDetails ? (
        <div className="space-y-2 px-2 pb-2 pt-1.5">
          {isSubagentCall && (
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">子代理调用详情</p>
          )}
          {part.state?.input && Object.keys(part.state.input).length > 0 && (
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">输入</div>
              <pre className="max-h-32 overflow-auto rounded-md bg-zinc-200/60 p-2 text-xs dark:bg-zinc-700/60">
                {JSON.stringify(part.state.input, null, 2)}
              </pre>
            </div>
          )}
          {outputText !== "" && (
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">输出</div>
              <pre className="max-h-40 overflow-auto rounded-md bg-zinc-200/60 p-2 text-xs dark:bg-zinc-700/60">
                {outputText}
              </pre>
            </div>
          )}
          {part.state?.error != null && part.state.error !== "" && (
            <p className="text-xs text-red-600 dark:text-red-400">{String(part.state.error)}</p>
          )}
        </div>
      ) : undefined}
    </AssistantCollapsibleBlock>
  );
}
