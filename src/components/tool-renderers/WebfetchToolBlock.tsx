import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownLinkComponents } from "@/components/MarkdownLink";
import {
  AssistantCollapsibleBlock,
  getBlockLabel,
} from "@/components/AssistantCollapsibleBlock";
import { SummarySuffix } from "./SummarySuffix";
import type { ToolPart, ToolRenderContext } from "./types";
import { getPartStatus } from "./statusHelpers";

/** webfetch：状态右侧展示 URL 文本，展开后展示内容 */
export function WebfetchToolBlock({
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
  const url = typeof input?.url === "string" ? input.url : "";
  const output = (part.state?.output ?? "").trim();
  const hasDetails =
    url !== "" || output !== "" || (part.state?.error != null && part.state?.error !== "");
  const label = getBlockLabel("获取中", "已获取", isCalling);
  const summaryText = url ? `获取 ${url}` : null;

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
        <div className="space-y-1 px-2 pb-2 pt-1.5">
          {output !== "" && (
            <div className="max-h-40 overflow-auto rounded border border-zinc-200/80 bg-zinc-50/80 p-2 text-xs dark:border-zinc-600/80 dark:bg-zinc-800/80 prose prose-sm dark:prose-invert max-w-none">
              {output.length > 2000 ? (
                <pre className="whitespace-pre-wrap font-sans">{output.slice(0, 2000)}…</pre>
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownLinkComponents}>{output}</ReactMarkdown>
              )}
            </div>
          )}
          {part.state?.error != null && part.state?.error !== "" && (
            <p className="text-xs text-red-600 dark:text-red-400">{String(part.state.error)}</p>
          )}
        </div>
      ) : undefined}
    </AssistantCollapsibleBlock>
  );
}
