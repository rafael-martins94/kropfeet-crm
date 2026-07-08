import { SearchInput } from "../SearchInput";
import { SearchableSelectDropdown } from "../SearchableSelectDropdown";
import { StatusItemFilterDropdown } from "../StatusItemFilterDropdown";
import { SituacaoConferenciaFilterDropdown } from "./SituacaoConferenciaFilterDropdown";
import { statusOpcoesFiltro } from "./itensEstoqueFiltrosConstants";
import type { SituacaoConferenciaFiltro } from "../../services/conferencias-estoque";
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
  variant?: "default" | "conferencia";
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
}: ItensEstoqueFiltrosToolbarProps) {
  const gridClass =
    variant === "conferencia"
      ? cn(
          "grid min-w-0 flex-1 items-end gap-x-3 gap-y-4",
          "[grid-template-columns:repeat(auto-fit,minmax(10rem,1fr))]",
          "md:[grid-template-columns:minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.15fr)]",
          "lg:[grid-template-columns:minmax(0,2.35fr)_minmax(0,1.05fr)_minmax(0,1.2fr)_minmax(6.25rem,0.72fr)_minmax(6.25rem,0.72fr)]",
        )
      : cn(
          "grid min-w-0 flex-1 items-end gap-x-3 gap-y-4",
          "[grid-template-columns:repeat(auto-fit,minmax(10rem,1fr))]",
          "lg:[grid-template-columns:minmax(0,2.1fr)_minmax(0,1.05fr)_minmax(0,1.15fr)_minmax(0,1.05fr)_minmax(0,0.85fr)]",
        );

  return (
    <div className="border-b border-line px-5 py-4">
      <div className={gridClass}>
        <SearchInput
          placeholder="Buscar por SKU ou nome do produto…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          wrapperClassName="min-w-0 w-full"
        />
        <div className="flex min-w-0 w-full flex-col gap-1.5">
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
          className="min-w-0 w-full"
        />
        {variant === "conferencia" ? (
          <SituacaoConferenciaFilterDropdown
            value={situacaoConferencia}
            onChange={(v) => onSituacaoConferenciaChange?.(v)}
            className="min-w-0 w-full"
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
            className="min-w-0 w-full"
          />
        )}
        <div className="flex min-w-0 w-full flex-col gap-1.5">
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
