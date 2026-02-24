import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { invoke } from "@tauri-apps/api/core";
import type { AppDispatch, RootState } from "@/store";
import {
  openFolderPicker as openFolderPickerThunk,
  setWorkspacePathThunk,
  workspaceSlice,
} from "@/store/slices/workspaceSlice";

type WorkspaceContextValue = {
  workspacePath: string | null;
  /** 是否已完成从 Rust 读取持久化路径（未完成前不触发 OpenCode 连接，避免启动时连两次） */
  workspaceInitialized: boolean;
  setWorkspacePath: (path: string | null) => void;
  openFolderPicker: () => Promise<string | null>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  const workspacePath = useSelector(
    (s: RootState) => s.workspace.workspacePath
  );
  const [workspaceInitialized, setWorkspaceInitialized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    invoke<string | null>("read_workspace_path")
      .then((path) => {
        if (!cancelled) {
          dispatch(workspaceSlice.actions.setWorkspacePath(path ?? null));
          setWorkspaceInitialized(true);
        }
      })
      .catch(() => {
        if (!cancelled) setWorkspaceInitialized(true);
      });
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  const setWorkspacePath = useCallback(
    (path: string | null) => {
      void dispatch(setWorkspacePathThunk(path));
    },
    [dispatch]
  );

  const openFolderPicker = useCallback(async (): Promise<string | null> => {
    const result = await dispatch(openFolderPickerThunk());
    if (openFolderPickerThunk.fulfilled.match(result)) {
      return result.payload;
    }
    return null;
  }, [dispatch]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspacePath,
      workspaceInitialized,
      setWorkspacePath,
      openFolderPicker,
    }),
    [workspacePath, workspaceInitialized, setWorkspacePath, openFolderPicker]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
