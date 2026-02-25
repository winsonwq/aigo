import type { AnchorHTMLAttributes } from "react";

/** 是否为应在系统默认浏览器中打开的外部 URL（http/https/mailto/tel） */
export function isExternalUrl(href: string | null | undefined): boolean {
  if (!href || typeof href !== "string") return false;
  const t = href.trim().toLowerCase();
  return (
    t.startsWith("http:") ||
    t.startsWith("https:") ||
    t.startsWith("mailto:") ||
    t.startsWith("tel:")
  );
}

type MarkdownLinkProps = AnchorHTMLAttributes<HTMLAnchorElement>;

/**
 * 供 ReactMarkdown 使用的 <a> 组件：外部链接点击时通过 Tauri opener 在系统默认浏览器中打开，
 * 避免在应用内 webview 中跳转。参见 Tauri 最佳实践：@tauri-apps/plugin-opener openUrl()
 */
export function MarkdownLink({ href, children, onClick, ...props }: MarkdownLinkProps) {
  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isExternalUrl(href)) {
      e.preventDefault();
      try {
        const { openUrl } = await import("@tauri-apps/plugin-opener");
        await openUrl(href!);
      } catch {
        // 非 Tauri 环境（如浏览器开发）：在新标签页打开
        window.open(href!, "_blank", "noopener,noreferrer");
      }
    }
    onClick?.(e);
  };

  return (
    <a href={href} onClick={handleClick} {...props}>
      {children}
    </a>
  );
}

/** 供 ReactMarkdown 使用的 components：链接在系统默认浏览器中打开 */
export const markdownLinkComponents = {
  a: MarkdownLink,
} as const;
