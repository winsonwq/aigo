import { useCallback, useEffect, useRef, useState } from "react";
import { useOpenCode } from "@/context/OpenCodeContext";
import { normalizeModel, readDefaultModel } from "@/config/models";

const RECONCILE_RETRY_COUNT = 25;
const RECONCILE_RETRY_DELAY_MS = 1_200;
/** 仅作为兜底：超过此时长未收到完成信号才提示。Agent 多轮工具/思考可能较久，不宜过短 */
const FALLBACK_BUSY_TIMEOUT_MS = 300_000; // 5 分钟

const USE_SYNC_PROMPT_KEY = "aigo.useSyncPrompt";
const DEBUG_MESSAGES_KEY = "aigo.debugMessages";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getUseSyncPrompt(): boolean {
  try {
    const v = localStorage.getItem(USE_SYNC_PROMPT_KEY);
    return v !== "false";
  } catch {
    return true;
  }
}

function isDebugMessages(): boolean {
  try {
    if (
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("debug") === "1"
    ) {
      return true;
    }
    return localStorage.getItem(DEBUG_MESSAGES_KEY) === "true";
  } catch {
    return false;
  }
}

function parseModel(raw: string): { providerID: string; modelID: string } | null {
  const text = raw.trim();
  const idx = text.indexOf("/");
  if (idx <= 0 || idx >= text.length - 1) return null;
  const providerID = text.slice(0, idx);
  const modelID = text.slice(idx + 1);
  if (!providerID || !modelID) return null;
  return { providerID, modelID };
}

function getPreferredModel(): { providerID: string; modelID: string } {
  const parsed = parseModel(readDefaultModel());
  return parsed ?? { providerID: "openrouter", modelID: "minimax/minimax-m1" };
}

function getPreferredModelFromRaw(raw?: string): { providerID: string; modelID: string } {
  const parsed = parseModel(normalizeModel(raw));
  return parsed ?? { providerID: "openrouter", modelID: "minimax/minimax-m1" };
}

function normalizeList<T>(res: { data?: unknown }): T[] {
  const data = res?.data;
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && "200" in data) {
    return (data as { 200?: T[] })[200] ?? [];
  }
  return [];
}

function toMessageWithParts(raw: unknown): MessageWithParts | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const infoRaw =
    o.info && typeof o.info === "object"
      ? (o.info as Record<string, unknown>)
      : o;

  const roleRaw = infoRaw.role;
  const role: "user" | "assistant" = roleRaw === "assistant" ? "assistant" : "user";

  const info: MessageInfo = {
    id: String(infoRaw.id ?? ""),
    sessionID: String(infoRaw.sessionID ?? infoRaw.session_id ?? ""),
    role,
    time: infoRaw.time as { created: number } | undefined,
    summary: infoRaw.summary as { title?: string; body?: string } | undefined,
    error: infoRaw.error as
      | { name?: string; data?: { message?: string }; message?: string }
      | undefined,
  };

  const rawParts = Array.isArray(o.parts) ? o.parts : [];
  const parts: MessagePart[] = rawParts.map((p) => {
    if (!p || typeof p !== "object") return p as MessagePart;
    const part = p as Record<string, unknown>;
    if (part.type === "text") {
      const id = String(part.id ?? `${info.id}-text`);
      const text = String(part.text ?? part.content ?? "");
      return { id, type: "text", text } as TextPart;
    }
    return p as MessagePart;
  });

  return { info, parts };
}

/** OpenCode 权限请求（SSE permission.asked 的 properties） */
export type PermissionRequest = {
  id: string;
  sessionID: string;
  permission: string;
  patterns: string[];
  metadata: Record<string, unknown>;
  always: string[];
  tool?: { messageID: string; callID: string };
};

export type MessageInfo = {
  id: string;
  sessionID: string;
  role: "user" | "assistant";
  time?: { created: number };
  summary?: { title?: string; body?: string };
  error?: {
    name?: string;
    data?: { message?: string };
    message?: string;
  };
};

