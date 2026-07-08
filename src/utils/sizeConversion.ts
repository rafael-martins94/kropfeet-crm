/** Padrão de exibição na lista (BR / EU / US único). */
export type DisplaySizeSystem = "br" | "eu" | "us";

/** Colunas US internas da tabela de equivalência. */
export type UsVariantColumn = "us_m" | "us_w" | "us_y";

export type ShoeSizeEquivalence = {
  br: number | null;
  eu: number | null;
  us_m: number | null;
  us_w: number | null;
  us_y: number | null;
  us_y_suffix: UsChildSizeSuffix | null;
};

/** @deprecated use ShoeSizeEquivalence */
export type SizeEquivalence = ShoeSizeEquivalence;

export type UsSizeVariant = "mens" | "w" | "y";
export type UsChildSizeSuffix = "C" | "Y";
export type ParsedNumeracaoUs = {
  value: number;
  variant: UsSizeVariant;
  childSuffix?: UsChildSizeSuffix;
};

export type SizeConvertibleItem = {
  numeracao_br?: number | string | null;
  numeracao_eu?: number | string | null;
  numeracao_us?: number | string | null;
  nome_produto?: string | null;
};

/** Tabela oficial BR ↔ EU ↔ US (Y infantil + M/W adulto). */
export const SHOE_SIZE_EQUIVALENCE_TABLE = [
  { br: 24.5, eu: 25.5, us_m: null, us_w: null, us_y: 8.5, us_y_suffix: "C" },
  { br: 25, eu: 26, us_m: null, us_w: null, us_y: 9, us_y_suffix: "C" },
  { br: 25.5, eu: 26.5, us_m: null, us_w: null, us_y: 9.5, us_y_suffix: "C" },
  { br: 26, eu: 27, us_m: null, us_w: null, us_y: 10, us_y_suffix: "C" },
  { br: 26.5, eu: 27.5, us_m: null, us_w: null, us_y: 10.5, us_y_suffix: "C" },
  { br: 27, eu: 28, us_m: null, us_w: null, us_y: 11, us_y_suffix: "C" },
  { br: 28, eu: 28.5, us_m: null, us_w: null, us_y: 11.5, us_y_suffix: "C" },
  { br: 28.5, eu: 29.5, us_m: null, us_w: null, us_y: 12, us_y_suffix: "C" },
  { br: 29, eu: 30, us_m: null, us_w: null, us_y: 12.5, us_y_suffix: "C" },
  { br: 30, eu: 31, us_m: null, us_w: null, us_y: 13, us_y_suffix: "C" },
  { br: 30.5, eu: 31.5, us_m: null, us_w: null, us_y: 13.5, us_y_suffix: "C" },
  { br: 31, eu: 32, us_m: 1, us_w: null, us_y: 1, us_y_suffix: "Y" },
  { br: 32, eu: 33, us_m: 1.5, us_w: null, us_y: 1.5, us_y_suffix: "Y" },
  { br: 32.5, eu: 33.5, us_m: 2, us_w: null, us_y: 2, us_y_suffix: "Y" },
  { br: 33, eu: 34, us_m: 2.5, us_w: null, us_y: 2.5, us_y_suffix: "Y" },
  { br: 33.5, eu: 35, us_m: 3, us_w: null, us_y: 3, us_y_suffix: "Y" },
  { br: 34, eu: 35.5, us_m: 3.5, us_w: 5.5, us_y: 3.5, us_y_suffix: "Y" },
  { br: 34.5, eu: 36, us_m: 4, us_w: 5.5, us_y: 4, us_y_suffix: "Y" },
  { br: 35, eu: 36.5, us_m: 4.5, us_w: 6, us_y: 4.5, us_y_suffix: "Y" },
  { br: 35.5, eu: 37.5, us_m: 5, us_w: 6.5, us_y: 5, us_y_suffix: "Y" },
  { br: 36, eu: 38, us_m: 5.5, us_w: 7, us_y: 5.5, us_y_suffix: "Y" },
  { br: 37, eu: 38.5, us_m: 6, us_w: 7.5, us_y: 6, us_y_suffix: "Y" },
  { br: 37.5, eu: 39, us_m: 6.5, us_w: 8, us_y: 6.5, us_y_suffix: "Y" },
  { br: 38, eu: 40, us_m: 7, us_w: 8.5, us_y: 7, us_y_suffix: "Y" },
  { br: 39, eu: 40.5, us_m: 7.5, us_w: 9, us_y: null, us_y_suffix: null },
  { br: 39.5, eu: 41, us_m: 8, us_w: 9.5, us_y: null, us_y_suffix: null },
  { br: 40, eu: 42, us_m: 8.5, us_w: 10, us_y: null, us_y_suffix: null },
  { br: 40.5, eu: 42.5, us_m: 9, us_w: 10.5, us_y: null, us_y_suffix: null },
  { br: 41, eu: 43, us_m: 9.5, us_w: 11, us_y: null, us_y_suffix: null },
  { br: 42, eu: 44, us_m: 10, us_w: 11.5, us_y: null, us_y_suffix: null },
  { br: 42.5, eu: 44.5, us_m: 10.5, us_w: 12, us_y: null, us_y_suffix: null },
  { br: 43, eu: 45, us_m: 11, us_w: 12.5, us_y: null, us_y_suffix: null },
  { br: 43.5, eu: 45.5, us_m: 11.5, us_w: 13, us_y: null, us_y_suffix: null },
  { br: 44, eu: 46, us_m: 12, us_w: 13.5, us_y: null, us_y_suffix: null },
  { br: 45, eu: 47, us_m: 12.5, us_w: 14, us_y: null, us_y_suffix: null },
  { br: 45.5, eu: 47.5, us_m: 13, us_w: 14.5, us_y: null, us_y_suffix: null },
  { br: 46.5, eu: 48.5, us_m: 14, us_w: null, us_y: null, us_y_suffix: null },
  { br: 47.5, eu: 49.5, us_m: 15, us_w: null, us_y: null, us_y_suffix: null },
  { br: 48.5, eu: 50.5, us_m: 16, us_w: null, us_y: null, us_y_suffix: null },
  { br: 49.5, eu: 51.5, us_m: 17, us_w: null, us_y: null, us_y_suffix: null },
  { br: 50.5, eu: 52.5, us_m: 18, us_w: null, us_y: null, us_y_suffix: null },
] as const satisfies readonly ShoeSizeEquivalence[];

