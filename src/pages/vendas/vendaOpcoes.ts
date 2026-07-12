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
  { value: "contareceber", label: "Conta a receber" },
  { value: "MBWay", label: "MBWay" },
  { value: "Presente / Amostra grátis", label: "Presente / Amostra grátis" },
];

/** Formas comuns usadas nas linhas de parcela (inclui meios que o Tiny grava como forma). */
export const formaPagamentoParcelaOpcoes: OpcaoSimples[] = [
  ...formaPagamentoOpcoes,
  { value: "Revolut", label: "Revolut" },
  { value: "Stripe", label: "Stripe" },
  { value: "Wise", label: "Wise" },
  { value: "SumUp Máquina", label: "SumUp Máquina" },
  { value: "SumUp Link", label: "SumUp Link" },
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

export const freteStatusOpcoes: OpcaoSimples[] = [
  { value: "nao_aplicavel", label: "Não aplicável" },
  { value: "pendente", label: "Pendente" },
  { value: "pago", label: "Pago" },
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

/** Parcela vinda de `dados_tiny.parcelas[].parcela` (API Tiny) — legado/fallback. */
export interface ParcelaDadosTiny {
  numero: number;
  data: string | null;
  valor: number | null;
  formaPagamento: string | null;
  meioPagamento: string | null;
  dias: number | null;
  obs: string | null;
}

function textoOuNulo(valor: unknown): string | null {
  if (typeof valor === "string") {
    const t = valor.trim();
    return t || null;
  }
  if (typeof valor === "number" && Number.isFinite(valor)) return String(valor);
  return null;
}

function numeroOuNulo(valor: unknown): number | null {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (typeof valor === "string") {
    const t = valor.trim().replace(",", ".");
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Converte data Tiny `DD/MM/YYYY` para ISO `YYYY-MM-DD` (para formatarData).
 * Outros formatos são devolvidos como estão.
 */
export function dataTinyParaIso(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const t = valor.trim();
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return t;
}

/** Extrai parcelas de `vendas.dados_tiny` (estrutura Tiny: parcelas[{ parcela: {...} }]). */
export function lerParcelasDadosTiny(dadosTiny: unknown): ParcelaDadosTiny[] {
  if (!dadosTiny || typeof dadosTiny !== "object") return [];
  const raw = (dadosTiny as Record<string, unknown>).parcelas;
  if (!Array.isArray(raw)) return [];

  const saida: ParcelaDadosTiny[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const nested = (entry as Record<string, unknown>).parcela;
    const p =
      nested && typeof nested === "object"
        ? (nested as Record<string, unknown>)
        : (entry as Record<string, unknown>);

    saida.push({
      numero: saida.length + 1,
      data: textoOuNulo(p.data),
      valor: numeroOuNulo(p.valor),
      formaPagamento: textoOuNulo(p.forma_pagamento),
      meioPagamento: textoOuNulo(p.meio_pagamento),
      dias: numeroOuNulo(p.dias),
      obs: textoOuNulo(p.obs),
    });
  }
  return saida;
}

/** `contareceber` = ainda nao pago. */
export function parcelaEstaPagaPorForma(forma: string | null | undefined): boolean {
  return (forma ?? "").trim().toLowerCase() !== "contareceber";
}

/** Múltiplas ou cartão/crédito — casos em que a UI deve destacar as parcelas. */
export function formaPagamentoUsaParcelas(forma: string | null | undefined): boolean {
  const f = (forma ?? "").trim().toLowerCase();
  if (!f) return false;
  return (
    f === "multiplas" ||
    f === "múltiplas" ||
    f === "credito" ||
    f === "crédito" ||
    f.includes("carta")
  );
}

export function labelFormaPagamento(forma: string | null | undefined): string {
  if (!forma) return "—";
  const opcao = [...formaPagamentoParcelaOpcoes, ...formaPagamentoOpcoes].find(
    (o) => o.value.toLowerCase() === forma.toLowerCase(),
  );
  return opcao?.label ?? forma;
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
