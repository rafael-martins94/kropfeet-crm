import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { usePopoverAnchorRect } from "../hooks/usePopoverAnchorRect";
import { cn } from "../utils/cn";
import { classesDoTom, pillClassesForStatusItem, type Tom } from "./StatusBadge";

export interface StatusSelectOption {
  value: string;
  label: string;
  tom?: Tom;
}

function classesDaOpcao(opcao: StatusSelectOption | undefined): string {
  if (opcao?.tom) return classesDoTom(opcao.tom);
  return pillClassesForStatusItem(opcao?.value);
}

type StatusSelectDropdownBaseProps = {
  options: StatusSelectOption[];
  className?: string;
  disabled?: boolean;
  /** Texto do trigger quando nada está marcado (modo múltiplo). */
  emptyLabel?: string;
};

type StatusSelectDropdownProps = StatusSelectDropdownBaseProps &
  (
    | {
        multiple?: false;
        value: string;
        onChange: (value: string) => void;
      }
    | {
        multiple: true;
        value: string[];
        onChange: (value: string[]) => void;
      }
  );

function ChevronDown() {
  return (
    <svg
      className="h-4 w-4 shrink-0 opacity-60"
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

/** Dropdown de status com pills. No modo múltiplo, a lista fica aberta para marcar várias opções. */
export function StatusSelectDropdown(props: StatusSelectDropdownProps) {
  const { options, className, disabled, multiple = false } = props;
  const value = props.value;
  const onChange = props.onChange;
  const emptyLabel = props.emptyLabel ?? "Todas";
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const pos = usePopoverAnchorRect(anchorRef, open, 4);

  const opcoesPainel = multiple ? options.filter((o) => o.value !== "") : options;
  const selecionados = multiple ? (value as string[]) : [];
  const selected = multiple
    ? null
    : (options.find((o) => o.value === value) ?? options[0]);

  const labelTrigger = multiple
    ? selecionados.length === 0
      ? emptyLabel
      : selecionados.length === 1
        ? (options.find((o) => o.value === selecionados[0])?.label ?? emptyLabel)
        : `${selecionados.length} selecionados`
    : (selected?.label ?? "—");

  const opcaoTrigger = multiple
    ? selecionados.length === 1
      ? options.find((o) => o.value === selecionados[0])
      : undefined
    : selected;

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
        aria-multiselectable={multiple || undefined}
        style={{
          position: "fixed",
          top: pos.top,
          left: pos.left,
          width: pos.width,
          zIndex: 10000,
        }}
        className="max-h-72 overflow-auto rounded-lg border border-line bg-surface py-1 shadow-lg"
      >
        {opcoesPainel.map((o) => {
          const ativo = multiple ? selecionados.includes(o.value) : value === o.value;
          return (
            <li key={o.value === "" ? "__all__" : o.value} role="option" aria-selected={ativo}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-brand-50/80",
                  ativo && "bg-brand-50/90",
                )}
                onClick={() => {
                  if (multiple) {
                    const next = ativo
                      ? selecionados.filter((v) => v !== o.value)
                      : [...selecionados, o.value];
                    (onChange as (value: string[]) => void)(next);
                    return;
                  }
                  (onChange as (value: string) => void)(o.value);
                  setOpen(false);
                }}
              >
                {multiple ? (
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]",
                      ativo
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "border-line bg-surface text-transparent",
                    )}
                    aria-hidden
                  >
                    ✓
                  </span>
                ) : null}
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
                    classesDaOpcao(o),
                  )}
                >
                  {o.label}
                </span>
              </button>
            </li>
          );
        })}
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
            "flex min-w-0 flex-1 items-center truncate rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
            multiple && selecionados.length !== 1
              ? "bg-surface-muted text-ink-soft ring-line"
              : classesDaOpcao(opcaoTrigger ?? undefined),
          )}
        >
          {labelTrigger}
        </span>
        <ChevronDown />
      </button>
      {list}
    </div>
  );
}
