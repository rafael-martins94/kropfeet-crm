import { useState } from "react";
import { SearchInput } from "../SearchInput";
import { SearchableSelectDropdown } from "../SearchableSelectDropdown";
import { StatusItemFilterDropdown } from "../StatusItemFilterDropdown";
import { StatusSelectDropdown } from "../StatusSelectDropdown";
import { SituacaoConferenciaFilterDropdown } from "./SituacaoConferenciaFilterDropdown";
import { statusOpcoesFiltro } from "./itensEstoqueFiltrosConstants";
import type { SituacaoConferenciaFiltro } from "../../services/conferencias-estoque";
import type { RegiaoEstoqueFiltro } from "../../services/itens-estoque";
import type { DisplaySizeSystem } from "../../utils/sizeConversion";
import type { StatusItem } from "../../types/entities";
import { cn } from "../../utils/cn";
import type { SearchableSelectOption } from "../SearchableSelectDropdown";

interface ItensEstoqueFiltrosToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: StatusItem[];
  onStatusChange: (value: StatusItem[]) => void;
  localEstoqueIds: string[];
  onLocalEstoqueIdsChange: (value: string[]) => void;
  categoriaIds?: string[];
  onCategoriaIdsChange?: (value: string[]) => void;
  situacaoConferencia?: SituacaoConferenciaFiltro;
  onSituacaoConferenciaChange?: (value: SituacaoConferenciaFiltro) => void;
  numeracaoFiltro: string;
  onNumeracaoFiltroChange: (value: string) => void;
  opcoesLocalFiltro: SearchableSelectOption[];
  opcoesCategoriaFiltro?: SearchableSelectOption[];
  locaisLoading?: boolean;
  categoriasLoading?: boolean;
  /** Na conferência, troca categoria por situação da conferência. */
  /** No link de pedido, troca o local de estoque pela região. */
  regiaoEstoque?: RegiaoEstoqueFiltro;
  onRegiaoEstoqueChange?: (value: RegiaoEstoqueFiltro) => void;
  displaySizeSystem?: DisplaySizeSystem | "";
  onDisplaySizeSystemChange?: (value: DisplaySizeSystem | "") => void;
  /** Na conferência, troca categoria por situação da conferência. No link, troca o local pela região. */
  variant?: "default" | "conferencia" | "link";
  /** No celular mostra só a busca e um botão "Filtros" que abre o restante. */
  recolherNoCelular?: boolean;
}

export function ItensEstoqueFiltrosToolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  localEstoqueIds,
  onLocalEstoqueIdsChange,
  categoriaIds = [],
  onCategoriaIdsChange,
  situacaoConferencia = "",
  onSituacaoConferenciaChange,
  numeracaoFiltro,
  onNumeracaoFiltroChange,
  opcoesLocalFiltro,
  opcoesCategoriaFiltro = [],
  locaisLoading,
  categoriasLoading,
  variant = "default",
  regiaoEstoque = "",
  onRegiaoEstoqueChange,
  displaySizeSystem = "",
  onDisplaySizeSystemChange,
  recolherNoCelular = false,
}: ItensEstoqueFiltrosToolbarProps) {
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const filtrosAtivos =
    (localEstoqueIds.length > 0 ? 1 : 0) +
    (categoriaIds.length > 0 ? 1 : 0) +
    (situacaoConferencia ? 1 : 0) +
    (regiaoEstoque ? 1 : 0) +
    (displaySizeSystem ? 1 : 0) +
    (numeracaoFiltro.trim() ? 1 : 0);
  // Filtros além da busca: escondidos no celular enquanto recolhidos.
  const extra = recolherNoCelular && !filtrosAbertos ? "max-lg:hidden" : "";
  const gridClass =
    variant === "conferencia"
      ? cn(
          "grid min-w-0 flex-1 items-end gap-x-3 gap-y-4",
          "[grid-template-columns:repeat(auto-fit,minmax(10rem,1fr))]",
          "md:[grid-template-columns:minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.15fr)]",
          "lg:[grid-template-columns:minmax(0,2.35fr)_minmax(0,1.05fr)_minmax(0,1.2fr)_minmax(6.25rem,0.72fr)_minmax(6.25rem,0.72fr)]",
        )
      : variant === "link"
        ? cn(
            "grid min-w-0 flex-1 items-end gap-x-3 gap-y-4",
            "[grid-template-columns:repeat(auto-fit,minmax(10rem,1fr))]",
            "lg:[grid-template-columns:minmax(0,1.15fr)_minmax(0,0.9fr)_minmax(0,0.95fr)_minmax(0,1fr)_minmax(6.5rem,0.65fr)_minmax(0,1.3fr)]",
          )
        : cn(
            "grid min-w-0 flex-1 items-end gap-x-3 gap-y-4",
            "[grid-template-columns:repeat(auto-fit,minmax(10rem,1fr))]",
            "lg:[grid-template-columns:minmax(0,2.1fr)_minmax(0,1.05fr)_minmax(0,1.15fr)_minmax(0,1.05fr)_minmax(0,0.85fr)]",
          );

  return (
    <div className={cn("border-b border-line py-4", recolherNoCelular ? "px-4 lg:px-5" : "px-5")}>
      <div className={gridClass}>
        <div className="flex min-w-0 w-full items-center gap-2">
          <SearchInput
            placeholder="Buscar por SKU ou nome do produto…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            wrapperClassName="min-w-0 w-full"
          />
          {recolherNoCelular ? (
            <button
              type="button"
              onClick={() => setFiltrosAbertos((aberto) => !aberto)}
              aria-expanded={filtrosAbertos}
              className={cn(
                "flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold lg:hidden",
                filtrosAbertos || filtrosAtivos > 0
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-line bg-surface text-ink",
              )}
            >
              Filtros
              {filtrosAtivos > 0 ? (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-700 px-1.5 text-xs text-white tabular-nums">
                  {filtrosAtivos}
                </span>
              ) : null}
            </button>
          ) : null}
        </div>
        <div className={cn("flex min-w-0 w-full flex-col gap-1.5", extra, variant === "link" && recolherNoCelular && "max-lg:hidden")}>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
            Status
          </span>
          <StatusItemFilterDropdown
            multiple
            value={status}
            options={statusOpcoesFiltro}
            emptyLabel="Todos os status"
            className="w-full min-w-0"
            onChange={onStatusChange}
          />
        </div>
        {variant === "link" ? (
          <div className={cn("flex min-w-0 w-full flex-col gap-1.5", extra)}>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              Região
            </span>
            <StatusSelectDropdown
              value={regiaoEstoque}
              options={[
                { value: "", label: "Todas as regiões", tom: "neutro" },
                { value: "br", label: "Brasil", tom: "brand" },
                { value: "eu", label: "Europa", tom: "info" },
              ]}
              onChange={(valor) => onRegiaoEstoqueChange?.(valor as RegiaoEstoqueFiltro)}
              className="w-full min-w-0"
            />
          </div>
        ) : (
          <SearchableSelectDropdown
            multiple
            label="Local de estoque"
            value={localEstoqueIds}
            options={opcoesLocalFiltro}
            emptyLabel="Todos os locais"
            loading={locaisLoading}
            searchPlaceholder="Buscar local…"
            triggerClassName="w-full min-w-0"
            onChange={onLocalEstoqueIdsChange}
            className={cn("min-w-0 w-full", extra)}
          />
        )}
        {variant === "conferencia" ? (
          <SituacaoConferenciaFilterDropdown
            value={situacaoConferencia}
            onChange={(v) => onSituacaoConferenciaChange?.(v)}
            className={cn("min-w-0 w-full", extra)}
          />
        ) : (
          <SearchableSelectDropdown
            multiple
            label="Categoria (modelo)"
            value={categoriaIds}
            options={opcoesCategoriaFiltro}
            emptyLabel="Todas as categorias"
            loading={categoriasLoading}
            searchPlaceholder="Buscar categoria…"
            triggerClassName="w-full min-w-0"
            onChange={onCategoriaIdsChange ?? (() => {})}
            className={cn("min-w-0 w-full", extra)}
          />
        )}
        {variant === "link" ? (
          <div className={cn("flex min-w-0 w-full flex-col gap-1.5", extra)}>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              Padrão
            </span>
            <StatusSelectDropdown
              value={displaySizeSystem}
              options={[
                { value: "", label: "—", tom: "neutro" },
                { value: "br", label: "BR", tom: "brand" },
                { value: "eu", label: "EU", tom: "info" },
                { value: "us", label: "US", tom: "teal" },
              ]}
              onChange={(valor) => onDisplaySizeSystemChange?.(valor as DisplaySizeSystem | "")}
              className="w-full min-w-0"
            />
          </div>
        ) : null}
        <div className={cn("flex min-w-0 w-full flex-col gap-1.5", extra)}>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
            Numeração
          </span>
          <SearchInput
            placeholder="Ex.: US 6, BR37…"
            value={numeracaoFiltro}
            onChange={(e) => onNumeracaoFiltroChange(e.target.value)}
            wrapperClassName="min-w-0 w-full"
          />
        </div>
      </div>
    </div>
  );
}
