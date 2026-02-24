import { useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/store";
import { fetchSkills, type SkillItem } from "@/store/slices/skillsSlice";

export type { SkillItem };

export function useSkills(directory?: string) {
  const dispatch = useDispatch<AppDispatch>();
  const skills = useSelector((s: RootState) => s.skills.skills);
  const isLoading = useSelector((s: RootState) => s.skills.isLoading);
  const error = useSelector((s: RootState) => s.skills.error);

  const refetch = useCallback(() => {
    void dispatch(fetchSkills(directory));
  }, [dispatch, directory]);

  useEffect(() => {
    void dispatch(fetchSkills(directory));
  }, [directory, dispatch]);

  return { skills, isLoading, error, refetch };
}
