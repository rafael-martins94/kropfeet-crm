/** Item com numeração BR/EU/US — usado para deduplicar correspondências da vitrine. */
export type ItemComNumeracaoVitrine = {
  numeracao_br: number | null;
  numeracao_eu: number | null;
  numeracao_us: string | null;
  sku: string;
  preco?: number | null;
};

export function chaveNumeracaoVitrine(item: ItemComNumeracaoVitrine): string {
  return [item.numeracao_br ?? "", item.numeracao_eu ?? "", item.numeracao_us ?? ""].join("|");
}

export function compararSkuVitrine(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return a.localeCompare(b, undefined, { numeric: true });
}

/** Menor preço vence; empate → menor SKU. */
export function compararCorrespondenciaDesempateVitrine(
  a: ItemComNumeracaoVitrine,
  b: ItemComNumeracaoVitrine,
): number {
  const precoA = a.preco ?? null;
  const precoB = b.preco ?? null;
  const temA = precoA != null;
  const temB = precoB != null;

  if (temA && temB && precoA !== precoB) return precoA - precoB;
  if (temA !== temB) return temA ? -1 : 1;

  return compararSkuVitrine(a.sku, b.sku);
}

/**
 * Mantém uma correspondência por numeração (BR/EU/US).
 * Desempate: menor preço; se igual, menor SKU.
 */
export function deduplicarCorrespondenciasPorNumeracao<T extends ItemComNumeracaoVitrine>(
  lista: T[],
): T[] {
  const melhorPorNumeracao = new Map<string, T>();

  for (const item of lista) {
    const chave = chaveNumeracaoVitrine(item);
    const atual = melhorPorNumeracao.get(chave);
    if (!atual || compararCorrespondenciaDesempateVitrine(item, atual) < 0) {
      melhorPorNumeracao.set(chave, item);
    }
  }

  return [...melhorPorNumeracao.values()].sort((a, b) => {
    const brA = a.numeracao_br ?? Number.POSITIVE_INFINITY;
    const brB = b.numeracao_br ?? Number.POSITIVE_INFINITY;
    if (brA !== brB) return brA - brB;
    return compararSkuVitrine(a.sku, b.sku);
  });
}
