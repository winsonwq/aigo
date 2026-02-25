import { Fragment, type ReactNode } from "react";
import type { ToolPart, ToolRenderContext, ToolGroupKind } from "./types";
import { isPartInProgress } from "./statusHelpers";
import {
  groupConsecutiveToolParts,
  defaultOpenForParts,
  isQuestionTool,
  isWebsearchTool,
  isBashTool,
} from "./utils";
import { GenericToolBlock } from "./GenericToolBlock";
import { WebsearchToolBlock } from "./WebsearchToolBlock";
import { BashToolBlock } from "./BashToolBlock";
import { WebfetchToolBlock } from "./WebfetchToolBlock";
import { FileWriteGroupBlock } from "./FileWriteGroupBlock";
import { FileReadGroupBlock } from "./FileReadGroupBlock";
import { TodoPlanBlock } from "./TodoPlanBlock";
import { SkillToolBlock } from "./SkillToolBlock";
import { QuestionToolBlock } from "./QuestionToolBlock";

export type { ToolPart, ToolRenderContext, ToolGroupKind };
export { groupConsecutiveToolParts };

/**
 * 根据工具类型选择渲染方式；非完成时默认展开，完成后默认收起。
 * stableKey 用于 React key，避免 refetch 后 part.id 变化导致整块重挂载。
 */
export function renderToolPart(
  part: ToolPart,
  context: ToolRenderContext,
  stableKey: string
): ReactNode {
  const defaultOpen = isPartInProgress(part);
  if (isQuestionTool(part)) {
    return (
      <QuestionToolBlock key={stableKey} part={part} context={context} defaultOpen={defaultOpen} />
    );
  }
  if (isWebsearchTool(part)) {
    return (
      <WebsearchToolBlock
        key={stableKey}
        part={part}
        context={context}
        defaultOpen={defaultOpen}
      />
    );
  }
  if (isBashTool(part)) {
    return (
      <BashToolBlock
        key={stableKey}
        part={part}
        context={context}
        defaultOpen={defaultOpen}
      />
    );
  }
  return (
    <GenericToolBlock
      key={stableKey}
      part={part}
      context={context}
      defaultOpen={defaultOpen}
    />
  );
}

/**
 * 按连续分组渲染整段工具调用：file-write → FileWriteGroupBlock，file-read → FileReadGroupBlock，
 * bash/question 逐条，todo → TodoPlanBlock，web 逐条（webfetch/websearch），skill 逐条，generic 逐条。
 */
export function renderToolSegment(
  parts: ToolPart[],
  context: ToolRenderContext,
  messageId: string,
  segmentIndex: number
): ReactNode {
  const groups = groupConsecutiveToolParts(parts);
  const prefix = `${messageId}-seg-${segmentIndex}`;

  return (
    <div className="tool my-2 flex flex-col gap-1">
      {groups.map((group, gi) => {
        const key = `${prefix}-g-${gi}`;
        const defaultOpen = defaultOpenForParts(group.parts);

        if (group.kind === "file-write") {
          return (
            <FileWriteGroupBlock
              key={key}
              parts={group.parts}
              context={context}
              defaultOpen={defaultOpen}
              stableKeyPrefix={key}
            />
          );
        }
        if (group.kind === "file-read") {
          return (
            <FileReadGroupBlock
              key={key}
              parts={group.parts}
              context={context}
              defaultOpen={defaultOpen}
              stableKeyPrefix={key}
            />
          );
        }
        if (group.kind === "todo") {
          return (
            <TodoPlanBlock
              key={key}
              parts={group.parts}
              context={context}
              defaultOpen={defaultOpen}
              stableKeyPrefix={key}
            />
          );
        }
        if (group.kind === "bash") {
          return (
            <Fragment key={key}>
              {group.parts.map((part, idx) =>
                renderToolPart(part, context, `${key}-${idx}`)
              )}
            </Fragment>
          );
        }
        if (group.kind === "question") {
          const n = group.parts.length;
          return (
            <Fragment key={key}>
              {n > 1 && (
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  向您确认（{n} 次）
                </p>
              )}
              {group.parts.map((part, idx) =>
                renderToolPart(part, context, `${key}-${idx}`)
              )}
            </Fragment>
          );
        }
        if (group.kind === "web") {
          return (
            <Fragment key={key}>
              {group.parts.map((part, idx) => {
                const stableKey = `${key}-${idx}`;
                const p = part;
                const t = p.tool?.toLowerCase() ?? "";
                if (t === "webfetch") {
                  return (
                    <WebfetchToolBlock
                      key={stableKey}
                      part={p}
                      context={context}
                      defaultOpen={defaultOpenForParts([p])}
                    />
                  );
                }
                if (t === "websearch") {
                  return (
                    <WebsearchToolBlock
                      key={stableKey}
                      part={p}
                      context={context}
                      defaultOpen={defaultOpenForParts([p])}
                    />
                  );
                }
                return renderToolPart(p, context, stableKey);
              })}
            </Fragment>
          );
        }
        if (group.kind === "skill") {
          return (
            <Fragment key={key}>
              {group.parts.map((part, idx) => (
                <SkillToolBlock
                  key={`${key}-${idx}`}
                  part={part}
                  context={context}
                  defaultOpen={defaultOpenForParts([part])}
                />
              ))}
            </Fragment>
          );
        }
        return (
          <Fragment key={key}>
            {group.parts.map((part, idx) =>
              renderToolPart(part, context, `${key}-${idx}`)
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
