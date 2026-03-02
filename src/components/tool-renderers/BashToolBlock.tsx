import { Terminal } from "lucide-react";
import {
  AssistantCollapsibleBlock,
  getBlockLabel,
} from "@/components/AssistantCollapsibleBlock";
import { SummarySuffix } from "./SummarySuffix";
import type { ToolPart, ToolRenderContext } from "./types";
import { getPartStatus } from "./statusHelpers";
import { useExpandedWithAutoCollapse } from "./useExpandedWithAutoCollapse";

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
  const { isCalling, statusLabel, statusVariant } = getPartStatus(part);
  const [expanded, setExpanded] = useExpandedWithAutoCollapse(defaultOpen, !isCalling);
  const input = part.state?.input as Record<string, unknown> | undefined;
  const command = getBashCommand(input);
  const cwd =
    input && typeof input.cwd === "string" && input.cwd.trim() !== ""
      ? input.cwd.trim()
      : "";
  const outputText = (part.state?.output ?? "").trim();
  const hasError = part.state?.error != null && part.state.error !== "";
  const hasDetails = command !== "" || outputText !== "" || hasError;
  const label = getBlockLabel("运行中", "已运行", isCalling);
  const description =
    part.state?.title && String(part.state.title).trim() !== ""
      ? String(part.state.title).trim()
      : "执行 shell 命令";
  const summaryText =
    isCalling
      ? command !== ""
        ? `运行 ${command.length > 60 ? `${command.slice(0, 60)}…` : command}`
        : description
      : description;

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
          <div className="rounded-md border border-zinc-200/80 dark:border-zinc-600/80">
            <div className="flex items-center gap-2 px-2 py-1.5 text-xs">
              <Terminal className="h-3 w-3 shrink-0 text-zinc-500 dark:text-zinc-400" />
              <span className="font-medium text-zinc-500 dark:text-zinc-400">命令</span>
              <span className="min-w-0 flex-1 truncate font-mono text-zinc-700 dark:text-zinc-300">
                {command !== "" ? command : "—"}
              </span>
            </div>
            {(cwd !== "" || outputText !== "" || hasError) && (
              <div className="border-t border-zinc-200/80 px-2 pb-2 pt-1.5 dark:border-zinc-600/80">
                {cwd !== "" && (
                  <p className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">cwd: {cwd}</p>
                )}
                {outputText !== "" && (
                  <pre className="mt-2 max-h-40 overflow-auto rounded bg-zinc-100 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    {outputText}
                  </pre>
                )}
                {hasError && (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400">{String(part.state?.error)}</p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : undefined}
    </AssistantCollapsibleBlock>
  );
}
