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
};

/** @deprecated use ShoeSizeEquivalence */
export type SizeEquivalence = ShoeSizeEquivalence;

export type SizeConvertibleItem = {
  numeracao_br?: number | string | null;
  numeracao_eu?: number | string | null;
  numeracao_us?: number | string | null;
  nome_completo?: string | null;
};

export const SHOE_SIZE_EQUIVALENCE_TABLE = [
  { br: 34, eu: 35.5, us_m: 3.5, us_w: 5, us_y: 3.5 },
  { br: 34.5, eu: 36, us_m: 4, us_w: 5.5, us_y: 4 },
  { br: 35, eu: 36.5, us_m: 4.5, us_w: 6, us_y: 4.5 },
  { br: 35.5, eu: 37, us_m: 5, us_w: 6.5, us_y: 5 },
  { br: 36, eu: 37.5, us_m: 5.5, us_w: 7, us_y: 5.5 },
  { br: 37, eu: 38.5, us_m: 6, us_w: 7.5, us_y: 6 },
  { br: 37.5, eu: 39, us_m: 6.5, us_w: 8, us_y: 6.5 },
  { br: 38, eu: 39.5, us_m: 7, us_w: 8.5, us_y: 7 },
  { br: 38.5, eu: 40, us_m: 7.5, us_w: 9, us_y: null },
  { br: 39, eu: 40.5, us_m: 8, us_w: 9.5, us_y: null },
  { br: 39.5, eu: 41, us_m: 8.5, us_w: 10, us_y: null },
  { br: 40, eu: 41.5, us_m: 9, us_w: 10.5, us_y: null },
  { br: 40.5, eu: 42, us_m: 9.5, us_w: 11, us_y: null },
  { br: 41, eu: 42.5, us_m: 10, us_w: 11.5, us_y: null },
  { br: 41.5, eu: 43, us_m: 10.5, us_w: 12, us_y: null },
  { br: 42, eu: 43.5, us_m: 11, us_w: 12.5, us_y: null },
  { br: 42.5, eu: 44, us_m: 11.5, us_w: 13, us_y: null },
  { br: 43, eu: 44.5, us_m: 12, us_w: 13.5, us_y: null },
  { br: 43.5, eu: 45, us_m: 12.5, us_w: 14, us_y: null },
  { br: 44, eu: 45.5, us_m: 13, us_w: 14.5, us_y: null },
  { br: 45, eu: 46.5, us_m: 14, us_w: 15.5, us_y: null },
  { br: 46, eu: 47.5, us_m: 15, us_w: 16.5, us_y: null },
] as const satisfies readonly ShoeSizeEquivalence[];

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

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
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
  const usRaw = normalizeSizeValue(item.numeracao_us);

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

    const nomeHint = parseUltimoBracketUs(item.nome_completo);

    for (const row of SHOE_SIZE_EQUIVALENCE_TABLE) {
      let score = 0;
      if (sameSize(usRaw, row.us_m)) score += nomeHint?.variant === "mens" ? 12 : 8;
      if (sameSize(usRaw, row.us_w)) score += nomeHint?.variant === "w" ? 12 : 8;
      if (row.us_y !== null && sameSize(usRaw, row.us_y))
        score += nomeHint?.variant === "y" ? 12 : 8;

      if (score <= 0) continue;

      if (br !== null && !sameSize(row.br, br)) score -= 5;
      if (eu !== null && !sameSize(row.eu, eu)) score -= 5;

      if (nomeHint !== null) {
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
  const usRaw = normalizeSizeValue(item.numeracao_us);

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

  if (usRaw !== null) {
    if (sameSize(usRaw, targetRow.us_m)) return true;
    if (sameSize(usRaw, targetRow.us_w)) return true;
    if (targetRow.us_y !== null && sameSize(usRaw, targetRow.us_y)) return true;
  }

  const ultimoNome = parseUltimoBracketUs(item.nome_completo);
  if (ultimoNome !== null) {
    if (
      ultimoNome.variant === "w" &&
      targetRow.us_w !== null &&
      sameSize(ultimoNome.value, targetRow.us_w)
    )
      return true;
    if (
      ultimoNome.variant === "y" &&
      targetRow.us_y !== null &&
      sameSize(ultimoNome.value, targetRow.us_y)
    )
      return true;
    if (ultimoNome.variant === "mens" && sameSize(ultimoNome.value, targetRow.us_m))
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
    };
  }

  return {
    br: normalizeSizeValue(item.numeracao_br),
    eu: normalizeSizeValue(item.numeracao_eu),
    us_m: normalizeSizeValue(item.numeracao_us),
    us_w: null,
    us_y: null,
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
 * Último `[US…]` em `nome_completo` (vírgula decimal, sufixo W/Y).
 * Paridade com tools/tiny-sync parseNumeracao (comentário de manutenção).
 */
export function parseUltimoBracketUs(
  nomeCompleto: string | null | undefined,
): { value: number; variant: "mens" | "w" | "y" } | null {
  if (!nomeCompleto?.trim()) return null;
  const re = /\[\s*US\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*([WY])?\s*\]/gi;
  let last: { value: number; variant: "mens" | "w" | "y" } | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(nomeCompleto)) !== null) {
    const n = Number(m[1].replace(",", "."));
    if (!Number.isFinite(n)) continue;
    const suf = (m[2] ?? "").toUpperCase();
    const variant = suf === "Y" ? "y" : suf === "W" ? "w" : "mens";
    last = { value: n, variant };
  }
  return last;
}

