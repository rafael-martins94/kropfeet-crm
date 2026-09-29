import { formatarMoeda } from "./format";

/** Conta SumUp da galeria: o dia comercial é o de Lisboa, não o do navegador. */
export const FUSO_PORTUGAL = "Europe/Lisbon";

export function dataCalendarioPortugal(instante = new Date()): {
  ano: number;
  mes: number;
  dia: number;
} {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_PORTUGAL,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instante);
  const [ano, mes, dia] = iso.split("-").map(Number);
  return { ano, mes, dia };
}

function partesNoFuso(ms: number) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSO_PORTUGAL,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ms));
  const ler = (tipo: string) => Number(partes.find((parte) => parte.type === tipo)?.value);
  return {
    ano: ler("year"),
    mes: ler("month"),
    dia: ler("day"),
    hora: ler("hour"),
    minuto: ler("minute"),
    segundo: ler("second"),
  };
}

/** Meia-noite em Lisboa do dia civil indicado, em ISO UTC. */
export function inicioDoDiaPortugalIso(ano: number, mes: number, dia: number): string {
  const chute = Date.UTC(ano, mes - 1, dia, 0, 0, 0);
  const visto = partesNoFuso(chute);
  const vistoComoUtc = Date.UTC(visto.ano, visto.mes - 1, visto.dia, visto.hora, visto.minuto, visto.segundo);
  return new Date(chute - (vistoComoUtc - chute)).toISOString();
}

export function inicioDoDiaSeguintePortugalIso(ano: number, mes: number, dia: number): string {
  const seguinte = new Date(Date.UTC(ano, mes - 1, dia + 1));
  return inicioDoDiaPortugalIso(
    seguinte.getUTCFullYear(),
    seguinte.getUTCMonth() + 1,
    seguinte.getUTCDate(),
  );
}

export function isoDataPortugal(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return null;
  const { ano, mes, dia } = dataCalendarioPortugal(data);
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function formatarDataHoraPortugal(valor: string | null | undefined): string {
  if (!valor) return "—";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: FUSO_PORTUGAL,
  }).format(data);
}

export function formatarDataPortugal(valor: string | null | undefined): string {
  if (!valor) return "—";
  const calendario = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (calendario) return `${calendario[3]}/${calendario[2]}/${calendario[1]}`;
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "short",
    timeZone: FUSO_PORTUGAL,
  }).format(data);
}

export function formatarEuro(valor: number | null | undefined, moeda = "EUR"): string {
  const normalizada = (moeda ?? "EUR").trim().toUpperCase() || "EUR";
  if (normalizada === "BRL") return formatarMoeda(valor, "BRL");
  return formatarMoeda(valor, normalizada, "pt-PT");
}
