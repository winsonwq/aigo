import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
} from "@/store/slices/opencodeSlice";
import { fetchSessions } from "@/store/slices/sessionsSlice";
import type { AppDispatch, RootState } from "@/store";

export type { OpenCodeStatus };

export const OPENCODE_PORT = 4096;

type OpenCodeContextValue = {
  status: OpenCodeStatus;
  errorMessage: string | null;
  client: OpencodeClient | null;
  baseUrl: string;
  connect: () => Promise<void>;
  disconnect: () => void;
};

const OpenCodeContext = createContext<OpenCodeContextValue | null>(null);

function useOpenCodeState() {
  const status = useSelector((s: RootState) => s.opencode.status);
  const errorMessage = useSelector((s: RootState) => s.opencode.errorMessage);
  const client = useSelector((s: RootState) => s.opencode.client);
  return { status, errorMessage, client };
}

export function OpenCodeProvider({ children }: { children: ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  const { workspacePath } = useWorkspace();
  const { status, errorMessage, client } = useOpenCodeState();

  useEffect(() => {
    void dispatch(connectOpencode(workspacePath ?? undefined));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on mount
  }, []);

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

  const value: OpenCodeContextValue = {
    status,
    errorMessage,
    client,
    baseUrl: OPENCODE_BASE_URL,
    connect,
    disconnect,
  };

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
