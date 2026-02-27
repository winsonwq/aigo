import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { listen } from "@tauri-apps/api/event";

export type RunOutputRecord = {
  runId: string;
  label: string;
  /** 实际执行的命令，用于在输出区域顶部展示 */
  command?: string;
  skillName?: string;
  key: string;
  stdout: string;
  stderr: string;
  exitCode?: number;
  status: "running" | "done";
};

type RunOutputState = {
  runs: Record<string, RunOutputRecord>;
  addRun: (run: RunOutputRecord) => void;
  getRun: (runId: string) => RunOutputRecord | undefined;
};

const RunOutputContext = createContext<RunOutputState | null>(null);

export function RunOutputProvider({ children }: { children: ReactNode }) {
  const [runs, setRuns] = useState<Record<string, RunOutputRecord>>({});

  const addRun = useCallback((run: RunOutputRecord) => {
    setRuns((prev) => ({ ...prev, [run.runId]: run }));
  }, []);

  const getRun = useCallback(
    (runId: string) => runs[runId],
    [runs]
  );

  useEffect(() => {
    let cancelled = false;
    const unlistenOut = listen<{ run_id: string; stream: string; data: string }>(
      "cmd_output",
      (ev) => {
        if (cancelled) return;
        const { run_id, stream, data } = ev.payload ?? {};
        if (!run_id || !stream) return;
        setRuns((prev) => {
          const r = prev[run_id];
          if (!r) return prev;
          return {
            ...prev,
            [run_id]: {
              ...r,
              stdout: stream === "stdout" ? r.stdout + data : r.stdout,
              stderr: stream === "stderr" ? r.stderr + data : r.stderr,
            },
          };
        });
      }
    );
    const unlistenExit = listen<{ run_id: string; exit_code: number }>(
      "cmd_exit",
      (ev) => {
        if (cancelled) return;
        const { run_id, exit_code } = ev.payload ?? {};
        if (run_id == null) return;
        setRuns((prev) => {
          const r = prev[run_id];
          if (!r) return prev;
          return {
            ...prev,
            [run_id]: {
              ...r,
              status: "done",
              exitCode: exit_code,
            },
          };
        });
      }
    );
    return () => {
      cancelled = true;
      unlistenOut.then((fn) => {
        if (typeof fn === "function") fn();
      }).catch(() => {});
      unlistenExit.then((fn) => {
        if (typeof fn === "function") fn();
      }).catch(() => {});
    };
  }, []);

  const value = useMemo(
    () => ({ runs, addRun, getRun }),
    [runs, addRun, getRun]
  );

  return (
    <RunOutputContext.Provider value={value}>
      {children}
    </RunOutputContext.Provider>
  );
}

export function useRunOutput() {
  const ctx = useContext(RunOutputContext);
  if (!ctx) throw new Error("useRunOutput must be used within RunOutputProvider");
  return ctx;
}