/** Equivalência entre variantes US na mesma linha (M ↔ W ↔ Y). */
export type UsSizeCrossEquivalence = {
  us_m: number | null;
  us_w: number | null;
  us_y: number | null;
  us_y_suffix: UsChildSizeSuffix | null;
};

export const US_SIZE_CROSS_EQUIVALENCE_TABLE = [
  { us_m: null, us_w: null, us_y: 8.5, us_y_suffix: "C" },
  { us_m: null, us_w: null, us_y: 9, us_y_suffix: "C" },
  { us_m: null, us_w: null, us_y: 9.5, us_y_suffix: "C" },
  { us_m: null, us_w: null, us_y: 10, us_y_suffix: "C" },
  { us_m: null, us_w: null, us_y: 10.5, us_y_suffix: "C" },
  { us_m: null, us_w: null, us_y: 11, us_y_suffix: "C" },
  { us_m: null, us_w: null, us_y: 11.5, us_y_suffix: "C" },
  { us_m: null, us_w: null, us_y: 12, us_y_suffix: "C" },
  { us_m: null, us_w: null, us_y: 12.5, us_y_suffix: "C" },
  { us_m: null, us_w: null, us_y: 13, us_y_suffix: "C" },
  { us_m: null, us_w: null, us_y: 13.5, us_y_suffix: "C" },
  { us_m: 1, us_w: null, us_y: 1, us_y_suffix: "Y" },
  { us_m: 1.5, us_w: null, us_y: 1.5, us_y_suffix: "Y" },
  { us_m: 2, us_w: null, us_y: 2, us_y_suffix: "Y" },
  { us_m: 2.5, us_w: null, us_y: 2.5, us_y_suffix: "Y" },
  { us_m: 3, us_w: null, us_y: 3, us_y_suffix: "Y" },
  { us_m: 3.5, us_w: 5.5, us_y: 3.5, us_y_suffix: "Y" },
  { us_m: 4, us_w: 5.5, us_y: 4, us_y_suffix: "Y" },
  { us_m: 4.5, us_w: 6, us_y: 4.5, us_y_suffix: "Y" },
  { us_m: 5, us_w: 6.5, us_y: 5, us_y_suffix: "Y" },
  { us_m: 5.5, us_w: 7, us_y: 5.5, us_y_suffix: "Y" },
  { us_m: 6, us_w: 7.5, us_y: 6, us_y_suffix: "Y" },
  { us_m: 6.5, us_w: 8, us_y: 6.5, us_y_suffix: "Y" },
  { us_m: 7, us_w: 8.5, us_y: 7, us_y_suffix: "Y" },
  { us_m: 7.5, us_w: 9, us_y: null, us_y_suffix: null },
  { us_m: 8, us_w: 9.5, us_y: null, us_y_suffix: null },
  { us_m: 8.5, us_w: 10, us_y: null, us_y_suffix: null },
  { us_m: 9, us_w: 10.5, us_y: null, us_y_suffix: null },
  { us_m: 9.5, us_w: 11, us_y: null, us_y_suffix: null },
  { us_m: 10, us_w: 11.5, us_y: null, us_y_suffix: null },
  { us_m: 10.5, us_w: 12, us_y: null, us_y_suffix: null },
  { us_m: 11, us_w: 12.5, us_y: null, us_y_suffix: null },
  { us_m: 11.5, us_w: 13, us_y: null, us_y_suffix: null },
  { us_m: 12, us_w: 13.5, us_y: null, us_y_suffix: null },
  { us_m: 12.5, us_w: 14, us_y: null, us_y_suffix: null },
  { us_m: 13, us_w: 14.5, us_y: null, us_y_suffix: null },
] as const satisfies readonly UsSizeCrossEquivalence[];

const EPSILON = 0.0001;

function sameSize(a: number | null, b: number | null): boolean {
  return a !== null && b !== null && Math.abs(a - b) < EPSILON;
}

function compactNumber(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toString();
}

/** Decimal com vírgula (alinhado a EU / nomes BR). */
function formatDecimalBrStyle(value: number): string {
  return compactNumber(value).replace(".", ",");
}

