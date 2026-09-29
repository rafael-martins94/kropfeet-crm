import type { TipoRegiao } from "../../types/entities";

export interface OpcaoSimples {
  value: string;
  label: string;
}

const LABEL_FORMA: Record<string, string> = {
  pix: "Pix",
  credito: "Cartão de crédito",
  debito: "Cartão de débito",
  dinheiro: "Dinheiro",
  crediario: "Crediário",
  vale: "Vale",
  cartao: "Cartão",
  mbway: "MBWay",
  transferencia: "Transferência",
  cortesia: "Cortesia",
  multiplas: "Múltiplas",
  boleto: "Boleto",
  contareceber: "Conta a receber",
};

export interface CatalogoPagamentoRegiao {
  formas: string[];
  meiosPorForma: Record<string, string[]>;
  /** Formas em que a condição de pagamento pode gerar mais de uma parcela. */
  parcelaveis: string[];
}

const CATALOGO_EUROPA: CatalogoPagamentoRegiao = {
  formas: ["cartao", "mbway", "transferencia", "dinheiro", "vale"],
  meiosPorForma: {
    cartao: ["SumUp Máquina", "SumUp Link", "Stripe"],
    transferencia: ["Revolut", "Wise"],
  },
  parcelaveis: [],
};

export const catalogoPagamento: Record<TipoRegiao, CatalogoPagamentoRegiao> = {
  brasil: {
    formas: ["pix", "credito", "debito", "dinheiro", "crediario", "vale"],
    meiosPorForma: {
      pix: ["Itaú", "Mercantil", "Nubank"],
      credito: ["SumUp"],
      debito: ["SumUp"],
      crediario: ["Itaú", "Mercantil", "Nubank"],
    },
    parcelaveis: ["credito", "crediario"],
  },
  europa: CATALOGO_EUROPA,
  outros: CATALOGO_EUROPA,
};

function catalogoDaRegiao(regiao: string | null | undefined): CatalogoPagamentoRegiao {
  return catalogoPagamento[(regiao ?? "brasil") as TipoRegiao] ?? catalogoPagamento.brasil;
}

export function formasPagamentoDaRegiao(regiao: string | null | undefined): OpcaoSimples[] {
  return catalogoDaRegiao(regiao).formas.map((f) => ({ value: f, label: labelFormaPagamento(f) }));
}

/** Meios usados no Brasil e na Europa, sem repetir. */
export function meiosPagamentoConhecidos(): string[] {
  const meios = new Set<string>();
  for (const catalogo of Object.values(catalogoPagamento)) {
    for (const lista of Object.values(catalogo.meiosPorForma)) {
      for (const meio of lista) meios.add(meio);
    }
  }
  return [...meios].sort((a, b) => a.localeCompare(b, "pt"));
}

export function meiosPagamentoDaForma(
  regiao: string | null | undefined,
  forma: string | null | undefined,
): OpcaoSimples[] {
  const meios = catalogoDaRegiao(regiao).meiosPorForma[(forma ?? "").toLowerCase()] ?? [];
  return meios.map((m) => ({ value: m, label: m }));
}

export function formaPermiteParcelar(
  regiao: string | null | undefined,
  forma: string | null | undefined,
): boolean {
  return catalogoDaRegiao(regiao).parcelaveis.includes((forma ?? "").toLowerCase());
}

/** Espelha `forma_pagamento_baixa_imediata` no banco: a conta já nasce recebida se venceu. */
export function formaBaixaImediata(forma: string | null | undefined): boolean {
  return ["pix", "dinheiro", "vale", "mbway", "transferencia"].includes(
    (forma ?? "").trim().toLowerCase(),
  );
}

export function meioEhSumup(meio: string | null | undefined): boolean {
  return /^sumup/i.test((meio ?? "").trim());
}

/** Crédito e débito no Brasil só passam pela SumUp. Na Europa, o meio precisa ser SumUp. */
export function parcelaUsaCodigoSumup(linha: {
  forma_pagamento?: string | null;
  meio_pagamento?: string | null;
  codigo_transacao?: string | null;
}): boolean {
  if (meioEhSumup(linha.meio_pagamento)) return true;
  const meio = (linha.meio_pagamento ?? "").trim();
  if (meio) return Boolean((linha.codigo_transacao ?? "").trim());
  const forma = (linha.forma_pagamento ?? "").trim().toLowerCase();
  return forma === "credito" || forma === "debito";
}

export function extrairCodigoSumup(texto: string | null | undefined): string {
  const bruto = (texto ?? "").trim().toUpperCase();
  if (!bruto) return "";
  return bruto.match(/T[A-Z0-9]{6,24}/)?.[0] ?? (bruto.includes(" ") ? "" : bruto);
}

/** Forma do pedido derivada das parcelas: uma só forma, ou "multiplas". */
export function formaDerivadaDasParcelas(
  parcelas: Array<{ forma_pagamento: string | null | undefined }>,
): string | null {
  const formas = parcelas
    .map((p) => (p.forma_pagamento ?? "").trim())
    .filter(Boolean);
  if (formas.length === 0) return null;
  const distintas = new Set(formas.map((f) => f.toLowerCase()));
  return distintas.size === 1 ? formas[0] : "multiplas";
}

/** Regiao da venda (mercado). */
export const regiaoVendaOpcoes: OpcaoSimples[] = [
  { value: "brasil", label: "Brasil" },
  { value: "europa", label: "Europa" },
  { value: "outros", label: "Outros" },
];

export const freteStatusOpcoes: OpcaoSimples[] = [
  { value: "nao_aplicavel", label: "Não aplicável" },
  { value: "pendente", label: "Pendente" },
  { value: "pago", label: "Pago" },
  { value: "cortesia", label: "Cortesia" },
];

export const localVendaOpcoes: OpcaoSimples[] = [
  { value: "", label: "— Não informado —" },
  { value: "galeria", label: "Galeria" },
  { value: "online", label: "Online" },
];

export function labelFreteStatus(valor: string | null | undefined): string {
  if (!valor) return "—";
  return freteStatusOpcoes.find((o) => o.value === valor)?.label ?? valor;
}

/** Valor que o cliente ainda precisa quitar, ou que já quitou, pelo frete. */
export function valorFreteCobrado(status: string | null | undefined, valor: number): number {
  if (status === "pendente" || status === "pago") return Math.max(0, valor);
  return 0;
}

export function labelLocalVenda(valor: string | null | undefined): string {
  if (!valor) return "—";
  return localVendaOpcoes.find((o) => o.value === valor)?.label ?? valor;
}

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

export const moedaFreteOpcoes: OpcaoSimples[] = [
  { value: "BRL", label: "Real (BRL)" },
  { value: "EUR", label: "Euro (EUR)" },
];

/** Moeda do frete. Quando não houver uma própria, acompanha a moeda do pedido. */
export function moedaDoFrete(venda: {
  moeda_frete?: string | null;
  moeda_venda?: string | null;
  regiao_venda?: string | null;
}): "BRL" | "EUR" {
  const frete = venda.moeda_frete?.trim().toUpperCase();
  if (frete === "EUR" || frete === "BRL") return frete;
  return moedaDaVenda(venda) === "EUR" ? "EUR" : "BRL";
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

export function labelFormaPagamento(forma: string | null | undefined): string {
  if (!forma) return "—";
  return LABEL_FORMA[forma.trim().toLowerCase()] ?? forma;
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
