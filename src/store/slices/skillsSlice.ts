import {
  createSlice,
  createAsyncThunk,
  type PayloadAction,
} from "@reduxjs/toolkit";

export type SkillItem = {
  name: string;
  description: string;
  location: string;
  /** 来源仓库，如 "owner/repo"，从技能目录 .git 解析，用于与搜索结果的 source 匹配 */
  source?: string;
  content?: string;
};

/** Single source of truth: list installed skills by reading from disk (Tauri list_installed_skills). */
export const fetchSkillsFromDisk = createAsyncThunk<
  SkillItem[],
  { projectPath?: string | null },
  { rejectValue: string }
>(
  "skills/fetchFromDisk",
  async ({ projectPath }, { rejectWithValue }) => {
    try {
      const list = await (await import("@tauri-apps/api/core")).invoke<
        { name: string; description: string; location: string; source?: string }[]
      >("list_installed_skills", {
        projectPath: projectPath ?? undefined,
      });
      return list.map((s) => ({
        name: s.name,
        description: s.description ?? "",
        location: s.location ?? "",
        source: s.source,
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return rejectWithValue(msg || "获取已安装 Skills 失败");
    }
  }
);

type SkillsState = {
  /** 唯一数据源：来自 list_installed_skills（读磁盘），安装/卸载后 refetch 即可 */
  skills: SkillItem[];
  isLoading: boolean;
  error: string | null;
};

const initialState: SkillsState = {
  skills: [],
  isLoading: false,
  error: null,
};

export const skillsSlice = createSlice({
  name: "skills",
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers(builder) {
    builder
      .addCase(fetchSkillsFromDisk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(
        fetchSkillsFromDisk.fulfilled,
        (state, action: PayloadAction<SkillItem[]>) => {
          state.skills = action.payload;
          state.isLoading = false;
        }
      )
      .addCase(fetchSkillsFromDisk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload ?? null;
        state.skills = [];
      });
  },
});
