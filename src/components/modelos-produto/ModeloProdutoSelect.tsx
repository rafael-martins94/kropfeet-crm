import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconImage, IconPlus, IconSearch } from "../Icons";
import { useDebounce } from "../../hooks/useDebounce";
import { usePopoverAnchorRect } from "../../hooks/usePopoverAnchorRect";
import { modelosProdutoService } from "../../services/modelos-produto";
import { cn } from "../../utils/cn";

export type ModeloOpcao = {
  id: string;
  nome_modelo: string;
  imagem_url?: string | null;
};

type ModeloProdutoSelectProps = {
  value: string;
  onChange: (id: string, modelo?: ModeloOpcao) => void;
  label?: string;
  disabled?: boolean;
  emptyLabel?: string;
  className?: string;
  /** Botão para abrir cadastro rápido. */
  onNovoModelo?: () => void;
  /** Modelo já conhecido (edição) para exibir no trigger. */
  modeloSelecionado?: ModeloOpcao | null;
};

function ModeloThumb({
  url,
  alt,
  size = "sm",
}: {
  url?: string | null;
  alt: string;
  size?: "sm" | "md";
}) {
  const box = size === "md" ? "h-10 w-10" : "h-8 w-8";
  if (url) {
    return (
      <img
        src={url}
        alt={alt}
        className={cn(box, "shrink-0 rounded-md border border-line object-cover")}
      />
    );
  }
  return (
    <span
      className={cn(
        box,
        "inline-flex shrink-0 items-center justify-center rounded-md border border-line bg-surface-subtle text-ink-faint",
      )}
      aria-hidden
    >
      <IconImage width={size === "md" ? 18 : 14} height={size === "md" ? 18 : 14} />
    </span>
  );
}

