import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  AssistantCollapsibleBlock,
  getBlockLabel,
} from "@/components/AssistantCollapsibleBlock";
import { QuestionsBlock, getQuestionsPayloadFromToolState } from "@/components/QuestionsBlock";
import { Badge } from "@/components/ui/badge";

export type ToolPart = {
  id?: string;
  type: "tool";
  tool: string;
  state?: {
    status?: "pending" | "running" | "completed" | "error";
    input?: Record<string, unknown>;
    output?: string;
    error?: string;
    title?: string;
  };
};

export type ToolRenderContext = {
  onQuestionAnswer?: (answerText: string) => void;
  nextUserMessageText?: string;
  onRefetchForIncompleteQuestion?: () => void;
};

/** 通用工具块：展示状态、输入/输出/错误，可折叠 */
export function GenericToolBlock({
  part,
  defaultOpen,
}: {
  part: ToolPart;
  context: ToolRenderContext;
  defaultOpen: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const status = part.state?.status ?? "pending";
  const isCalling = status === "running" || status === "pending";
  const hasDetails =
    (part.state?.input && Object.keys(part.state.input).length > 0) ||
    (part.state?.output != null && part.state.output !== "") ||
    (part.state?.error != null && part.state?.error !== "");
  const statusLabel =
    status === "pending"
      ? "等待"
      : status === "running"
        ? "执行中"
        : status === "completed"
          ? "完成"
          : "错误";
  const statusVariant =
    status === "error"
      ? "destructive"
      : status === "running"
        ? "warning"
        : status === "completed"
          ? "success"
          : "secondary";
  const toolInput = part.state?.input;
  const inputUrl =
    toolInput && typeof toolInput === "object" && "url" in toolInput
      ? String((toolInput as { url?: unknown }).url ?? "")
      : "";
  const isSubagentCall =
    part.tool.toLowerCase().includes("subagent") ||
    part.tool.toLowerCase().includes("task") ||
    (toolInput &&
      typeof toolInput === "object" &&
      "subagent_type" in toolInput &&
      typeof (toolInput as { subagent_type?: unknown }).subagent_type === "string");
  const summaryText = part.state?.error
    ? String(part.state.error)
    : inputUrl || String(part.state?.title ?? "");
  const outputText = (part.state?.output ?? "").trim();
  const label = getBlockLabel("Calling", "Called", isCalling);

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
          <span className="shrink-0 font-mono font-medium text-zinc-800 dark:text-zinc-200">
            {part.tool}
          </span>
          {isSubagentCall && (
            <span className="shrink-0 text-[10px] text-zinc-500 dark:text-zinc-400">subagent</span>
          )}
          {!!summaryText && (
            <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
              {summaryText}
            </span>
          )}
        </>
      }
    >
      {hasDetails ? (
        <div className="space-y-2 px-2 pb-2 pt-1.5">
          {isSubagentCall && (
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">子代理调用详情</p>
          )}
          {part.state?.input && Object.keys(part.state.input).length > 0 && (
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">输入</div>
              <pre className="max-h-32 overflow-auto rounded-md bg-zinc-200/60 p-2 text-xs dark:bg-zinc-700/60">
                {JSON.stringify(part.state.input, null, 2)}
              </pre>
            </div>
          )}
          {outputText !== "" && (
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">输出</div>
              <pre className="max-h-40 overflow-auto rounded-md bg-zinc-200/60 p-2 text-xs dark:bg-zinc-700/60">
                {outputText}
              </pre>
            </div>
          )}
          {part.state?.error != null && part.state.error !== "" && (
            <p className="text-xs text-red-600 dark:text-red-400">{String(part.state.error)}</p>
          )}
        </div>
      ) : undefined}
    </AssistantCollapsibleBlock>
  );
}

const INCOMPLETE_QUESTION_REFETCH_DELAY_MS = 600;

/** Question 工具专用块：题目、选项、提交答案；等待时默认展开；无 payload 时延迟 refetch */
export function QuestionToolBlock({
  part,
  context,
}: {
  part: ToolPart;
  context: ToolRenderContext;
}) {
  const questionsPayload = getQuestionsPayloadFromToolState(part.state ?? {});
  const status = part.state?.status ?? "pending";
  const isWaiting = status === "running" || status === "pending";
  const questionAlreadyAnswered =
    !!context.nextUserMessageText && context.nextUserMessageText.startsWith("我选择：");
  const expandWhenWaiting = !!questionsPayload || isWaiting;
  const [expanded, setExpanded] = useState(expandWhenWaiting);
  const refetchTriggeredRef = useRef(false);
  const isIncompleteQuestion = questionsPayload == null && isWaiting;

  useEffect(() => {
    if (!isIncompleteQuestion || !context.onRefetchForIncompleteQuestion || refetchTriggeredRef.current) return;
    refetchTriggeredRef.current = true;
    const t = setTimeout(() => {
      context.onRefetchForIncompleteQuestion?.();
    }, INCOMPLETE_QUESTION_REFETCH_DELAY_MS);
    return () => clearTimeout(t);
  }, [isIncompleteQuestion, context.onRefetchForIncompleteQuestion]);

  const isQuestionWaitingUser = questionsPayload != null && isWaiting && !questionAlreadyAnswered;
  const statusLabel =
    questionAlreadyAnswered
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

const QUESTION_TOOL_NAME = "question";

function isQuestionTool(part: ToolPart): boolean {
  return part.tool?.toLowerCase() === QUESTION_TOOL_NAME;
}

/**
 * 根据工具类型选择渲染方式：question 走 QuestionToolBlock，其余走 GenericToolBlock。
 * stableKey 用于 React key，避免 refetch 后 part.id 变化导致整块重挂载、丢失本地状态（如选项勾选）。
 */
export function renderToolPart(
  part: ToolPart,
  context: ToolRenderContext,
  stableKey: string
): React.ReactNode {
  if (isQuestionTool(part)) {
    return (
      <QuestionToolBlock key={stableKey} part={part} context={context} />
    );
  }
  const defaultOpen =
    (part.state?.input && Object.keys(part.state.input).length > 0) ||
    (part.state?.output != null && part.state.output !== "") ||
    (part.state?.error != null && part.state.error !== "");
  return (
    <GenericToolBlock
      key={stableKey}
      part={part}
      context={context}
      defaultOpen={!!defaultOpen}
    />
  );
}
