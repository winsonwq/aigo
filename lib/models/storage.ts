// 模型配置存储层 - 使用 localStorage

import type { ModelConfig } from "./types";
import { MODELS_STORAGE_KEY, DEFAULT_MODEL_KEY } from "./types";
import type { Result } from "@/lib/utils/errors";
import { ok, err } from "@/lib/utils/errors";

/**
 * 获取所有模型配置
 */
export function getAllModels(): Result<ModelConfig[]> {
  try {
    if (typeof window === "undefined") {
      return ok([]);
    }

    const stored = localStorage.getItem(MODELS_STORAGE_KEY);
    if (!stored) {
      return ok([]);
    }

    const models = JSON.parse(stored) as ModelConfig[];
    return ok(models);
  } catch (error) {
    return err(
      error instanceof Error ? error : new Error("Failed to get models")
    );
  }
}

/**
 * 获取单个模型配置
 */
export function getModel(id: string): Result<ModelConfig | null> {
  try {
    const result = getAllModels();
    if (!result.success) {
      return result;
    }

    const model = result.value.find((m) => m.id === id);
    return ok(model || null);
  } catch (error) {
    return err(
      error instanceof Error ? error : new Error("Failed to get model")
    );
  }
}

/**
 * 创建新模型配置
 */
export function createModel(
  model: Omit<ModelConfig, "id" | "created_at" | "updated_at">
): Result<ModelConfig> {
  try {
    if (typeof window === "undefined") {
      return err(new Error("localStorage is not available"));
    }

    const result = getAllModels();
    if (!result.success) {
      return result;
    }

    const models = result.value;
    const now = new Date().toISOString();
    const newModel: ModelConfig = {
      ...model,
      id: `model-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      created_at: now,
      updated_at: now,
    };

    models.push(newModel);
    localStorage.setItem(MODELS_STORAGE_KEY, JSON.stringify(models));

    return ok(newModel);
  } catch (error) {
    return err(
      error instanceof Error ? error : new Error("Failed to create model")
    );
  }
}

/**
 * 更新模型配置
 */
export function updateModel(model: ModelConfig): Result<ModelConfig> {
  try {
    if (typeof window === "undefined") {
      return err(new Error("localStorage is not available"));
    }

    const result = getAllModels();
    if (!result.success) {
      return result;
    }

    const models = result.value;
    const index = models.findIndex((m) => m.id === model.id);

    if (index === -1) {
      return err(new Error("Model not found"));
    }

    models[index] = {
      ...model,
      updated_at: new Date().toISOString(),
    };

    localStorage.setItem(MODELS_STORAGE_KEY, JSON.stringify(models));
    return ok(models[index]);
  } catch (error) {
    return err(
      error instanceof Error ? error : new Error("Failed to update model")
    );
  }
}

/**
 * 删除模型配置
 */
export function deleteModel(id: string): Result<void> {
  try {
    if (typeof window === "undefined") {
      return err(new Error("localStorage is not available"));
    }

    const result = getAllModels();
    if (!result.success) {
      return result;
    }

    const models = result.value.filter((m) => m.id !== id);
    localStorage.setItem(MODELS_STORAGE_KEY, JSON.stringify(models));

    // 如果删除的是默认模型，清除默认模型设置
    const defaultModelId = getDefaultModelId();
    if (defaultModelId === id) {
      localStorage.removeItem(DEFAULT_MODEL_KEY);
    }

    return ok(undefined);
  } catch (error) {
    return err(
      error instanceof Error ? error : new Error("Failed to delete model")
    );
  }
}

/**
 * 获取默认模型 ID
 */
export function getDefaultModelId(): string | null {
  try {
    if (typeof window === "undefined") {
      return null;
    }
    return localStorage.getItem(DEFAULT_MODEL_KEY);
  } catch {
    return null;
  }
}

/**
 * 设置默认模型 ID
 */
export function setDefaultModelId(id: string | null): Result<void> {
  try {
    if (typeof window === "undefined") {
      return err(new Error("localStorage is not available"));
    }

    if (id === null) {
      localStorage.removeItem(DEFAULT_MODEL_KEY);
    } else {
      localStorage.setItem(DEFAULT_MODEL_KEY, id);
    }

    return ok(undefined);
  } catch (error) {
    return err(
      error instanceof Error ? error : new Error("Failed to set default model")
    );
  }
}
