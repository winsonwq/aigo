import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createOpencodeClient,
  type OpencodeClient,
} from "@opencode-ai/sdk/v2/client";
import { invoke } from "@tauri-apps/api/core";

const OPENCODE_PORT = 4096;
const BASE_URL = `http://127.0.0.1:${OPENCODE_PORT}`;
const HEALTH_POLL_MS = 10_000;

export type OpenCodeStatus = "idle" | "connecting" | "connected" | "error";

type OpenCodeContextValue = {
  status: OpenCodeStatus;
  errorMessage: string | null;
  client: OpencodeClient | null;
  baseUrl: string;
  connect: () => Promise<void>;
  disconnect: () => void;
};

const OpenCodeContext = createContext<OpenCodeContextValue | null>(null);

type HealthResult = { ok: true } | { ok: false; error: string };

async function checkHealth(client: OpencodeClient): Promise<HealthResult> {
  try {
    const res = (await client.global.health()) as {
      data?: unknown;
      response?: { ok?: boolean };
      error?: unknown;
    };
    const data = res?.data as Record<string, unknown> | undefined;
    // 兼容多种返回格式：{ healthy: true }、{ 200: { healthy: true } }、或任意 2xx 且有 body
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

export function OpenCodeProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<OpenCodeStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [client, setClient] = useState<OpencodeClient | null>(null);

  const disconnect = useCallback(() => {
    setClient(null);
    setStatus("idle");
    setErrorMessage(null);
  }, []);

  const connect = useCallback(async () => {
    setStatus("connecting");
    setErrorMessage(null);

    // 一套流程：由 AIGO 负责启动 OpenCode 并连接，用户无需本机单独安装/启动。
    // 当前从 PATH 启动 opencode；后续版本将改为内置/下载的二进制。
    const tryConnect = async (): Promise<
      { client: OpencodeClient } | { error: string }
    > => {
      const newClient = createOpencodeClient({ baseUrl: BASE_URL });
      const health = await checkHealth(newClient);
      if (health.ok) return { client: newClient };
      const err = health.error;
      const isCors =
        typeof err === "string" &&
        (err.includes("Failed to fetch") ||
          err.includes("NetworkError") ||
          err.includes("CORS"));
      return { error: isCors ? "CORS/网络被拦截" : err };
    };

    try {
      await invoke("start_opencode_serve", { port: OPENCODE_PORT });
      // 轮询等待服务就绪，最多约 8 秒
      const maxAttempts = 20;
      const intervalMs = 400;
      let result: { client: OpencodeClient } | { error: string } = {
        error: "等待服务启动",
      };
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, intervalMs));
        result = await tryConnect();
        if ("client" in result) break;
      }
      if ("client" in result) {
        setClient(result.client);
        setStatus("connected");
        return;
      }
      const lastError = result.error;
      setStatus("error");
      setErrorMessage(
        "无法连接 OpenCode（" +
          lastError +
          "）。当前会从本机 PATH 启动 opencode；若未安装请先安装（如 brew install opencode）。后续版本将内置 OpenCode，无需单独安装。"
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus("error");
      setErrorMessage(
        msg ||
          "启动失败。请先安装 opencode（如 brew install opencode），后续版本将内置无需安装。"
      );
    }
  }, []);

  // 应用启动时自动连接，无需用户点击
  useEffect(() => {
    void connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅挂载时执行一次
  }, []);

  // Health poll when connected; on failure set error and allow reconnect
  useEffect(() => {
    if (status !== "connected" || !client) return;
    const id = setInterval(async () => {
      const health = await checkHealth(client);
      if (!health.ok) {
        setClient(null);
        setStatus("error");
        setErrorMessage("连接已断开");
      }
    }, HEALTH_POLL_MS);
    return () => clearInterval(id);
  }, [status, client]);

  const value = useMemo<OpenCodeContextValue>(
    () => ({
      status,
      errorMessage,
      client,
      baseUrl: BASE_URL,
      connect,
      disconnect,
    }),
    [status, errorMessage, client, connect, disconnect]
  );

  return (
    <OpenCodeContext.Provider value={value}>
      {children}
    </OpenCodeContext.Provider>
  );
}

export function useOpenCode(): OpenCodeContextValue {
  const ctx = useContext(OpenCodeContext);
  if (!ctx) throw new Error("useOpenCode must be used within OpenCodeProvider");
  return ctx;
}