function decimalVariants(value: number): string[] {
  const dot = compactNumber(value);
  const comma = dot.replace(".", ",");
  return dot === comma ? [dot] : [dot, comma];
}

function normalizeComparable(value: string): string {
  return normalizeSizeSearch(value).replace(/\s+/g, "");
}

function labelVariants(prefix: string, value: number): string[] {
  return decimalVariants(value).flatMap((v) => [`${prefix}${v}`, `${prefix} ${v}`]);
}

export function normalizeSizeValue(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;

  const numericPart = normalized.match(/^(\d+(?:\.\d+)?)\s*[CYW]?$/i)?.[1] ?? normalized;

  const parsed = Number(numericPart);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Inferência automática do sistema de numeração a partir dos campos preenchidos. */
export function inferirSistemaNumeracao(
  br: number | null,
  eu: number | null,
  us: string | null,
): "br" | "eu" | "us" | "outro" {
  if (br !== null) return "br";
  if (eu !== null) return "eu";
  if (us !== null && us.trim() !== "") return "us";
  return "outro";
}

/** Lê `numeracao_us` do banco: número + sufixo opcional C/Y/W (sem sufixo = masculino). */
export function parseNumeracaoUs(
  value: number | string | null | undefined,
): ParsedNumeracaoUs | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? { value, variant: "mens" } : null;
  }

  const text = value.trim();
  if (!text) return null;

  const match = text.match(/^(\d+(?:[.,]\d+)?)\s*([CcYyWw])?\s*$/);
  if (!match) return null;

  const parsed = normalizeSizeValue(match[1]);
  if (parsed === null) return null;

  const suf = (match[2] ?? "").toUpperCase();
  const variant: UsSizeVariant = suf === "C" || suf === "Y" ? "y" : suf === "W" ? "w" : "mens";
  if (suf === "C" || suf === "Y") {
    return { value: parsed, variant, childSuffix: suf };
  }
  return { value: parsed, variant };
}

/** Formato persistido em `numeracao_us`: C/Y/W só quando não for masculino. */
export function formatNumeracaoUsForDb(
  value: number,
  variant: UsSizeVariant,
  childSuffix: UsChildSizeSuffix = "Y",
): string {
  const numero = compactNumber(value);
  if (variant === "y") return `${numero}${childSuffix}`;
  if (variant === "w") return `${numero}W`;
  return numero;
}

/** Normaliza entrada do formulário para gravar no banco. */
export function normalizeNumeracaoUsInput(raw: string): string | null {
  const parsed = parseNumeracaoUs(raw);
  if (!parsed) return null;
  return formatNumeracaoUsForDb(parsed.value, parsed.variant, parsed.childSuffix);
}

/** Normaliza campo US usando o tipo selecionado quando o valor ainda não tem sufixo. */
export function normalizeNumeracaoUsFormInput(
  raw: string,
  selectedVariant: UsSizeVariant,
): string | null {
  const parsed = parseNumeracaoUs(raw);
  if (!parsed) return null;

  if (/[CYW]\s*$/i.test(raw)) {
    return formatNumeracaoUsForDb(parsed.value, parsed.variant, parsed.childSuffix);
  }

  return formatNumeracaoUsForDb(parsed.value, selectedVariant);
}

export function formatNumeracaoUsFormValue(
  value: number,
  variant: UsSizeVariant,
  childSuffix?: UsChildSizeSuffix,
): string {
  if (variant === "y" && childSuffix) return `${compactNumber(value)}${childSuffix}`;
  return compactNumber(value);
}

export function formatNumeracaoUsDisplay(
  raw: string,
  selectedVariant: UsSizeVariant | "",
): string {
  const parsed = parseNumeracaoUs(raw);
  if (!parsed) return raw.replace(".", ",");

  const variant = parsed.variant === "mens" && selectedVariant ? selectedVariant : parsed.variant;
  const suffix =
    variant === "y" ? parsed.childSuffix ?? "Y" : variant === "w" ? "W" : "";

  return `${formatDecimalBrStyle(parsed.value)}${suffix}`;
}

