const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** Compara strings com segmentos numéricos em ordem natural (ex.: 100, 103, 1003). */
export function compareNatural(a: string, b: string): number {
  return collator.compare(a, b);
}
