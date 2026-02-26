/**
 * skills.sh 搜索：通过 Tauri 后端请求 https://skills.sh/api/search，避免 CORS（开发与打包均可用）。
 */

import { invoke } from "@tauri-apps/api/core";

/** 与 skills.sh API 返回一致，用于 Skills 页展示 */
export type SearchResultItem = {
  id?: string;
  source: string;
  skillName?: string;
  name?: string;
  skillId?: string;
  /** 安装次数 */
  installs?: number;
};

const PAGE_SIZE = 50;
/** 无关键词时使用的默认查询，用于展示热门 skills */
export const DEFAULT_SEARCH_QUERY = "skill";

export type SearchSkillsShOptions = {
  q: string;
  limit?: number;
  offset?: number;
};

export type SearchSkillsShResult = {
  items: SearchResultItem[];
  count: number;
  hasMore: boolean;
};

/**
 * 通过 Tauri 命令请求 skills.sh 搜索 API（后端发起 HTTP，无 CORS 问题）。
 * @param options.q 关键词，空串时后端使用默认查询
 * @param options.limit 每页条数，默认 PAGE_SIZE
 * @param options.offset 偏移，默认 0
 */
export async function searchSkillsShApi(
  options: SearchSkillsShOptions
): Promise<SearchSkillsShResult> {
  const q = options.q.trim();
  const limit = options.limit ?? PAGE_SIZE;
  const offset = options.offset ?? 0;

  const result = await invoke<SearchSkillsShResult>("search_skills_via_api", {
    q: q || DEFAULT_SEARCH_QUERY,
    limit,
    offset,
  });
  return result;
}

export { PAGE_SIZE as SKILLS_SH_PAGE_SIZE };
