import {
  createSlice,
  createAsyncThunk,
  type PayloadAction,
} from "@reduxjs/toolkit";
import type { RootState } from "@/store";

export type SkillItem = {
  name: string;
  description: string;
  location: string;
  content?: string;
};

function normalizeSkillList(res: { data?: unknown }): SkillItem[] {
  const data = res?.data;
  if (Array.isArray(data)) return data as SkillItem[];
  if (data && typeof data === "object" && "200" in data)
    return ((data as { 200: SkillItem[] })[200] ?? []) as SkillItem[];
  return [];
}

export const fetchSkills = createAsyncThunk<
  SkillItem[],
  string | undefined,
  { state: RootState; rejectValue: string }
>(
  "skills/fetch",
  async (directory, { getState, rejectWithValue }) => {
    const client = getState().opencode.client;
    if (!client) return [];
    try {
      const res = await client.app.skills({ directory });
      return normalizeSkillList(res as { data?: unknown });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return rejectWithValue(msg || "获取 Skills 失败");
    }
  }
);

type SkillsState = {
  /** 唯一数据源：来自 client.app.skills({ directory }) 的返回，仅在此处维护 */
  skills: SkillItem[];
  isLoading: boolean;
  error: string | null;
  /** 已卸载的 skill 名称：只要 API 仍返回就继续从列表过滤；API 不返回后才移除；安装成功后清除该名以便重装后能显示 */
  recentlyRemovedNames: string[];
  /** 安装成功时乐观添加的 skill（API 可能尚未返回），fetch 返回后若已在 payload 中则移出 */
  optimisticSkills: SkillItem[];
};

const initialState: SkillsState = {
  skills: [],
  isLoading: false,
  error: null,
  recentlyRemovedNames: [],
  optimisticSkills: [],
};

export const skillsSlice = createSlice({
  name: "skills",
  initialState,
  reducers: {
    /** 卸载：乐观更新列表并标记为已卸载，后续 fetch 会持续过滤直到 API 不再返回 */
    removeSkill(state, action: PayloadAction<string>) {
      const name = action.payload.trim().toLowerCase();
      state.skills = state.skills.filter((s) => s.name.toLowerCase() !== name);
      if (name && !state.recentlyRemovedNames.includes(name)) {
        state.recentlyRemovedNames.push(name);
      }
    },
    /** 安装成功后调用，清除该名的“已卸载”标记，这样重装或新安装的能正常显示 */
    clearRecentlyRemovedSkill(state, action: PayloadAction<string>) {
      const name = action.payload?.trim().toLowerCase();
      if (name) {
        state.recentlyRemovedNames = state.recentlyRemovedNames.filter((n) => n !== name);
      }
    },
    /** 安装成功时乐观添加一条 skill，使列表立即显示「已安装」；后续 fetch 返回后若 API 已包含则从 optimisticSkills 移出 */
    addOptimisticSkill(state, action: PayloadAction<SkillItem>) {
      const item = action.payload;
      const nameLower = item.name?.trim().toLowerCase();
      if (!nameLower) return;
      const exists =
        state.skills.some((s) => s.name.toLowerCase() === nameLower) ||
        state.optimisticSkills.some((s) => s.name.toLowerCase() === nameLower);
      if (!exists) {
        state.optimisticSkills.push({
          name: item.name.trim(),
          description: item.description ?? "",
          location: item.location ?? "",
        });
      }
    },
    /** 更新乐观添加的 skill 的 location（例如解析出真实路径后补全，用于显示「打开文件夹」） */
    updateOptimisticSkillLocation(state, action: PayloadAction<{ name: string; location: string }>) {
      const { name, location } = action.payload;
      const nameLower = name?.trim().toLowerCase();
      if (!nameLower || !location.trim()) return;
      const opt = state.optimisticSkills.find((s) => s.name.toLowerCase() === nameLower);
      if (opt) opt.location = location.trim();
    },
  },
  extraReducers(builder) {
    builder
      .addCase(fetchSkills.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(
        fetchSkills.fulfilled,
        (state, action: PayloadAction<SkillItem[]>) => {
          const removed = new Set(state.recentlyRemovedNames);
          state.skills = action.payload.filter(
            (s) => !removed.has(s.name.toLowerCase())
          );
          // 仅当 API 不再返回该 skill 时才从“已卸载”中移除（说明服务端已同步）；否则继续过滤
          state.recentlyRemovedNames = state.recentlyRemovedNames.filter((n) =>
            action.payload.some((s) => s.name.toLowerCase() === n)
          );
          // 已由 API 返回的乐观项从 optimisticSkills 移出，避免重复
          state.optimisticSkills = state.optimisticSkills.filter(
            (opt) => !action.payload.some((s) => s.name.toLowerCase() === opt.name.toLowerCase())
          );
          state.isLoading = false;
        }
      )
      .addCase(fetchSkills.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload ?? null;
        state.skills = [];
      });
  },
});
