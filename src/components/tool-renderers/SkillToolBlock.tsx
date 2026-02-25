import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpen } from "lucide-react";
import {
  AssistantCollapsibleBlock,
  getBlockLabel,
} from "@/components/AssistantCollapsibleBlock";
import { SummarySuffix } from "./SummarySuffix";
import type { ToolPart, ToolRenderContext } from "./types";
import { getPartStatus } from "./statusHelpers";

/** skill：使用了技能 <name>，可折叠展示内容 */
export function SkillToolBlock({
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
  const name =
    (typeof input?.name === "string" ? input.name : null) ??
    (typeof input?.path === "string" ? input.path : null) ??
    part.state?.title ??
    "技能";
  const output = (part.state?.output ?? "").trim();
  const hasDetails =
    output !== "" || (part.state?.error != null && part.state?.error !== "");
  const label = getBlockLabel("加载中", "已使用技能", isCalling);

  return (
    <AssistantCollapsibleBlock
      label={label}
      open={expanded}
      onSummaryClick={() => setExpanded((e) => !e)}
      summarySuffix={
        <>
          <SummarySuffix
            isRunning={part.state?.status === "running"}
            statusLabel={statusLabel}
            statusVariant={statusVariant}
          />
          <span className="min-w-0 flex-1 truncate font-medium text-zinc-700 dark:text-zinc-300">
            <BookOpen className="mr-1 inline h-3.5 w-3.5" />
            {name}
          </span>
        </>
      }
    >
      {(hasDetails && output !== "") ||
      (part.state?.error != null && part.state?.error !== "") ? (
        <>
          {output !== "" && (
            <div className="max-h-48 overflow-auto rounded border border-zinc-200/80 bg-zinc-50/80 px-2 py-1.5 text-xs dark:border-zinc-600/80 dark:bg-zinc-800/80 prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {output.slice(0, 3000)}
              </ReactMarkdown>
            </div>
          )}
          {part.state?.error != null && part.state?.error !== "" && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {String(part.state.error)}
            </p>
          )}
        </>
      ) : undefined}
    </AssistantCollapsibleBlock>
  );
}