function formatUsNumericLabel(value: number, variant: "mens" | "w" | "y"): string {
  const n = formatDecimalBrStyle(value);
  if (variant === "w") return `US ${n}W`;
  if (variant === "y") return `US ${n}Y`;
  return `US ${n}`;
}

/**
 * Rótulo principal da coluna US: último `[US…]` no nome; senão fallback pela linha de equivalência.
 */
export function getUsDisplayLabel(item: SizeConvertibleItem): string {
  const parsed = parseUltimoBracketUs(item.nome_completo);
  if (parsed) return formatUsNumericLabel(parsed.value, parsed.variant);

  const eq = getAllSizeEquivalences(item);
  if (eq.us_m !== null) return formatUsNumericLabel(eq.us_m, "mens");
  if (eq.us_w !== null) return formatUsNumericLabel(eq.us_w, "w");
  if (eq.us_y !== null) return formatUsNumericLabel(eq.us_y, "y");
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
  if (eq.us_y !== null) pushIf(formatUsNumericLabel(eq.us_y, "y"));

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
  if (eq.us_y !== null) pushIf(formatUsNumericLabel(eq.us_y, "y"));

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
    const v = compactNumber(sizes.us_y);
    labels.add(`US${v}Y`);
    labels.add(`US ${v}Y`);
    labels.add(`${v}Y`);
  }

  return [...labels];
}

type FilterSizeSystem = "br" | "eu" | UsVariantColumn;

type ParsedSizeFilter =
  | { kind: "column"; system: FilterSizeSystem; value: number }
  | { kind: "us_ambiguous"; value: number };

/** Numerações “inteiras” de calçados (vs 7,5 / 43,5). */
function isWholeShoeStep(value: number): boolean {
  return Math.abs(value - Math.round(value)) < EPSILON;
}

/**
 * Filtro só com dígito US (sem M/W/Y):
 * - Meia-numeração: prioriza linhas onde bate em `us_w` ou `us_y` (ex.: US 7,5 feminino ⇄ US M 6 / US 6Y);
 *   evita usar `us_m` 7,5 (linha física diferente → ex.: feminino US 9).
 * - Inteira: união masculino ∪ feminino ∪ infantil.
 * Para meia masculina explícita: `USM7.5`.
 */
