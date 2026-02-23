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

/** 规范化为唯一形式，保证显示与 tooltip 一致 */
function normalizePath(p: string | null): string | null {
  if (p == null || typeof p !== "string") return null;
  const trimmed = p.trim().replace(/\/+$/, "");
  return trimmed.length > 0 ? trimmed : null;
}

function loadStoredPath(): string | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v ? normalizePath(v) : null;
  } catch {
    return null;
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspacePath, setState] = useState<string | null>(loadStoredPath);

  const setWorkspacePath = useCallback((path: string | null) => {
    const normalized = normalizePath(path);
    setState(normalized);
    if (normalized !== null) {
      localStorage.setItem(STORAGE_KEY, normalized);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const openFolderPicker = useCallback(async (): Promise<string | null> => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "选择工作区文件夹",
      ...(workspacePath ? { defaultPath: workspacePath } : {}),
    });
    // 对话框可能返回 string | string[] | null（依平台/选项）
    const raw =
      selected == null
        ? null
        : Array.isArray(selected)
          ? selected[0]
          : typeof selected === "string"
            ? selected
            : null;
    if (raw) {
      const normalized = normalizePath(raw);
      if (normalized !== null) {
        setWorkspacePath(normalized);
        return normalized;
      }
    }
    return null;
  }, [setWorkspacePath, workspacePath]);

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
