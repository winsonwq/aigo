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
  reducers: {},
  extraReducers(builder) {
    builder
      .addCase(fetchSkills.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(
        fetchSkills.fulfilled,
        (state, action: PayloadAction<SkillItem[]>) => {
          state.skills = action.payload;
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
