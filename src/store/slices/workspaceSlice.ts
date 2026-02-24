import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

const STORAGE_KEY = "aigo_workspace_path";

function normalizePath(p: string | null): string | null {
  if (p == null || typeof p !== "string") return null;
  const trimmed = p.trim().replace(/\/+$/, "");
  return trimmed.length > 0 ? trimmed : null;
}

export function loadStoredWorkspacePath(): string | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v ? normalizePath(v) : null;
  } catch {
    return null;
  }
}

function persistWorkspacePath(path: string | null) {
  try {
    if (path !== null) {
      localStorage.setItem(STORAGE_KEY, path);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

export const openFolderPicker = createAsyncThunk<
  string | null,
  void,
  { rejectValue: null }
>(
  "workspace/openFolderPicker",
  async (_, { getState, dispatch, rejectWithValue }) => {
    const state = getState() as { workspace?: { workspacePath: string | null } };
    const workspacePath = state.workspace?.workspacePath ?? null;
    const defaultPath = workspacePath
      ? workspacePath
      : (await invoke<string>("get_home_dir").catch(() => null)) ?? undefined;
    const selected = await open({
      directory: true,
      multiple: false,
      title: "选择工作区文件夹",
      ...(defaultPath ? { defaultPath } : {}),
    });
    const raw =
      selected == null
        ? null
        : Array.isArray(selected)
          ? selected[0]
          : typeof selected === "string"
            ? selected
            : null;
    if (!raw) return rejectWithValue(null);
    const normalized = normalizePath(raw);
    if (normalized === null) return rejectWithValue(null);
    dispatch(workspaceSlice.actions.setWorkspacePath(normalized));
    persistWorkspacePath(normalized);
    return normalized;
  }
);

/** Dispatch this thunk to set path and persist to localStorage. */
export const setWorkspacePathThunk = createAsyncThunk(
  "workspace/setPath",
  async (path: string | null, { dispatch }) => {
    const normalized = normalizePath(path);
    dispatch(workspaceSlice.actions.setWorkspacePath(normalized));
    persistWorkspacePath(normalized);
  }
);

type WorkspaceState = {
  workspacePath: string | null;
};

const initialState: WorkspaceState = {
  workspacePath: loadStoredWorkspacePath(),
};

export const workspaceSlice = createSlice({
  name: "workspace",
  initialState,
  reducers: {
    setWorkspacePath(state, action: PayloadAction<string | null>) {
      state.workspacePath = normalizePath(action.payload);
    },
  },
});
