import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** 题目选项 */
export type QuestionOption = {
  label: string;
  description: string;
};

/** 单道题目 */
export type QuestionItem = {
  header?: string;
  question: string;
  multiple?: boolean;
  options: QuestionOption[];
};

/** 助手返回的 questions 载荷 */
export type QuestionsPayload = {
  questions: QuestionItem[];
};

function isQuestionOption(o: unknown): o is QuestionOption {
  return (
    o != null &&
    typeof o === "object" &&
    typeof (o as QuestionOption).label === "string" &&
    typeof (o as QuestionOption).description === "string"
  );
}

function isQuestionItem(q: unknown): q is QuestionItem {
  if (!q || typeof q !== "object") return false;
  const o = q as Record<string, unknown>;
  if (typeof o.question !== "string" || !Array.isArray(o.options)) return false;
  return o.options.every(isQuestionOption);
}

/**
 * 从助手文本中尝试解析出 questions 结构。
 * 支持：纯 JSON 字符串、或 markdown 中的 ```json ... ``` 代码块。
 */
export function tryParseQuestionsPayload(text: string): QuestionsPayload | null {
  const raw = text.trim();
  if (!raw) return null;

  let jsonStr: string | null = raw;

  const codeBlockMatch = raw.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/m);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  if (!jsonStr) return null;

  let data: unknown;
  try {
    data = JSON.parse(jsonStr);
  } catch {
    return null;
  }

  if (!data || typeof data !== "object" || !("questions" in data)) return null;
  const questions = (data as { questions: unknown }).questions;
  if (!Array.isArray(questions) || questions.length === 0) return null;
  if (!questions.every(isQuestionItem)) return null;

  return { questions } as QuestionsPayload;
}

/**
 * 从 question 工具的 state（input / output）中解析出 questions 载荷。
 * 支持 input 为对象 { questions: [...] } 或 JSON 字符串，以及 output 为 JSON 字符串。
 */
export function getQuestionsPayloadFromToolState(state: {
  input?: unknown;
  output?: string;
}): QuestionsPayload | null {
  if (!state) return null;
  const input = state.input;
  const output = (state.output ?? "").trim();

  if (input != null && typeof input === "object" && "questions" in input) {
    const questions = (input as { questions: unknown }).questions;
    if (Array.isArray(questions) && questions.length > 0 && questions.every(isQuestionItem)) {
      return { questions } as QuestionsPayload;
    }
  }
  if (typeof input === "string") {
    const fromInput = tryParseQuestionsPayload(input);
    if (fromInput) return fromInput;
  }
  if (output) {
    const fromOutput = tryParseQuestionsPayload(output);
    if (fromOutput) return fromOutput;
  }
  return null;
}

export type QuestionsBlockProps = {
  payload: QuestionsPayload;
  /** 可选。传入后且在 interactive 为 true 时显示选项点击与「提交答案」。可返回 Promise<boolean>，false 表示发送失败不视为已提交 */
  onAnswerSubmit?: (answerText: string) => void | Promise<boolean | void>;
  /** 是否可交互（选择 + 提交）。仅 Calling 时为 true，Called 后为 false，刷新后由 alreadyAnswered 决定 */
  interactive?: boolean;
  /** 是否已回答（如根据下一条用户消息「我选择：」判断），刷新/重载后仍能显示已回答 */
  alreadyAnswered?: boolean;
  /** 已回答时的用户消息文案，用于展示「我的答案」 */
  answerText?: string;
};

/** 每道题选中的选项下标：题目索引 -> 选项索引数组（单选也存为长度为 1 的数组） */
type SelectedState = Record<number, number[]>;

