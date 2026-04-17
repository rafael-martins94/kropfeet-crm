export function normalizarTexto(valor: string | null | undefined): string | null {
  if (valor === null || valor === undefined) return null;
  const limpo = String(valor).trim().replace(/\s+/g, " ");
  return limpo.length === 0 ? null : limpo;
}

export function gerarSlug(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 120);
}

export function paraNumeroOuNulo(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const texto = String(valor).replace(/\./g, "").replace(",", ".");
  const tentativaDireta = Number(valor);
  const tentativaBr = Number(texto);
  const escolhido = Number.isFinite(tentativaDireta) ? tentativaDireta : tentativaBr;
  return Number.isFinite(escolhido) ? escolhido : null;
}

export function paraDataIso(valor: unknown): string | null {
  if (!valor) return null;
  const s = String(valor).trim();
  if (!s) return null;

  const brDateTime = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (brDateTime) {
    const [, dd, mm, yyyy, hh = "00", mi = "00", ss = "00"] = brDateTime;
    return new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}-03:00`).toISOString();
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function paraDataApenas(valor: unknown): string | null {
  const iso = paraDataIso(valor);
  return iso ? iso.substring(0, 10) : null;
}
