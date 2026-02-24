import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/store";
import { fetchModelOptions } from "@/store/slices/modelOptionsSlice";
import type { ModelOption, ModelOptionGroup } from "@/config/models";

export type { ModelOption, ModelOptionGroup };

export function useModelOptions() {
  const dispatch = useDispatch<AppDispatch>();
  const options = useSelector((s: RootState) => s.modelOptions.options);
  const optionsGrouped = useSelector(
    (s: RootState) => s.modelOptions.optionsGrouped
  );
  const loading = useSelector((s: RootState) => s.modelOptions.loading);
  const error = useSelector((s: RootState) => s.modelOptions.error);
  const status = useSelector((s: RootState) => s.opencode.status);
  const client = useSelector((s: RootState) => s.opencode.client);

  useEffect(() => {
    if (client && status === "connected") {
      void dispatch(fetchModelOptions());
    }
  }, [client, status, dispatch]);

  const refetch = () => void dispatch(fetchModelOptions());

  return { options, optionsGrouped, loading, error, refetch };
}
