import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { usePopoverAnchorRect } from "../hooks/usePopoverAnchorRect";
import { cn } from "../utils/cn";
import { pillClassesForStatusItem } from "./StatusBadge";
import type { StatusItem } from "../types/entities";

export interface StatusItemFilterOption {
  value: StatusItem | "";
  label: string;
}

interface StatusItemFilterDropdownProps {
  value: StatusItem | "";
  options: StatusItemFilterOption[];
  onChange: (value: StatusItem | "") => void;
  className?: string;
  disabled?: boolean;
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-4 w-4 shrink-0 opacity-60", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Filtro de status com pills; lista em portal para não ser cortada por overflow do pai. */
export function StatusItemFilterDropdown({
  value,
  options,
  onChange,
  className,
  disabled,
}: StatusItemFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const pos = usePopoverAnchorRect(anchorRef, open, 4);

  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const list =
    open &&
    createPortal(
      <ul
        ref={panelRef}
        role="listbox"
        style={{
          position: "fixed",
          top: pos.top,
          left: pos.left,
          width: pos.width,
          zIndex: 10000,
        }}
        className="max-h-72 overflow-auto rounded-lg border border-line bg-surface py-1 shadow-lg"
      >
        {options.map((o) => (
          <li
            key={o.value === "" ? "__all__" : o.value}
            role="option"
            aria-selected={value === o.value}
          >
            <button
              type="button"
              className={cn(
                "flex w-full items-center px-3 py-2 text-left transition-colors hover:bg-brand-50/80",
                value === o.value && "bg-brand-50/90",
              )}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
                  pillClassesForStatusItem(o.value),
                )}
              >
                {o.label}
              </span>
            </button>
          </li>
        ))}
      </ul>,
      document.body,
    );

  return (
    <div className={cn("relative w-full min-w-0", className)}>
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "input-base flex w-full items-center justify-between gap-2 py-2.5 text-left",
          disabled && "cursor-not-allowed opacity-60",
        )}
        onClick={() => !disabled && setOpen((o) => !o)}
      >
        <span
          className={cn(
            "inline-flex min-w-0 max-w-[calc(100%-1.5rem)] items-center truncate rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
            pillClassesForStatusItem(selected?.value),
          )}
        >
          {selected?.label ?? "—"}
        </span>
        <ChevronDown />
      </button>
      {list}
    </div>
  );
}
