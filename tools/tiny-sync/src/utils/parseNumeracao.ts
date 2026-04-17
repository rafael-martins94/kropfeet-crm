export interface NumeracoesExtraidas {
  br: number | null;
  eu: number | null;
  us: number | null;
  nomeModelo: string;
  nomeCompleto: string;
}

const REGEX_BR = /(?:\[\s*)?BR\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*\]?/i;
const REGEX_EU = /(?:\[\s*)?EU\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*\]?/i;
const REGEX_US = /(?:\[\s*)?US\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*\]?/i;

function extrairNumero(texto: string, regex: RegExp): number | null {
  const m = texto.match(regex);
  if (!m || !m[1]) return null;
  const n = Number(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function limparNomeModelo(nomeOriginal: string): string {
  let nome = nomeOriginal;

  nome = nome.replace(/\[\s*(?:BR|EU|US)\s*[:\-]?\s*\d+(?:[.,]\d+)?\s*\]/gi, " ");
  nome = nome.replace(/\b(?:BR|EU|US)\s*[:\-]?\s*\d+(?:[.,]\d+)?\b/gi, " ");

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
  const us = extrairNumero(nomeCompleto, REGEX_US);
  const nomeModelo = limparNomeModelo(nomeCompleto);
  return { br, eu, us, nomeModelo, nomeCompleto };
}
