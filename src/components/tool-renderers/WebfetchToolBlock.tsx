import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Globe } from "lucide-react";
import { markdownLinkComponents } from "@/components/MarkdownLink";
import {
  AssistantCollapsibleBlock,
  getBlockLabel,
} from "@/components/AssistantCollapsibleBlock";
import { SummarySuffix } from "./SummarySuffix";
import type { ToolPart, ToolRenderContext } from "./types";
import { getPartStatus } from "./statusHelpers";
import { useExpandedWithAutoCollapse } from "./useExpandedWithAutoCollapse";

/** webfetch：状态右侧展示 URL 文本，展开后展示内容 */
export function WebfetchToolBlock({
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
        <div className="space-y-0 px-2 pb-2 pt-1.5">
          <div className="rounded-md border border-zinc-200/80 dark:border-zinc-600/80">
            <div className="flex items-center gap-2 px-2 py-1.5 text-xs">
              <Globe className="h-3 w-3 shrink-0 text-zinc-500 dark:text-zinc-400" />
              <span className="font-medium text-zinc-500 dark:text-zinc-400">获取</span>
              <span className="min-w-0 flex-1 truncate font-mono text-zinc-700 dark:text-zinc-300">
                {url || "—"}
              </span>
            </div>
            {(output !== "" || (part.state?.error != null && part.state?.error !== "")) && (
              <div className="border-t border-zinc-200/80 px-2 py-1.5 dark:border-zinc-600/80">
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
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400">{String(part.state.error)}</p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : undefined}
    </AssistantCollapsibleBlock>
  );
}
