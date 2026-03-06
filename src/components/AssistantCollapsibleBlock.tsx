import { ChevronDown, ChevronRight } from "lucide-react";

/**
 * 根据「进行中 / 已完成」范式返回当前应显示的标签。
 * 例如：Thinking ↔ Thought，Calling ↔ Called，Skill ↔ Skilled 等。
 */
export function getBlockLabel(
  labelActive: string,
  labelDone: string,
  isActive: boolean
): string {
  return isActive ? labelActive : labelDone;
}

export type AssistantCollapsibleBlockProps = {
  /** 当前显示的标题文案（可由 getBlockLabel 生成） */
  label: string;
  /** 是否展开 */
  open: boolean;
  /** 点击标题行时 */
  onSummaryClick: (e: React.MouseEvent) => void;
  /** 标题行右侧可选内容（箭头之后），如 Badge、工具名等 */
  summarySuffix?: React.ReactNode;
  /** 展开后的内容 */
  children?: React.ReactNode;
};

/**
 * 助手消息中的可折叠区块通用组件。
 * 用于 Thinking/Thought、Calling/Called 等统一样式与交互。
 */
export function AssistantCollapsibleBlock({
  label,
  open,
  onSummaryClick,
  summarySuffix,
  children,
}: AssistantCollapsibleBlockProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSummaryClick(e as unknown as React.MouseEvent);
    }
  };
  return (
    <div className="text-sm text-zinc-500 dark:text-zinc-400">
      <div
        role="button"
        tabIndex={0}
        onClick={onSummaryClick}
        onKeyDown={handleKeyDown}
        className="flex w-full cursor-pointer list-none items-center gap-1.5 py-0.5 text-left"
      >
        <span className="font-medium">{label}</span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" />
        )}
        {summarySuffix}
      </div>
      {open && children != null && (
        <div className="assistant-collapsible-content mt-2 text-zinc-600 dark:text-zinc-400">
          {children}
        </div>
      )}
    </div>
  );
}
