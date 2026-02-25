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

export type ToolGroupKind =
  | "file-write"
  | "file-read"
  | "bash"
  | "todo"
  | "question"
  | "web"
  | "skill"
  | "generic";
