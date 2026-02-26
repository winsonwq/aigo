"use client";

import { Toaster as SonnerToaster } from "sonner";

/** shadcn/ui 风格的 Sonner Toaster，用于 toast 提示 */
function Toaster() {
  return (
    <SonnerToaster
      position="bottom-center"
      toastOptions={{
        classNames: {
          toast:
            "group toast border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950",
          success: "border-green-200 dark:border-green-900",
          error: "border-red-200 dark:border-red-900",
        },
      }}
    />
  );
}

export { Toaster };
export { toast } from "sonner";
