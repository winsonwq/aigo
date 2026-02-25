import {
  createSlice,
  createAsyncThunk,
  type PayloadAction,
} from "@reduxjs/toolkit";
import type { AppDispatch } from "@/store";
import type { RootState } from "@/store";
import {
  mergePersistedPathsIntoMessages,
  persistAttachmentPaths,
} from "@/store/attachmentPathsPersistence";
import { disconnectOpencode } from "@/store/slices/opencodeSlice";
import { normalizeModel, readDefaultModel } from "@/config/models";

// --- Types (re-exported for consumers) ---
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
  /** 用户消息附件路径（与 attachmentContext 中顺序一致），仅本地保留用于「用系统默认打开」 */
  attachmentPaths?: string[];
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

// --- Helpers ---
const RECONCILE_RETRY_COUNT = 25;
const RECONCILE_RETRY_DELAY_MS = 1_200;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseModel(raw: string): { providerID: string; modelID: string } | null {
  const text = raw.trim();
  const idx = text.indexOf("/");
  if (idx <= 0 || idx >= text.length - 1) return null;
  return {
    providerID: text.slice(0, idx),
    modelID: text.slice(idx + 1),
  };
}

function getPreferredModel(): { providerID: string; modelID: string } {
  const parsed = parseModel(readDefaultModel());
  return parsed ?? { providerID: "openrouter", modelID: "minimax/minimax-m1" };
}

function getPreferredModelFromRaw(raw?: string): {
  providerID: string;
  modelID: string;
} {
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
  const role: "user" | "assistant" =
    roleRaw === "assistant" ? "assistant" : "user";
  const info: MessageInfo = {
    id: String(infoRaw.id ?? ""),
    sessionID: String(infoRaw.sessionID ?? infoRaw.session_id ?? ""),
    role,
    time: infoRaw.time as { created: number } | undefined,
    summary: infoRaw.summary as { title?: string; body?: string } | undefined,
    error: infoRaw.error as MessageInfo["error"],
  };
  const rawParts = Array.isArray(o.parts) ? o.parts : [];
  const parts: MessagePart[] = rawParts.map((p) => {
    if (!p || typeof p !== "object") return p as MessagePart;
    const part = p as Record<string, unknown>;
    if (part.type === "text") {
      return {
        id: String(part.id ?? `${info.id}-text`),
        type: "text",
        text: String(part.text ?? part.content ?? ""),
      } as TextPart;
    }
    return p as MessagePart;
  });
  return { info, parts };
}

function getMessageErrorText(msg: MessageWithParts): string | null {
  const err = msg.info.error;
  if (!err) return null;
  return err.data?.message ?? err.message ?? err.name ?? "助手执行失败";
}

