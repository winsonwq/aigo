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

export type { MessageWithParts, PermissionRequest, MessageInfo, MessagePart, TextPart, ToolPart };

export type UseSessionMessagesOptions = Record<string, never>;

function selectMessages(state: RootState, sessionId: string | undefined): MessageWithParts[] {
  if (!sessionId) return [];
  return state.messages.messagesBySession[sessionId] ?? [];
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

  // When sessionId changes, clear pending permission if it was for another session
  useEffect(() => {
    if (sessionId && pendingPermission && pendingPermission.sessionID !== sessionId) {
      dispatch(messagesSlice.actions.setPendingPermission(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only clear when sessionId or permission session mismatch
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
    if (!client || !sessionId) return;

    let cancelled = false;

    const triggerRefresh = () => {
      if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
      refreshDebounceRef.current = setTimeout(() => {
        if (!cancelled && !unmountedRef.current) {
          void dispatch(fetchMessages(sessionId));
        }
      }, 200);
    };

    (async () => {
      try {
        const result = await client.event.subscribe();
        const stream = result?.stream;
        if (!stream || typeof stream[Symbol.asyncIterator] !== "function") {
          if (debug) console.log("[aigo:sse] no stream or stream not iterable");
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

          const evSessionId =
            ev.properties?.part?.sessionID ?? ev.properties?.sessionID;
          if (evSessionId && evSessionId !== sessionIdRef.current) continue;

          if (
            ev?.type === "permission.asked" &&
            ev.properties?.sessionID === sessionIdRef.current
          ) {
            const req = ev.properties as PermissionRequest;
            if (req.id && req.sessionID) {
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
          }
          if (
            ev?.type === "permission.replied" &&
            ev.properties?.sessionID === sessionIdRef.current
          ) {
            dispatch(messagesSlice.actions.setPendingPermission(null));
          }
          if (
            ev?.type === "message.part.updated" ||
            ev?.type === "session.idle"
          ) {
            triggerRefresh();
          }
        }
      } catch (e) {
        if (debug) console.warn("[aigo:sse] subscribe failed", e);
      }
    })();

    return () => {
      cancelled = true;
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
