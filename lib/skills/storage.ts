// Skills 配置存储层 - 使用 localStorage

import type { SkillConfig } from "./types";
import type { Result } from "@/lib/utils/errors";
import { ok, err } from "@/lib/utils/errors";

const SKILLS_STORAGE_KEY = "aigo_skills";

/**
 * 获取所有 Skills 配置
 */
export function getAllSkillConfigs(): Result<SkillConfig[]> {
  try {
    if (typeof window === "undefined") {
      return ok([]);
    }

    const stored = localStorage.getItem(SKILLS_STORAGE_KEY);
    if (!stored) {
      return ok([]);
    }

    const configs = JSON.parse(stored) as SkillConfig[];
    return ok(configs);
  } catch (error) {
    return err(
      error instanceof Error ? error : new Error("Failed to get skills")
    );
  }
}

/**
 * 获取单个 Skill 配置
 */
export function getSkillConfig(id: string): Result<SkillConfig | null> {
  try {
    const result = getAllSkillConfigs();
    if (!result.success) {
      return result;
    }

    const config = result.value.find((s) => s.id === id);
    return ok(config || null);
  } catch (error) {
    return err(
      error instanceof Error ? error : new Error("Failed to get skill")
    );
  }
}

/**
 * 创建新 Skill 配置
 */
export function createSkillConfig(
  config: Omit<SkillConfig, "id" | "updatedAt">
): Result<SkillConfig> {
  try {
    if (typeof window === "undefined") {
      return err(new Error("localStorage is not available"));
    }

    const result = getAllSkillConfigs();
    if (!result.success) {
      return result;
    }

    const configs = result.value;
    const newConfig: SkillConfig = {
      ...config,
      id: `skill-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      updatedAt: Date.now(),
    };

    configs.push(newConfig);
    localStorage.setItem(SKILLS_STORAGE_KEY, JSON.stringify(configs));

    return ok(newConfig);
  } catch (error) {
    return err(
      error instanceof Error ? error : new Error("Failed to create skill")
    );
  }
}

/**
 * 更新 Skill 配置
 */
export function updateSkillConfig(config: SkillConfig): Result<SkillConfig> {
  try {
    if (typeof window === "undefined") {
      return err(new Error("localStorage is not available"));
    }

    const result = getAllSkillConfigs();
    if (!result.success) {
      return result;
    }

    const configs = result.value;
    const index = configs.findIndex((s) => s.id === config.id);

    if (index === -1) {
      return err(new Error("Skill not found"));
    }

    configs[index] = {
      ...config,
      updatedAt: Date.now(),
    };

    localStorage.setItem(SKILLS_STORAGE_KEY, JSON.stringify(configs));
    return ok(configs[index]);
  } catch (error) {
    return err(
      error instanceof Error ? error : new Error("Failed to update skill")
    );
  }
}

/**
 * 删除 Skill 配置
 */
export function deleteSkillConfig(id: string): Result<void> {
  try {
    if (typeof window === "undefined") {
      return err(new Error("localStorage is not available"));
    }

    const result = getAllSkillConfigs();
    if (!result.success) {
      return result;
    }

    const configs = result.value.filter((s) => s.id !== id);
    localStorage.setItem(SKILLS_STORAGE_KEY, JSON.stringify(configs));

    return ok(undefined);
  } catch (error) {
    return err(
      error instanceof Error ? error : new Error("Failed to delete skill")
    );
  }
}

/**
 * 获取所有启用的 Skills 配置
 */
export function getEnabledSkillConfigs(): Result<SkillConfig[]> {
  try {
    const result = getAllSkillConfigs();
    if (!result.success) {
      return result;
    }

    const enabled = result.value.filter((s) => s.enabled);
    return ok(enabled);
  } catch (error) {
    return err(
      error instanceof Error
        ? error
        : new Error("Failed to get enabled skills")
    );
  }
}
