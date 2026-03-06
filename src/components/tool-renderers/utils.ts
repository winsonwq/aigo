import type { ToolPart, ToolGroupKind } from "./types";
import { isPartInProgress } from "./statusHelpers";

export const WEBSEARCH_TOOL_NAME = "websearch";
export const BASH_TOOL_NAME = "bash";
export const QUESTION_TOOL_NAME = "question";
export const TOOL_WRITE = "write";
export const TOOL_PATCH = "patch";
export const TOOL_READ = "read";
export const TOOL_GREP = "grep";
export const TOOL_GLOB = "glob";
export const TOOL_LIST = "list";
export const TOOL_SKILL = "skill";

const FILE_WRITE_PATH_KEYS = [
  "path",
  "file_path",
  "filePath",
  "target_file",
  "file",
  "filename",
  "dest",
  "filepath",
] as const;

export function getFileWritePath(input: Record<string, unknown> | undefined): string {
  if (!input || typeof input !== "object") return "";
  for (const k of FILE_WRITE_PATH_KEYS) {
    const v = input[k];
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return "";
}

export type FileOp = "新建" | "修改" | "补丁";
export function getFileWriteOp(tool: string): FileOp {
  const t = tool?.toLowerCase() ?? "";
  if (t === TOOL_WRITE) return "新建";
  if (t === TOOL_PATCH) return "补丁";
  return "修改";
}

export function isSubagentTool(part: ToolPart): boolean {
  const t = part.tool?.toLowerCase() ?? "";
  const input = part.state?.input;
  return Boolean(
    t.includes("subagent") ||
      t.includes("task") ||
      (input &&
        typeof input === "object" &&
        "subagent_type" in input &&
        typeof (input as { subagent_type?: unknown }).subagent_type === "string")
  );
}

export function getToolCategory(part: ToolPart): ToolGroupKind {
  if (isSubagentTool(part)) return "subagent";
  const t = part.tool?.toLowerCase() ?? "";
  if (["edit", "write", "patch", "multiedit"].includes(t)) return "file-write";
  if (["read", "grep", "glob", "list", "codesearch"].includes(t)) return "file-read";
  if (t === BASH_TOOL_NAME) return "bash";
  if (["todowrite", "todoread"].includes(t)) return "todo";
  if (t === QUESTION_TOOL_NAME) return "question";
  if (["webfetch", "websearch"].includes(t)) return "web";
  if (t === TOOL_SKILL) return "skill";
  return "generic";
}

export function groupConsecutiveToolParts(
  parts: ToolPart[]
): Array<{ kind: ToolGroupKind; parts: ToolPart[] }> {
  if (parts.length === 0) return [];
  const result: Array<{ kind: ToolGroupKind; parts: ToolPart[] }> = [];
  let current: { kind: ToolGroupKind; parts: ToolPart[] } = {
    kind: getToolCategory(parts[0]),
    parts: [parts[0]],
  };
  for (let i = 1; i < parts.length; i++) {
    const cat = getToolCategory(parts[i]);
    if (cat === current.kind) {
      current.parts.push(parts[i]);
    } else {
      result.push(current);
      current = { kind: cat, parts: [parts[i]] };
    }
  }
  result.push(current);
  return result;
}

export function defaultOpenForParts(parts: ToolPart[]): boolean {
  return parts.some(isPartInProgress);
}

export function isQuestionTool(part: ToolPart): boolean {
  return part.tool?.toLowerCase() === QUESTION_TOOL_NAME;
}
export function isWebsearchTool(part: ToolPart): boolean {
  return part.tool?.toLowerCase() === WEBSEARCH_TOOL_NAME;
}
export function isBashTool(part: ToolPart): boolean {
  return part.tool?.toLowerCase() === BASH_TOOL_NAME;
}

function getStringFromObj(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/** 从 subagent 工具 input/raw 中取出用于展示的 command（描述/提示），通用回退 */
export function getSubagentCommand(part: ToolPart): string {
  const state = part.state;
  if (state && typeof state === "object") {
    const s = state as Record<string, unknown>;
    if (typeof s.raw === "string" && s.raw.trim()) return s.raw.trim();
    if (s.raw && typeof s.raw === "object") {
      const str = getStringFromObj(s.raw as Record<string, unknown>, ["prompt", "description", "task", "message", "arguments"]);
      if (str) return str;
    }
  }
  const input = part.state?.input;
  if (!input || typeof input !== "object") return "";
  const o = input as Record<string, unknown>;
  const descKeys = ["description", "prompt", "task", "message", "arguments", "query", "body"];
  const str = getStringFromObj(o, descKeys);
  if (str) return str;
  if (typeof o.subagent_type === "string") {
    return `${o.subagent_type} 子任务`;
  }
  if (part.tool?.toLowerCase() === "task") {
    return "子任务执行中";
  }
  return "";
}

/** 摘要行右侧显示：优先 input.command（短句），否则回退到 getSubagentCommand */
export function getSubagentSummaryCommand(part: ToolPart): string {
  const input = part.state?.input;
  if (input && typeof input === "object") {
    const cmd = (input as Record<string, unknown>).command;
    if (typeof cmd === "string" && cmd.trim()) return cmd.trim();
  }
  return getSubagentCommand(part);
}

/** 展开区「子任务指令」内容：优先 input.prompt（完整说明），否则 description，再回退 getSubagentCommand */
export function getSubagentPrompt(part: ToolPart): string {
  const input = part.state?.input;
  if (input && typeof input === "object") {
    const o = input as Record<string, unknown>;
    const prompt = typeof o.prompt === "string" && o.prompt.trim() ? o.prompt.trim() : "";
    if (prompt) return prompt;
    const desc = typeof o.description === "string" && o.description.trim() ? o.description.trim() : "";
    if (desc) return desc;
  }
  return getSubagentCommand(part);
}

/** 从 subagent 工具 part.state 中取出用于展示的输出（兼容 output/result/content/raw 等字段） */
export function getSubagentOutput(part: ToolPart): string {
  const state = part.state;
  if (!state || typeof state !== "object") return "";
  const s = state as Record<string, unknown>;
  const keys = ["output", "result", "content", "text"];
  for (const k of keys) {
    const v = s[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  if (typeof s.raw === "string" && s.raw.trim()) {
    try {
      const parsed = JSON.parse(s.raw) as Record<string, unknown>;
      const fromParsed = parsed.output ?? parsed.result ?? parsed.content ?? parsed.text ?? parsed.message;
      if (typeof fromParsed === "string" && fromParsed.trim()) return fromParsed.trim();
    } catch {
      return s.raw.trim();
    }
  }
  return "";
}

/** 从 subagent 工具 part 中取出子任务会话 ID（若有），用于在右侧面板拉取并展示该会话的完整消息流 */
export function getSubagentSessionId(part: ToolPart): string | null {
  const state = part.state;
  if (!state || typeof state !== "object") return null;
  const s = state as Record<string, unknown>;
  const fromState =
    s.sessionID ?? s.subagentSessionID ?? s.session_id ?? s.sessionId;
  if (typeof fromState === "string" && fromState.trim()) return fromState.trim();
  const metadata = s.metadata;
  if (metadata && typeof metadata === "object") {
    const m = metadata as Record<string, unknown>;
    const fromMeta =
      m.sessionID ?? m.subagentSessionID ?? m.session_id ?? m.sessionId;
    if (typeof fromMeta === "string" && fromMeta.trim()) return fromMeta.trim();
  }
  const input = s.input;
  if (input && typeof input === "object") {
    const fromInput = (input as Record<string, unknown>).sessionID
      ?? (input as Record<string, unknown>).session_id
      ?? (input as Record<string, unknown>).subagentSessionID;
    if (typeof fromInput === "string" && fromInput.trim()) return fromInput.trim();
  }
  if (typeof s.raw === "string" && s.raw.trim()) {
    try {
      const parsed = JSON.parse(s.raw) as Record<string, unknown>;
      const id = parsed.sessionID ?? parsed.session_id ?? parsed.subagentSessionID ?? parsed.sessionId;
      if (typeof id === "string" && id.trim()) return id.trim();
    } catch {
      // raw 非 JSON，忽略
    }
  }
  return null;
}
