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
      const list = Array.isArray(data) ? data : data?.[200];
      setSessions(Array.isArray(list) ? list : []);
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

  const createSession = useCallback(async (): Promise<string | null> => {
    if (!client) return null;
    try {
      const res = await client.session.create({ title: "新会话" });
      const data = res?.data as
        | { id?: string }
        | { 200?: { id?: string } }
        | undefined;
      const session =
        data && typeof data === "object" && "id" in data
          ? data
          : (data as Record<string, unknown>)?.[200];
      const id = (session as { id?: string })?.id;
      if (id) {
        await fetchSessions();
        return id;
      }
      return null;
    } catch {
      return null;
    }
  }, [client, fetchSessions]);

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
    createSession,
    deleteSession,
  };
}
