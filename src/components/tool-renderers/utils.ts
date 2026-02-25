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

export function getToolCategory(part: ToolPart): ToolGroupKind {
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
