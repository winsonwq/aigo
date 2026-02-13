import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type DropdownMenuProps = {
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "end";
  className?: string;
};

export function DropdownMenu({
  trigger,
  children,
  align = "end",
  className,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {trigger}
      </div>
      {open && (
        <div
          className={cn(
            "absolute z-50 min-w-[10rem] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900",
            align === "end" ? "right-0" : "left-0"
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

type DropdownMenuItemProps = {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: "default" | "destructive";
};

export function DropdownMenuItem({
  children,
  onClick,
  className,
  variant = "default",
}: DropdownMenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800",
        variant === "destructive"
          ? "text-red-600 dark:text-red-400"
          : "text-zinc-700 dark:text-zinc-300",
        className
      )}
      onClick={() => onClick?.()}
    >
      {children}
    </button>
  );
}