export function ModeloProdutoSelect({
  value,
  onChange,
  label = "Modelo de produto",
  disabled,
  emptyLabel = "— Selecione o modelo —",
  className,
  onNovoModelo,
  modeloSelecionado: modeloProp,
}: ModeloProdutoSelectProps) {
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [opcoes, setOpcoes] = useState<ModeloOpcao[]>([]);
  const [totalResultados, setTotalResultados] = useState(0);
  const [selecionadoCache, setSelecionadoCache] = useState<ModeloOpcao | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const pos = usePopoverAnchorRect(anchorRef, open);
  const queryDebounced = useDebounce(query, 280);

  const selecionado =
    (modeloProp && modeloProp.id === value
      ? {
          ...modeloProp,
          imagem_url: modeloProp.imagem_url ?? selecionadoCache?.imagem_url,
        }
      : null) ||
    (selecionadoCache && selecionadoCache.id === value ? selecionadoCache : null) ||
    opcoes.find((o) => o.id === value) ||
    null;

  useEffect(() => {
    if (!value) {
      setSelecionadoCache(null);
      return;
    }
    // Já temos opção completa (ex.: escolhida na lista)
    if (
      selecionadoCache?.id === value &&
      selecionadoCache.nome_modelo &&
      selecionadoCache.imagem_url !== undefined
    ) {
      return;
    }

    let cancelado = false;
    Promise.all([
      modelosProdutoService.obter(value),
      modelosProdutoService.listarUrlsPorModelos([value]),
    ])
      .then(([m, urls]) => {
        if (cancelado || !m) return;
        setSelecionadoCache({
          id: m.id,
          nome_modelo: m.nome_modelo,
          imagem_url: urls[m.id] ?? null,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, [value, selecionadoCache]);

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    setLoading(true);
    const pageSize = 100;
    modelosProdutoService
      .listarComRelacoes({
        page: 1,
        pageSize,
        search: queryDebounced,
        orderBy: "nome_modelo",
        ascending: true,
      })
      .then(async (res) => {
        if (cancelado) return;
        setTotalResultados(res.total);
        const base = res.data.map((m) => ({
          id: m.id,
          nome_modelo: m.nome_modelo,
        }));
        const urls = await modelosProdutoService.listarUrlsPorModelos(base.map((m) => m.id));
        if (cancelado) return;
        setOpcoes(
          base.map((m) => ({
            ...m,
            imagem_url: urls[m.id] ?? null,
          })),
        );
      })
      .catch(() => {
        if (!cancelado) {
          setOpcoes([]);
          setTotalResultados(0);
        }
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [open, queryDebounced]);

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
    if (open) {
      setQuery("");
      queueMicrotask(() => searchRef.current?.focus());
    }
  }, [open]);

  const escolher = (opcao: ModeloOpcao) => {
    const completo = { ...opcao, imagem_url: opcao.imagem_url ?? null };
    setSelecionadoCache(completo);
    onChange(opcao.id, completo);
    setOpen(false);
  };

  return (
    <div className={cn("space-y-1", className)}>
      {label ? (
        <label htmlFor={fieldId} className="label-base">
          {label}
        </label>
      ) : null}
      <button
        ref={anchorRef}
        id={fieldId}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "group flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-line bg-surface px-2.5 py-1.5 text-left text-sm text-ink shadow-sm transition-all",
          "hover:border-brand-400/35 hover:bg-brand-50/40 hover:shadow-md",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
          disabled && "cursor-not-allowed opacity-60",
        )}
        onClick={() => !disabled && setOpen((o) => !o)}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2.5">
          {selecionado ? (
            <ModeloThumb url={selecionado.imagem_url} alt={selecionado.nome_modelo} />
          ) : (
            <ModeloThumb url={null} alt="" />
          )}
          <span className="min-w-0 flex-1 truncate font-medium">
            {selecionado?.nome_modelo ?? emptyLabel}
          </span>
        </span>
        <svg
          className={cn("h-4 w-4 shrink-0 text-ink-muted transition-transform", open && "rotate-180")}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && pos
        ? createPortal(
            <div
              ref={panelRef}
              className="fixed z-[80] overflow-hidden rounded-xl border border-line bg-surface shadow-elevated"
              style={{
                top: pos.top,
                left: pos.left,
                width: Math.max(pos.width, 320),
              }}
            >
              <div className="border-b border-line p-2">
                <div className="relative">
                  <IconSearch
                    width={14}
                    height={14}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint"
                  />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar modelo…"
                    className="input-base h-9 pl-8 text-sm"
                  />
                </div>
              </div>
              {onNovoModelo ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 border-b border-line px-3 py-2.5 text-left text-sm font-medium text-brand-700 hover:bg-brand-50/60"
                  onClick={() => {
                    setOpen(false);
                    onNovoModelo();
                  }}
                >
                  <IconPlus width={14} height={14} />
                  Cadastrar novo modelo
                </button>
              ) : null}
              <div className="max-h-72 overflow-y-auto py-1" role="listbox">
                {loading ? (
                  <p className="px-3 py-3 text-sm text-ink-soft">Buscando…</p>
                ) : opcoes.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-ink-soft">Nenhum modelo encontrado.</p>
                ) : (
                  opcoes.map((opcao) => (
                    <button
                      key={opcao.id}
                      type="button"
                      role="option"
                      aria-selected={opcao.id === value}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition hover:bg-surface-subtle",
                        opcao.id === value && "bg-brand-50/70 text-brand-800",
                      )}
                      onClick={() => escolher(opcao)}
                    >
                      <ModeloThumb url={opcao.imagem_url} alt={opcao.nome_modelo} size="md" />
                      <span className="min-w-0 flex-1 truncate font-medium">{opcao.nome_modelo}</span>
                    </button>
                  ))
                )}
              </div>
              {!loading && totalResultados > opcoes.length ? (
                <p className="border-t border-line px-3 py-2 text-xs text-ink-soft">
                  Mostrando {opcoes.length} de {totalResultados} — refine a busca para ver mais.
                </p>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
