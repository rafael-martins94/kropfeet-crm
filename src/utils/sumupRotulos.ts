import type { VendaSumup } from "../services/sumup";

const STATUS: Record<string, string> = {
  SUCCESSFUL: "Aprovada",
  PENDING: "Pendente",
  CANCELLED: "Cancelada",
  FAILED: "Falhou",
  REFUNDED: "Estornada",
  CHARGE_BACK: "Chargeback",
};

const TIPO_PAGAMENTO: Record<string, string> = {
  CASH: "Dinheiro",
  POS: "Maquininha",
  ECOM: "Link",
  RECURRING: "Recorrente",
  BITCOIN: "Bitcoin",
  BALANCE: "Saldo",
  MOTO: "Manual",
  BOLETO: "Boleto",
  DIRECT_DEBIT: "Débito direto",
  APM: "Outro meio",
  UNKNOWN: "Desconhecido",
};

const TIPO: Record<string, string> = {
  PAYMENT: "Pagamento",
  REFUND: "Estorno",
  CHARGE_BACK: "Chargeback",
};

export const FILTROS_STATUS_SUMUP = [
  { value: "", label: "Todos os status" },
  { value: "SUCCESSFUL", label: "Aprovadas" },
  { value: "PENDING", label: "Pendentes" },
  { value: "REFUNDED", label: "Estornadas" },
  { value: "CANCELLED", label: "Canceladas" },
  { value: "FAILED", label: "Falhas" },
  { value: "CHARGE_BACK", label: "Chargebacks" },
] as const;

export function rotuloStatusSumup(status: string): string {
  return STATUS[status] ?? status.replace(/_/g, " ");
}

export function tomStatusSumup(
  status: string,
): "sucesso" | "aviso" | "erro" | "laranja" | "neutro" {
  if (status === "SUCCESSFUL") return "sucesso";
  if (status === "PENDING") return "aviso";
  if (status === "REFUNDED") return "laranja";
  if (status === "CANCELLED" || status === "FAILED" || status === "CHARGE_BACK") return "erro";
  return "neutro";
}

export function rotuloPagamentoSumup(venda: VendaSumup): string {
  const meio = venda.tipoPagamento ? (TIPO_PAGAMENTO[venda.tipoPagamento] ?? venda.tipoPagamento) : null;
  const cartao =
    venda.cartao && venda.cartao !== "UNKNOWN" ? venda.cartao.replace(/_/g, " ") : null;
  if (meio && cartao) return `${meio} · ${cartao}`;
  return meio ?? cartao ?? "—";
}

export function rotuloTipoSumup(tipo: string | null): string {
  if (!tipo) return "—";
  return TIPO[tipo] ?? tipo.replace(/_/g, " ");
}

export function rotuloParcelasSumup(parcelas: number | null): string {
  if (!parcelas || parcelas <= 1) return "À vista";
  return `${parcelas}x`;
}
