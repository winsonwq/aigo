import { useCallback, useEffect, useState } from "react";
import { useOpenCode } from "@/context/OpenCodeContext";

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

/**
 * 加载当前 OpenCode 检索到的 skills 列表（参考 OpenWork Skills Manager）。
 * 数据来自 client.app.skills()，即服务端聚合的 .opencode/skills、.claude/skills、~/.config/opencode/skills 等路径下的 SKILL.md。
 */
export function useSkills(directory?: string) {
  const { client } = useOpenCode();
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSkills = useCallback(async () => {
    if (!client) {
      setSkills([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await client.app.skills({ directory });
      setSkills(normalizeSkillList(res as { data?: unknown }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "获取 Skills 失败");
      setSkills([]);
    } finally {
      setIsLoading(false);
    }
  }, [client, directory]);

  useEffect(() => {
    void fetchSkills();
  }, [fetchSkills]);

  return { skills, isLoading, error, refetch: fetchSkills };
}
