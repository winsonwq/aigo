import {
  createSlice,
  createAsyncThunk,
  type PayloadAction,
} from "@reduxjs/toolkit";
import type { RootState } from "@/store";
import { OPENCODE_BASE_URL } from "./opencodeSlice";

export type SessionItem = {
  id: string;
  title: string;
  slug?: string;
  time?: { created: number; updated: number };
};

const LIST_LIMIT = 50;
const TITLE_MAX_LEN = 80;

function normalizeList(
  rawList: Record<string, unknown>[]
): SessionItem[] {
  return rawList.map((s) => ({
    id: String(s.id ?? s.sessionID ?? ""),
    title:
      typeof s.title === "string" && s.title.trim()
        ? s.title.trim()
        : "新会话",
    slug: typeof s.slug === "string" ? s.slug : undefined,
    time:
      s.time && typeof s.time === "object"
        ? (s.time as SessionItem["time"])
        : undefined,
  }));
}

export const fetchSessions = createAsyncThunk<
  SessionItem[],
  void,
  { state: RootState; rejectValue: string }
>(
  "sessions/fetch",
  async (_, { getState, rejectWithValue }) => {
    const client = getState().opencode.client;
    if (!client) return [];
    let res: Awaited<ReturnType<typeof client.session.list>>;
    try {
      res = await client.session.list({ limit: LIST_LIMIT });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return rejectWithValue(msg || "获取会话列表失败");
    }
    const data = res?.data as
      | SessionItem[]
      | { 200?: Record<string, unknown>[] }
      | undefined;
    const rawList = Array.isArray(data)
      ? (data as unknown as Record<string, unknown>[])
      : data?.[200];
    if (!Array.isArray(rawList)) return [];
    return normalizeList(rawList);
  }
);

export const createSession = createAsyncThunk<
  { id: string },
  { title?: string },
  { state: RootState; rejectValue: string }
>(
  "sessions/create",
  async (options, { getState, dispatch, rejectWithValue }) => {
    const client = getState().opencode.client;
    if (!client) return rejectWithValue("未连接 OpenCode");
    const title = options?.title?.trim() || "新会话";
    let res: Awaited<ReturnType<typeof client.session.create>>;
    try {
      res = await client.session.create({ title });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return rejectWithValue(
        msg || "创建会话失败，请检查 OpenCode 连接或重试。"
      );
    }
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
      return rejectWithValue(msg);
    }
    const data = raw?.data;
    if (data != null && typeof data === "object") {
      const obj = data as Record<string, unknown>;
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
        void dispatch(fetchSessions());
        return { id };
      }
    }
    const location = raw?.response?.headers?.get?.("Location");
    if (typeof location === "string") {
      const match = /\/session\/([^/?#]+)/.exec(location);
      if (match?.[1]) {
        void dispatch(fetchSessions());
        return { id: match[1] };
      }
    }
    return rejectWithValue("服务端返回格式异常，无法解析会话 ID");
  }
);

export const setSessionTitle = createAsyncThunk<
  void,
  { sessionID: string; title: string },
  { state: RootState; rejectValue: string }
>(
  "sessions/setTitle",
  async ({ sessionID, title }, { getState, dispatch, rejectWithValue }) => {
    const client = getState().opencode.client;
    if (!client || !sessionID)
      return rejectWithValue("未连接 OpenCode 或缺少 sessionID");
    const t =
      typeof title === "string" && title.trim()
        ? title.trim().slice(0, TITLE_MAX_LEN)
        : "";
    if (!t) return rejectWithValue("标题为空");
    try {
      await client.session.update({ sessionID, title: t });
    } catch {
      return rejectWithValue("设置标题失败");
    }
    void dispatch(fetchSessions());
  }
);

export const deleteSession = createAsyncThunk<
  void,
  string,
  { state: RootState; rejectValue: string }
>(
  "sessions/delete",
  async (sessionID, { getState, dispatch, rejectWithValue }) => {
    const client = getState().opencode.client;
    const baseUrl = OPENCODE_BASE_URL;
    if (!client || !sessionID)
      return rejectWithValue("未连接 OpenCode 或缺少 sessionID");
    try {
      const api = client.session as unknown as {
        delete?: (args: {
          sessionID?: string;
          id?: string;
        }) => Promise<unknown>;
      };
      if (typeof api?.delete === "function") {
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
        if (!res.ok) throw new Error(`删除会话失败: ${res.status}`);
      }
      void dispatch(fetchSessions());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return rejectWithValue(msg);
    }
  }
);

type SessionsState = {
  sessions: SessionItem[];
  isLoading: boolean;
  error: string | null;
};

const initialState: SessionsState = {
  sessions: [],
  isLoading: false,
  error: null,
};

export const sessionsSlice = createSlice({
  name: "sessions",
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers(builder) {
    builder
      .addCase(fetchSessions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(
        fetchSessions.fulfilled,
        (state, action: PayloadAction<SessionItem[]>) => {
          state.sessions = action.payload;
          state.isLoading = false;
        }
      )
      .addCase(fetchSessions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload ?? "获取会话列表失败";
        state.sessions = [];
      })
      .addCase(createSession.rejected, (state, action) => {
        state.error = action.payload ?? null;
      })
      .addCase(deleteSession.rejected, (state, action) => {
        state.error = action.payload ?? null;
      });
  },
});
