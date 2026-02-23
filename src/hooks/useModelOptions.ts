import { useCallback, useEffect, useState } from "react";
import { useOpenCode } from "@/context/OpenCodeContext";
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
    ? (payload.providers as Array<{ id: string; name: string; models: Record<string, ProviderModel> }>)
    : [];
  return { providers };
}

function isFreeModel(value: string, label: string, model?: ProviderModel): boolean {
  if (/[:/]free\b/i.test(value) || /\bfree\b/i.test(label)) return true;
  const cost = model?.cost;
  if (cost && typeof cost.input === "number" && typeof cost.output === "number")
    return cost.input === 0 && cost.output === 0;
  return false;
}

/**
 * 按 provider 分组，组内 free 优先（OpenCode 习惯：free 放最前），再按 label 排序。
 * 分组顺序：有 free 模型的 provider 组排在前面，其余按 provider 名称排序。
 */
function buildGroupedOptionsFromProviders(
  providers: ReturnType<typeof normalizeProvidersResponse>["providers"]
): ModelOptionGroup[] {
  const groups: ModelOptionGroup[] = [];
  for (const provider of providers) {
    const models = provider.models && typeof provider.models === "object" ? provider.models : {};
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

const FALLBACK_GROUPED: ModelOptionGroup[] = [{ label: "模型", options: FALLBACK_OPTIONS }];

/**
 * 模型选项来源：优先从 OpenCode SDK client.config.providers() 拉取（服务端返回已配置的 providers 及其 models），
 * 未连接或请求失败时使用本地静态 MODEL_OPTIONS 兜底。
 * 分组规则：按 provider 分组；组内与组间均 free 优先（cost 为 0 或 id/label 含 free 的排最前）。
 */
export function useModelOptions() {
  const { client, status } = useOpenCode();
  const [options, setOptions] = useState<ModelOption[]>(FALLBACK_OPTIONS);
  const [optionsGrouped, setOptionsGrouped] = useState<ModelOptionGroup[]>(FALLBACK_GROUPED);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOptions = useCallback(async () => {
    if (!client || status !== "connected") {
      setOptions(FALLBACK_OPTIONS);
      setOptionsGrouped(FALLBACK_GROUPED);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await client.config.providers();
      const { providers } = normalizeProvidersResponse(res as { data?: unknown });
      const grouped = buildGroupedOptionsFromProviders(providers);
      if (grouped.length === 0) {
        setOptions(FALLBACK_OPTIONS);
        setOptionsGrouped(FALLBACK_GROUPED);
      } else {
        setOptions(flattenGroups(grouped));
        setOptionsGrouped(grouped);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "获取模型列表失败");
      setOptions(FALLBACK_OPTIONS);
      setOptionsGrouped(FALLBACK_GROUPED);
    } finally {
      setLoading(false);
    }
  }, [client, status]);

  useEffect(() => {
    void fetchOptions();
  }, [fetchOptions]);

  return { options, optionsGrouped, loading, error, refetch: fetchOptions };
}
