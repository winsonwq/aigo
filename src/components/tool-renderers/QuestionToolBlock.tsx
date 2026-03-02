import { useEffect, useRef } from "react";
import {
  AssistantCollapsibleBlock,
  getBlockLabel,
} from "@/components/AssistantCollapsibleBlock";
import { QuestionsBlock, getQuestionsPayloadFromToolState } from "@/components/QuestionsBlock";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import type { ToolPart, ToolRenderContext } from "./types";
import { useExpandedWithAutoCollapse } from "./useExpandedWithAutoCollapse";

const INCOMPLETE_QUESTION_REFETCH_DELAY_MS = 600;

/** Question 工具专用块：题目、选项、提交答案；非完成时默认展开，完成后默认收起 */
export function QuestionToolBlock({
  part,
  context,
  defaultOpen,
}: {
  part: ToolPart;
  context: ToolRenderContext;
  defaultOpen?: boolean;
}) {
  const questionsPayload = getQuestionsPayloadFromToolState(part.state ?? {});
  const status = part.state?.status ?? "pending";
  const isWaiting = status === "running" || status === "pending";
  const questionAlreadyAnswered =
    !!context.nextUserMessageText && context.nextUserMessageText.startsWith("我选择：");
  const defaultExpanded = defaultOpen !== undefined ? defaultOpen : !!questionsPayload || isWaiting;
  const isCompleted = questionAlreadyAnswered || status === "completed" || status === "error";
  const [expanded, setExpanded] = useExpandedWithAutoCollapse(defaultExpanded, isCompleted);
  const refetchTriggeredRef = useRef(false);
  const isIncompleteQuestion = questionsPayload == null && isWaiting;

  useEffect(() => {
    if (
      !isIncompleteQuestion ||
      !context.onRefetchForIncompleteQuestion ||
      refetchTriggeredRef.current
    )
      return;
    refetchTriggeredRef.current = true;
    const t = setTimeout(() => {
      context.onRefetchForIncompleteQuestion?.();
    }, INCOMPLETE_QUESTION_REFETCH_DELAY_MS);
    return () => clearTimeout(t);
  }, [isIncompleteQuestion, context.onRefetchForIncompleteQuestion]);

  const isQuestionWaitingUser =
    questionsPayload != null && isWaiting && !questionAlreadyAnswered;
  const statusLabel = questionAlreadyAnswered
    ? "完成"
    : isQuestionWaitingUser
      ? "等待选择"
      : status === "pending"
        ? "等待"
        : status === "running"
          ? "执行中"
          : status === "completed"
            ? "完成"
            : "错误";
  const statusVariant = questionAlreadyAnswered
    ? "success"
    : status === "error"
      ? "destructive"
      : status === "running"
        ? "warning"
        : status === "completed"
          ? "success"
          : "secondary";
  const isCallingForLabel = isWaiting && !questionAlreadyAnswered;
  const label = getBlockLabel("Calling", "Called", isCallingForLabel);

  const detailsContent =
    questionsPayload != null ? (
      <div className="space-y-3">
        <QuestionsBlock
          payload={questionsPayload}
          onAnswerSubmit={context.onQuestionAnswer}
          interactive={!questionAlreadyAnswered}
          alreadyAnswered={questionAlreadyAnswered}
          answerText={questionAlreadyAnswered ? context.nextUserMessageText : undefined}
        />
        {part.state?.error != null && part.state.error !== "" && (
          <p className="text-xs text-red-600 dark:text-red-400">{String(part.state.error)}</p>
        )}
      </div>
    ) : undefined;

  return (
    <AssistantCollapsibleBlock
      label={label}
      open={expanded}
      onSummaryClick={() => setExpanded((e) => !e)}
      summarySuffix={
        <>
          {status === "running" && !questionAlreadyAnswered && (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-400 dark:text-zinc-500" />
          )}
          <Badge variant={statusVariant} className="shrink-0 text-[10px]">
            {statusLabel}
          </Badge>
          <span className="shrink-0 font-mono font-medium text-zinc-800 dark:text-zinc-200">
            {part.tool}
          </span>
          {!!part.state?.title && (
            <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
              {String(part.state.title)}
            </span>
          )}
        </>
      }
    >
      {detailsContent}
    </AssistantCollapsibleBlock>
  );
}
