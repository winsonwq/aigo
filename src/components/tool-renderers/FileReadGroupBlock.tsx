import { useState } from "react";
import {
  AssistantCollapsibleBlock,
  getBlockLabel,
} from "@/components/AssistantCollapsibleBlock";
import { Search } from "lucide-react";
import { SummarySuffix } from "./SummarySuffix";
import type { ToolPart, ToolRenderContext } from "./types";
import { getPartsStatus } from "./statusHelpers";
import { TOOL_READ, TOOL_GREP, TOOL_GLOB, TOOL_LIST } from "./utils";

/** 读/搜文件分组块：摘要行状态 + 关键内容提示，展开后直接展示每项详情 */
export function FileReadGroupBlock({
  parts,
  defaultOpen,
  stableKeyPrefix,
}: {
  parts: ToolPart[];
  context: ToolRenderContext;
  defaultOpen: boolean;
  stableKeyPrefix: string;
}) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const { isAnyRunning, statusLabel, statusVariant } = getPartsStatus(parts);
  const label = getBlockLabel("浏览中", "已浏览", isAnyRunning);

  const summaryHint =
    parts.length === 0
      ? ""
      : parts.length === 1
        ? (() => {
            const p = parts[0];
            const t = p.tool?.toLowerCase() ?? "";
            const input = p.state?.input as Record<string, unknown> | undefined;
            const path = (input && typeof input.path === "string" ? input.path : "") || "";
            const query =
              input && typeof input.query === "string"
                ? input.query
                : input && typeof input.q === "string"
                  ? input.q
                  : "";
            if (t === "codesearch" && query)
              return `搜索「${query.slice(0, 24)}${query.length > 24 ? "…" : ""}」`;
            if (path) return path;
            return "代码库查阅";
          })()
        : `共 ${parts.length} 次查阅`;

  return (
    <AssistantCollapsibleBlock
      label={label}
      open={expanded}
      onSummaryClick={() => setExpanded((e) => !e)}
      summarySuffix={
        <SummarySuffix
          isRunning={isAnyRunning}
          statusLabel={statusLabel}
          statusVariant={statusVariant}
          summaryText={summaryHint || null}
        />
      }
    >
      <div className="space-y-3 px-2 pb-2 pt-1.5">
        {parts.length > 1 && (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">共 {parts.length} 次查阅</p>
        )}
        {parts.map((part, i) => {
          const t = part.tool?.toLowerCase() ?? "";
          const input = part.state?.input as Record<string, unknown> | undefined;
          const path = (input && typeof input.path === "string" ? input.path : "") || "";
          const pathStr = path || "(路径)";
          const output = (part.state?.output ?? "").trim();
          let lineSummary = "";
          if (t === TOOL_READ)
            lineSummary = pathStr !== "(路径)" ? `读取了 ${pathStr}` : "读取文件";
          else if (t === TOOL_GREP)
            lineSummary = output
              ? `匹配 ${output.split("\n").filter(Boolean).length} 处`
              : "grep";
          else if (t === TOOL_GLOB || t === TOOL_LIST)
            lineSummary = output
              ? `找到 ${output.split("\n").filter(Boolean).length} 项`
              : "列表";
          else if (t === "codesearch") {
            const query =
              input && typeof input.query === "string"
                ? input.query
                : input && typeof input.q === "string"
                  ? input.q
                  : "";
            lineSummary = query
              ? `搜索「${query.slice(0, 40)}${query.length > 40 ? "…" : ""}」`
              : output
                ? `匹配 ${output.split("\n").filter(Boolean).length} 处`
                : "代码搜索";
          }
          return (
            <div
              key={`${stableKeyPrefix}-read-${i}`}
              className="rounded-md border border-zinc-200/80 dark:border-zinc-600/80"
            >
              <div className="flex items-center gap-2 px-2 py-1.5 text-xs">
                <Search className="h-3 w-3 shrink-0 text-zinc-500 dark:text-zinc-400" />
                <span className="min-w-0 truncate font-mono text-zinc-700 dark:text-zinc-300">
                  {t} {pathStr !== "(路径)" ? pathStr : ""}
                </span>
                {lineSummary && (
                  <span className="shrink-0 text-[10px] text-zinc-500 dark:text-zinc-400">
                    {lineSummary}
                  </span>
                )}
              </div>
              {output !== "" && (
                <pre className="max-h-32 overflow-auto border-t border-zinc-200/80 px-2 py-1.5 font-mono text-[11px] text-zinc-700 dark:border-zinc-600/80 dark:text-zinc-200">
                  {output.slice(0, 2000)}
                  {output.length > 2000 ? "\n…" : ""}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </AssistantCollapsibleBlock>
  );
}
