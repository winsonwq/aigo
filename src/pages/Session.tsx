import { useParams } from "react-router-dom";

export function Session() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        会话 {id ?? "—"}
      </h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        会话详情与消息流占位，后续对接 OpenCode 消息与事件。
      </p>
    </div>
  );
}
