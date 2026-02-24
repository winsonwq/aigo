import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  setWorkspacePath: (path: string | null) => void;
  openFolderPicker: () => Promise<string | null>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  const workspacePath = useSelector(
    (s: RootState) => s.workspace.workspacePath
  );
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    invoke<string | null>("read_workspace_path")
      .then((path) => dispatch(workspaceSlice.actions.setWorkspacePath(path ?? null)))
      .catch(() => {});
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
      setWorkspacePath,
      openFolderPicker,
    }),
    [workspacePath, setWorkspacePath, openFolderPicker]
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
