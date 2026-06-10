import {
  padraoNumeracaoOpcoes,
  regiaoEstoqueOpcoes,
} from "./itensEstoqueFiltrosConstants";
import type { RegiaoEstoqueFiltro } from "../../services/itens-estoque";
import type { DisplaySizeSystem } from "../../utils/sizeConversion";

interface ItensEstoqueHeaderControlsProps {
  displaySizeSystem: DisplaySizeSystem;
  onDisplaySizeSystemChange: (value: DisplaySizeSystem) => void;
  regiaoEstoque: RegiaoEstoqueFiltro;
  onRegiaoEstoqueChange: (value: RegiaoEstoqueFiltro) => void;
}

export function ItensEstoqueHeaderControls({
  displaySizeSystem,
  onDisplaySizeSystemChange,
  regiaoEstoque,
  onRegiaoEstoqueChange,
}: ItensEstoqueHeaderControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft shadow-sm">
        <span>Padrão</span>
        <select
          value={displaySizeSystem}
          onChange={(e) => onDisplaySizeSystemChange(e.target.value as DisplaySizeSystem)}
          className="bg-transparent text-xs font-semibold text-ink outline-none"
          aria-label="Padrão de numeração"
        >
          {padraoNumeracaoOpcoes.map((opcao) => (
            <option key={opcao.value} value={opcao.value}>
              {opcao.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft shadow-sm">
        <span>Região</span>
        <select
          value={regiaoEstoque}
          onChange={(e) => onRegiaoEstoqueChange(e.target.value as RegiaoEstoqueFiltro)}
          className="bg-transparent text-xs font-semibold text-ink outline-none"
          aria-label="Região do estoque"
        >
          {regiaoEstoqueOpcoes.map((opcao) => (
            <option key={opcao.value || "todas"} value={opcao.value}>
              {opcao.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
