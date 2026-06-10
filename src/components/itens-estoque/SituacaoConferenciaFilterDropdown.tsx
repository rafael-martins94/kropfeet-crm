import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { usePopoverAnchorRect } from "../../hooks/usePopoverAnchorRect";
import {
  situacaoConferenciaOpcoes,
  type SituacaoConferenciaFiltro,
} from "../../services/conferencias-estoque";
import { cn } from "../../utils/cn";

interface SituacaoConferenciaFilterDropdownProps {
  value: SituacaoConferenciaFiltro;
  onChange: (value: SituacaoConferenciaFiltro) => void;
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

export function SituacaoConferenciaFilterDropdown({
  value,
  onChange,
  className,
  disabled,
}: SituacaoConferenciaFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const pos = usePopoverAnchorRect(anchorRef, open, 4);

  const selected =
    situacaoConferenciaOpcoes.find((o) => o.value === value) ?? situacaoConferenciaOpcoes[0];

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
        {situacaoConferenciaOpcoes.map((o) => {
          const ativo = value === o.value;
          return (
            <li key={o.value === "" ? "__all__" : o.value} role="option" aria-selected={ativo}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-brand-50/80",
                  ativo && "bg-brand-50/90 font-medium text-brand-900",
                )}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {o.label}
              </button>
            </li>
          );
        })}
      </ul>,
      document.body,
    );

  return (
    <div className={cn("relative w-full min-w-0", className)}>
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
          Situação
        </span>
        <button
          ref={anchorRef}
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="listbox"
          className={cn(
            "input-base flex h-[38px] w-full items-center justify-between gap-1.5 px-2.5 py-2 text-left text-sm",
            disabled && "cursor-not-allowed opacity-60",
          )}
          onClick={() => !disabled && setOpen((o) => !o)}
        >
          <span className="min-w-0 flex-1 truncate font-medium">{selected.label}</span>
          <ChevronDown />
        </button>
      </div>
      {list}
    </div>
  );
}
