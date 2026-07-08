export interface NumeracoesExtraidas {
  br: number | null;
  eu: number | null;
  us: string | null;
  nomeModelo: string;
  nomeCompleto: string;
}

const REGEX_BR = /(?:\[\s*)?BR\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*\]?/i;
const REGEX_EU = /(?:\[\s*)?EU\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*\]?/i;
const REGEX_US = /(?:\[\s*)?US\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*([CcYyWw])?\s*\]?/i;

function extrairNumero(texto: string, regex: RegExp): number | null {
  const m = texto.match(regex);
  if (!m || !m[1]) return null;
  const n = Number(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function extrairUs(texto: string): string | null {
  const m = texto.match(REGEX_US);
  if (!m || !m[1]) return null;
  const n = Number(m[1].replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const numero = Number.isInteger(n) ? n.toFixed(0) : String(n);
  const suf = (m[2] ?? "").toUpperCase();
  if (suf === "C") return `${numero}C`;
  if (suf === "Y") return `${numero}Y`;
  if (suf === "W") return `${numero}W`;
  return numero;
}

function limparNomeModelo(nomeOriginal: string): string {
  let nome = nomeOriginal;

  nome = nome.replace(/\[\s*(?:BR|EU|US)\s*[:\-]?\s*\d+(?:[.,]\d+)?\s*[CcYyWw]?\s*\]/gi, " ");
  nome = nome.replace(/\b(?:BR|EU|US)\s*[:\-]?\s*\d+(?:[.,]\d+)?\s*[CcYyWw]?\b/gi, " ");

  const idxHash = nome.indexOf("#");
  if (idxHash >= 0) nome = nome.slice(0, idxHash);

  nome = nome.replace(/[#|\-–—]\s*$/g, "");
  nome = nome.replace(/\s+/g, " ").trim();

  return nome;
}

export function parseNomeProdutoTiny(nomeBruto: string): NumeracoesExtraidas {
  const nomeCompleto = nomeBruto.trim();
  const br = extrairNumero(nomeCompleto, REGEX_BR);
  const eu = extrairNumero(nomeCompleto, REGEX_EU);
  const us = extrairUs(nomeCompleto);
  const nomeModelo = limparNomeModelo(nomeCompleto);
  return { br, eu, us, nomeModelo, nomeCompleto };
}
