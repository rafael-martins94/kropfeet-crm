/** Converte texto de input (ex.: "480,00") em número ou null. */
export function parsePrecoInput(valor: string): number | null {
  if (!valor.trim()) return null;
  const n = Number(valor.trim().replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Valor numérico para exibição em input. */
export function formatPrecoInput(preco: number | null | undefined): string {
  if (preco == null) return "";
  return preco.toString().replace(".", ",");
}
