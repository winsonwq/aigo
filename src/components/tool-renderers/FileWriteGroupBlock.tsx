import { FilePen } from "lucide-react";
import {
  AssistantCollapsibleBlock,
  getBlockLabel,
} from "@/components/AssistantCollapsibleBlock";
import { SummarySuffix } from "./SummarySuffix";
import type { ToolPart, ToolRenderContext } from "./types";
import type { FileOp } from "./utils";
import { getFileWritePath, getFileWriteOp } from "./utils";
import { getPartsStatus } from "./statusHelpers";
import { useExpandedWithAutoCollapse } from "./useExpandedWithAutoCollapse";

/** 写文件分组块：摘要行状态 + 路径提示，展开后每文件「写入/编辑/补丁 + 路径」及具体内容 */
export function FileWriteGroupBlock({
  parts,
  defaultOpen,
}: {
  parts: ToolPart[];
  context: ToolRenderContext;
  defaultOpen: boolean;
  stableKeyPrefix: string;
}) {
  const byPath = new Map<string, { op: FileOp; part: ToolPart }[]>();
  parts.forEach((part, idx) => {
    const path = getFileWritePath(part.state?.input as Record<string, unknown> | undefined);
    const key = path || `no-path-${part.id ?? idx}`;
    if (!byPath.has(key)) byPath.set(key, []);
    byPath.get(key)!.push({ op: getFileWriteOp(part.tool), part });
  });
  const pathList = Array.from(byPath.entries());
  const pathLabels = pathList
    .map(([p]) => (p.startsWith("no-path-") ? "" : p))
    .filter(Boolean) as string[];
  const summaryPaths =
    pathLabels.length === 0
      ? ""
      : pathLabels.length === 1
        ? pathLabels[0]
        : pathLabels.length <= 2
          ? pathLabels.join("、")
          : `${pathLabels[0]} 等 ${pathList.length} 个文件`;

  const newCount = pathList.filter(([, arr]) => arr.some(({ op }) => op === "新建")).length;
  const modCount = pathList.length - newCount;
  const title =
    newCount > 0 && modCount > 0
      ? `新建 ${newCount} 个、修改 ${modCount} 个文件`
      : newCount > 0
        ? `新建 ${pathList.length} 个文件`
        : `修改了 ${pathList.length} 个文件`;

  const { isAnyRunning, statusLabel, statusVariant } = getPartsStatus(parts);
  const [expanded, setExpanded] = useExpandedWithAutoCollapse(defaultOpen, !isAnyRunning);
  const label = getBlockLabel("写入中", "已写入", isAnyRunning);
  const opVerb = (op: FileOp) => (op === "新建" ? "写入" : op === "补丁" ? "补丁" : "编辑");

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
          summaryText={summaryPaths ? `写入 ${summaryPaths}` : null}
        />
      }
    >
      <p className="px-2 pt-1.5 pb-1 text-[11px] text-zinc-500 dark:text-zinc-400">{title}</p>
      <ul className="space-y-3 px-2 pb-2 pt-0 text-sm">
        {pathList.map(([path, arr]) => {
          const { op, part } = arr[0];
          const pathDisplay =
            path.startsWith("no-path-")
              ? getFileWritePath(part.state?.input as Record<string, unknown> | undefined) || "路径缺失"
              : path;
          const isPathMissing = pathDisplay === "路径缺失";
          const errorMsg =
            part.state?.error != null && part.state.error !== "" ? String(part.state.error) : null;
          const input = part.state?.input as Record<string, unknown> | undefined;
          const oldStr = typeof input?.old_string === "string" ? input.old_string : "";
          const newStr =
            typeof input?.new_string === "string"
              ? input.new_string
              : typeof input?.contents === "string"
                ? input.contents
                : typeof input?.content === "string"
                  ? input.content
                  : "";
          const outputText = (part.state?.output ?? "").trim();
          const hasContent = oldStr !== "" || newStr !== "" || outputText !== "";

          return (
            <li key={path} className="rounded-md border border-zinc-200/80 dark:border-zinc-600/80">
              <div className="flex items-center gap-2 px-2 py-1.5 text-xs">
                <FilePen className="h-3 w-3 shrink-0 text-zinc-500 dark:text-zinc-400" />
                <span className="font-medium text-zinc-500 dark:text-zinc-400">{opVerb(op)}</span>
                <span className="min-w-0 truncate font-mono text-zinc-700 dark:text-zinc-300">{pathDisplay}</span>
                {errorMsg != null && (
                  <span className="shrink-0 text-xs text-red-600 dark:text-red-400">（{errorMsg}）</span>
                )}
              </div>
              {isPathMissing && (
                <div className="border-t border-zinc-200/80 px-2 pb-2 pt-1.5 dark:border-zinc-600/80">
                  <div className="rounded bg-zinc-100 dark:bg-zinc-800/80 px-2 py-1.5 space-y-2">
                    <div>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400">原始输入</span>
                      <pre className="mt-0.5 max-h-24 overflow-auto font-mono text-[11px] text-zinc-700 dark:text-zinc-200 whitespace-pre-wrap break-all">
                        {part.state?.input != null
                          ? JSON.stringify(part.state.input, null, 2)
                          : "—"}
                      </pre>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400">原始输出</span>
                      <pre className="mt-0.5 max-h-24 overflow-auto font-mono text-[11px] text-zinc-700 dark:text-zinc-200 whitespace-pre-wrap break-all">
                        {part.state?.output != null && String(part.state.output).trim() !== ""
                          ? String(part.state.output)
                          : "—"}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
              {hasContent && !isPathMissing && (
                <div className="border-t border-zinc-200/80 px-2 pb-2 pt-1 dark:border-zinc-600/80">
                  {oldStr !== "" && (
                    <div className="mb-1.5">
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400">原片段</span>
                      <pre className="mt-0.5 max-h-28 overflow-auto rounded bg-zinc-100 px-2 py-1.5 font-mono text-[11px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                        {oldStr.slice(0, 800)}
                        {oldStr.length > 800 ? "\n…" : ""}
                      </pre>
                    </div>
                  )}
                  {(newStr !== "" || outputText !== "") && (
                    <div>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        {op === "新建" ? "写入内容" : "新内容"}
                      </span>
                      <pre className="mt-0.5 max-h-28 overflow-auto rounded bg-zinc-100 px-2 py-1.5 font-mono text-[11px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                        {(newStr || outputText).slice(0, 800)}
                        {(newStr || outputText).length > 800 ? "\n…" : ""}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </AssistantCollapsibleBlock>
  );
}