function rowsForAmbiguousUs(value: number): ShoeSizeEquivalence[] {
  const byW_Y = SHOE_SIZE_EQUIVALENCE_TABLE.filter(
    (row) =>
      sameSize(row.us_w, value) ||
      (row.us_y !== null && sameSize(row.us_y, value)),
  );

  let chosen: ShoeSizeEquivalence[];
  if (!isWholeShoeStep(value)) {
    chosen =
      byW_Y.length > 0
        ? [...byW_Y]
        : SHOE_SIZE_EQUIVALENCE_TABLE.filter((row) => sameSize(row.us_m, value));
  } else {
    chosen = SHOE_SIZE_EQUIVALENCE_TABLE.filter(
      (row) =>
        sameSize(row.us_m, value) ||
        sameSize(row.us_w, value) ||
        (row.us_y !== null && sameSize(row.us_y, value)),
    );
  }

  const byBr = new Map<number, ShoeSizeEquivalence>();
  for (const row of chosen) {
    if (row.br !== null) {
      byBr.set(row.br, row as ShoeSizeEquivalence);
    }
  }
  return [...byBr.values()];
}

function findTableRowByUs(system: UsVariantColumn, value: number): ShoeSizeEquivalence | null {
  const row = SHOE_SIZE_EQUIVALENCE_TABLE.find(
    (r) => r[system] !== null && sameSize(r[system], value),
  );
  return row ?? null;
}

/** Duas linhas da tabela são a mesma numeração (br/eu/US alinhados; null em ambos conta como igual). */
function equivalenceRowsMatch(
  a: ShoeSizeEquivalence | null,
  b: ShoeSizeEquivalence | null,
): boolean {
  if (!a || !b) return false;
  const keys: (keyof ShoeSizeEquivalence)[] = ["br", "eu", "us_m", "us_w", "us_y"];
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
    [new RegExp(`^US${numberPattern}Y$`), "us_y"],
    [new RegExp(`^US${numberPattern}W$`), "us_w"],
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

/** Rótulo pesquisável para filtros US com coluna explícita. */
function filterLabelComparableForUs(system: UsVariantColumn, value: number): string[] {
  const out: string[] = [];
  const dot = compactNumber(value);
  const comma = dot.replace(".", ",");
  for (const v of dot === comma ? [dot] : [dot, comma]) {
    if (system === "us_m") {
      out.push(normalizeComparable(`US ${v}`));
      out.push(normalizeComparable(`USM${v}`));
      out.push(normalizeComparable(`M${v}`));
    } else if (system === "us_w") {
      out.push(normalizeComparable(`US${v}W`));
      out.push(normalizeComparable(`US ${v}W`));
      out.push(normalizeComparable(`USW${v}`));
      out.push(normalizeComparable(`US W ${v}`));
      out.push(normalizeComparable(`W${v}`));
    } else {
      out.push(normalizeComparable(`US ${v}Y`));
      out.push(normalizeComparable(`${v}Y`));
    }
  }
  return [...new Set(out)];
}

/** Labels combinados para filtro só com número americano. */
function filterLabelComparableForAmbiguousUs(value: number): string[] {
  const merged = [
    ...filterLabelComparableForUs("us_m", value),
    ...filterLabelComparableForUs("us_w", value),
    ...filterLabelComparableForUs("us_y", value),
  ];
  return [...new Set(merged)];
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
    if (targetRows.some((row) => itemBelongsToUsEquivalenceRow(item, row))) return true;

    const itemLabels = getSearchableSizeLabels(item).map((x) => normalizeComparable(x));
    const candidates = filterLabelComparableForAmbiguousUs(parsed.value);
    return candidates.some((c) => itemLabels.includes(c));
  }

  const { system, value } = parsed;

  if (system === "us_m" || system === "us_w" || system === "us_y") {
    const targetRow = findTableRowByUs(system, value);
    if (targetRow !== null && itemBelongsToUsEquivalenceRow(item, targetRow)) return true;

    if (sameSize(sizes[system], value)) return true;

    const itemLabels = getSearchableSizeLabels(item).map((x) => normalizeComparable(x));
    const candidates = filterLabelComparableForUs(system, value);
    return candidates.some((c) => itemLabels.includes(c));
  }

  if (system === "br" || system === "eu") {
    if (sameSize(sizes[system], value)) return true;

    const normalizedTarget = normalizeComparable(formatSizeLabel(value, system));
    return getSearchableSizeLabels(item).some(
      (label) => normalizeComparable(label) === normalizedTarget,
    );
  }

  return false;
}
