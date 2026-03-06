import {
  AssistantCollapsibleBlock,
  getBlockLabel,
} from "@/components/AssistantCollapsibleBlock";
import { markdownLinkComponents } from "@/components/MarkdownLink";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, Loader2, PanelRightOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ToolPart, ToolRenderContext } from "./types";
import { getPartStatus } from "./statusHelpers";
import { useExpandedWithAutoCollapse } from "./useExpandedWithAutoCollapse";
import { getSubagentOutput, getSubagentPrompt, getSubagentSummaryCommand } from "./utils";

/** 解析子任务输出：提取 task_id 行与 <task_result> 内文，便于排版渲染 */
function parseSubagentOutput(raw: string): { taskId?: string; body: string } {
  let rest = raw.trim();
  const taskIdMatch = rest.match(/^task_id:\s*(\S+)(?:\s*\([^)]*\))?\s*\n?/i);
  const taskId = taskIdMatch ? taskIdMatch[1].trim() : undefined;
  if (taskIdMatch) rest = rest.slice(taskIdMatch[0].length).trim();

  const taskResultMatch = rest.match(/<task_result>\s*([\s\S]*?)<\/task_result>/i);
  let body = taskResultMatch ? taskResultMatch[1].trim() : rest;
  body = tabSeparatedToMarkdownTable(body);
  return { taskId, body };
}

/** 将 tab 分隔的段落转为 Markdown 表格，便于正确排版 */
function tabSeparatedToMarkdownTable(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      out.push(line);
      i++;
      continue;
    }
    const cells = trimmed.split(/\t/);
    const isAlreadyMarkdown = trimmed.startsWith("#") || trimmed.startsWith("|");
    if (cells.length >= 2 && !isAlreadyMarkdown) {
      const tableRows: string[] = [];
      tableRows.push("| " + cells.map((c) => c.trim()).join(" | ") + " |");
      i++;
      while (i < lines.length) {
        const next = lines[i].trim();
        if (!next) break;
        const nextCells = next.split(/\t/);
        if (nextCells.length !== cells.length) break;
        tableRows.push("| " + nextCells.map((c) => c.trim()).join(" | ") + " |");
        i++;
      }
      tableRows.splice(1, 0, "|" + cells.map(() => " --- ").join("|") + "|");
      out.push(tableRows.join("\n"));
      continue;
    }
    out.push(line);
    i++;
  }
  return out.join("\n");
}

/** 子任务类型标签（如 explore / shell / browser） */
function getSubagentTypeLabel(part: ToolPart): string {
  const input = part.state?.input;
  if (input && typeof input === "object" && typeof (input as { subagent_type?: unknown }).subagent_type === "string") {
    return String((input as { subagent_type: string }).subagent_type);
  }
  const t = part.tool?.toLowerCase() ?? "";
  if (t.includes("explore")) return "explore";
  if (t.includes("shell") || t.includes("bash")) return "shell";
  if (t.includes("browser")) return "browser";
  return "子任务";
}

export function SubagentToolBlock({
  part,
  context,
  defaultOpen,
}: {
  part: ToolPart;
  context: ToolRenderContext;
  defaultOpen: boolean;
}) {
  const { status, isCalling, statusLabel, statusVariant } = getPartStatus(part);
  const [expanded, setExpanded] = useExpandedWithAutoCollapse(defaultOpen, !isCalling);
  const summaryCommand = getSubagentSummaryCommand(part);
  const prompt = getSubagentPrompt(part);
  const rawOutput = getSubagentOutput(part);
  const { taskId, body: outputBody } = rawOutput ? parseSubagentOutput(rawOutput) : { taskId: undefined, body: "" };
  const hasDetails = Boolean(summaryCommand || prompt || rawOutput);
  const typeLabel = getSubagentTypeLabel(part);
  const label = getBlockLabel("子任务执行中", "子任务完成", isCalling);
  const canOpenPanel = !!context.onOpenSubagentPanel;
  const isPanelOpen = !!context.isSubagentPanelOpenFor?.(part, context.messageId);

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
          <Bot className="h-3 w-3 shrink-0 text-zinc-500 dark:text-zinc-400" />
          <span className="shrink-0 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
            {typeLabel}
          </span>
          {summaryCommand && (
            <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
              {summaryCommand}
            </span>
          )}
          {canOpenPanel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 h-7 gap-1 px-2 text-[10px] [&_svg]:size-3"
              onClick={(e) => {
                e.stopPropagation();
                context.onOpenSubagentPanel?.(part, context.messageId);
              }}
              title={isPanelOpen ? "收起右侧面板" : "在右侧面板查看子任务详情"}
            >
              <PanelRightOpen />
              {isPanelOpen ? "收起" : "在面板查看"}
            </Button>
          )}
        </>
      }
    >
      {hasDetails ? (
        <div className="space-y-0 px-2 pb-2 pt-1.5">
          <div className="rounded-md border border-zinc-200/80 dark:border-zinc-600/80">
            {prompt && (
              <div className="flex flex-col gap-1 px-2 py-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <Bot className="h-3 w-3 shrink-0 text-zinc-500 dark:text-zinc-400" />
                  <span className="font-medium text-zinc-500 dark:text-zinc-400">
                    子任务指令
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-800 dark:text-zinc-200">
                  {prompt}
                </p>
              </div>
            )}
            {rawOutput && (
              <div
                className={
                  prompt
                    ? "border-t border-zinc-200/80 px-2 pb-2 pt-1.5 dark:border-zinc-600/80"
                    : "px-2 pb-2 pt-1.5"
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    子任务输出
                  </span>
                  {taskId && (
                    <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500" title="可恢复任务 ID">
                      {taskId}
                    </span>
                  )}
                </div>
                <div className="subagent-output-content markdown-content mt-1.5 max-h-56 overflow-auto text-zinc-700 dark:text-zinc-300">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownLinkComponents}>
                    {outputBody}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : undefined}
    </AssistantCollapsibleBlock>
  );
}
