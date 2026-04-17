import { createHash } from "node:crypto";
import { env } from "../../config/env.js";
import type { SupabaseAppClient } from "./clienteSupabase.js";

const EXTENSAO_POR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export interface ImagemArmazenada {
  caminhoArquivo: string;
  hashArquivo: string;
  mimeType: string;
  tamanhoBytes: number;
  urlPublica: string | null;
  jaExistia: boolean;
}

export class ImagemDownloadError extends Error {
  readonly urlOrigem: string;
  readonly temporario: boolean;
  readonly status: number | null;

  constructor(args: {
    mensagem: string;
    urlOrigem: string;
    temporario?: boolean;
    status?: number | null;
  }) {
    super(args.mensagem);
    this.name = "ImagemDownloadError";
    this.urlOrigem = args.urlOrigem;
    this.temporario = args.temporario ?? false;
    this.status = args.status ?? null;
  }
}

function inferirMimeDaUrl(url: string): string | null {
  const semQuery = url.split("?")[0] ?? url;
  const pos = semQuery.lastIndexOf(".");
  if (pos < 0) return null;
  const ext = semQuery.slice(pos + 1).toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "avif":
      return "image/avif";
    default:
      return null;
  }
}

function normalizarMime(valor: string | null): string | null {
  if (!valor) return null;
  const base = valor.split(";")[0]?.trim().toLowerCase() ?? "";
  return EXTENSAO_POR_MIME[base] ? base : null;
}

async function baixarBinario(
  urlOrigem: string,
): Promise<{ dados: Uint8Array; mimeType: string }> {
  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), env.imagens.timeoutMs);

  let resposta: Response;
  try {
    resposta = await fetch(urlOrigem, { signal: controlador.signal });
  } catch (erro) {
    clearTimeout(timeout);
    throw new ImagemDownloadError({
      mensagem: `Falha de rede ao baixar imagem: ${
        erro instanceof Error ? erro.message : String(erro)
      }`,
      urlOrigem,
      temporario: true,
    });
  }
  clearTimeout(timeout);

  if (!resposta.ok) {
    throw new ImagemDownloadError({
      mensagem: `HTTP ${resposta.status} ao baixar imagem`,
      urlOrigem,
      status: resposta.status,
      temporario: resposta.status >= 500 || resposta.status === 429,
    });
  }

  const mimeHeader = normalizarMime(resposta.headers.get("content-type"));
  const mimeInferido = inferirMimeDaUrl(urlOrigem);
  const mimeType = mimeHeader ?? mimeInferido;

  if (!mimeType) {
    throw new ImagemDownloadError({
      mensagem: `Tipo MIME nao suportado. Header: ${
        resposta.headers.get("content-type") ?? "ausente"
      }`,
      urlOrigem,
    });
  }

  const dados = new Uint8Array(await resposta.arrayBuffer());

  if (dados.byteLength === 0) {
    throw new ImagemDownloadError({
      mensagem: "Arquivo vazio",
      urlOrigem,
    });
  }
  if (dados.byteLength > env.imagens.tamanhoMaximoBytes) {
    throw new ImagemDownloadError({
      mensagem: `Arquivo excede limite (${dados.byteLength} bytes > ${env.imagens.tamanhoMaximoBytes})`,
      urlOrigem,
    });
  }

  return { dados, mimeType };
}

function hashSha256Hex(dados: Uint8Array): string {
  return createHash("sha256").update(dados).digest("hex");
}

export function montarCaminhoArquivo(
  idModelo: string,
  hash: string,
  mimeType: string,
): string {
  const ext = EXTENSAO_POR_MIME[mimeType] ?? "bin";
  return `modelos/${idModelo}/${hash}.${ext}`;
}

export function obterUrlPublica(
  supabase: SupabaseAppClient,
  caminhoArquivo: string,
): string | null {
  const { data } = supabase.storage
    .from(env.supabase.bucketImagens)
    .getPublicUrl(caminhoArquivo);
  return data?.publicUrl ?? null;
}

export async function baixarEArmazenarImagemDoModelo(
  supabase: SupabaseAppClient,
  urlOrigem: string,
  idModelo: string,
): Promise<ImagemArmazenada> {
  const { dados, mimeType } = await baixarBinario(urlOrigem);
  const hash = hashSha256Hex(dados);
  const caminhoArquivo = montarCaminhoArquivo(idModelo, hash, mimeType);

  const upload = await supabase.storage
    .from(env.supabase.bucketImagens)
    .upload(caminhoArquivo, dados, {
      contentType: mimeType,
      upsert: false,
      cacheControl: "31536000",
    });

  let jaExistia = false;
  if (upload.error) {
    const msg = upload.error.message ?? "";
    const duplicado = /already exists|duplicate|resource already exists/i.test(msg);
    if (!duplicado) {
      throw new ImagemDownloadError({
        mensagem: `Falha ao subir para o bucket: ${msg}`,
        urlOrigem,
      });
    }
    jaExistia = true;
  }

  return {
    caminhoArquivo,
    hashArquivo: hash,
    mimeType,
    tamanhoBytes: dados.byteLength,
    urlPublica: obterUrlPublica(supabase, caminhoArquivo),
    jaExistia,
  };
}
