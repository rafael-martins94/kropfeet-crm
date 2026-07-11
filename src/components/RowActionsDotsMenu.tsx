import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconMoreVertical } from "./Icons";
import { cn } from "../utils/cn";

export type RowActionItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
};

interface RowActionsDotsMenuProps {
  label: string;
  items: RowActionItem[];
  className?: string;
}

export function RowActionsDotsMenu({ label, items, className }: RowActionsDotsMenuProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = 168;
      const pad = 8;
      let left = r.right - width;
      left = Math.max(pad, Math.min(left, window.innerWidth - width - pad));
      setPos({ top: r.bottom + 4, left });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

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
        role="menu"
        style={{ position: "fixed", top: pos.top, left: pos.left, width: 168, zIndex: 10000 }}
        className="overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg"
      >
        {items.map((item) => (
          <li key={item.key} role="none">
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-brand-50/80"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
            >
              {item.icon ? <span className="text-ink-soft">{item.icon}</span> : null}
              {item.label}
            </button>
          </li>
        ))}
      </ul>,
      document.body,
    );

  return (
    <div className={cn("relative inline-flex justify-end", className)}>
      <button
        ref={anchorRef}
        type="button"
        className="btn-ghost h-8 w-8 p-0"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        title={label}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <IconMoreVertical width={16} height={16} />
      </button>
      {list}
    </div>
  );
}
