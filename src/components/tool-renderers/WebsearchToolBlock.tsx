import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AssistantCollapsibleBlock,
  getBlockLabel,
} from "@/components/AssistantCollapsibleBlock";
import { SummarySuffix } from "./SummarySuffix";
import type { ToolPart, ToolRenderContext } from "./types";
import { getPartStatus } from "./statusHelpers";

/** websearch：摘要「搜索中/已搜索」+ 查询词，展开后查询一句 + 结果正文 */
export function WebsearchToolBlock({
  part,
  defaultOpen,
}: {
  part: ToolPart;
  context: ToolRenderContext;
  defaultOpen: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const { isCalling, statusLabel, statusVariant } = getPartStatus(part);
  const toolInput = part.state?.input as Record<string, unknown> | undefined;
  const querySummary =
    toolInput && typeof toolInput.query === "string"
      ? toolInput.query
      : toolInput && typeof toolInput.q === "string"
        ? toolInput.q
        : part.state?.title ?? "";
  const resultMarkdown = (part.state?.output ?? "").trim();
  const hasError = part.state?.error != null && part.state.error !== "";
  const hasDetails = !!querySummary || resultMarkdown !== "" || hasError;
  const label = getBlockLabel("搜索中", "已搜索", isCalling);
  const summaryText = querySummary ? `搜索「${String(querySummary)}」` : null;

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
        <div className="space-y-2 px-2 pb-2 pt-1.5">
          {!!querySummary && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">查询：{querySummary}</p>
          )}
          {resultMarkdown !== "" && (
            <div className="max-h-40 overflow-auto rounded-md border border-zinc-200/80 bg-zinc-50/80 p-2 text-sm dark:border-zinc-600/80 dark:bg-zinc-800/80">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{resultMarkdown}</ReactMarkdown>
              </div>
            </div>
          )}
          {hasError && (
            <p className="text-xs text-red-600 dark:text-red-400">{String(part.state?.error)}</p>
          )}
        </div>
      ) : undefined}
    </AssistantCollapsibleBlock>
  );
}
