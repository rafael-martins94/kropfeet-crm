export interface OpcaoSimples {
  value: string;
  label: string;
}

/** Formas de pagamento observadas nos pedidos importados do Tiny. */
export const formaPagamentoOpcoes: OpcaoSimples[] = [
  { value: "pix", label: "Pix" },
  { value: "credito", label: "Crédito" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "boleto", label: "Boleto" },
  { value: "crediario", label: "Crediário" },
  { value: "vale", label: "Vale" },
  { value: "multiplas", label: "Múltiplas" },
  { value: "MBWay", label: "MBWay" },
  { value: "Presente / Amostra grátis", label: "Presente / Amostra grátis" },
];

/** Meios de pagamento (contas/maquininhas) observados nos pedidos do Tiny. */
export const meioPagamentoOpcoes: OpcaoSimples[] = [
  { value: "SumUp", label: "SumUp" },
  { value: "Mercantil", label: "Mercantil" },
  { value: "Itaú", label: "Itaú" },
  { value: "Nubank", label: "Nubank" },
];

/** Regiao da venda (mercado). */
export const regiaoVendaOpcoes: OpcaoSimples[] = [
  { value: "brasil", label: "Brasil" },
  { value: "europa", label: "Europa" },
  { value: "outros", label: "Outros" },
];

const REGIOES_ROTA = new Set(["brasil", "europa", "outros"]);

export function parseRegiaoVendaRota(
  valor: string | null | undefined,
): "brasil" | "europa" | "outros" | null {
  if (!valor || !REGIOES_ROTA.has(valor)) return null;
  return valor as "brasil" | "europa" | "outros";
}

export function caminhoListaVendas(regiao: string | null | undefined): string {
  const r = parseRegiaoVendaRota(regiao);
  return r ? `/vendas/${r}` : "/vendas";
}

export function moedaPorRegiao(regiao: string | null | undefined): string {
  return regiao === "europa" ? "EUR" : "BRL";
}

/** Preferir moeda persistida; fallback pela região. */
export function moedaDaVenda(venda: {
  moeda_venda?: string | null;
  regiao_venda?: string | null;
}): string {
  const gravada = venda.moeda_venda?.trim().toUpperCase();
  if (gravada) return gravada;
  return moedaPorRegiao(venda.regiao_venda);
}

export interface MarcadorVenda {
  id?: string;
  descricao?: string;
  cor?: string;
}

export function lerMarcadores(valor: unknown): MarcadorVenda[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter((m): m is Record<string, unknown> => Boolean(m) && typeof m === "object")
    .map((m) => ({
      id: typeof m.id === "string" || typeof m.id === "number" ? String(m.id) : undefined,
      descricao: typeof m.descricao === "string" ? m.descricao : undefined,
      cor: typeof m.cor === "string" ? m.cor : undefined,
    }))
    .filter((m) => Boolean(m.descricao?.trim()));
}

/**
 * Garante que o valor atualmente gravado apareça no dropdown mesmo que não
 * esteja na lista pré-definida, evitando perder dados importados incomuns.
 */
export function opcoesComValorAtual(
  base: OpcaoSimples[],
  valorAtual: string,
  vazioLabel: string,
): OpcaoSimples[] {
  const opcoes: OpcaoSimples[] = [{ value: "", label: vazioLabel }, ...base];
  if (valorAtual && !opcoes.some((o) => o.value === valorAtual)) {
    opcoes.push({ value: valorAtual, label: valorAtual });
  }
  return opcoes;
}
