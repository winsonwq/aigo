import * as React from "react";
import { cn } from "@/lib/utils";

function Checkbox({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className={cn(
        "h-4 w-4 rounded border-zinc-300 text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:focus-visible:ring-zinc-700",
        className
      )}
      {...props}
    />
  );
}

export { Checkbox };
