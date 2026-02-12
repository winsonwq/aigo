import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type ModelOption = { value: string; label: string };

function ModelSelect({
  value,
  options,
  onChange,
  disabled,
  className,
  placeholder = "选择模型",
  placement = "top",
}: {
  value: string;
  options: ModelOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  /** "top" = 选项在按钮上方展开（输入框场景推荐）, "bottom" = 在下方展开 */
  placement?: "top" | "bottom";
}) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
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
          "flex h-8 min-w-0 items-center justify-between gap-2 rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-left text-xs text-zinc-900",
          "hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:ring-zinc-600",
          "w-[200px] max-w-full"
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
          className="absolute bottom-full left-0 z-50 mb-1 max-h-64 w-full overflow-auto rounded-md border border-zinc-200 bg-white py-1 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {options.map((opt) => (
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
                "hover:bg-zinc-100 dark:hover:bg-zinc-800",
                opt.value === value && "bg-zinc-100 dark:bg-zinc-800"
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
