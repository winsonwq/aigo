import { useCallback, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useOpenCode } from "@/context/OpenCodeContext";
import type { AppDispatch, RootState } from "@/store";
import {
  fetchMessages,
  sendPrompt as sendPromptThunk,
  stopSession as stopSessionThunk,
  respondToPermission as respondToPermissionThunk,
  messagesSlice,
  type MessageWithParts,
  type PermissionRequest,
  type MessageInfo,
  type MessagePart,
  type TextPart,
  type ToolPart,
} from "@/store/slices/messagesSlice";

const FALLBACK_BUSY_TIMEOUT_MS = 300_000; // 5 min
const DEBUG_MESSAGES_KEY = "aigo.debugMessages";

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

/** 是否输出 SSE/子任务相关调试日志（?debug=1 或 aigo.debugMessages 或 aigo.debugSubagent） */
function isDebugSse(): boolean {
  try {
    if (typeof window === "undefined") return false;
    if (new URLSearchParams(window.location.search).get("debug") === "1") return true;
    return localStorage.getItem(DEBUG_MESSAGES_KEY) === "true" || localStorage.getItem("aigo.debugSubagent") === "true";
  } catch {
    return false;
  }
}

export type { MessageWithParts, PermissionRequest, MessageInfo, MessagePart, TextPart, ToolPart };

export type UseSessionMessagesOptions = Record<string, never>;

const EMPTY_MESSAGES: MessageWithParts[] = [];

function selectMessages(state: RootState, sessionId: string | undefined): MessageWithParts[] {
  if (!sessionId) return EMPTY_MESSAGES;
  return state.messages.messagesBySession[sessionId] ?? EMPTY_MESSAGES;
}

function selectIsLoading(state: RootState, sessionId: string | undefined): boolean {
  if (!sessionId) return false;
  return state.messages.loadingSessionIds[sessionId] ?? false;
}

function selectError(state: RootState, sessionId: string | undefined): string | null {
  if (!sessionId) return null;
  return state.messages.errors[sessionId] ?? null;
}

function selectSendError(state: RootState, sessionId: string | undefined): string | null {
  if (!sessionId) return null;
  return state.messages.sendErrors[sessionId] ?? null;
}

function selectIsSessionBusy(state: RootState, sessionId: string | undefined): boolean {
  if (!sessionId) return false;
  return state.messages.busySessionIds[sessionId] ?? false;
}

function selectPendingPermission(state: RootState): PermissionRequest | null {
  return state.messages.pendingPermission;
}

