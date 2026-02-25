import type { ToolPart } from "./types";

export function getStatusLabel(status: string | undefined): string {
  switch (status) {
    case "pending":
      return "等待";
    case "running":
      return "执行中";
    case "completed":
      return "完成";
    case "error":
      return "错误";
    default:
      return "等待";
  }
}

export function getStatusVariant(
  status: string | undefined
): "destructive" | "warning" | "success" | "secondary" {
  switch (status) {
    case "error":
      return "destructive";
    case "running":
      return "warning";
    case "completed":
      return "success";
    default:
      return "secondary";
  }
}

export function isPartInProgress(part: ToolPart): boolean {
  const s = part.state?.status;
  return s === "pending" || s === "running";
}

/** 单 part：用于 Badge 的 statusLabel / statusVariant */
export function getPartStatus(part: ToolPart) {
  const status = part.state?.status ?? "pending";
  return {
    status,
    isCalling: status === "running" || status === "pending",
    statusLabel: getStatusLabel(status),
    statusVariant: getStatusVariant(status),
  };
}

type StatusVariant = "destructive" | "warning" | "success" | "secondary";

/** 多 parts（分组块）：任一部分进行中则 isAnyRunning，有 error 则 hasError */
export function getPartsStatus(parts: ToolPart[]): {
  isAnyRunning: boolean;
  hasError: boolean;
  statusLabel: string;
  statusVariant: StatusVariant;
} {
  const isAnyRunning = parts.some((p) => p.state?.status === "running" || p.state?.status === "pending");
  const hasError = parts.some((p) => p.state?.status === "error");
  const statusLabel = hasError
    ? "错误"
    : isAnyRunning
      ? parts.some((p) => p.state?.status === "running")
        ? "执行中"
        : "等待"
      : "完成";
  const statusVariant: StatusVariant = hasError ? "destructive" : isAnyRunning ? "warning" : "success";
  return { isAnyRunning, hasError, statusLabel, statusVariant };
}
