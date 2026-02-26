import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/store";
import { fetchSkills, type SkillItem } from "@/store/slices/skillsSlice";

export type { SkillItem };

/**
 * 不再在挂载时自动请求；由 Skills 页在切换到「已安装」tab 时再拉取。
 * 避免点击 Skills 菜单即触发 OpenCode skills 接口（实测约 6.5s），导致体感卡顿。
 */
export function useSkills(directory?: string) {
  const dispatch = useDispatch<AppDispatch>();
  const skills = useSelector((s: RootState) => s.skills.skills);
  const isLoading = useSelector((s: RootState) => s.skills.isLoading);
  const error = useSelector((s: RootState) => s.skills.error);

  const refetch = useCallback(() => {
    return dispatch(fetchSkills(directory));
  }, [dispatch, directory]);

  return { skills, isLoading, error, refetch };
}
