import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * 行列表容器。无外框、无内边距，仅提供语义与布局。
 * 与 ListRow / ListFooter 配合使用，适用于需要「每行 border-bottom + hover」的列表场景。
 */
const List = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(function List({ className, ...props }, ref) {
  return (
    <ul
      ref={ref}
      role="list"
      className={cn("flex flex-col gap-0 [&>li:last-child>div]:border-b-0", className)}
      {...props}
    />
  );
});

/**
 * 单行容器：底部边框 + 悬停背景。内容由 children 自由组合。
 */
const ListRow = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(function ListRow({ className, ...props }, ref) {
  return (
    <li>
      <div
        ref={ref}
        className={cn(
          "flex items-center gap-3 py-2 px-3 border-b border-zinc-200 dark:border-zinc-700",
          "hover:bg-zinc-100 dark:hover:bg-zinc-800/50",
          className
        )}
        {...props}
      />
    </li>
  );
});

/**
 * 列表底部占位行（如「加载更多」）。无 border-bottom，不参与「最后一行去底线」的规则。
 */
const ListFooter = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(function ListFooter({ className, ...props }, ref) {
  return (
    <li>
      <div
        ref={ref}
        className={cn("py-3 flex justify-center", className)}
        {...props}
      />
    </li>
  );
});

export { List, ListRow, ListFooter };