export function normalizeSizeSearch(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/,/g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

function findEquivalenceRow(item: SizeConvertibleItem): ShoeSizeEquivalence | null {
  const br = normalizeSizeValue(item.numeracao_br);
  const eu = normalizeSizeValue(item.numeracao_eu);
  const usParsed = parseNumeracaoUs(item.numeracao_us);
  const usRaw = usParsed?.value ?? null;
  const usVariant = usParsed?.variant ?? null;

  if (br === null && eu === null && usRaw === null) return null;

  /** Nesta tabela cada BR é único por linha: resolve equivalência completa. */
  if (br !== null) {
    const byBr = SHOE_SIZE_EQUIVALENCE_TABLE.find((row) => sameSize(row.br, br));
    if (byBr) return byBr;
  }

  if (eu !== null && br !== null) {
    const byPair = SHOE_SIZE_EQUIVALENCE_TABLE.find(
      (row) => sameSize(row.br, br) && sameSize(row.eu, eu),
    );
    if (byPair) return byPair;
  }

  /** EU apenas (fallback se BR ausente/errado) */
  if (eu !== null) {
    const rows = SHOE_SIZE_EQUIVALENCE_TABLE.filter((row) => sameSize(row.eu, eu));
    if (rows.length === 1) return rows[0]!;
  }

  /** Só numeracao_us: qualquer coluna US + dica do nome */
  if (usRaw !== null) {
    let best: ShoeSizeEquivalence | null = null;
    let bestScore = -1;

    const nomeHint = parseUltimoBracketUs(item.nome_produto);

    for (const row of SHOE_SIZE_EQUIVALENCE_TABLE) {
      let score = 0;
      if (sameSize(usRaw, row.us_m)) {
        score += usVariant === "mens" || usVariant === null ? 12 : 8;
      }
      if (sameSize(usRaw, row.us_w)) {
        score += usVariant === "w" ? 12 : 8;
      }
      if (row.us_y !== null && sameSize(usRaw, row.us_y)) {
        score += usVariant === "y" ? 12 : 8;
      }

      if (score <= 0) continue;

      if (br !== null && !sameSize(row.br, br)) score -= 5;
      if (eu !== null && !sameSize(row.eu, eu)) score -= 5;

      if (nomeHint !== null && usVariant === null) {
        if (nomeHint.variant === "w" && row.us_w !== null && sameSize(nomeHint.value, row.us_w))
          score += 4;
        if (nomeHint.variant === "y" && row.us_y !== null && sameSize(nomeHint.value, row.us_y))
          score += 4;
        if (nomeHint.variant === "mens" && sameSize(nomeHint.value, row.us_m)) score += 4;
      }

      if (score > bestScore) {
        best = row;
        bestScore = score;
      }
    }
    return best;
  }

  return null;
}

/** Item na mesma medição física que `targetRow` (BR, colunas US ou colchetes US no nome). */
function itemBelongsToUsEquivalenceRow(
  item: SizeConvertibleItem,
  targetRow: ShoeSizeEquivalence,
): boolean {
  const brItem = normalizeSizeValue(item.numeracao_br);
  const euItem = normalizeSizeValue(item.numeracao_eu);
  const usColumn = parseNumeracaoUs(item.numeracao_us);

  if (usColumn !== null) {
    if (usColumn.variant === "mens") return sameSize(usColumn.value, targetRow.us_m);
    if (usColumn.variant === "w") {
      return targetRow.us_w !== null && sameSize(usColumn.value, targetRow.us_w);
    }
    return targetRow.us_y !== null && sameSize(usColumn.value, targetRow.us_y);
  }

  const ultimoNome = parseUltimoBracketUs(item.nome_produto);
  if (ultimoNome !== null) {
    if (ultimoNome.variant === "mens") return sameSize(ultimoNome.value, targetRow.us_m);
    if (ultimoNome.variant === "w") {
      return targetRow.us_w !== null && sameSize(ultimoNome.value, targetRow.us_w);
    }
    return targetRow.us_y !== null && sameSize(ultimoNome.value, targetRow.us_y);
  }

  if (brItem !== null && sameSize(brItem, targetRow.br)) return true;

  const resolved = findEquivalenceRow(item);
  if (resolved !== null && equivalenceRowsMatch(resolved, targetRow)) return true;

  if (
    brItem !== null &&
    euItem !== null &&
    sameSize(brItem, targetRow.br) &&
    sameSize(euItem, targetRow.eu)
  ) {
    return true;
  }

  return false;
}

export function getAllSizeEquivalences(item: SizeConvertibleItem): ShoeSizeEquivalence {
  const row = findEquivalenceRow(item);
  if (row) {
    return {
      br: row.br,
      eu: row.eu,
      us_m: row.us_m,
      us_w: row.us_w,
      us_y: row.us_y,
      us_y_suffix: row.us_y_suffix,
    };
  }

  return {
    br: normalizeSizeValue(item.numeracao_br),
    eu: normalizeSizeValue(item.numeracao_eu),
    us_m: (() => {
      const us = parseNumeracaoUs(item.numeracao_us);
      if (!us) return null;
      if (us.variant === "mens") return us.value;
      return null;
    })(),
    us_w: (() => {
      const us = parseNumeracaoUs(item.numeracao_us);
      if (!us || us.variant !== "w") return null;
      return us.value;
    })(),
    us_y: (() => {
      const us = parseNumeracaoUs(item.numeracao_us);
      if (!us || us.variant !== "y") return null;
      return us.value;
    })(),
    us_y_suffix: (() => {
      const us = parseNumeracaoUs(item.numeracao_us);
      if (!us || us.variant !== "y") return null;
      return us.childSuffix ?? "Y";
    })(),
  };
}

export function getSizeByDisplaySystem(
  item: SizeConvertibleItem,
  displaySystem: DisplaySizeSystem,
): number | null {
  const eq = getAllSizeEquivalences(item);
  if (displaySystem === "us") return eq.us_m ?? eq.us_w ?? eq.us_y;
  return eq[displaySystem];
}

/**
 * Último `[US…]` em `nome_produto` (vírgula decimal, sufixo C/Y/W).
 * Paridade com tools/tiny-sync parseNumeracao (comentário de manutenção).
 */
export function parseUltimoBracketUs(
  nomeCompleto: string | null | undefined,
): ParsedNumeracaoUs | null {
  if (!nomeCompleto?.trim()) return null;
  const re = /\[\s*US\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*([CYW])?\s*\]/gi;
  let last: ParsedNumeracaoUs | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(nomeCompleto)) !== null) {
    const n = Number(m[1].replace(",", "."));
    if (!Number.isFinite(n)) continue;
    const suf = (m[2] ?? "").toUpperCase();
    const variant: UsSizeVariant = suf === "C" || suf === "Y" ? "y" : suf === "W" ? "w" : "mens";
    last =
      suf === "C" || suf === "Y"
        ? { value: n, variant, childSuffix: suf }
        : { value: n, variant };
  }
  return last;
}

