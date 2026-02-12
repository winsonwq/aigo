import * as React from "react";
import { cn } from "@/lib/utils";

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<"div"> & {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
}) {
  return (
    <div
      role={decorative ? "none" : "separator"}
      aria-orientation={orientation}
      data-orientation={orientation}
      data-slot="separator"
      className={cn(
        "shrink-0 bg-zinc-200 dark:bg-zinc-800",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className
      )}
      {...props}
    />
  );
}

export { Separator };
