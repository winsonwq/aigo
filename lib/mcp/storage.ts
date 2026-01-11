// MCP 配置存储层 - 使用 localStorage

import type { MCPConfig, MCPServerConfig } from "./types";
import { MCP_STORAGE_KEY } from "./types";
import type { Result } from "@/lib/utils/errors";
import { ok, err } from "@/lib/utils/errors";

/**
 * 获取完整 MCP 配置
 */
export function getMCPConfig(): Result<MCPConfig> {
  try {
    if (typeof window === "undefined") {
      return ok({});
    }

    const stored = localStorage.getItem(MCP_STORAGE_KEY);
    if (!stored) {
      return ok({});
    }

    const config = JSON.parse(stored) as MCPConfig;
    return ok(config);
  } catch (error) {
    return err(
      error instanceof Error ? error : new Error("Failed to get MCP config")
    );
  }
}

/**
 * 保存完整 MCP 配置
 */
export function saveMCPConfig(config: MCPConfig): Result<void> {
  try {
    if (typeof window === "undefined") {
      return err(new Error("localStorage is not available"));
    }

    localStorage.setItem(MCP_STORAGE_KEY, JSON.stringify(config));
    return ok(undefined);
  } catch (error) {
    return err(
      error instanceof Error ? error : new Error("Failed to save MCP config")
    );
  }
}
