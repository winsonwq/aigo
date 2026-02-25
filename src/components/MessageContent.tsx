import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { MessagePart } from "@/hooks/useSessionMessages";
import { markdownLinkComponents } from "@/components/MarkdownLink";

function isTextPart(p: MessagePart): p is { type: "text"; text?: string; content?: string } {
  return p && typeof p === "object" && "type" in p && (p as { type: string }).type === "text";
}
function partText(part: { type: "text"; text?: string; content?: string }): string {
  return (part.text ?? (part as { content?: string }).content ?? "") || "";
}

function isToolPart(
  p: MessagePart
): p is {
  type: "tool";
  id: string;
  tool: string;
  callID: string;
  state: { status: string; input?: unknown; output?: string; error?: string; title?: string };
} {
  return p && typeof p === "object" && "type" in p && (p as { type: string }).type === "tool";
}

export function MessageContent({ parts }: { parts: MessagePart[] }) {
  return (
    <div className="space-y-2">
      {parts.map((part, index) => {
        if (isTextPart(part)) {
          return (
            <div key={(part as { id?: string }).id ?? `p-${index}`} className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownLinkComponents}>{partText(part)}</ReactMarkdown>
            </div>
          );
        }
        if (isToolPart(part)) {
          const st = part.state;
          const status = st?.status ?? "pending";
          const title = st?.title ?? part.tool;
          return (
            <div
              key={part.id}
              className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              <div className="font-medium text-zinc-700 dark:text-zinc-300">
                工具: {title}
                <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                  ({status})
                </span>
              </div>
              {Boolean(st?.input) && Object.keys(st.input as object).length > 0 && (
                <pre className="mt-1 overflow-x-auto text-xs text-zinc-600 dark:text-zinc-400">
                  {JSON.stringify(st.input, null, 2) ?? ""}
                </pre>
              )}
              {status === "completed" && st?.output && (
                <pre className="mt-1 max-h-32 overflow-auto text-xs text-zinc-600 dark:text-zinc-400">
                  {st.output}
                </pre>
              )}
              {status === "error" && st?.error && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{st.error}</p>
              )}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