function formatUsNumericLabel(
  value: number,
  variant: UsSizeVariant,
  childSuffix: UsChildSizeSuffix = "Y",
): string {
  const n = formatDecimalBrStyle(value);
  if (variant === "w") return `US ${n}W`;
  if (variant === "y") return `US ${n}${childSuffix}`;
  return `US ${n}`;
}

/**
 * Rótulo principal da coluna US: último `[US…]` no nome; senão fallback pela linha de equivalência.
 */
export function getUsDisplayLabel(item: SizeConvertibleItem): string {
  const fromColumn = parseNumeracaoUs(item.numeracao_us);
  if (fromColumn) {
    return formatUsNumericLabel(fromColumn.value, fromColumn.variant, fromColumn.childSuffix);
  }

  const parsed = parseUltimoBracketUs(item.nome_produto);
  if (parsed) return formatUsNumericLabel(parsed.value, parsed.variant, parsed.childSuffix);

  const eq = getAllSizeEquivalences(item);
  if (eq.us_y !== null) return formatUsNumericLabel(eq.us_y, "y", eq.us_y_suffix ?? "Y");
  if (eq.us_m !== null) return formatUsNumericLabel(eq.us_m, "mens");
  if (eq.us_w !== null) return formatUsNumericLabel(eq.us_w, "w");
  return "—";
}

/** Linhas de tooltip: outras equivalências além do primário US. */
export function getSecondaryEquivalenceLabelsForUsColumn(item: SizeConvertibleItem): string[] {
  const primary = getUsDisplayLabel(item);
  const eq = getAllSizeEquivalences(item);
  const out: string[] = [];

  const pushIf = (label: string) => {
    if (label !== "—" && label !== primary) out.push(label);
  };

  pushIf(formatSizeLabel(eq.br, "br"));
  pushIf(formatSizeLabel(eq.eu, "eu"));
  if (eq.us_m !== null) pushIf(formatUsNumericLabel(eq.us_m, "mens"));
  if (eq.us_w !== null) pushIf(formatUsNumericLabel(eq.us_w, "w"));
  if (eq.us_y !== null) pushIf(formatUsNumericLabel(eq.us_y, "y", eq.us_y_suffix ?? "Y"));

  return out;
}

/**Tooltip da coluna NUM: equivalências não exibidas como primário. */
export function getSecondaryEquivalenceLabelsAfterPrimary(
  displaySystem: DisplaySizeSystem,
  item: SizeConvertibleItem,
): string[] {
  if (displaySystem === "us") return getSecondaryEquivalenceLabelsForUsColumn(item);

  const eq = getAllSizeEquivalences(item);
  const primary =
    displaySystem === "br"
      ? formatSizeLabel(eq.br, "br")
      : formatSizeLabel(eq.eu, "eu");
  const out: string[] = [];
  const pushIf = (label: string) => {
    if (label !== "—" && label !== primary) out.push(label);
  };

  if (displaySystem === "br") {
    pushIf(formatSizeLabel(eq.eu, "eu"));
  } else {
    pushIf(formatSizeLabel(eq.br, "br"));
  }
  if (eq.us_m !== null) pushIf(formatUsNumericLabel(eq.us_m, "mens"));
  if (eq.us_w !== null) pushIf(formatUsNumericLabel(eq.us_w, "w"));
  if (eq.us_y !== null) pushIf(formatUsNumericLabel(eq.us_y, "y", eq.us_y_suffix ?? "Y"));

  return out;
}

export function formatSizeLabel(
  value: number | null | undefined,
  displaySystem: DisplaySizeSystem,
): string {
  if (value === null || value === undefined) return "—";

  if (displaySystem === "eu") return `EU ${formatDecimalBrStyle(value)}`;
  if (displaySystem === "us") return formatUsNumericLabel(value, "mens");

  return `BR ${formatDecimalBrStyle(value)}`;
}

