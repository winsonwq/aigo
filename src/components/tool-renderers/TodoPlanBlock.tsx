import { useState } from "react";
import {
  AssistantCollapsibleBlock,
  getBlockLabel,
} from "@/components/AssistantCollapsibleBlock";
import { SummarySuffix } from "./SummarySuffix";
import type { ToolPart, ToolRenderContext } from "./types";
import { getPartsStatus } from "./statusHelpers";

function parseTodoItems(parts: ToolPart[]): { text: string; done: boolean }[] {
  const items: { text: string; done: boolean }[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const raw =
      part.state?.output ??
      (part.state?.input as Record<string, unknown>)?.output ??
      "";
    const str = typeof raw === "string" ? raw.trim() : "";
    if (!str) continue;
    try {
      const parsed = JSON.parse(str) as unknown;
      if (Array.isArray(parsed)) {
        for (const x of parsed) {
          const text =
            typeof x === "string"
              ? x
              : (x as { text?: string; title?: string })?.text ??
                (x as { title?: string })?.title ??
                String(x);
          const done =
            typeof x === "object" &&
            x !== null &&
            "done" in (x as object) &&
            (x as { done?: boolean }).done === true;
          if (text && !seen.has(text)) {
            seen.add(text);
            items.push({ text, done });
          }
        }
      }
    } catch {
      for (const line of str.split("\n").filter(Boolean)) {
        const done = /^\[x\]|^\[X\]|^✔|^✓|- \[x\]/i.test(line);
        const text = line.replace(/^\[[ xX]\]\s*|^✔\s*|^✓\s*/i, "").trim();
        if (text && !seen.has(text)) {
          seen.add(text);
          items.push({ text, done });
        }
      }
    }
  }
  return items;
}

/** 执行计划块：todowrite + todoread 合并为复选框清单 */
export function TodoPlanBlock({
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
  const items = parseTodoItems(parts);
  const doneCount = items.filter((i) => i.done).length;
  const { isAnyRunning, statusLabel, statusVariant } = getPartsStatus(parts);
  const label = getBlockLabel("计划中", "执行计划", isAnyRunning);

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
        />
      }
    >
      <div className="space-y-1 px-2 pb-2 pt-1.5">
        {items.length > 0 && (
          <p className="pb-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            {items.length} 项，{doneCount} 已完成
          </p>
        )}
        {items.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">暂无待办</p>
        ) : (
          <ul className="space-y-1">
            {items.map((item, i) => (
              <li
                key={`${stableKeyPrefix}-todo-${i}`}
                className="flex items-center gap-2 text-sm"
              >
                <span className="shrink-0 text-zinc-500 dark:text-zinc-400">
                  {item.done ? "✔" : "○"}
                </span>
                <span
                  className={
                    item.done ? "text-zinc-500 line-through dark:text-zinc-400" : ""
                  }
                >
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AssistantCollapsibleBlock>
  );
}
