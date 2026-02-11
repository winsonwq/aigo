import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk/v2/client";
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
    const res = await client.global.health() as {
      data?: unknown;
      response?: { ok?: boolean };
      error?: unknown;
    };
    const data = res?.data as Record<string, unknown> | undefined;
    // 兼容多种返回格式：{ healthy: true }、{ 200: { healthy: true } }、或任意 2xx 且有 body
    if (data && typeof data === "object") {
      if (data.healthy === true || (data.healthy as string) === "true") return { ok: true };
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

    const corsHint =
      " 解决 CORS：opencode serve --hostname 127.0.0.1 --port " +
      OPENCODE_PORT +
      " --cors http://localhost:1420 --cors tauri://localhost";

    const tryConnect = async (): Promise<{ client: OpencodeClient } | { error: string }> => {
      const newClient = createOpencodeClient({ baseUrl: BASE_URL });
      const health = await checkHealth(newClient);
      if (health.ok) return { client: newClient };
      const err = health.error;
      const isCors =
        typeof err === "string" &&
        (err.includes("Failed to fetch") || err.includes("NetworkError") || err.includes("CORS"));
      return { error: isCors ? "CORS/网络被拦截" : err };
    };

    try {
      // 1. If server is already running, connect directly
      let result = await tryConnect();
      if ("client" in result) {
        setClient(result.client);
        setStatus("connected");
        return;
      }
      let lastError = result.error;
      // 2. Otherwise start serve and retry once
      await invoke("start_opencode_serve", { port: OPENCODE_PORT });
      await new Promise((r) => setTimeout(r, 1200));
      result = await tryConnect();
      if ("client" in result) {
        setClient(result.client);
        setStatus("connected");
        return;
      }
      lastError = result.error;
      setStatus("error");
      setErrorMessage(
        "无法连接 OpenCode（" +
          lastError +
          "）。请确认：1) opencode serve 已在 " +
          OPENCODE_PORT +
          " 端口运行；2) 若在 Tauri 内报 CORS/网络被拦截，" +
          corsHint
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const hint =
        typeof msg === "string" && (msg.includes("CORS") || msg.includes("Failed to fetch"))
          ? " 请用 opencode serve ... --cors http://localhost:1420 --cors tauri://localhost 重启服务。"
          : "";
      setStatus("error");
      setErrorMessage((msg || "启动或连接失败") + hint);
    }
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
    <OpenCodeContext.Provider value={value}>{children}</OpenCodeContext.Provider>
  );
}

export function useOpenCode(): OpenCodeContextValue {
  const ctx = useContext(OpenCodeContext);
  if (!ctx) throw new Error("useOpenCode must be used within OpenCodeProvider");
  return ctx;
}
