import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import {
  createOpencodeClient,
  type OpencodeClient,
} from "@opencode-ai/sdk/v2/client";
import { invoke } from "@tauri-apps/api/core";

const OPENCODE_PORT = 4096;
export const OPENCODE_BASE_URL = `http://127.0.0.1:${OPENCODE_PORT}`;
const HEALTH_POLL_MS = 10_000;

export type OpenCodeStatus = "idle" | "connecting" | "connected" | "error";

type HealthResult = { ok: true } | { ok: false; error: string };

async function checkHealth(client: OpencodeClient): Promise<HealthResult> {
  try {
    const res = (await client.global.health()) as {
      data?: unknown;
      response?: { ok?: boolean };
      error?: unknown;
    };
    const data = res?.data as Record<string, unknown> | undefined;
    if (data && typeof data === "object") {
      if (data.healthy === true || (data.healthy as string) === "true")
        return { ok: true };
      const inner = data[200] as Record<string, unknown> | undefined;
      if (inner?.healthy === true) return { ok: true };
      if (res?.response?.ok === true) return { ok: true };
    }
    return { ok: false, error: "health 返回异常" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg || "请求失败" };
  }
}

function tryConnect(): Promise<
  { client: OpencodeClient } | { error: string }
> {
  const newClient = createOpencodeClient({ baseUrl: OPENCODE_BASE_URL });
  return checkHealth(newClient).then((health) => {
    if (health.ok) return { client: newClient };
    const err = health.error;
    const isCors =
      typeof err === "string" &&
      (err.includes("Failed to fetch") ||
        err.includes("NetworkError") ||
        err.includes("CORS"));
    return { error: isCors ? "CORS/网络被拦截" : err };
  });
}

let healthPollIntervalId: ReturnType<typeof setInterval> | null = null;

function stopHealthPoll() {
  if (healthPollIntervalId != null) {
    clearInterval(healthPollIntervalId);
    healthPollIntervalId = null;
  }
}

export const connectOpencode = createAsyncThunk<
  { client: OpencodeClient; source: string },
  string | undefined,
  { rejectValue: string }
>(
  "opencode/connect",
  async (workspacePath, { rejectWithValue }) => {
    console.log("[OpenCode] Connecting…", { workspacePath: workspacePath ?? "(default)" });
    let source = "path";
    try {
      await invoke("kill_process_on_port", { port: OPENCODE_PORT });
      source = (await invoke("start_opencode_serve", {
        port: OPENCODE_PORT,
        directory: workspacePath || undefined,
      })) as string;
      console.log("[OpenCode] start_opencode_serve ok (" + source + "), polling health…");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[OpenCode] start_opencode_serve failed:", msg);
      return rejectWithValue(
        msg ||
          "启动失败。请先安装 opencode（如 brew install opencode），后续版本将内置无需安装。"
      );
    }
    const maxAttempts = 20;
    const intervalMs = 400;
    let lastError = "等待服务启动";
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, intervalMs));
      const result = await tryConnect();
      if ("client" in result) {
        console.log("[OpenCode] Connected (" + source + ").");
        return { client: result.client, source };
      }
      lastError = result.error;
    }
    console.error("[OpenCode] Health check failed after retries:", lastError);
    return rejectWithValue(
      "无法连接 OpenCode（" +
        lastError +
        "）。当前会从本机 PATH 启动 opencode；若未安装请先安装（如 brew install opencode）。后续版本将内置 OpenCode，无需单独安装。"
    );
  }
);

export const disconnectOpencode = createAsyncThunk(
  "opencode/disconnect",
  async (_, { dispatch }) => {
    stopHealthPoll();
    dispatch(opencodeSlice.actions.disconnect());
  }
);

export type OpenCodeEngineSource = "sidecar" | "path";

type OpenCodeState = {
  status: OpenCodeStatus;
  errorMessage: string | null;
  client: OpencodeClient | null;
  /** "sidecar" = 内置打包的 OpenCode，"path" = 本机 PATH 上的 opencode */
  engineSource: OpenCodeEngineSource | null;
};

const initialState: OpenCodeState = {
  status: "idle",
  errorMessage: null,
  client: null,
  engineSource: null,
};

export const opencodeSlice = createSlice({
  name: "opencode",
  initialState,
  reducers: {
    disconnect(state) {
      state.status = "idle";
      state.errorMessage = null;
      state.client = null;
      state.engineSource = null;
    },
  },
  extraReducers(builder) {
    builder
      .addCase(connectOpencode.pending, (state) => {
        state.status = "connecting";
        state.errorMessage = null;
      })
      .addCase(
        connectOpencode.fulfilled,
        (state, action: PayloadAction<{ client: OpencodeClient; source: string }>) => {
          state.status = "connected";
          state.client = action.payload.client;
          state.engineSource =
            action.payload.source === "sidecar" ? "sidecar" : "path";
        }
      )
      .addCase(connectOpencode.rejected, (state, action) => {
        state.status = "error";
        state.client = null;
        state.errorMessage =
          action.payload ??
          "启动失败。请先安装 opencode（如 brew install opencode），后续版本将内置无需安装。";
      });
  },
});

export function startHealthPoll(
  client: OpencodeClient,
  dispatch: (action: ReturnType<typeof disconnectOpencode>) => void
) {
  stopHealthPoll();
  healthPollIntervalId = setInterval(async () => {
    const health = await checkHealth(client);
    if (!health.ok) {
      stopHealthPoll();
      dispatch(disconnectOpencode());
    }
  }, HEALTH_POLL_MS);
}
