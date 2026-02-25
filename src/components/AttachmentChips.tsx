import { ExternalLink, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

const ATTACHMENT_HEADER = "[上传文件]";

/** 从已发送消息文本中解析出「正文」和「附件列表」（与 buildAttachmentContext 输出格式一致） */
export function parseAttachmentBlockFromMessageText(
  text: string
): { mainText: string; attachmentItems: { name: string; sizeLabel: string }[] } {
  const idx = text.indexOf(ATTACHMENT_HEADER);
  if (idx === -1) {
    return { mainText: text.trim(), attachmentItems: [] };
  }
  const mainText = text.slice(0, idx).trim();
  const rest = text.slice(idx + ATTACHMENT_HEADER.length).trimStart();
  const attachmentItems: { name: string; sizeLabel: string }[] = [];
  // 行格式: "- 1. filename (373 B)" 或 "- 1. filename (1.2 KB)"
  const lineRe = /^\s*-\s*\d+\.\s+(.+?)\s+\(([^)]+)\)\s*$/;
  for (const line of rest.split("\n")) {
    const m = line.match(lineRe);
    if (m) {
      attachmentItems.push({ name: m[1].trim(), sizeLabel: m[2].trim() });
    }
    // 遇到代码块或空行可视为附件列表结束（可选，当前实现按行解析到不匹配为止）
  }
  return { mainText, attachmentItems };
}

export type AttachmentChipItem = {
  id?: string;
  name: string;
  size?: number;
  sizeLabel?: string;
  path?: string;
};

type AttachmentChipsProps = {
  items: AttachmentChipItem[];
  variant: "input" | "display";
  onRemove?: (item: AttachmentChipItem) => void;
  onOpen?: (path: string) => void;
};

export function AttachmentChips({
  items,
  variant,
  onRemove,
  onOpen,
}: AttachmentChipsProps) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((file, i) => {
        const sizeStr =
          file.size != null ? formatBytes(file.size) : (file.sizeLabel ?? "");
        const canOpen = file.path && onOpen;

        return (
          <Badge
            key={file.id ?? `${file.name}-${i}`}
            variant="secondary"
            className="gap-1 pr-1"
          >
            <span className="max-w-[180px] truncate">{file.name}</span>
            <span className="text-[10px] opacity-70">{sizeStr}</span>
            {canOpen && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onOpen(file.path!);
                }}
                className="ml-0.5 rounded p-0.5 hover:bg-zinc-300 dark:hover:bg-zinc-600"
                aria-label={`用系统默认方式打开 ${file.name}`}
                title="用系统默认方式打开"
              >
                <ExternalLink className="h-3 w-3" />
              </button>
            )}
            {variant === "input" && onRemove && (
              <button
                type="button"
                onClick={() => onRemove(file)}
                className="ml-0.5 rounded p-0.5 hover:bg-zinc-300 dark:hover:bg-zinc-600"
                aria-label={`移除 ${file.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        );
      })}
    </div>
  );
}
