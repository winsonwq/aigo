import * as React from "react";
import { cn } from "@/lib/utils";

export type SuggestionListVariant = "bordered" | "filled";

export type SuggestionListProps = React.ComponentProps<"div"> & {
  /** 列表容器样式变体：bordered 带边框，filled 无边框仅背景 */
  variant?: SuggestionListVariant;
};

/** 用于 @ / 等建议列表的容器，支持 bordered / filled 两种视觉变体 */
function SuggestionList({
  variant = "filled",
  className,
  ...props
}: SuggestionListProps) {
  return (
    <div
      role="listbox"
      data-suggestion-variant={variant}
      className={cn(
        "absolute z-50 min-w-[160px] rounded-lg py-1",
        variant === "bordered"
          ? "border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
          : "border-0 bg-zinc-100 shadow-md dark:bg-zinc-800",
        className
      )}
      {...props}
    />
  );
}

export { SuggestionList };