export function getSearchableSizeLabels(item: SizeConvertibleItem): string[] {
  const sizes = getAllSizeEquivalences(item);
  const labels = new Set<string>();

  const addValueOnly = (value: number) => {
    for (const v of decimalVariants(value)) labels.add(v);
  };

  if (sizes.br !== null) {
    for (const label of labelVariants("BR", sizes.br)) labels.add(label);
    addValueOnly(sizes.br);
  }

  if (sizes.eu !== null) {
    for (const label of labelVariants("EU", sizes.eu)) labels.add(label);
    addValueOnly(sizes.eu);
  }

  if (sizes.us_m !== null) {
    for (const v of decimalVariants(sizes.us_m)) {
      labels.add(`US${v}`);
      labels.add(`US ${v}`);
      labels.add(`USM${v}`);
      labels.add(`US M ${v}`);
      labels.add(`M${v}`);
    }
    addValueOnly(sizes.us_m);
  }

  if (sizes.us_w !== null) {
    for (const v of decimalVariants(sizes.us_w)) {
      labels.add(`US${v}W`);
      labels.add(`US ${v}W`);
      labels.add(`USW${v}`);
      labels.add(`US W ${v}`);
      labels.add(`W${v}`);
    }
    addValueOnly(sizes.us_w);
  }

  if (sizes.us_y !== null) {
    const suffix = sizes.us_y_suffix ?? "Y";
    for (const v of decimalVariants(sizes.us_y)) {
      labels.add(`US${v}${suffix}`);
      labels.add(`US ${v}${suffix}`);
      labels.add(`${v}${suffix}`);
    }
  }

  return [...labels];
}

type FilterSizeSystem = "br" | "eu" | UsVariantColumn;

type ParsedSizeFilter =
  | { kind: "column"; system: FilterSizeSystem; value: number }
  | { kind: "us_ambiguous"; value: number };

/** Filtro US sem W/Y usa a coluna principal `US` da tabela enviada. */
function rowsForAmbiguousUs(value: number): ShoeSizeEquivalence[] {
  const chosen = SHOE_SIZE_EQUIVALENCE_TABLE.filter((row) => sameSize(row.us_m, value));

  const byBr = new Map<number, ShoeSizeEquivalence>();
  for (const row of chosen) {
    if (row.br !== null) {
      byBr.set(row.br, row as ShoeSizeEquivalence);
    }
  }
  return [...byBr.values()];
}

function findTableRowsByUs(system: UsVariantColumn, value: number): ShoeSizeEquivalence[] {
  return SHOE_SIZE_EQUIVALENCE_TABLE.filter(
    (row) => row[system] !== null && sameSize(row[system], value),
  );
}

/** Duas linhas da tabela são a mesma numeração (br/eu/US alinhados; null em ambos conta como igual). */
function equivalenceRowsMatch(
  a: ShoeSizeEquivalence | null,
  b: ShoeSizeEquivalence | null,
): boolean {
  if (!a || !b) return false;
  const keys: Array<Exclude<keyof ShoeSizeEquivalence, "us_y_suffix">> = [
    "br",
    "eu",
    "us_m",
    "us_w",
    "us_y",
  ];
  const cellMatch = (x: number | null, y: number | null) => {
    if (x === null && y === null) return true;
    return sameSize(x, y);
  };
  return keys.every((k) => cellMatch(a[k], b[k]));
}

function interpretFilterDisplay(displaySystem: DisplaySizeSystem): "br" | "eu" {
  if (displaySystem === "eu") return "eu";
  return "br";
}

function parseSizeFilter(
  filterValue: string,
  displaySystem: DisplaySizeSystem,
): ParsedSizeFilter | null {
  const text = normalizeSizeSearch(filterValue);
  if (!text) return null;

  const compact = text.replace(/\s+/g, "");
  const numberPattern = "(\\d+(?:\\.\\d+)?)";
  const prefixedPatterns: Array<[RegExp, FilterSizeSystem]> = [
    [new RegExp(`^BR${numberPattern}$`), "br"],
    [new RegExp(`^EU${numberPattern}$`), "eu"],
    [new RegExp(`^USM${numberPattern}$`), "us_m"],
    [new RegExp(`^US${numberPattern}C$`), "us_y"],
    [new RegExp(`^US${numberPattern}Y$`), "us_y"],
    [new RegExp(`^US${numberPattern}W$`), "us_w"],
    [new RegExp(`^${numberPattern}C$`), "us_y"],
    [new RegExp(`^${numberPattern}Y$`), "us_y"],
    [new RegExp(`^${numberPattern}W$`), "us_w"],
    [new RegExp(`^M${numberPattern}$`), "us_m"],
    [new RegExp(`^USW${numberPattern}$`), "us_w"],
    [new RegExp(`^W${numberPattern}$`), "us_w"],
  ];

  for (const [pattern, system] of prefixedPatterns) {
    const match = compact.match(pattern);
    if (match) {
      const value = normalizeSizeValue(match[1]);
      return value === null ? null : { kind: "column", system, value };
    }
  }

  /** `US7`, `US7.5`, `US7,5`: ambíguo — não confundir com masculino apenas. */
  const nakedUs = compact.match(new RegExp(`^US${numberPattern}$`));
  if (nakedUs) {
    const value = normalizeSizeValue(nakedUs[1]);
    return value === null ? null : { kind: "us_ambiguous", value };
  }

  const value = normalizeSizeValue(compact);
  if (value === null) return null;
  if (displaySystem === "us") return { kind: "us_ambiguous", value };
  return { kind: "column", system: interpretFilterDisplay(displaySystem), value };
}

