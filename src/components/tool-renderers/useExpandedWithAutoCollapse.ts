import { useEffect, useState } from "react";

/**
 * 非完成时默认展开，完成后自动收起；用户可随时点击展开/收起。
 * 当从「完成」再次变为「进行中」时自动重新展开。
 *
 * @param defaultOpen 当前是否应视为「进行中」（由调用方根据 part 状态计算）
 * @param isCompleted 当前是否已完成（completed/error 等）
 */
export function useExpandedWithAutoCollapse(
  defaultOpen: boolean,
  isCompleted: boolean
): [expanded: boolean, setExpanded: (value: boolean | ((prev: boolean) => boolean)) => void] {
  const [expanded, setExpanded] = useState(defaultOpen);

  useEffect(() => {
    if (isCompleted) {
      setExpanded(false);
    } else if (defaultOpen) {
      setExpanded(true);
    }
  }, [defaultOpen, isCompleted]);

  return [expanded, setExpanded];
}
