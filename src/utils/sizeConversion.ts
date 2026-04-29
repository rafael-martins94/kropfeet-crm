export type DisplaySizeSystem = "br" | "eu" | "us_m" | "us_w" | "us_y";

export type SizeEquivalence = Record<DisplaySizeSystem, number | null>;

export type SizeConvertibleItem = {
  numeracao_br?: number | string | null;
  numeracao_eu?: number | string | null;
  numeracao_us?: number | string | null;
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
] as const satisfies readonly SizeEquivalence[];

const DISPLAY_SYSTEM_LABELS: Record<DisplaySizeSystem, string> = {
  br: "BR",
  eu: "EU",
  us_m: "US M",
  us_w: "US W",
  us_y: "US Y",
};

const EPSILON = 0.0001;

function sameSize(a: number | null, b: number | null): boolean {
  return a !== null && b !== null && Math.abs(a - b) < EPSILON;
}

function compactNumber(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toString();
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
    .replace(",", ".")
    .replace(/\s+/g, " ")
    .trim();
}

function findEquivalenceRow(item: SizeConvertibleItem): SizeEquivalence | null {
  const known = {
    br: normalizeSizeValue(item.numeracao_br),
    eu: normalizeSizeValue(item.numeracao_eu),
    us_m: normalizeSizeValue(item.numeracao_us),
  };

  const filled = Object.entries(known).filter(([, value]) => value !== null) as Array<
    [keyof typeof known, number]
  >;
  if (filled.length === 0) return null;

  const exact = SHOE_SIZE_EQUIVALENCE_TABLE.find((row) =>
    filled.every(([system, value]) => sameSize(row[system], value)),
  );
  if (exact) return exact;

  let best: SizeEquivalence | null = null;
  let bestScore = 0;
  for (const row of SHOE_SIZE_EQUIVALENCE_TABLE) {
    const score = filled.filter(([system, value]) => sameSize(row[system], value)).length;
    if (score > bestScore) {
      best = row;
      bestScore = score;
    }
  }

  return best;
}

export function getAllSizeEquivalences(item: SizeConvertibleItem): SizeEquivalence {
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
  return getAllSizeEquivalences(item)[displaySystem];
}

export function formatSizeLabel(
  value: number | null | undefined,
  displaySystem: DisplaySizeSystem,
): string {
  if (value === null || value === undefined) return "—";

  if (displaySystem === "eu") return `EU ${compactNumber(value).replace(".", ",")}`;
  if (displaySystem === "us_y") return `US ${compactNumber(value)}Y`;

  return `${DISPLAY_SYSTEM_LABELS[displaySystem]} ${compactNumber(value)}`;
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

function parseSizeFilter(
  filterValue: string,
  displaySystem: DisplaySizeSystem,
): { system: DisplaySizeSystem; value: number } | null {
  const text = normalizeSizeSearch(filterValue);
  if (!text) return null;

  const compact = text.replace(/\s+/g, "");
  const numberPattern = "(\\d+(?:\\.\\d+)?)";
  const prefixedPatterns: Array<[RegExp, DisplaySizeSystem]> = [
    [new RegExp(`^BR${numberPattern}$`), "br"],
    [new RegExp(`^EU${numberPattern}$`), "eu"],
    [new RegExp(`^USM${numberPattern}$`), "us_m"],
    [new RegExp(`^M${numberPattern}$`), "us_m"],
    [new RegExp(`^USW${numberPattern}$`), "us_w"],
    [new RegExp(`^W${numberPattern}$`), "us_w"],
    [new RegExp(`^US${numberPattern}Y$`), "us_y"],
    [new RegExp(`^${numberPattern}Y$`), "us_y"],
    [new RegExp(`^US${numberPattern}$`), "us_m"],
  ];

  for (const [pattern, system] of prefixedPatterns) {
    const match = compact.match(pattern);
    if (match) {
      const value = normalizeSizeValue(match[1]);
      return value === null ? null : { system, value };
    }
  }

  const value = normalizeSizeValue(compact);
  return value === null ? null : { system: displaySystem, value };
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
  if (sameSize(sizes[parsed.system], parsed.value)) return true;

  const normalizedTarget = normalizeComparable(
    formatSizeLabel(parsed.value, parsed.system).replace("US M", "US"),
  );
  return getSearchableSizeLabels(item).some(
    (label) => normalizeComparable(label) === normalizedTarget,
  );
}
