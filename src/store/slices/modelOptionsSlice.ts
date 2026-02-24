import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "@/store";
import {
  MODEL_OPTIONS as FALLBACK_OPTIONS,
  type ModelOption,
  type ModelOptionGroup,
} from "@/config/models";

type ProviderModel = {
  id?: string;
  name?: string;
  cost?: { input?: number; output?: number };
};

function normalizeProvidersResponse(res: { data?: unknown }): {
  providers: Array<{
    id: string;
    name: string;
    models: Record<string, ProviderModel>;
  }>;
} {
  const data = res?.data as Record<string, unknown> | undefined;
  if (!data || typeof data !== "object") return { providers: [] };
  const payload = "200" in data ? (data[200] as Record<string, unknown>) : data;
  if (!payload || typeof payload !== "object") return { providers: [] };
  const providers = Array.isArray(payload.providers)
    ? (payload.providers as Array<{
        id: string;
        name: string;
        models: Record<string, ProviderModel>;
      }>)
    : [];
  return { providers };
}

function isFreeModel(
  value: string,
  label: string,
  model?: ProviderModel
): boolean {
  if (/[:/]free\b/i.test(value) || /\bfree\b/i.test(label)) return true;
  const cost = model?.cost;
  if (
    cost &&
    typeof cost.input === "number" &&
    typeof cost.output === "number"
  )
    return cost.input === 0 && cost.output === 0;
  return false;
}

function buildGroupedOptionsFromProviders(
  providers: ReturnType<typeof normalizeProvidersResponse>["providers"]
): ModelOptionGroup[] {
  const groups: ModelOptionGroup[] = [];
  for (const provider of providers) {
    const models =
      provider.models && typeof provider.models === "object"
        ? provider.models
        : {};
    const withFree: Array<ModelOption & { _free: boolean }> = [];
    for (const [modelKey, model] of Object.entries(models)) {
      if (!model || typeof model !== "object") continue;
      const value = `${provider.id}/${modelKey}`;
      const label = (model.name as string) || modelKey || value;
      withFree.push({ value, label, _free: isFreeModel(value, label, model) });
    }
    if (withFree.length === 0) continue;
    withFree.sort((a, b) => {
      if (a._free !== b._free) return a._free ? -1 : 1;
      return a.label.localeCompare(b.label);
    });
    groups.push({
      label: provider.name || provider.id,
      options: withFree.map(({ value, label }) => ({ value, label })),
    });
  }
  groups.sort((a, b) => {
    const aHasFree = a.options.some((o) => isFreeModel(o.value, o.label));
    const bHasFree = b.options.some((o) => isFreeModel(o.value, o.label));
    if (aHasFree !== bHasFree) return aHasFree ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
  return groups;
}

function flattenGroups(groups: ModelOptionGroup[]): ModelOption[] {
  return groups.flatMap((g) => g.options);
}

const FALLBACK_GROUPED: ModelOptionGroup[] = [
  { label: "模型", options: FALLBACK_OPTIONS },
];

export const fetchModelOptions = createAsyncThunk<
  { options: ModelOption[]; optionsGrouped: ModelOptionGroup[] },
  void,
  { state: RootState; rejectValue: string }
>(
  "modelOptions/fetch",
  async (_, { getState, rejectWithValue }) => {
    const client = getState().opencode.client;
    const status = getState().opencode.status;
    if (!client || status !== "connected") {
      return {
        options: FALLBACK_OPTIONS,
        optionsGrouped: FALLBACK_GROUPED,
      };
    }
    try {
      const res = await client.config.providers();
      const { providers } = normalizeProvidersResponse(res as { data?: unknown });
      const grouped = buildGroupedOptionsFromProviders(providers);
      if (grouped.length === 0) {
        return { options: FALLBACK_OPTIONS, optionsGrouped: FALLBACK_GROUPED };
      }
      return {
        options: flattenGroups(grouped),
        optionsGrouped: grouped,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return rejectWithValue(msg || "获取模型列表失败");
    }
  }
);

type ModelOptionsState = {
  options: ModelOption[];
  optionsGrouped: ModelOptionGroup[];
  loading: boolean;
  error: string | null;
};

const initialState: ModelOptionsState = {
  options: FALLBACK_OPTIONS,
  optionsGrouped: FALLBACK_GROUPED,
  loading: false,
  error: null,
};

export const modelOptionsSlice = createSlice({
  name: "modelOptions",
  initialState,
  reducers: {},
  extraReducers(builder) {
    builder
      .addCase(fetchModelOptions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchModelOptions.fulfilled,
        (
          state,
          action: PayloadAction<{
            options: ModelOption[];
            optionsGrouped: ModelOptionGroup[];
          }>
        ) => {
          state.options = action.payload.options;
          state.optionsGrouped = action.payload.optionsGrouped;
          state.loading = false;
        }
      )
      .addCase(fetchModelOptions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? null;
        state.options = FALLBACK_OPTIONS;
        state.optionsGrouped = FALLBACK_GROUPED;
      });
  },
});