export function QuestionsBlock({
  payload,
  onAnswerSubmit,
  interactive = true,
  alreadyAnswered = false,
  answerText,
}: QuestionsBlockProps) {
  const [selected, setSelected] = useState<SelectedState>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canInteract = interactive && !!onAnswerSubmit && !submitted && !alreadyAnswered && !submitting;

  const toggleOption = (questionIdx: number, optionIdx: number, multiple: boolean) => {
    if (!canInteract) return;
    setSelected((prev) => {
      const current = prev[questionIdx] ?? [];
      if (multiple) {
        const next = current.includes(optionIdx)
          ? current.filter((i) => i !== optionIdx)
          : [...current, optionIdx];
        return { ...prev, [questionIdx]: next };
      }
      return { ...prev, [questionIdx]: [optionIdx] };
    });
  };

  const buildAnswerText = (): string => {
    const parts: string[] = [];
    payload.questions.forEach((q, qIdx) => {
      const indices = selected[qIdx] ?? [];
      if (indices.length === 0) return;
      const labels = indices
        .map((i) => q.options[i]?.label)
        .filter(Boolean)
        .join("；");
      if (labels) parts.push(labels);
    });
    if (parts.length === 0) return "";
    return parts.length === 1 ? `我选择：${parts[0]}` : `我选择：\n${parts.map((p, i) => `${i + 1}. ${p}`).join("\n")}`;
  };

  const handleSubmit = async () => {
    const text = buildAnswerText();
    if (!text || !onAnswerSubmit) return;
    setSubmitting(true);
    try {
      const result = await Promise.resolve(onAnswerSubmit(text));
      if (result !== false) setSubmitted(true);
    } catch {
      // 发送失败时保持可再次提交
    } finally {
      setSubmitting(false);
    }
  };

  const hasSelection = Object.values(selected).some((arr) => arr.length > 0);

  return (
    <div className="questions-block my-3 space-y-6 pointer-events-auto">
      {alreadyAnswered && answerText && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 py-2 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900/50">
          <span className="font-medium text-zinc-600 dark:text-zinc-400">已回答：</span>
          <span className="text-zinc-800 dark:text-zinc-200">{answerText}</span>
        </div>
      )}
      {payload.questions.map((q, idx) => (
        <div key={idx} className="space-y-3">
          {q.header && (
            <div className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {q.header}
            </div>
          )}
          <p className="text-base font-medium text-zinc-900 dark:text-zinc-100">{q.question}</p>
          <div className="flex flex-col gap-2">
            {q.options.map((opt, optIdx) => {
              const isSelected = (selected[idx] ?? []).includes(optIdx);
              const isInteractive = canInteract;
              return (
                <Card
                  key={optIdx}
                  role={isInteractive ? "button" : undefined}
                  tabIndex={isInteractive ? 0 : undefined}
                  onClick={(e) => {
                  e.stopPropagation();
                  if (isInteractive) toggleOption(idx, optIdx, !!q.multiple);
                }}
                  onKeyDown={(e) => {
                    if (!isInteractive) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleOption(idx, optIdx, !!q.multiple);
                    }
                  }}
                  className={
                    (isInteractive ? "cursor-pointer transition-colors " : "cursor-default ") +
                    (isSelected
                      ? "border-[var(--color-accent,#646cff)] bg-[var(--color-accent-subtle,rgba(100,108,255,0.08))] hover:border-[var(--color-accent,#646cff)] hover:bg-[var(--color-accent-subtle,rgba(100,108,255,0.08))] "
                      : "border-zinc-200 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-900/50 hover:border-zinc-300 hover:bg-zinc-100/80 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/50 ") +
                    "shadow-none"
                  }
                  aria-pressed={isInteractive ? isSelected : undefined}
                  aria-label={isInteractive ? `${opt.label}${isSelected ? "，已选中" : ""}` : undefined}
                >
                  <CardHeader className="py-2.5 pb-0">
                    <div className="flex items-center gap-2">
                      {isInteractive && (
                        <span
                          className={
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 text-xs " +
                            (isSelected
                              ? "border-[var(--color-accent,#646cff)] bg-[var(--color-accent,#646cff)] text-white"
                              : "border-zinc-400 dark:border-zinc-500")
                          }
                          aria-hidden
                        >
                          {q.multiple && isSelected ? "✓" : !q.multiple && isSelected ? "●" : null}
                        </span>
                      )}
                      <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        {opt.label}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="py-2 pt-1">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{opt.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {q.multiple && (
            <p className="text-xs text-zinc-500 dark:text-zinc-500">（多选）</p>
          )}
        </div>
      ))}
      {onAnswerSubmit && canInteract && (
        <div className="flex items-center gap-2 pt-2">
          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={!hasSelection || submitting}
            onClick={(e) => {
              e.stopPropagation();
              void handleSubmit();
            }}
          >
            {submitting ? "发送中…" : "提交答案"}
          </Button>
        </div>
      )}
      {onAnswerSubmit && submitted && !alreadyAnswered && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 pt-1">答案已作为消息发送</p>
      )}
    </div>
  );
}
