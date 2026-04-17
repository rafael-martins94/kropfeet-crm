export function formatarData(
  valor: string | null | undefined,
  opcoes: Intl.DateTimeFormatOptions = { dateStyle: "short" },
): string {
  if (!valor) return "—";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", opcoes).format(data);
}

export function formatarDataHora(valor: string | null | undefined): string {
  return formatarData(valor, { dateStyle: "short", timeStyle: "short" });
}

export function formatarMoeda(
  valor: number | null | undefined,
  moeda = "BRL",
  locale = "pt-BR",
): string {
  if (valor === null || valor === undefined) return "—";
  const normalizada = (moeda ?? "BRL").trim().toUpperCase() || "BRL";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: normalizada,
      minimumFractionDigits: 2,
    }).format(valor);
  } catch {
    return `${normalizada} ${valor.toFixed(2)}`;
  }
}

export function formatarNumero(
  valor: number | null | undefined,
  fractionDigits = 0,
): string {
  if (valor === null || valor === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(valor);
}

export function traduzirEnum(valor: string | null | undefined): string {
  if (!valor) return "—";
  return valor
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function iniciaisDoNome(nome: string | null | undefined): string {
  if (!nome) return "?";
  const partes = nome.trim().split(/\s+/).slice(0, 2);
  return partes.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function truncar(texto: string | null | undefined, max = 48): string {
  if (!texto) return "—";
  if (texto.length <= max) return texto;
  return `${texto.slice(0, max - 1).trimEnd()}…`;
}

export function limparParaBanco<T extends Record<string, unknown>>(obj: T): T {
  const saida: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(obj)) {
    if (typeof valor === "string") {
      const t = valor.trim();
      saida[chave] = t === "" ? null : t;
    } else {
      saida[chave] = valor;
    }
  }
  return saida as T;
}
