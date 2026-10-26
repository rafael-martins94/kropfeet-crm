import { formatarDataHora } from "./format";
import { formatSizeLabel, getSizeByDisplaySystem, getUsDisplayLabel, type DisplaySizeSystem } from "./sizeConversion";

export type ValidadeHorasLink = 24 | 48 | 72;

export function textoValidadeLink(link: {
  validade_horas: number;
  aberto_em: string | null;
  validade_em: string;
}): string {
  if (!link.aberto_em) return `${link.validade_horas} horas depois da abertura`;
  return formatarDataHora(link.validade_em);
}

export function numeracaoVisivel(
  item: {
    numeracao_br?: number | null;
    numeracao_eu?: number | null;
    numeracao_us?: string | null;
    nome_produto?: string | null;
  },
  padrao?: DisplaySizeSystem,
): string {
  if (padrao === "us") {
    const us = getUsDisplayLabel(item);
    return us === "—" ? "" : us;
  }
  if (padrao === "br" || padrao === "eu") {
    const label = formatSizeLabel(getSizeByDisplaySystem(item, padrao), padrao);
    return label === "—" ? "" : label;
  }
  return [
    formatSizeLabel(getSizeByDisplaySystem(item, "br"), "br"),
    formatSizeLabel(getSizeByDisplaySystem(item, "eu"), "eu"),
    getUsDisplayLabel(item),
  ]
    .filter((parte) => parte !== "—")
    .join(" · ");
}

const MENSAGEM_LINK_ANTIGA =
  "Olá {nome}! Separei estes tênis para você. Este link vale {validade}. Se ninguém abrir em 7 dias, ele expira:\n{url}";

export const MENSAGEM_LINK_PADRAO =
  "Separei estes tênis para você. Após a abertura, o link tem validade de {validade}.\n{url}";

export function prazoDaMensagemLink(horas: number): string {
  return `${horas} horas`;
}

export const DOMINIO_PUBLICO_LINK = (import.meta.env.VITE_APP_URL || "https://app.kropfeet.com").replace(/\/$/, "");

export function urlDoLink(token: string): string {
  return `${DOMINIO_PUBLICO_LINK}/p/${token}`;
}

export function mensagemDoLink(
  modelo: string | null | undefined,
  dados: { nome?: string | null; instagram: string; validade: string; url: string },
): string {
  const tratamento = dados.nome?.trim() || `@${dados.instagram.replace(/^@+/, "")}`;
  const modeloLimpo = modelo?.trim();
  return (modeloLimpo && modeloLimpo !== MENSAGEM_LINK_ANTIGA ? modeloLimpo : MENSAGEM_LINK_PADRAO)
    .replaceAll("{nome}", tratamento)
    .replaceAll("{instagram}", `@${dados.instagram.replace(/^@+/, "")}`)
    .replaceAll("{validade}", dados.validade)
    .replaceAll("{url}", dados.url);
}

export function situacaoLink(status: string, validadeEm: string, agora = Date.now()): "ativo" | "expirado" | "desativado" {
  if (status === "desativado") return "desativado";
  if (new Date(validadeEm).getTime() <= agora) return "expirado";
  return "ativo";
}

export function rotuloSituacaoLink(situacao: "ativo" | "expirado" | "desativado"): string {
  if (situacao === "ativo") return "Ativo";
  if (situacao === "expirado") return "Expirado";
  return "Desativado";
}

export function normalizarMoeda(moeda: string | null | undefined): "BRL" | "EUR" | null {
  const texto = moeda?.trim().toUpperCase() ?? "";
  if (texto === "EUR" || texto === "EURO" || texto === "€") return "EUR";
  if (texto === "BRL" || texto === "R$" || texto === "REAL") return "BRL";
  return null;
}

export function itemTemPrecoNaMoeda(
  item: { moedaOriginal: string | null; precoOriginal: number | null },
  moedaDestino: "BRL" | "EUR",
): boolean {
  return normalizarMoeda(item.moedaOriginal) === moedaDestino && Number(item.precoOriginal) > 0;
}

export function destinoPorMoeda(destino: string): { moeda: "BRL" | "EUR"; conta: "br" | "pt"; rotulo: string } {
  if (destino === "europa") return { moeda: "EUR", conta: "pt", rotulo: "Europa" };
  return { moeda: "BRL", conta: "br", rotulo: "Brasil" };
}