export function matchesSizeFilter(
  item: SizeConvertibleItem,
  displaySystem: DisplaySizeSystem,
  filterValue: string,
): boolean {
  if (!normalizeSizeSearch(filterValue)) return true;

  const parsed = parseSizeFilter(filterValue, displaySystem);
  if (!parsed) return false;

  const sizes = getAllSizeEquivalences(item);

  if (parsed.kind === "us_ambiguous") {
    const targetRows = rowsForAmbiguousUs(parsed.value);
    return targetRows.some((row) => itemBelongsToUsEquivalenceRow(item, row));
  }

  const { system, value } = parsed;

  if (system === "us_m" || system === "us_w" || system === "us_y") {
    const targetRows = findTableRowsByUs(system, value);
    return targetRows.some((row) => itemBelongsToUsEquivalenceRow(item, row));
  }

  if (system === "br" || system === "eu") {
    return sameSize(sizes[system], value);
  }

  return false;
}

/** Linha da tabela por numeração BR. */
export function findEquivalenceRowByBr(br: number): ShoeSizeEquivalence | null {
  return SHOE_SIZE_EQUIVALENCE_TABLE.find((row) => sameSize(row.br, br)) ?? null;
}

/** Linha da tabela por numeração EU (única). */
export function findEquivalenceRowByEu(eu: number): ShoeSizeEquivalence | null {
  const rows = SHOE_SIZE_EQUIVALENCE_TABLE.filter((row) => sameSize(row.eu, eu));
  return rows.length === 1 ? rows[0]! : null;
}

/** Linha da tabela por coluna US + variante. */
export function findEquivalenceRowByUs(
  value: number,
  variant: UsSizeVariant,
): ShoeSizeEquivalence | null {
  if (variant === "mens") {
    return SHOE_SIZE_EQUIVALENCE_TABLE.find((row) => sameSize(row.us_m, value)) ?? null;
  }
  if (variant === "w") {
    return (
      SHOE_SIZE_EQUIVALENCE_TABLE.find(
        (row) => row.us_w !== null && sameSize(row.us_w, value),
      ) ?? null
    );
  }
  return (
    SHOE_SIZE_EQUIVALENCE_TABLE.find(
      (row) => row.us_y !== null && sameSize(row.us_y, value),
    ) ?? null
  );
}

export type NumeracaoEquivalenciaPreenchida = {
  numeracao_br: string;
  numeracao_eu: string;
  numeracao_us: string;
  us_variant: UsSizeVariant;
};

function usValueFromRow(row: ShoeSizeEquivalence, usVariant: UsSizeVariant): number | null {
  if (usVariant === "w") return row.us_w;
  if (usVariant === "y") return row.us_y;
  return row.us_m;
}

function usFormValueFromRow(row: ShoeSizeEquivalence, usVariant: UsSizeVariant): string | null {
  const value = usValueFromRow(row, usVariant);
  if (value === null) return null;
  if (usVariant === "y" && row.us_y_suffix !== null) {
    return formatNumeracaoUsFormValue(value, usVariant, row.us_y_suffix);
  }
  return compactNumber(value);
}

function rowParaNumeracaoForm(
  row: ShoeSizeEquivalence,
  usVariant: UsSizeVariant,
): NumeracaoEquivalenciaPreenchida {
  const usValue = usFormValueFromRow(row, usVariant);

  return {
    numeracao_br: row.br !== null ? formatDecimalBrStyle(row.br) : "",
    numeracao_eu: row.eu !== null ? formatDecimalBrStyle(row.eu) : "",
    numeracao_us: usValue ?? "",
    us_variant: usVariant,
  };
}

export function preencherEquivalenciasPorBr(
  br: number,
  usVariant: UsSizeVariant = "mens",
): NumeracaoEquivalenciaPreenchida | null {
  const row = findEquivalenceRowByBr(br);
  if (!row) return null;
  return rowParaNumeracaoForm(row, usVariant);
}

export function preencherEquivalenciasPorEu(
  eu: number,
  usVariant: UsSizeVariant = "mens",
): NumeracaoEquivalenciaPreenchida | null {
  const row = findEquivalenceRowByEu(eu);
  if (!row) return null;
  return rowParaNumeracaoForm(row, usVariant);
}

export function preencherEquivalenciasPorUs(
  value: number,
  variant: UsSizeVariant,
): NumeracaoEquivalenciaPreenchida | null {
  const row = findEquivalenceRowByUs(value, variant);
  if (!row) return null;
  return rowParaNumeracaoForm(row, variant);
}

type OrigemNumeracaoForm = "br" | "eu" | "us";

/** Preenche apenas BR ↔ EU; não preenche numeração US. */
export function aplicarEquivalenciaBrEuForm(
  origem: "br" | "eu",
  valorCampo: string,
): {
  numeracao_br: string;
  numeracao_eu: string;
  sistema_numeracao: "br" | "eu";
} | null {
  if (origem === "br") {
    const br = normalizeSizeValue(valorCampo);
    if (br === null) return null;
    const row = findEquivalenceRowByBr(br);
    if (!row) return null;
    return {
      numeracao_br: valorCampo,
      numeracao_eu: row.eu !== null ? formatDecimalBrStyle(row.eu) : "",
      sistema_numeracao: "br",
    };
  }

  const eu = normalizeSizeValue(valorCampo);
  if (eu === null) return null;
  const row = findEquivalenceRowByEu(eu);
  if (!row) return null;
  return {
    numeracao_br: row.br !== null ? formatDecimalBrStyle(row.br) : "",
    numeracao_eu: valorCampo,
    sistema_numeracao: "eu",
  };
}

