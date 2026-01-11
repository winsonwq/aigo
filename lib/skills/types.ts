/**
 * Anthropic Agent Skills 标准类型定义
 * 参考: https://agentskills.io/specification
 */

/**
 * Skill 元数据（SKILL.md frontmatter）
 */
export interface SkillMetadata {
  /** 技能名称（必需） */
  name: string;
  /** 技能描述（必需） */
  description: string;
  /** 许可证（可选） */
  license?: string;
  /** 兼容性要求（可选） */
  compatibility?: string;
  /** 额外元数据（可选） */
  metadata?: Record<string, unknown>;
  /** 允许使用的工具列表（可选，实验性） */
  allowedTools?: string[];
}

/**
 * Skill 完整定义
 */
export interface Skill {
  /** 技能 ID（唯一标识） */
  id: string;
  /** 技能路径（本地路径或远程 URL） */
  path: string;
  /** 是否为远程 URL */
  isRemote: boolean;
  /** 是否启用 */
  enabled: boolean;
  /** 元数据（从 SKILL.md frontmatter 解析） */
  metadata: SkillMetadata;
  /** 指令内容（SKILL.md body，仅在激活时加载） */
  instructions?: string;
  /** 最后更新时间 */
  updatedAt: number;
}

/**
 * Skill 配置（存储用）
 */
export interface SkillConfig {
  /** 技能 ID */
  id: string;
  /** 技能路径 */
  path: string;
  /** 是否为远程 URL */
  isRemote: boolean;
  /** 是否启用 */
  enabled: boolean;
  /** 最后更新时间 */
  updatedAt: number;
}

/**
 * Skill 加载状态
 */
export interface SkillLoadState {
  /** 元数据是否已加载 */
  metadataLoaded: boolean;
  /** 指令是否已加载 */
  instructionsLoaded: boolean;
  /** 资源是否已加载 */
  resourcesLoaded: boolean;
}

/**
 * Skill 资源类型
 */
export type SkillResourceType = "scripts" | "references" | "assets";

/**
 * Skill 资源文件
 */
export interface SkillResource {
  /** 资源类型 */
  type: SkillResourceType;
  /** 文件路径（相对于技能根目录） */
  path: string;
  /** 文件内容（按需加载） */
  content?: string | Buffer;
}

/**
 * Skill 解析结果
 */
export interface SkillParseResult {
  /** 元数据 */
  metadata: SkillMetadata;
  /** 指令内容 */
  instructions: string;
}
