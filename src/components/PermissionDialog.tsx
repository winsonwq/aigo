import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import type { PermissionRequest } from "@/hooks/useSessionMessages";

const PERMISSION_LABELS: Record<string, string> = {
  read: "读取文件",
  edit: "编辑文件",
  write: "写入文件",
  patch: "应用补丁",
  bash: "执行命令",
  glob: "glob 匹配",
  grep: "grep 搜索",
  list: "列出目录",
  task: "子任务",
  skill: "加载 Skill",
  webfetch: "请求 URL",
  websearch: "网页搜索",
  codesearch: "代码搜索",
  external_directory: "访问工作区外目录",
};

function getPermissionLabel(permission: string): string {
  return PERMISSION_LABELS[permission] ?? permission;
}

type Props = {
  request: PermissionRequest;
  onRespond: (response: "once" | "always" | "reject") => Promise<boolean>;
  onClose?: () => void;
};

export function PermissionDialog({ request, onRespond, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const handle = async (response: "once" | "always" | "reject") => {
    setBusy(true);
    try {
      const ok = await onRespond(response);
      if (ok && onClose) onClose();
    } finally {
      setBusy(false);
    }
  };

  const permissionLabel = getPermissionLabel(request.permission);
  const patternText =
    request.patterns.length > 0 ? request.patterns.join("、") : "(无具体路径)";

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="permission-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose && !busy) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="permission-dialog-title"
          className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
        >
          OpenCode 请求权限
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="font-medium">{permissionLabel}</span>
          {patternText !== "(无具体路径)" && (
            <>
              <br />
              <span className="mt-1 block break-all text-zinc-500 dark:text-zinc-500">
                {patternText}
              </span>
            </>
          )}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={() => void handle("reject")}
          >
            拒绝
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void handle("always")}
          >
            始终允许
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => void handle("once")}
          >
            仅此次允许
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
