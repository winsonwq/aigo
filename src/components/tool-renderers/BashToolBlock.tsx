import { useState } from "react";
import {
  AssistantCollapsibleBlock,
  getBlockLabel,
} from "@/components/AssistantCollapsibleBlock";
import { SummarySuffix } from "./SummarySuffix";
import type { ToolPart, ToolRenderContext } from "./types";
import { getPartStatus } from "./statusHelpers";

function getBashCommand(input: Record<string, unknown> | undefined): string {
  if (!input || typeof input !== "object") return "";
  const cmd =
    typeof input.command === "string"
      ? input.command
      : typeof input.command_line === "string"
        ? input.command_line
        : "";
  return cmd.trim();
}

/** bash：摘要显示描述，展开后 $ 命令 + 输出块 */
export function BashToolBlock({
  part,
  defaultOpen,
}: {
  part: ToolPart;
  context: ToolRenderContext;
  defaultOpen: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const { isCalling, statusLabel, statusVariant } = getPartStatus(part);
  const input = part.state?.input as Record<string, unknown> | undefined;
  const command = getBashCommand(input);
  const cwd =
    input && typeof input.cwd === "string" && input.cwd.trim() !== ""
      ? input.cwd.trim()
      : "";
  const outputText = (part.state?.output ?? "").trim();
  const hasError = part.state?.error != null && part.state.error !== "";
  const hasDetails = command !== "" || outputText !== "" || hasError;
  const label = getBlockLabel("运行", "已运行", isCalling);
  const summaryText =
    part.state?.title && String(part.state.title).trim() !== ""
      ? String(part.state.title).trim()
      : "执行 shell 命令";

  return (
    <AssistantCollapsibleBlock
      label={label}
      open={expanded}
      onSummaryClick={() => setExpanded((e) => !e)}
      summarySuffix={
        <SummarySuffix
          isRunning={part.state?.status === "running"}
          statusLabel={statusLabel}
          statusVariant={statusVariant}
          summaryText={summaryText}
        />
      }
    >
      {hasDetails ? (
        <div className="space-y-0 px-2 pb-2 pt-1.5">
          {command !== "" && (
            <div className="flex items-baseline gap-2 font-mono text-xs">
              <span className="shrink-0 select-none text-zinc-500 dark:text-zinc-400">$</span>
              <span className="min-w-0 break-all text-zinc-800 dark:text-zinc-200">{command}</span>
            </div>
          )}
          {cwd !== "" && (
            <p className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">cwd: {cwd}</p>
          )}
          {outputText !== "" && (
            <pre className="mt-2 max-h-40 overflow-auto rounded-md border border-zinc-200 bg-zinc-100 px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-200">
              {outputText}
            </pre>
          )}
          {hasError && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">{String(part.state?.error)}</p>
          )}
        </div>
      ) : undefined}
    </AssistantCollapsibleBlock>
  );
}