function countConsecutiveOrphanUsers(list: MessageWithParts[]): number {
  const assistantParentIds = new Set(
    list
      .filter((m) => m.info.role === "assistant")
      .map(
        (m) => (m.info as MessageInfo & { parentID?: string }).parentID
      )
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

const USE_SYNC_PROMPT_KEY = "aigo.useSyncPrompt";

function getUseSyncPrompt(): boolean {
  try {
    return localStorage.getItem(USE_SYNC_PROMPT_KEY) !== "false";
  } catch {
    return true;
  }
}

// --- Thunks ---
export const fetchMessages = createAsyncThunk<
  { sessionId: string; messages: MessageWithParts[] },
  string,
  { state: RootState; rejectValue: string }
>(
  "messages/fetch",
  async (sessionId, { getState, dispatch, rejectWithValue }) => {
    const client = getState().opencode.client;
    if (!client || !sessionId) {
      if (!client) (dispatch as AppDispatch)(disconnectOpencode());
      return rejectWithValue("未连接或缺少 sessionId");
    }
    let res: Awaited<ReturnType<typeof client.session.messages>>;
    try {
      res = await client.session.messages({ sessionID: sessionId, limit: 100 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return rejectWithValue(msg || "获取消息失败");
    }
    const rawList = normalizeList<unknown>(res as { data?: unknown });
    const messages = rawList
      .map((item) => toMessageWithParts(item))
      .filter((m): m is MessageWithParts => m != null);
    return { sessionId, messages };
  }
);

export const sendPrompt = createAsyncThunk<
  boolean,
  {
    sessionId: string;
    text: string;
    modelRaw?: string;
    attachmentContext?: string;
    attachmentPaths?: string[];
  },
  { state: RootState; rejectValue: string }
>(
  "messages/sendPrompt",
  async (
    { sessionId, text, modelRaw, attachmentContext, attachmentPaths },
    { getState, dispatch, rejectWithValue }
  ) => {
    const client = getState().opencode.client;
    if (!client || !sessionId || !text.trim()) {
      if (!client) (dispatch as AppDispatch)(disconnectOpencode());
      return rejectWithValue("缺少 client、sessionId 或内容");
    }
    const state = getState().messages;
    if (state.busySessionIds[sessionId]) {
      return rejectWithValue("会话忙");
    }

    const trimmed = text.trim();
    const preferredModel = modelRaw
      ? getPreferredModelFromRaw(modelRaw)
      : getPreferredModel();
    const preferredModelText = `${preferredModel.providerID}/${preferredModel.modelID}`;
    const composedText = attachmentContext
      ? `${trimmed}\n\n${attachmentContext}`
      : trimmed;

    const now = Date.now();
    if (attachmentPaths?.length) {
      dispatch(
        messagesSlice.actions.setPendingAttachmentPaths({
          sessionId,
          paths: attachmentPaths,
        })
      );
    }
    const userMsg: MessageWithParts = {
      info: {
        id: `local-user-${now}`,
        sessionID: sessionId,
        role: "user",
        time: { created: now },
        ...(attachmentPaths?.length ? { attachmentPaths } : {}),
      },
      parts: [{ id: `local-part-${now}`, type: "text", text: trimmed }],
    };
    dispatch(
      messagesSlice.actions.addOptimisticUserMessage({
        sessionId,
        message: userMsg,
      })
    );
    dispatch(messagesSlice.actions.setBusy({ sessionId, busy: true }));
    dispatch(messagesSlice.actions.setSendError({ sessionId, error: null }));

    const beforeIds = new Set(
      (state.messagesBySession[sessionId] ?? []).map((m) => m.info.id)
    );
    beforeIds.add(userMsg.info.id);

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

      let newAssistant: MessageWithParts | null = null;
      for (let i = 0; i < RECONCILE_RETRY_COUNT; i++) {
        const result = await dispatch(fetchMessages(sessionId));
        const list =
          fetchMessages.fulfilled.match(result) ? result.payload.messages : [];
        const newAssistantList = list.filter(
          (m) => m.info.role === "assistant" && !beforeIds.has(m.info.id)
        );
        newAssistant = newAssistantList[newAssistantList.length - 1] ?? null;
        if (newAssistant) break;
        if (i < RECONCILE_RETRY_COUNT - 1) await sleep(RECONCILE_RETRY_DELAY_MS);
      }

      if (!newAssistant) {
        const latestResult = await dispatch(fetchMessages(sessionId));
        const latest =
          fetchMessages.fulfilled.match(latestResult)
            ? latestResult.payload.messages
            : [];
        const orphanUsers = countConsecutiveOrphanUsers(latest);
        const errMsg =
          orphanUsers >= 2
            ? "当前会话连续未产生助手消息，可能已卡死。请新建会话后重试（模型默认已切到 openrouter/minimax/minimax-m1）。"
            : "消息已发送，但服务端未返回助手消息。请检查 OpenCode 的 Provider/Model 配置与外网连通性。";
        dispatch(
          messagesSlice.actions.setSendError({ sessionId, error: errMsg })
        );
        dispatch(messagesSlice.actions.setBusy({ sessionId, busy: false }));
        return false;
      }

      const assistantError = getMessageErrorText(newAssistant);
      if (assistantError) {
        dispatch(
          messagesSlice.actions.setSendError({
            sessionId,
            error: `模型 ${preferredModelText} 返回错误：${assistantError}`,
          })
        );
      }
      await dispatch(fetchMessages(sessionId));
      dispatch(messagesSlice.actions.setBusy({ sessionId, busy: false }));
      return !assistantError;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      dispatch(
        messagesSlice.actions.setSendError({
          sessionId,
          error: msg ? `模型 ${preferredModelText} 发送失败：${msg}` : "发送失败",
        })
      );
      await dispatch(fetchMessages(sessionId));
      dispatch(messagesSlice.actions.setBusy({ sessionId, busy: false }));
      return false;
    }
  }
);

export const stopSession = createAsyncThunk<
  void,
  string,
  { state: RootState; rejectValue: string }
>(
  "messages/stopSession",
  async (sessionId, { getState, dispatch, rejectWithValue }) => {
    const client = getState().opencode.client;
    const busy = getState().messages.busySessionIds[sessionId];
    if (!client || !sessionId || !busy) {
      if (!client) (dispatch as AppDispatch)(disconnectOpencode());
      return rejectWithValue("未连接、缺少 sessionId 或会话未在忙");
    }
    await client.session.abort({ sessionID: sessionId });
    dispatch(messagesSlice.actions.setBusy({ sessionId, busy: false }));
    await dispatch(fetchMessages(sessionId));
  }
);

export const respondToPermission = createAsyncThunk<
  void,
  "once" | "always" | "reject",
  { state: RootState; rejectValue: string }
>(
  "messages/respondToPermission",
  async (response, { getState, dispatch, rejectWithValue }) => {
    const client = getState().opencode.client;
    const req = getState().messages.pendingPermission;
    if (!client || !req) {
      if (!client) (dispatch as AppDispatch)(disconnectOpencode());
      return rejectWithValue("未连接或无待处理权限");
    }
    await client.permission.respond({
      sessionID: req.sessionID,
      permissionID: req.id,
      response,
    });
    dispatch(messagesSlice.actions.setPendingPermission(null));
    await dispatch(fetchMessages(req.sessionID));
  }
);

// --- Slice ---
type MessagesState = {
  messagesBySession: Record<string, MessageWithParts[]>;
  /** 刚发送的那条用户消息的附件路径，在 fetchMessages 合并到对应消息后清除，避免多次 fetch 覆盖丢失 */
  pendingAttachmentPathsBySession: Record<string, string[]>;
  loadingSessionIds: Record<string, boolean>;
  errors: Record<string, string>;
  sendErrors: Record<string, string>;
  busySessionIds: Record<string, boolean>;
  pendingPermission: PermissionRequest | null;
};

const initialState: MessagesState = {
  messagesBySession: {},
  pendingAttachmentPathsBySession: {},
  loadingSessionIds: {},
  errors: {},
  sendErrors: {},
  busySessionIds: {},
  pendingPermission: null,
};

export const messagesSlice = createSlice({
  name: "messages",
  initialState,
  reducers: {
    clearSession(state, action: PayloadAction<string>) {
      const id = action.payload;
      delete state.messagesBySession[id];
      delete state.pendingAttachmentPathsBySession[id];
      delete state.loadingSessionIds[id];
      delete state.errors[id];
      delete state.sendErrors[id];
      delete state.busySessionIds[id];
      if (state.pendingPermission?.sessionID === id) {
        state.pendingPermission = null;
      }
    },
    addOptimisticUserMessage(
      state,
      action: PayloadAction<{ sessionId: string; message: MessageWithParts }>
    ) {
      const { sessionId, message } = action.payload;
      const list = state.messagesBySession[sessionId] ?? [];
      state.messagesBySession[sessionId] = [...list, message];
    },
    setBusy(
      state,
      action: PayloadAction<{ sessionId: string; busy: boolean }>
    ) {
      const { sessionId, busy } = action.payload;
      if (busy) state.busySessionIds[sessionId] = true;
      else delete state.busySessionIds[sessionId];
    },
    setSendError(
      state,
      action: PayloadAction<{ sessionId: string; error: string | null }>
    ) {
      const { sessionId, error } = action.payload;
      if (error == null) delete state.sendErrors[sessionId];
      else state.sendErrors[sessionId] = error;
    },
    setPendingPermission(
      state,
      action: PayloadAction<PermissionRequest | null>
    ) {
      state.pendingPermission = action.payload;
    },
    setPendingAttachmentPaths(
      state,
      action: PayloadAction<{ sessionId: string; paths: string[] }>
    ) {
      const { sessionId, paths } = action.payload;
      state.pendingAttachmentPathsBySession[sessionId] = paths;
    },
  },
  extraReducers(builder) {
    builder
      .addCase(fetchMessages.pending, (state, action) => {
        const sessionId = action.meta.arg;
        const hasCache = (state.messagesBySession[sessionId]?.length ?? 0) > 0;
        if (!hasCache) state.loadingSessionIds[sessionId] = true;
        delete state.errors[sessionId];
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        const { sessionId, messages } = action.payload;
        const prev = state.messagesBySession[sessionId] ?? [];
        const pendingPaths = state.pendingAttachmentPathsBySession[sessionId];
        const lastUserPrevPaths = [...prev]
          .reverse()
          .find((m) => m.info.role === "user")?.info?.attachmentPaths;
        const paths = pendingPaths ?? lastUserPrevPaths;
        const lastUserIdx = messages.map((m) => m.info.role).lastIndexOf("user");

        let next: MessageWithParts[];
        if (paths?.length && lastUserIdx !== -1) {
          next = [...messages];
          const msg = next[lastUserIdx];
          next[lastUserIdx] = {
            ...msg,
            info: { ...msg.info, attachmentPaths: paths },
          };
          delete state.pendingAttachmentPathsBySession[sessionId];
        } else {
          next = [...messages];
        }
        // 按 id 从 prev 拷回 attachmentPaths，避免后续某次 fetch 用纯 API 结果覆盖导致丢失
        const prevUserById = new Map(
          prev
            .filter((m) => m.info.role === "user" && m.info.attachmentPaths?.length)
            .map((m) => [m.info.id, m.info.attachmentPaths!])
        );
        next = next.map((msg) => {
          if (msg.info.role !== "user") return msg;
          const kept = prevUserById.get(msg.info.id);
          if (!kept?.length) return msg;
          return {
            ...msg,
            info: { ...msg.info, attachmentPaths: kept },
          };
        });
        // reload 后从 localStorage 补全 attachmentPaths，实现「打开」回显
        next = mergePersistedPathsIntoMessages(
          sessionId,
          next
        ) as MessageWithParts[];
        persistAttachmentPaths(sessionId, next);
        state.messagesBySession[sessionId] = next;
        delete state.loadingSessionIds[sessionId];
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        const sessionId = action.meta.arg;
        delete state.loadingSessionIds[sessionId];
        if (action.payload) state.errors[sessionId] = action.payload;
      })
      .addCase(stopSession.rejected, (state, action) => {
        if (action.meta.arg && action.payload) {
          state.sendErrors[action.meta.arg] = action.payload;
        }
      })
      .addCase(respondToPermission.rejected, (state, action) => {
        const sessionId = state.pendingPermission?.sessionID;
        if (sessionId && action.payload) {
          state.sendErrors[sessionId] = action.payload;
        }
      });
  },
});
