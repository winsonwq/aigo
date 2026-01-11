/**
 * Skill 解析器 - 解析 SKILL.md 文件
 * 符合 Anthropic Agent Skills 标准
 */

import type { SkillMetadata, SkillParseResult } from "./types";
import type { Result } from "@/lib/utils/errors";
import { ok, err } from "@/lib/utils/errors";

/**
 * 解析 SKILL.md 文件内容
 * 提取 YAML frontmatter 和 Markdown body
 */
export function parseSkillMarkdown(content: string): Result<SkillParseResult> {
  try {
    // 匹配 YAML frontmatter（--- 包围的内容）
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return err(new Error("Invalid SKILL.md format: missing YAML frontmatter"));
    }

    const frontmatterText = match[1];
    const bodyText = match[2].trim();

    // 解析 YAML frontmatter
    const metadataResult = parseYamlFrontmatter(frontmatterText);
    if (!metadataResult.success) {
      return metadataResult;
    }

    return ok({
      metadata: metadataResult.value,
      instructions: bodyText,
    });
  } catch (error) {
    return err(
      error instanceof Error
        ? error
        : new Error("Failed to parse SKILL.md")
    );
  }
}

/**
 * 解析 YAML frontmatter
 * 简化版 YAML 解析器，只处理基本键值对
 */
function parseYamlFrontmatter(
  yamlText: string
): Result<SkillMetadata> {
  try {
    const metadata: Partial<SkillMetadata> = {};
    const lines = yamlText.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue; // 跳过空行和注释
      }

      const colonIndex = trimmed.indexOf(":");
      if (colonIndex === -1) {
        continue; // 跳过无效行
      }

      const key = trimmed.substring(0, colonIndex).trim();
      let value = trimmed.substring(colonIndex + 1).trim();

      // 移除引号（如果存在）
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      switch (key) {
        case "name":
          metadata.name = value;
          break;
        case "description":
          metadata.description = value;
          break;
        case "license":
          metadata.license = value;
          break;
        case "compatibility":
          metadata.compatibility = value;
          break;
        case "allowed-tools":
          // 支持空格分隔的列表
          metadata.allowedTools = value.split(/\s+/).filter(Boolean);
          break;
        case "metadata":
          // metadata 字段可能是嵌套对象，这里简化处理
          // 实际使用时可能需要更复杂的 YAML 解析
          try {
            metadata.metadata = JSON.parse(value);
          } catch {
            // 如果解析失败，作为字符串存储
            metadata.metadata = { raw: value };
          }
          break;
      }
    }

    // 验证必需字段
    if (!metadata.name) {
      return err(new Error("Missing required field: name"));
    }
    if (!metadata.description) {
      return err(new Error("Missing required field: description"));
    }

    return ok(metadata as SkillMetadata);
  } catch (error) {
    return err(
      error instanceof Error
        ? error
        : new Error("Failed to parse YAML frontmatter")
    );
  }
}

/**
 * 验证 Skill 元数据
 */
export function validateSkillMetadata(
  metadata: Partial<SkillMetadata>
): Result<SkillMetadata> {
  if (!metadata.name) {
    return err(new Error("Missing required field: name"));
  }
  if (!metadata.description) {
    return err(new Error("Missing required field: description"));
  }

  return ok(metadata as SkillMetadata);
}
