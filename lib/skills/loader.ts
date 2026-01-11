/**
 * Skills 加载器 - 实现渐进式披露加载机制
 * 符合 Anthropic Agent Skills 标准
 */

import type {
  Skill,
  SkillConfig,
  SkillLoadState,
  SkillResource,
  SkillResourceType,
} from "./types";
import { parseSkillMarkdown } from "./parser";
import { getAllSkillConfigs, getEnabledSkillConfigs } from "./storage";
import type { Result } from "@/lib/utils/errors";
import { ok, err } from "@/lib/utils/errors";

/**
 * Skills 加载器类
 * 管理技能的渐进式加载
 */
class SkillLoader {
  private loadedSkills: Map<string, Skill> = new Map();
  private loadStates: Map<string, SkillLoadState> = new Map();

  /**
   * 加载所有启用技能的元数据（启动时调用）
   * 只加载 name 和 description，约 100 tokens
   */
  async loadAllMetadata(): Promise<Result<Skill[]>> {
    try {
      const configsResult = getEnabledSkillConfigs();
      if (!configsResult.success) {
        return configsResult;
      }

      const configs = configsResult.value;
      const skills: Skill[] = [];

      for (const config of configs) {
        const skillResult = await this.loadMetadata(config);
        if (skillResult.success) {
          skills.push(skillResult.value);
        } else {
          console.warn(
            `[Skill Loader] Failed to load metadata for ${config.id}:`,
            skillResult.error
          );
        }
      }

      return ok(skills);
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to load skills metadata")
      );
    }
  }

  /**
   * 加载单个技能的元数据
   */
  async loadMetadata(config: SkillConfig): Promise<Result<Skill>> {
    try {
      // 检查是否已加载
      const existing = this.loadedSkills.get(config.id);
      if (existing && this.loadStates.get(config.id)?.metadataLoaded) {
        return ok(existing);
      }

      // 读取 SKILL.md 文件
      const skillMdResult = await this.readSkillMarkdown(config);
      if (!skillMdResult.success) {
        return skillMdResult;
      }

      // 解析 frontmatter（只解析元数据，不加载 body）
      const parseResult = parseSkillMarkdown(skillMdResult.value);
      if (!parseResult.success) {
        return parseResult;
      }

      const skill: Skill = {
        id: config.id,
        path: config.path,
        isRemote: config.isRemote,
        enabled: config.enabled,
        metadata: parseResult.value.metadata,
        updatedAt: config.updatedAt,
      };

      // 更新加载状态
      this.loadedSkills.set(config.id, skill);
      this.loadStates.set(config.id, {
        metadataLoaded: true,
        instructionsLoaded: false,
        resourcesLoaded: false,
      });

      return ok(skill);
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error(`Failed to load metadata for skill ${config.id}`)
      );
    }
  }

  /**
   * 激活技能 - 加载完整的指令内容（< 5000 tokens 推荐）
   */
  async activateSkill(skillId: string): Promise<Result<Skill>> {
    try {
      const skill = this.loadedSkills.get(skillId);
      if (!skill) {
        return err(new Error(`Skill ${skillId} not found`));
      }

      const state = this.loadStates.get(skillId);
      if (state?.instructionsLoaded) {
        return ok(skill);
      }

      // 读取 SKILL.md 文件
      const config: SkillConfig = {
        id: skill.id,
        path: skill.path,
        isRemote: skill.isRemote,
        enabled: skill.enabled,
        updatedAt: skill.updatedAt,
      };

      const skillMdResult = await this.readSkillMarkdown(config);
      if (!skillMdResult.success) {
        return skillMdResult;
      }

      // 解析完整内容（包括 body）
      const parseResult = parseSkillMarkdown(skillMdResult.value);
      if (!parseResult.success) {
        return parseResult;
      }

      // 更新技能对象
      skill.instructions = parseResult.value.instructions;
      skill.metadata = parseResult.value.metadata;

      // 更新加载状态
      this.loadStates.set(skillId, {
        metadataLoaded: true,
        instructionsLoaded: true,
        resourcesLoaded: state?.resourcesLoaded || false,
      });

      return ok(skill);
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error(`Failed to activate skill ${skillId}`)
      );
    }
  }

  /**
   * 加载技能资源（按需）
   */
  async loadResource(
    skillId: string,
    resourceType: SkillResourceType,
    resourcePath: string
  ): Promise<Result<SkillResource>> {
    try {
      const skill = this.loadedSkills.get(skillId);
      if (!skill) {
        return err(new Error(`Skill ${skillId} not found`));
      }

      // 构建资源完整路径
      const fullPath = skill.isRemote
        ? `${skill.path}/${resourceType}/${resourcePath}`
        : `${skill.path}/${resourceType}/${resourcePath}`;

      // 读取资源文件
      const contentResult = await this.readFile(fullPath, skill.isRemote);
      if (!contentResult.success) {
        return contentResult;
      }

      const resource: SkillResource = {
        type: resourceType,
        path: resourcePath,
        content: contentResult.value,
      };

      return ok(resource);
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error(
              `Failed to load resource ${resourceType}/${resourcePath} for skill ${skillId}`
            )
      );
    }
  }

  /**
   * 读取 SKILL.md 文件
   */
  private async readSkillMarkdown(
    config: SkillConfig
  ): Promise<Result<string>> {
    const skillMdPath = config.isRemote
      ? `${config.path}/SKILL.md`
      : `${config.path}/SKILL.md`;

    return this.readFile(skillMdPath, config.isRemote);
  }

  /**
   * 读取文件（支持本地和远程）
   */
  private async readFile(
    path: string,
    isRemote: boolean
  ): Promise<Result<string>> {
    try {
      if (isRemote) {
        // 远程 URL：使用 fetch
        const response = await fetch(path);
        if (!response.ok) {
          return err(
            new Error(`Failed to fetch ${path}: ${response.statusText}`)
          );
        }
        const content = await response.text();
        return ok(content);
      } else {
        // 本地路径：在 Node.js 环境中使用 fs
        // 注意：在浏览器环境中无法直接读取本地文件系统
        // 这里需要根据实际使用场景调整
        // 如果是 Next.js API 路由，可以使用 Node.js fs
        if (typeof window === "undefined") {
          // 服务端：使用 fs
          const fs = await import("fs/promises");
          const content = await fs.readFile(path, "utf-8");
          return ok(content);
        } else {
          // 客户端：无法直接读取本地文件系统
          // 需要通过 API 路由读取
          return err(
            new Error(
              "Cannot read local files from browser. Use API route instead."
            )
          );
        }
      }
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error(`Failed to read file ${path}`)
      );
    }
  }

  /**
   * 获取已加载的技能
   */
  getSkill(skillId: string): Skill | undefined {
    return this.loadedSkills.get(skillId);
  }

  /**
   * 获取所有已加载的技能
   */
  getAllSkills(): Skill[] {
    return Array.from(this.loadedSkills.values());
  }

  /**
   * 获取技能的加载状态
   */
  getLoadState(skillId: string): SkillLoadState | undefined {
    return this.loadStates.get(skillId);
  }

  /**
   * 清除所有加载的技能（重新加载时使用）
   */
  clear(): void {
    this.loadedSkills.clear();
    this.loadStates.clear();
  }
}

// 单例加载器
export const skillLoader = new SkillLoader();

/**
 * 加载所有启用技能的元数据（启动时调用）
 */
export async function loadSkillsMetadata(): Promise<Result<Skill[]>> {
  return skillLoader.loadAllMetadata();
}

/**
 * 激活技能（加载完整指令）
 */
export async function activateSkill(
  skillId: string
): Promise<Result<Skill>> {
  return skillLoader.activateSkill(skillId);
}

/**
 * 加载技能资源
 */
export async function loadSkillResource(
  skillId: string,
  resourceType: SkillResourceType,
  resourcePath: string
): Promise<Result<SkillResource>> {
  return skillLoader.loadResource(skillId, resourceType, resourcePath);
}
