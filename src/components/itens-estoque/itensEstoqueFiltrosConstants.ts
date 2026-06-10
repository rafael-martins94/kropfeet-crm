import type { StatusItem } from "../../types/entities";
import type { DisplaySizeSystem } from "../../utils/sizeConversion";
import type { RegiaoEstoqueFiltro } from "../../services/itens-estoque";

export const statusOpcoesFiltro: Array<{ value: StatusItem | ""; label: string }> = [
  { value: "", label: "Todos os status" },
  { value: "em_estoque", label: "Em estoque" },
  { value: "fora_de_estoque", label: "Fora de estoque" },
  { value: "em_processo_de_compra", label: "Em processo de compra" },
  { value: "transferencia", label: "Transferência" },
  { value: "reservado", label: "Reservado" },
  { value: "vendido", label: "Vendido" },
  { value: "devolvido", label: "Devolvido" },
  { value: "inativo", label: "Inativo" },
];

export const padraoNumeracaoOpcoes: Array<{ value: DisplaySizeSystem; label: string }> = [
  { value: "br", label: "BR" },
  { value: "eu", label: "EU" },
  { value: "us", label: "US" },
];

export const regiaoEstoqueOpcoes: Array<{ value: RegiaoEstoqueFiltro; label: string }> = [
  { value: "", label: "Todas" },
  { value: "br", label: "BR" },
  { value: "eu", label: "EU" },
];
