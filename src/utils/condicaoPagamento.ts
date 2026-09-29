/**
 * Condição de pagamento no estilo Tiny:
 * - "10x"       → 10 parcelas mensais, a primeira um mês após a data base;
 * - "0 30 60"   → parcelas nos dias informados a partir da data base (0 = entrada);
 * - "" / "à vista" → uma parcela na data base.
 */
export type CondicaoPagamento =
  | { tipo: "mensal"; parcelas: number }
  | { tipo: "dias"; dias: number[] };

export const MAX_PARCELAS = 36;

export function interpretarCondicao(texto: string | null | undefined): CondicaoPagamento | null {
  const t = (texto ?? "").trim().toLowerCase();
  if (t === "" || t === "à vista" || t === "a vista" || t === "avista" || t === "1x") {
    return { tipo: "dias", dias: [0] };
  }

  const mensal = /^(\d{1,2})\s*x$/.exec(t);
  if (mensal) {
    const n = Number(mensal[1]);
    if (n < 1 || n > MAX_PARCELAS) return null;
    return n === 1 ? { tipo: "dias", dias: [0] } : { tipo: "mensal", parcelas: n };
  }

  const partes = t.split(/[\s,;/]+/).filter(Boolean);
  if (partes.length === 0 || partes.length > MAX_PARCELAS) return null;
  if (!partes.every((p) => /^\d{1,4}$/.test(p))) return null;
  const dias = partes.map(Number);
  for (let i = 1; i < dias.length; i += 1) {
    if (dias[i] < dias[i - 1]) return null;
  }
  return { tipo: "dias", dias };
}

export function quantidadeParcelas(condicao: CondicaoPagamento): number {
  return condicao.tipo === "mensal" ? condicao.parcelas : condicao.dias.length;
}

function paraIso(data: Date): string {
  const y = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, "0");
  const d = String(data.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function deIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function somarDias(iso: string, dias: number): string {
  const data = deIso(iso);
  data.setDate(data.getDate() + dias);
  return paraIso(data);
}

/** Soma meses mantendo o dia; em meses mais curtos usa o último dia (31/01 + 1 → 28/02). */
export function somarMeses(iso: string, meses: number): string {
  const base = deIso(iso);
  const alvo = new Date(base.getFullYear(), base.getMonth() + meses, 1);
  const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(base.getDate(), ultimoDia));
  return paraIso(alvo);
}

/** Divide em centavos; a diferença do arredondamento vai para a última parcela. */
export function dividirValor(total: number, partes: number): number[] {
  if (partes <= 0) return [];
  const centavos = Math.round((Number.isFinite(total) ? total : 0) * 100);
  const base = Math.floor(centavos / partes);
  const valores = Array.from({ length: partes }, () => base);
  valores[partes - 1] += centavos - base * partes;
  return valores.map((c) => c / 100);
}

/** Primeiro vencimento padrão: um mês após a data base no mensal; senão, o primeiro dia da lista. */
export function primeiroVencimentoPadrao(condicao: CondicaoPagamento, dataBaseIso: string): string {
  return condicao.tipo === "mensal"
    ? somarMeses(dataBaseIso, 1)
    : somarDias(dataBaseIso, condicao.dias[0] ?? 0);
}

/**
 * No mensal, `primeiroVencimentoIso` define a 1ª parcela e as demais seguem mês a mês;
 * na lista de dias, desloca todas as datas mantendo os intervalos.
 */
export function gerarVencimentos(
  condicao: CondicaoPagamento,
  dataBaseIso: string,
  primeiroVencimentoIso?: string | null,
): string[] {
  const primeiro = primeiroVencimentoIso || primeiroVencimentoPadrao(condicao, dataBaseIso);
  if (condicao.tipo === "mensal") {
    return Array.from({ length: condicao.parcelas }, (_, i) => somarMeses(primeiro, i));
  }
  const inicio = condicao.dias[0] ?? 0;
  return condicao.dias.map((d) => somarDias(primeiro, d - inicio));
}

export function gerarParcelas(params: {
  valor: number;
  condicao: CondicaoPagamento;
  dataBaseIso: string;
  primeiroVencimentoIso?: string | null;
}): Array<{ data_vencimento: string; valor: number }> {
  const datas = gerarVencimentos(params.condicao, params.dataBaseIso, params.primeiroVencimentoIso);
  const valores = dividirValor(params.valor, datas.length);
  return datas.map((data, i) => ({ data_vencimento: data, valor: valores[i] }));
}
