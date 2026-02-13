import { useCallback, useEffect, useState } from "react";
import { useOpenCode } from "@/context/OpenCodeContext";

export type SessionItem = {
  id: string;
  title: string;
  slug?: string;
  time?: { created: number; updated: number };
};

const LIST_LIMIT = 50;

export function useSessions() {
  const { client, baseUrl } = useOpenCode();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!client) {
      setSessions([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await client.session.list({ limit: LIST_LIMIT });
      const data = res?.data as
        | SessionItem[]
        | { 200?: SessionItem[] }
        | undefined;
      const rawList = Array.isArray(data) ? data : data?.[200];
      const list = Array.isArray(rawList)
        ? rawList.map((s: Record<string, unknown>) => ({
            id: String(s.id ?? s.sessionID ?? ""),
            title: typeof s.title === "string" && s.title.trim() ? s.title.trim() : "新会话",
            slug: typeof s.slug === "string" ? s.slug : undefined,
            time: s.time && typeof s.time === "object" ? (s.time as SessionItem["time"]) : undefined,
          }))
        : [];
      setSessions(list);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "获取会话列表失败");
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void fetchSessions();
    if (!client) return;
    const id = setInterval(fetchSessions, 15_000);
    return () => clearInterval(id);
  }, [client, fetchSessions]);

  const createSession = useCallback(
    async (options?: { title?: string }): Promise<{ id: string } | { error: string }> => {
      if (!client) {
        return { error: "未连接 OpenCode" };
      }
      const title = options?.title?.trim() || "新会话";
      try {
        const res = await client.session.create({ title });
        const raw = res as {
          data?: unknown;
          error?: unknown;
          response?: { ok?: boolean; headers?: Headers };
          [k: string]: unknown;
        };
        if (raw?.error) {
          const err = raw.error as Record<string, unknown>;
          const msg =
            (err?.message as string) ||
            (err?.detail as string) ||
            (typeof raw.error === "string" ? raw.error : "创建失败");
          return { error: msg };
        }
        const data = raw?.data;
        if (data != null && typeof data === "object") {
          const obj = data as Record<string, unknown>;
          // SDK/服务端可能返回：Session 直接作为 data、{ 200: Session }、或 { session: Session }
          const session =
            typeof obj.id === "string"
              ? obj
              : (obj[200] as Record<string, unknown> | undefined) ??
                (obj.session as Record<string, unknown> | undefined);
          const id =
            session && typeof session === "object"
              ? (session.id as string) ?? (session.sessionID as string)
              : null;
          if (typeof id === "string" && id.length > 0) {
            await fetchSessions();
            return { id };
          }
        }
        // 尝试从 Location 头解析（部分实现会返回 201 + Location）
        const location = raw?.response?.headers?.get?.("Location");
        if (typeof location === "string") {
          const match = /\/session\/([^/?#]+)/.exec(location);
          if (match?.[1]) {
            await fetchSessions();
            return { id: match[1] };
          }
        }
        return { error: "服务端返回格式异常，无法解析会话 ID" };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          error:
            msg ||
            "创建会话失败，请检查 OpenCode 连接或重试。",
        };
      }
    },
    [client, fetchSessions]
  );

  /** 获取单会话详情（含 OpenCode 自动更新后的 title） */
  const getSession = useCallback(
    async (sessionID: string): Promise<{ title: string } | null> => {
      if (!client || !sessionID) return null;
      try {
        const res = await client.session.get({ sessionID });
        const data = (res as { data?: unknown })?.data as
          | { title?: string }
          | { 200?: { title?: string } }
          | undefined;
        const session = data && typeof data === "object"
          ? ("title" in data ? data : (data as { 200?: { title?: string } })[200])
          : undefined;
        const title =
          session && typeof session === "object" && typeof session.title === "string" && session.title.trim()
            ? session.title.trim()
            : "新会话";
        return { title };
      } catch {
        return null;
      }
    },
    [client]
  );

  const deleteSession = useCallback(
    async (sessionID: string): Promise<boolean> => {
      if (!client || !sessionID) return false;
      try {
        const api = client.session as unknown as {
          delete?: (args: { sessionID: string } | { id: string }) => Promise<unknown>;
        };
        if (typeof api.delete === "function") {
          try {
            await api.delete({ sessionID });
          } catch {
            await api.delete({ id: sessionID });
          }
        } else {
          const res = await fetch(
            `${baseUrl}/session/${encodeURIComponent(sessionID)}`,
            { method: "DELETE" }
          );
          if (!res.ok) {
            throw new Error(`删除会话失败: ${res.status}`);
          }
        }
        await fetchSessions();
        return true;
      } catch {
        return false;
      }
    },
    [client, baseUrl, fetchSessions]
  );

  return {
    sessions,
    isLoading,
    error,
    refetch: fetchSessions,
    getSession,
    createSession,
    deleteSession,
  };
}
