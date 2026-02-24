import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { useWorkspace } from "@/context/WorkspaceContext";
import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import {
  connectOpencode,
  disconnectOpencode,
  startHealthPoll,
  OPENCODE_BASE_URL,
  type OpenCodeStatus,
  type OpenCodeEngineSource,
} from "@/store/slices/opencodeSlice";
import { fetchSessions } from "@/store/slices/sessionsSlice";
import type { AppDispatch, RootState } from "@/store";

export type { OpenCodeStatus, OpenCodeEngineSource };

export const OPENCODE_PORT = 4096;

type OpenCodeContextValue = {
  status: OpenCodeStatus;
  errorMessage: string | null;
  client: OpencodeClient | null;
  /** "sidecar" = 内置 OpenCode，"path" = 本机 PATH */
  engineSource: OpenCodeEngineSource | null;
  baseUrl: string;
  connect: () => Promise<void>;
  disconnect: () => void;
};

const OpenCodeContext = createContext<OpenCodeContextValue | null>(null);

function useOpenCodeState() {
  const status = useSelector((s: RootState) => s.opencode.status);
  const errorMessage = useSelector((s: RootState) => s.opencode.errorMessage);
  const client = useSelector((s: RootState) => s.opencode.client);
  const engineSource = useSelector((s: RootState) => s.opencode.engineSource);
  return { status, errorMessage, client, engineSource };
}

export function OpenCodeProvider({ children }: { children: ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  const { workspacePath, workspaceInitialized } = useWorkspace();
  const { status, errorMessage, client, engineSource } = useOpenCodeState();

  // 等 workspace 完成首次读取后再连接，避免启动时用 null 连一次、路径到位又断线重连一次（整页“再加载一次”）
  useEffect(() => {
    if (!workspaceInitialized) return;
    dispatch(disconnectOpencode());
    void dispatch(connectOpencode(workspacePath ?? undefined));
  }, [workspaceInitialized, workspacePath, dispatch]);

  // 保持 status 与 client 一致：若显示已连接但 client 为空（异常状态），则置为未连接
  useEffect(() => {
    if (status === "connected" && client === null) {
      dispatch(disconnectOpencode());
    }
  }, [status, client, dispatch]);

  useEffect(() => {
    if (status === "connected" && client) {
      startHealthPoll(client, dispatch);
      void dispatch(fetchSessions());
      const id = setInterval(() => {
        void dispatch(fetchSessions());
      }, 15_000);
      return () => clearInterval(id);
    }
  }, [status, client, dispatch]);

  const connect = useCallback(() => {
    return dispatch(
      connectOpencode(workspacePath ?? undefined)
    ) as unknown as Promise<void>;
  }, [dispatch, workspacePath]);

  const disconnect = useCallback(() => {
    void dispatch(disconnectOpencode());
  }, [dispatch]);

  const value = useMemo<OpenCodeContextValue>(
    () => ({
      status,
      errorMessage,
      client,
      engineSource,
      baseUrl: OPENCODE_BASE_URL,
      connect,
      disconnect,
    }),
    [status, errorMessage, client, engineSource, connect, disconnect]
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