export type TextPart = {
  id: string;
  type: "text";
  text: string;
};

export type ToolPart = {
  id: string;
  type: "tool";
  callID: string;
  tool: string;
  state: {
    status: "pending" | "running" | "completed" | "error";
    input?: Record<string, unknown>;
    output?: string;
    error?: string;
    title?: string;
  };
};

export type MessagePart = TextPart | ToolPart | Record<string, unknown>;

export type MessageWithParts = {
  info: MessageInfo;
  parts: MessagePart[];
};

function getMessageErrorText(msg: MessageWithParts): string | null {
  const err = msg.info.error;
  if (!err) return null;
  return err.data?.message ?? err.message ?? err.name ?? "助手执行失败";
}

function countConsecutiveOrphanUsers(list: MessageWithParts[]): number {
  const assistantParentIds = new Set(
    list
      .filter((m) => m.info.role === "assistant")
      .map((m) => (m.info as MessageInfo & { parentID?: string }).parentID)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  );
  let count = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    if (m.info.role !== "user") break;
    if (!assistantParentIds.has(m.info.id)) count += 1;
  }
  return count;
}

export type UseSessionMessagesOptions = Record<string, never>;

export function useSessionMessages(
  sessionId: string | undefined,
  _options?: UseSessionMessagesOptions
) {
  const { client } = useOpenCode();
  const [messages, setMessages] = useState<MessageWithParts[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSessionBusy, setIsSessionBusy] = useState(false);
  /** OpenCode 权限请求（如 write/edit 为 ask 时），需用户批准后才会继续执行 */
  const [pendingPermission, setPendingPermission] = useState<PermissionRequest | null>(null);

  const messagesRef = useRef<MessageWithParts[]>([]);
  const activeFetchSeqRef = useRef(0);
  const fallbackBusyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);
  const sessionIdRef = useRef(sessionId);

  messagesRef.current = messages;
  sessionIdRef.current = sessionId;

  const clearBusyState = useCallback(() => {
    if (fallbackBusyTimeoutRef.current) {
      clearTimeout(fallbackBusyTimeoutRef.current);
      fallbackBusyTimeoutRef.current = null;
    }
    setIsSessionBusy(false);
  }, []);

  const fetchMessages = useCallback(
    async (opts?: { silent?: boolean }) => {
      const debug = isDebugMessages();
      const silent = opts?.silent === true;
      const fetchSeq = ++activeFetchSeqRef.current;

      if (!client || !sessionId) {
        if (debug) {
          console.log("[aigo:messages] skip fetch, no client/session", {
            hasClient: !!client,
            sessionId: sessionId ?? "(undefined)",
          });
        }
        setMessages([]);
        if (!silent) setIsLoading(false);
        return [];
      }

      if (!silent) {
        setIsLoading(true);
        setError(null);
      }

      try {
        const res = await client.session.messages({
          sessionID: sessionId,
          limit: 100,
        });
        const rawList = normalizeList<unknown>(res as { data?: unknown });
        const list = rawList
          .map((item) => toMessageWithParts(item))
          .filter((m): m is MessageWithParts => m != null);

        if (debug) {
          console.log("[aigo:messages] fetched", {
            count: list.length,
            roles: list.map((m) => m.info.role),
            silent,
          });
        }

        if (fetchSeq === activeFetchSeqRef.current) {
          setMessages(list);
        }
        return list;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!silent) {
          setError(msg || "获取消息失败");
        }
        if (debug) {
          console.error("[aigo:messages] fetch failed", msg);
        }
        return messagesRef.current;
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [client, sessionId]
  );

  // session 切换时先清空消息并设 loading，再由下方 fetchMessages 的 effect 拉取新 session 的消息（顺序需保持：先清空再拉取）
  useEffect(() => {
    setMessages([]);
    setSendError(null);
    setPendingPermission(null);
    clearBusyState();
    if (sessionId && client) {
      setIsLoading(true);
      setError(null);
    } else {
      // 无 client 或 sessionId 时立即清除 loading，避免一直显示「加载消息…」
      setIsLoading(false);
    }
    return () => {
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current);
        refreshDebounceRef.current = null;
      }
    };
  }, [sessionId, clearBusyState, client]);

  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      if (fallbackBusyTimeoutRef.current) {
        clearTimeout(fallbackBusyTimeoutRef.current);
        fallbackBusyTimeoutRef.current = null;
      }
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current);
        refreshDebounceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const debug = isDebugMessages();
    if (!client || !sessionId) return;

    let cancelled = false;

    const triggerRefresh = () => {
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current);
      }
      refreshDebounceRef.current = setTimeout(() => {
        if (!cancelled && !unmountedRef.current) {
          void fetchMessages({ silent: true });
        }
      }, 200);
    };

    (async () => {
      try {
        const result = await client.event.subscribe();
        const stream = result?.stream;
        if (!stream || typeof stream[Symbol.asyncIterator] !== "function") {
          if (debug) {
            console.log("[aigo:sse] no stream or stream not iterable");
          }
          return;
        }

        for await (const ev of stream as AsyncGenerator<{
          type?: string;
          properties?: {
            sessionID?: string;
            part?: { sessionID?: string };
          } & Partial<PermissionRequest>;
        }>) {
          if (cancelled) break;

          const evSessionId = ev.properties?.part?.sessionID ?? ev.properties?.sessionID;
          if (evSessionId && evSessionId !== sessionIdRef.current) continue;
          if (ev?.type === "permission.asked" && ev.properties?.sessionID === sessionIdRef.current) {
            const req = ev.properties as PermissionRequest;
            if (req.id && req.sessionID) {
              setPendingPermission({
                id: req.id,
                sessionID: req.sessionID,
                permission: req.permission ?? "",
                patterns: Array.isArray(req.patterns) ? req.patterns : [],
                metadata: req.metadata && typeof req.metadata === "object" ? req.metadata : {},
                always: Array.isArray(req.always) ? req.always : [],
                tool: req.tool,
              });
            }
          }
          if (ev?.type === "permission.replied" && ev.properties?.sessionID === sessionIdRef.current) {
            setPendingPermission(null);
          }
          if (ev?.type === "message.part.updated" || ev?.type === "session.idle") {
            triggerRefresh();
          }
        }
      } catch (e) {
        if (debug) {
          console.warn("[aigo:sse] subscribe failed", e);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current);
        refreshDebounceRef.current = null;
      }
    };
  }, [client, sessionId, fetchMessages]);

  const reconcileAfterSend = useCallback(
    async (beforeIds: Set<string>) => {
      for (let i = 0; i < RECONCILE_RETRY_COUNT; i++) {
        if (unmountedRef.current || sessionId !== sessionIdRef.current) {
          return null;
        }

        const list = await fetchMessages({ silent: true });
        const newAssistantList = list.filter(
          (m) => m.info.role === "assistant" && !beforeIds.has(m.info.id)
        );
        const newAssistant = newAssistantList[newAssistantList.length - 1];
        if (newAssistant) {
          return newAssistant;
        }

        if (i < RECONCILE_RETRY_COUNT - 1) {
          await sleep(RECONCILE_RETRY_DELAY_MS);
        }
      }
      return null;
    },
    [fetchMessages, sessionId]
  );

  const sendPrompt = useCallback(
    async (
      text: string,
      options?: { modelRaw?: string; attachmentContext?: string }
    ): Promise<boolean> => {
      const debug = isDebugMessages();
      if (!client || !sessionId || !text.trim()) return false;
      if (isSessionBusy) return false;

      setIsSessionBusy(true);
      setSendError(null);

      const trimmed = text.trim();
      const now = Date.now();
      const beforeIds = new Set(messagesRef.current.map((m) => m.info.id));
      const preferredModel = options?.modelRaw
        ? getPreferredModelFromRaw(options.modelRaw)
        : getPreferredModel();
      const preferredModelText = `${preferredModel.providerID}/${preferredModel.modelID}`;
      const composedText = options?.attachmentContext
        ? `${trimmed}\n\n${options.attachmentContext}`
        : trimmed;

      // 乐观显示用户输入，随后统一由服务端消息列表覆盖本地状态。
      const userMsg: MessageWithParts = {
        info: {
          id: `local-user-${now}`,
          sessionID: sessionId,
          role: "user",
          time: { created: now },
        },
        parts: [{ id: `local-part-${now}`, type: "text", text: trimmed }],
      };
      setMessages((prev) => [...prev, userMsg]);

      if (fallbackBusyTimeoutRef.current) {
        clearTimeout(fallbackBusyTimeoutRef.current);
      }
      fallbackBusyTimeoutRef.current = setTimeout(() => {
        if (!unmountedRef.current) {
          setIsSessionBusy(false);
          setSendError("等待时间较长。若界面仍在更新请继续等待；若长时间无响应请检查 OpenCode 配置或重试。");
        }
      }, FALLBACK_BUSY_TIMEOUT_MS);

      try {
        const useSync = getUseSyncPrompt();
        if (useSync) {
          await client.session.prompt({
            sessionID: sessionId,
            model: preferredModel,
            parts: [{ type: "text", text: composedText }],
          });
        } else {
          await client.session.promptAsync({
            sessionID: sessionId,
            model: preferredModel,
            parts: [{ type: "text", text: composedText }],
          });
        }

        const newAssistant = await reconcileAfterSend(beforeIds);
        if (!newAssistant) {
          const latest = await fetchMessages({ silent: true });
          const orphanUsers = countConsecutiveOrphanUsers(latest);
          if (orphanUsers >= 2) {
            setSendError(
              "当前会话连续未产生助手消息，可能已卡死。请新建会话后重试（模型默认已切到 openrouter/minimax/minimax-m1）。"
            );
          } else {
            setSendError(
              "消息已发送，但服务端未返回助手消息。请检查 OpenCode 的 Provider/Model 配置与外网连通性。"
            );
          }
          return false;
        }

        const assistantError = getMessageErrorText(newAssistant);
        if (assistantError) {
          setSendError(`模型 ${preferredModelText} 返回错误：${assistantError}`);
        }
        await fetchMessages({ silent: true });
        return !assistantError;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setSendError(msg ? `模型 ${preferredModelText} 发送失败：${msg}` : "发送失败");
        await fetchMessages({ silent: true });
        if (debug) {
          console.error("[aigo:send] send failed", msg);
        }
        return false;
      } finally {
        clearBusyState();
      }
    },
    [
      client,
      sessionId,
      isSessionBusy,
      reconcileAfterSend,
      fetchMessages,
      clearBusyState,
    ]
  );

  const stopSession = useCallback(async (): Promise<boolean> => {
    if (!client || !sessionId || !isSessionBusy) return false;
    try {
      await client.session.abort({ sessionID: sessionId });
      clearBusyState();
      await fetchMessages({ silent: true });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSendError(msg || "停止失败");
      return false;
    }
  }, [client, sessionId, isSessionBusy, clearBusyState, fetchMessages]);

  const respondToPermission = useCallback(
    async (response: "once" | "always" | "reject"): Promise<boolean> => {
      const req = pendingPermission;
      if (!client || !req) return false;
      try {
        await client.permission.respond({
          sessionID: req.sessionID,
          permissionID: req.id,
          response,
        });
        setPendingPermission(null);
        void fetchMessages({ silent: true });
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setSendError(msg || "回复权限请求失败");
        return false;
      }
    },
    [client, pendingPermission, fetchMessages]
  );

  return {
    messages,
    isLoading,
    error,
    sendError,
    isSessionBusy,
    refetch: fetchMessages,
    sendPrompt,
    stopSession,
    pendingPermission,
    respondToPermission,
  };
}
