import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { invoke } from "@tauri-apps/api/core";

function normalizePath(p: string | null): string | null {
  if (p == null || typeof p !== "string") return null;
  let s = p.trim();
  if (s.startsWith("file://")) s = s.slice(7);
  s = s.replace(/\/+$/, "");
  return s.length > 0 ? s : null;
}

/** 选文件夹：Rust 端已持久化到本地文件，前端只更新 store。 */
export const openFolderPicker = createAsyncThunk<
  string | null,
  void,
  { rejectValue: null }
>(
  "workspace/openFolderPicker",
  async (_, { getState, dispatch, rejectWithValue }) => {
    const state = getState() as { workspace?: { workspacePath: string | null } };
    const defaultPath = state.workspace?.workspacePath ?? null;
    let raw: string | null = null;
    try {
      const result = await invoke<string | null>("pick_workspace_folder", {
        default_path: defaultPath ?? undefined,
      });
      raw = result != null && typeof result === "string" ? result : null;
    } catch (e) {
      console.error("[workspace] openFolderPicker failed:", e);
      return rejectWithValue(null);
    }
    if (raw === null || raw === undefined) return rejectWithValue(null);
    const normalized = normalizePath(raw);
    if (normalized === null) return rejectWithValue(null);
    dispatch(workspaceSlice.actions.setWorkspacePath(normalized));
    return normalized;
  }
);

/** 设置路径并持久化到 Rust 端本地文件（不依赖 localStorage）。 */
export const setWorkspacePathThunk = createAsyncThunk(
  "workspace/setPath",
  async (path: string | null, { dispatch }) => {
    const normalized = normalizePath(path);
    try {
      await invoke("save_workspace_path", { path: normalized });
    } catch {
      // 非 Tauri 环境忽略
    }
    dispatch(workspaceSlice.actions.setWorkspacePath(normalized));
  }
);

type WorkspaceState = {
  workspacePath: string | null;
};

const initialState: WorkspaceState = {
  workspacePath: null,
};

export const workspaceSlice = createSlice({
  name: "workspace",
  initialState,
  reducers: {
    setWorkspacePath(state, action: PayloadAction<string | null>) {
      state.workspacePath = normalizePath(action.payload);
    },
  },
  extraReducers(builder) {
    builder.addCase(openFolderPicker.fulfilled, (state, action) => {
      if (action.payload != null) {
        state.workspacePath = normalizePath(action.payload);
      }
    });
  },
});
