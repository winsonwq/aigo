import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/store";
import {
  fetchSessions,
  createSession as createSessionThunk,
  deleteSession as deleteSessionThunk,
  setSessionTitle as setSessionTitleThunk,
  type SessionItem,
} from "@/store/slices/sessionsSlice";

export type { SessionItem };

export function useSessions() {
  const dispatch = useDispatch<AppDispatch>();
  const sessions = useSelector((s: RootState) => s.sessions.sessions);
  const isLoading = useSelector((s: RootState) => s.sessions.isLoading);
  const error = useSelector((s: RootState) => s.sessions.error);

  const refetch = useCallback(() => {
    void dispatch(fetchSessions());
  }, [dispatch]);

  const createSession = useCallback(
    async (options?: { title?: string }): Promise<
      { id: string } | { error: string }
    > => {
      const result = await dispatch(createSessionThunk(options ?? {}));
      if (createSessionThunk.fulfilled.match(result)) {
        return { id: result.payload.id };
      }
      return {
        error:
          result.payload ?? "创建会话失败，请检查 OpenCode 连接或重试。",
      };
    },
    [dispatch]
  );

  const setSessionTitle = useCallback(
    async (sessionID: string, title: string): Promise<boolean> => {
      const result = await dispatch(
        setSessionTitleThunk({ sessionID, title })
      );
      return setSessionTitleThunk.fulfilled.match(result);
    },
    [dispatch]
  );

  const deleteSession = useCallback(
    async (sessionID: string): Promise<boolean> => {
      const result = await dispatch(deleteSessionThunk(sessionID));
      return deleteSessionThunk.fulfilled.match(result);
    },
    [dispatch]
  );

  return {
    sessions,
    isLoading,
    error,
    refetch,
    setSessionTitle,
    createSession,
    deleteSession,
  };
}
