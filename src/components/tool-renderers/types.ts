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
  /** 当前助手消息 id，用于面板从最新 messages 中解析出 part，保证 output 能更新 */
  messageId?: string;
  /** 打开/切换右侧面板展示 subagent 详情（同一 part 再次点击则关闭面板） */
  onOpenSubagentPanel?: (part: ToolPart, messageId?: string) => void;
  /** 当前右侧面板是否正在展示该 part（用于按钮显示「收起」等 toggle 状态） */
  isSubagentPanelOpenFor?: (part: ToolPart, messageId?: string) => boolean;
};

export type ToolGroupKind =
  | "file-write"
  | "file-read"
  | "bash"
  | "todo"
  | "question"
  | "web"
  | "skill"
  | "subagent"
  | "generic";