export function useSessionMessages(
  sessionId: string | undefined,
  _options?: UseSessionMessagesOptions // reserved for future options
) {
  const dispatch = useDispatch<AppDispatch>();
  const { client } = useOpenCode();

  const messages = useSelector((s: RootState) => selectMessages(s, sessionId));
  const isLoading = useSelector((s: RootState) => selectIsLoading(s, sessionId));
  const error = useSelector((s: RootState) => selectError(s, sessionId));
  const sendError = useSelector((s: RootState) => selectSendError(s, sessionId));
  const isSessionBusy = useSelector((s: RootState) =>
    selectIsSessionBusy(s, sessionId)
  );
  const pendingPermission = useSelector(selectPendingPermission);

  const sessionIdRef = useRef(sessionId);
  const prevSessionIdRef = useRef<string | undefined>(sessionId);
  const fallbackBusyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  sessionIdRef.current = sessionId;

  // Clear session-specific state when switching away; clear pending permission when switching session
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
    if (!sessionId) return;
    void dispatch(fetchMessages(sessionId));
  }, [sessionId, dispatch]);

  // 仅当用户切走「发起权限请求的那条会话」时清除弹窗；子任务(subagent) 的 permission 的 sessionID 与主会话不同，不能因 sessionID !== sessionId 就清除，否则 glob 等子任务会一直等权限导致卡死
  useEffect(() => {
    const prev = prevSessionIdRef.current;
    prevSessionIdRef.current = sessionId;
    if (prev != null && prev !== sessionId && pendingPermission?.sessionID === prev) {
      dispatch(messagesSlice.actions.setPendingPermission(null));
    }
  }, [sessionId, pendingPermission?.sessionID, dispatch]);

  // Fallback busy timeout: after 5 min clear busy and set message
  useEffect(() => {
    if (!isSessionBusy || !sessionId) return;
    fallbackBusyTimeoutRef.current = setTimeout(() => {
      if (!unmountedRef.current) {
        dispatch(messagesSlice.actions.setBusy({ sessionId, busy: false }));
        dispatch(
          messagesSlice.actions.setSendError({
            sessionId,
            error:
              "等待时间较长。若界面仍在更新请继续等待；若长时间无响应请检查 OpenCode 配置或重试。",
          })
        );
      }
    }, FALLBACK_BUSY_TIMEOUT_MS);
    return () => {
      if (fallbackBusyTimeoutRef.current) {
        clearTimeout(fallbackBusyTimeoutRef.current);
        fallbackBusyTimeoutRef.current = null;
      }
    };
  }, [isSessionBusy, sessionId, dispatch]);

  // SSE: subscribe to events and refresh messages / set pending permission
  useEffect(() => {
    const debug = isDebugMessages();
    const debugSse = isDebugSse();
    if (!client || !sessionId) return;

    let cancelled = false;
    console.log("[aigo:sse] subscribe sessionId=", sessionId);
    if (debugSse) console.log("[aigo:sse] subscribe start sessionId=", sessionId);

    const triggerRefresh = () => {
      if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
      refreshDebounceRef.current = setTimeout(() => {
        if (!cancelled && !unmountedRef.current) {
          // #region agent log
          fetch("http://127.0.0.1:7384/ingest/52a81ad1-6528-4dca-9c42-33bc440a4a2f", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "fa953f" },
            body: JSON.stringify({
              sessionId: "fa953f",
              hypothesisId: "C",
              location: "useSessionMessages.ts:triggerRefresh",
              message: "SSE triggerRefresh",
              data: { sessionId: sessionIdRef.current },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
          if (debugSse) console.log("[aigo:sse] triggerRefresh -> fetchMessages sessionId=", sessionIdRef.current);
          void dispatch(fetchMessages(sessionId));
        }
      }, 200);
    };

    (async () => {
      try {
        const result = await client.event.subscribe();
        const stream = result?.stream;
        if (!stream || typeof stream[Symbol.asyncIterator] !== "function") {
          console.warn("[aigo:sse] no stream or stream not iterable");
          return;
        }
        console.log("[aigo:sse] stream ready sessionId=", sessionId);
        if (debugSse) console.log("[aigo:sse] stream ready, listening for sessionId=", sessionId);

        for await (const ev of stream as AsyncGenerator<{
          type?: string;
          properties?: {
            sessionID?: string;
            part?: { sessionID?: string };
          } & Partial<PermissionRequest>;
        }>) {
          if (cancelled) break;

          const evSessionId =
            ev.properties?.part?.sessionID ?? ev.properties?.sessionID;
          const match = !evSessionId || evSessionId === sessionIdRef.current;
          if (debugSse) {
            console.log("[aigo:sse] ev", ev?.type, "evSessionId=", evSessionId, "mySessionId=", sessionIdRef.current, "match=", match);
          }

          if (
            ev?.type === "message.part.updated" ||
            ev?.type === "session.idle"
          ) {
            if (debugSse) console.log("[aigo:sse] triggerRefresh (ev.type=", ev?.type, ")");
            triggerRefresh();
            continue;
          }

          // 任意会话的权限请求都展示弹窗（含子任务/subagent），否则子任务执行 glob 等时的 permission.asked 会被主会话过滤掉导致卡住
          if (ev?.type === "permission.asked") {
            const req = ev.properties as PermissionRequest;
            if (req?.id && req?.sessionID) {
              if (debugSse) console.log("[aigo:sse] permission.asked sessionID=", req.sessionID);
              dispatch(
                messagesSlice.actions.setPendingPermission({
                  id: req.id,
                  sessionID: req.sessionID,
                  permission: req.permission ?? "",
                  patterns: Array.isArray(req.patterns) ? req.patterns : [],
                  metadata:
                    req.metadata && typeof req.metadata === "object"
                      ? req.metadata
                      : {},
                  always: Array.isArray(req.always) ? req.always : [],
                  tool: req.tool,
                })
              );
            }
            continue;
          }
          if (ev?.type === "permission.replied") {
            dispatch(messagesSlice.actions.setPendingPermission(null));
            continue;
          }

          if (evSessionId && evSessionId !== sessionIdRef.current) continue;
        }
      } catch (e) {
        if (debug) console.warn("[aigo:sse] subscribe failed", e);
      }
    })();

    return () => {
      cancelled = true;
      console.log("[aigo:sse] subscribe cleanup sessionId=", sessionId);
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current);
        refreshDebounceRef.current = null;
      }
    };
  }, [client, sessionId, dispatch]);

  const refetch = useCallback(() => {
    if (sessionId) void dispatch(fetchMessages(sessionId));
  }, [sessionId, dispatch]);

  const sendPrompt = useCallback(
    async (
      text: string,
      options?: {
        modelRaw?: string;
        attachmentContext?: string;
        attachmentPaths?: string[];
      }
    ): Promise<boolean> => {
      if (!sessionId) return false;
      const result = await dispatch(
        sendPromptThunk({
          sessionId,
          text,
          modelRaw: options?.modelRaw,
          attachmentContext: options?.attachmentContext,
          attachmentPaths: options?.attachmentPaths,
        })
      );
      return sendPromptThunk.fulfilled.match(result) && result.payload;
    },
    [sessionId, dispatch]
  );

  const stopSession = useCallback(async (): Promise<boolean> => {
    if (!sessionId) return false;
    const result = await dispatch(stopSessionThunk(sessionId));
    return stopSessionThunk.fulfilled.match(result);
  }, [sessionId, dispatch]);

  const respondToPermission = useCallback(
    async (response: "once" | "always" | "reject"): Promise<boolean> => {
      const result = await dispatch(respondToPermissionThunk(response));
      return respondToPermissionThunk.fulfilled.match(result);
    },
    [dispatch]
  );

  return {
    messages,
    isLoading,
    error,
    sendError,
    isSessionBusy,
    refetch,
    sendPrompt,
    stopSession,
    pendingPermission,
    respondToPermission,
  };
}
