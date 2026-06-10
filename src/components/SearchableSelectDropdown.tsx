import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePopoverAnchorRect } from "../hooks/usePopoverAnchorRect";
import { cn } from "../utils/cn";
import { IconSearch } from "./Icons";

export interface SearchableSelectOption {
  value: string;
  label: string;
  imageUrl?: string | null;
}

type SearchableSelectDropdownBaseProps = {
  options: SearchableSelectOption[];
  /** Rótulo acima do campo (opcional). */
  label?: string;
  /** Placeholder da busca dentro do painel. */
  searchPlaceholder?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  /** Classes extras no botão do trigger (permite afiar largura em filtros específicos). */
  triggerClassName?: string;
  /** Texto do trigger quando nenhuma opção está selecionada (modo múltiplo). */
  emptyLabel?: string;
};

export type SearchableSelectDropdownProps = SearchableSelectDropdownBaseProps &
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

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      className={cn(
        "h-4 w-4 shrink-0 text-ink-muted transition-transform duration-200",
        open && "rotate-180",
      )}
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

function OptionThumb({ url, label }: { url?: string | null; label: string }) {
  if (!url) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface-subtle text-ink-faint">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
      </span>
    );
  }

  return (
    <img
      src={url}
      alt=""
      className="h-8 w-8 shrink-0 rounded-md border border-line bg-surface-subtle object-cover"
      loading="lazy"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

function normalizeBusca(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function labelTriggerMulti(
  value: string[],
  options: SearchableSelectOption[],
  emptyLabel: string,
): string {
  if (value.length === 0) return emptyLabel;
  if (value.length === 1) {
    return options.find((o) => o.value === value[0])?.label ?? emptyLabel;
  }
  return `${value.length} selecionados`;
}

/** Dropdown com campo de busca; painel em portal `fixed` para não ser cortado por overflow do pai. */
export function SearchableSelectDropdown(props: SearchableSelectDropdownProps) {
  const {
    options,
    label,
    searchPlaceholder = "Buscar…",
    disabled,
    loading,
    className,
    triggerClassName,
    multiple = false,
  } = props;
  const value = props.value;
  const onChange = props.onChange;
  const emptyLabel = props.emptyLabel ?? "Selecionar";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const pos = usePopoverAnchorRect(anchorRef, open);

  const selected = useMemo(() => {
    if (multiple) return null;
    return options.find((o) => o.value === value);
  }, [multiple, options, value]);

  const opcoesPainel = useMemo(
    () => (multiple ? options.filter((o) => o.value !== "") : options),
    [multiple, options],
  );

  const filtradas = useMemo(() => {
    const q = normalizeBusca(query);
    if (!q) return opcoesPainel;
    return opcoesPainel.filter((o) => normalizeBusca(o.label).includes(q));
  }, [opcoesPainel, query]);

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

  useEffect(() => {
    if (open) {
      setQuery("");
      queueMicrotask(() => searchRef.current?.focus());
    }
  }, [open]);

  const labelTrigger = loading
    ? "Carregando…"
    : multiple
      ? labelTriggerMulti(value as string[], options, emptyLabel)
      : selected?.label ?? emptyLabel;

  const triggerBtn = (
    <button
      ref={anchorRef}
      type="button"
      disabled={disabled || loading}
      aria-expanded={open}
      aria-haspopup="listbox"
      className={cn(
        "group flex h-[38px] w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-left text-sm text-ink shadow-sm transition-all",
        "hover:border-brand-400/35 hover:bg-brand-50/40 hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        (disabled || loading) && "cursor-not-allowed opacity-60 hover:border-line hover:bg-surface hover:shadow-sm",
        triggerClassName,
      )}
      onClick={() => !(disabled || loading) && setOpen((o) => !o)}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {!multiple && selected?.imageUrl ? (
          <OptionThumb url={selected.imageUrl} label={selected.label} />
        ) : null}
        <span className="min-w-0 flex-1 truncate font-medium">{labelTrigger}</span>
      </span>
      <ChevronDown open={open} />
    </button>
  );

  const panel =
    open &&
    createPortal(
      <div
        ref={panelRef}
        style={{
          position: "fixed",
          top: pos.top,
          left: pos.left,
          width: pos.width,
          zIndex: 10000,
        }}
        className="overflow-hidden rounded-xl border border-line bg-surface shadow-xl ring-1 ring-black/[0.06]"
        role="presentation"
      >
        <div className="border-b border-line/80 bg-brand-500/[0.04] p-2">
          <div className="relative">
            <IconSearch
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint"
              width={15}
              height={15}
            />
            <input
              ref={searchRef}
              type="search"
              autoComplete="off"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input-base w-full rounded-lg border-brand-200/50 bg-surface py-2 pl-8 pr-3 text-sm placeholder:text-ink-faint focus:border-brand-400/60 focus:ring-brand-500/25"
              aria-label={searchPlaceholder}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>
        <ul
          role="listbox"
          className="max-h-[min(18rem,45vh)] overflow-y-auto overscroll-contain py-1"
        >
          {filtradas.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-ink-soft">
              Nenhum resultado para “{query.trim()}”.
            </li>
          ) : (
            filtradas.map((o) => {
              const ativo = multiple
                ? (value as string[]).includes(o.value)
                : value === o.value;
              return (
                <li key={o.value === "" ? "__all__" : o.value} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={ativo}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors",
                      ativo
                        ? "bg-brand-500/[0.12] font-semibold text-brand-900"
                        : "text-ink hover:bg-brand-50/90",
                    )}
                    onClick={() => {
                      if (multiple) {
                        const selecionados = value as string[];
                        const next = ativo
                          ? selecionados.filter((v) => v !== o.value)
                          : [...selecionados, o.value];
                        (onChange as (value: string[]) => void)(next);
                      } else {
                        (onChange as (value: string) => void)(o.value);
                        setOpen(false);
                      }
                    }}
                  >
                    {o.imageUrl ? <OptionThumb url={o.imageUrl} label={o.label} /> : null}
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center border text-[10px]",
                        multiple ? "rounded" : "rounded-full",
                        ativo
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-line bg-surface text-transparent",
                      )}
                      aria-hidden
                    >
                      ✓
                    </span>
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>,
      document.body,
    );

  return (
    <div className={cn("relative w-full min-w-0", className)}>
      {label ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
            {label}
          </span>
          {triggerBtn}
        </div>
      ) : (
        triggerBtn
      )}
      {panel}
    </div>
  );
}
