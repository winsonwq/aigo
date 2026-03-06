import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type ModelOption = { value: string; label: string };

/** 分组：label 为组名，options 为该组下的模型 */
export type ModelOptionGroup = { label: string; options: ModelOption[] };

export type ModelSelectVariant = "bordered" | "filled";

function isGrouped(
  options: ModelOption[] | ModelOptionGroup[]
): options is ModelOptionGroup[] {
  return (
    options.length > 0 &&
    "options" in options[0] &&
    Array.isArray((options[0] as ModelOptionGroup).options)
  );
}

function flattenOptions(options: ModelOption[] | ModelOptionGroup[]): ModelOption[] {
  return isGrouped(options) ? options.flatMap((g) => g.options) : options;
}

function ModelSelect({
  value,
  options,
  onChange,
  disabled,
  className,
  placeholder = "选择模型",
  placement = "top",
  variant = "bordered",
}: {
  value: string;
  /** 扁平列表或按组分组的列表（分组时按组展示，free 等由上层排序） */
  options: ModelOption[] | ModelOptionGroup[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  /** "top" = 选项在按钮上方展开（输入框场景推荐）, "bottom" = 在下方展开 */
  placement?: "top" | "bottom";
  /** bordered = 带边框，filled = 无边框仅背景 */
  variant?: ModelSelectVariant;
}) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const isTop = placement === "top";

  const flatOptions = React.useMemo(() => flattenOptions(options), [options]);
  const selected = flatOptions.find((o) => o.value === value);
  const displayLabel = selected?.label ?? selected?.value ?? (value || placeholder);

  React.useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={cn(
          "flex h-8 min-w-0 items-center justify-between gap-2 rounded-md px-2.5 py-1 text-left text-xs text-zinc-900",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "w-[160px] max-w-full",
          variant === "bordered" &&
            "border border-zinc-300 bg-white hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:ring-zinc-600",
          variant === "filled" &&
            "border-0 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 dark:focus-visible:ring-zinc-600"
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="选择模型"
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-zinc-500 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <ul
          role="listbox"
          className={cn(
            "absolute left-0 z-50 max-h-64 w-full overflow-auto rounded-md shadow-lg",
            isTop ? "bottom-full mb-1" : "top-full mt-1",
            variant === "bordered" &&
              "border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900",
            variant === "filled" &&
              "border-0 bg-zinc-100 dark:bg-zinc-800"
          )}
        >
          {isGrouped(options)
            ? options.map((group) => (
                <li key={group.label} role="none" className="list-none">
                  <div
                    className={cn(
                      "sticky top-0 z-10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400",
                      variant === "bordered" &&
                        "bg-white dark:bg-zinc-900",
                      variant === "filled" &&
                        "bg-zinc-100 dark:bg-zinc-800"
                    )}
                  >
                    {group.label}
                  </div>
                  <ul role="group" aria-label={group.label} className="list-none">
                    {group.options.map((opt) => (
                      <li
                        key={opt.value}
                        role="option"
                        aria-selected={opt.value === value}
                        onClick={() => {
                          onChange(opt.value);
                          setOpen(false);
                        }}
                        className={cn(
                          "cursor-pointer px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100",
                          variant === "bordered" &&
                            "hover:bg-zinc-100 dark:hover:bg-zinc-800",
                          variant === "filled" &&
                            "hover:bg-zinc-200 dark:hover:bg-zinc-700",
                          opt.value === value &&
                            (variant === "bordered"
                              ? "bg-zinc-100 dark:bg-zinc-800"
                              : "bg-zinc-200 dark:bg-zinc-700")
                        )}
                      >
                        <span className="block truncate font-medium">{opt.label}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))
            : options.map((opt) => (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={opt.value === value}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "cursor-pointer px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100",
                    variant === "bordered" &&
                      "hover:bg-zinc-100 dark:hover:bg-zinc-800",
                    variant === "filled" &&
                      "hover:bg-zinc-200 dark:hover:bg-zinc-700",
                    opt.value === value &&
                      (variant === "bordered"
                        ? "bg-zinc-100 dark:bg-zinc-800"
                        : "bg-zinc-200 dark:bg-zinc-700")
                  )}
                >
                  <span className="block truncate font-medium">{opt.label}</span>
                </li>
              ))}
        </ul>
      )}
    </div>
  );
}

export { ModelSelect };
