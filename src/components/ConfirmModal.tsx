import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
};

type ConfirmModalContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmModalContext = createContext<ConfirmModalContextValue | null>(null);

type State = ConfirmOptions & {
  open: boolean;
  resolve: ((value: boolean) => void) | null;
};

export function ConfirmModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({
    open: false,
    title: "",
    message: "",
    confirmLabel: "确定",
    cancelLabel: "取消",
    variant: "default",
    resolve: null,
  });

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({
        open: true,
        title: options.title,
        message: options.message ?? "",
        confirmLabel: options.confirmLabel ?? "确定",
        cancelLabel: options.cancelLabel ?? "取消",
        variant: options.variant ?? "default",
        resolve,
      });
    });
  }, []);

  const close = useCallback((value: boolean) => {
    setState((prev) => {
      prev.resolve?.(value);
      return {
        ...prev,
        open: false,
        resolve: null,
      };
    });
  }, []);

  const value = useRef({ confirm }).current;
  value.confirm = confirm;

  return (
    <ConfirmModalContext.Provider value={value}>
      {children}
      {state.open &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) close(false);
            }}
          >
            <div
              className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                id="confirm-title"
                className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
              >
                {state.title}
              </h2>
              {state.message ? (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {state.message}
                </p>
              ) : null}
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => close(false)}
                >
                  {state.cancelLabel}
                </Button>
                <Button
                  type="button"
                  variant={state.variant === "destructive" ? "destructive" : "default"}
                  size="sm"
                  onClick={() => close(true)}
                >
                  {state.confirmLabel}
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </ConfirmModalContext.Provider>
  );
}

export function useConfirmModal(): ConfirmModalContextValue {
  const ctx = useContext(ConfirmModalContext);
  if (!ctx) {
    throw new Error("useConfirmModal must be used within ConfirmModalProvider");
  }
  return ctx;
}