/** Preenche numeração US a partir de BR/EU já informados e do tipo US selecionado. */
export function preencherNumeracaoUsPorTipo(
  numeracaoBr: string,
  numeracaoEu: string,
  usVariant: UsSizeVariant,
): string | null {
  const br = normalizeSizeValue(numeracaoBr);
  const eu = normalizeSizeValue(numeracaoEu);
  const row =
    (br !== null ? findEquivalenceRowByBr(br) : null) ??
    (eu !== null ? findEquivalenceRowByEu(eu) : null);
  if (!row) return null;
  return usFormValueFromRow(row, usVariant);
}

function usCrossValueFromRow(row: UsSizeCrossEquivalence, variant: UsSizeVariant): number | null {
  if (variant === "mens") return row.us_m;
  if (variant === "w") return row.us_w;
  return row.us_y;
}

function usCrossFormValueFromRow(row: UsSizeCrossEquivalence, variant: UsSizeVariant): string | null {
  const value = usCrossValueFromRow(row, variant);
  if (value === null) return null;
  if (variant === "y" && row.us_y_suffix !== null) {
    return formatNumeracaoUsFormValue(value, variant, row.us_y_suffix);
  }
  return compactNumber(value);
}

function findUsCrossRow(value: number, variant: UsSizeVariant): UsSizeCrossEquivalence | null {
  return (
    US_SIZE_CROSS_EQUIVALENCE_TABLE.find((row) => {
      const col = usCrossValueFromRow(row, variant);
      return col !== null && sameSize(col, value);
    }) ?? null
  );
}

/** Converte numeração US entre M, W e Y usando a tabela cruzada americana. */
export function converterNumeracaoUsPorTipo(
  numeracaoUs: string,
  fromVariant: UsSizeVariant,
  toVariant: UsSizeVariant,
): string | null {
  const parsed = parseNumeracaoUs(numeracaoUs);
  if (!parsed) return null;
  if (fromVariant === toVariant) {
    return formatNumeracaoUsFormValue(parsed.value, toVariant, parsed.childSuffix);
  }

  const row = findUsCrossRow(parsed.value, fromVariant);
  if (!row) return null;

  return usCrossFormValueFromRow(row, toVariant);
}

/** Ao mudar o tipo US: usa BR/EU quando disponíveis; sem eles, converte pela tabela M/W/Y. */
export function numeracaoUsAoMudarTipo(
  numeracaoBr: string,
  numeracaoEu: string,
  numeracaoUs: string,
  fromVariant: UsSizeVariant | "",
  toVariant: UsSizeVariant,
): string {
  const fromBrEu = preencherNumeracaoUsPorTipo(numeracaoBr, numeracaoEu, toVariant);
  if (fromBrEu !== null) return fromBrEu;

  const usNum = normalizeSizeValue(numeracaoUs);
  if (usNum !== null && fromVariant) {
    const converted = converterNumeracaoUsPorTipo(numeracaoUs, fromVariant, toVariant);
    if (converted !== null) return converted;
  }
  return "";
}

/** Preenche BR/EU/US a partir de um campo editado, respeitando o tipo US (M/Y/W). */
export function aplicarEquivalenciaNumeracaoForm(
  origem: OrigemNumeracaoForm,
  valorCampo: string,
  usVariant: UsSizeVariant,
): (NumeracaoEquivalenciaPreenchida & { sistema_numeracao: OrigemNumeracaoForm }) | null {
  if (origem === "br") {
    const br = normalizeSizeValue(valorCampo);
    if (br === null) return null;
    const eq = preencherEquivalenciasPorBr(br, usVariant);
    if (!eq) return null;
    return { ...eq, numeracao_br: valorCampo, sistema_numeracao: "br" };
  }

  if (origem === "eu") {
    const eu = normalizeSizeValue(valorCampo);
    if (eu === null) return null;
    const eq = preencherEquivalenciasPorEu(eu, usVariant);
    if (!eq) return null;
    return { ...eq, numeracao_eu: valorCampo, sistema_numeracao: "eu" };
  }

  const usNum = normalizeSizeValue(valorCampo);
  if (usNum === null) return null;
  const eq = preencherEquivalenciasPorUs(usNum, usVariant);
  if (!eq) return null;
  return { ...eq, numeracao_us: valorCampo, sistema_numeracao: "us" };
}

/** Monta `{modelo} # [BR…] [EU…] [US…]` no formato Tiny. */
export function montarNomeProdutoComNumeracoes(
  nomeModelo: string,
  br: number | null,
  eu: number | null,
  us: ParsedNumeracaoUs | null,
): string {
  const base = nomeModelo.trim();
  const partes: string[] = [];

  if (br !== null) partes.push(`[BR ${formatDecimalBrStyle(br)}]`);
  if (eu !== null) partes.push(`[EU ${formatDecimalBrStyle(eu)}]`);
  if (us) {
    const n = formatDecimalBrStyle(us.value);
    const suf = us.variant === "y" ? us.childSuffix ?? "Y" : us.variant === "w" ? "W" : "";
    partes.push(`[US ${n}${suf}]`);
  }

  if (partes.length === 0) return base;
  return `${base} # ${partes.join(" ")}`;
}
