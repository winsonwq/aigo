import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/store";
import { fetchSkillsFromDisk, type SkillItem } from "@/store/slices/skillsSlice";

export type { SkillItem };

/**
 * 已安装列表唯一数据源：磁盘（Tauri list_installed_skills）。安装/卸载后 refetch 即可，无需乐观更新。
 */
export function useSkills(projectPath?: string | null) {
  const dispatch = useDispatch<AppDispatch>();
  const skills = useSelector((s: RootState) => s.skills.skills);
  const isLoading = useSelector((s: RootState) => s.skills.isLoading);
  const error = useSelector((s: RootState) => s.skills.error);

  const refetch = useCallback(() => {
    return dispatch(fetchSkillsFromDisk({ projectPath }));
  }, [dispatch, projectPath]);

  return { skills, isLoading, error, refetch };
}
