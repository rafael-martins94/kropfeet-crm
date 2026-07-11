/**
 * Valor para filtros `.or()` / `.and()` do PostgREST (Supabase).
 * Espaços, vírgulas e parênteses precisam de aspas; sem isso a busca com
 * termos compostos (ex.: "Jordan 1 Low Travis") quebra silenciosamente.
 */
export function valorFiltroPostgrest(valor: string): string {
  const precisaAspas = /[\s,()"]/.test(valor);
  if (!precisaAspas) return valor;
  return `"${valor.replace(/"/g, '\\"')}"`;
}

/** Padrão `%termo%` já citado para uso em `coluna.ilike.${padrao}`. */
export function padraoIlikePostgrest(termo: string): string {
  const limpo = termo.replace(/%/g, "").replace(/,/g, " ").trim();
  return valorFiltroPostgrest(`%${limpo}%`);
}
