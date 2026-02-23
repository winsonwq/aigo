import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { open } from "@tauri-apps/plugin-dialog";

const STORAGE_KEY = "aigo_workspace_path";

type WorkspaceContextValue = {
  workspacePath: string | null;
  setWorkspacePath: (path: string | null) => void;
  openFolderPicker: () => Promise<string | null>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function loadStoredPath(): string | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspacePath, setState] = useState<string | null>(loadStoredPath);

  const setWorkspacePath = useCallback((path: string | null) => {
    setState(path);
    if (path !== null) {
      localStorage.setItem(STORAGE_KEY, path);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const openFolderPicker = useCallback(async (): Promise<string | null> => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "选择工作区文件夹",
    });
    if (selected && typeof selected === "string") {
      setWorkspacePath(selected);
      return selected;
    }
    return null;
  }, [setWorkspacePath]);

  // Sync from storage (e.g. another tab or initial load)
  useEffect(() => {
    setState(loadStoredPath());
  }, []);

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
