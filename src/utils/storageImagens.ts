import { env } from "../lib/env";
import { supabase } from "../lib/supabase";

const EXTENSAO_POR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function hashArquivoSha256Hex(dados: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", dados);
  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function extensaoPorMime(mimeType: string): string {
  return EXTENSAO_POR_MIME[mimeType.toLowerCase()] ?? "bin";
}

export function montarCaminhoArquivoModelo(
  idModelo: string,
  hash: string,
  mimeType: string,
): string {
  return `modelos/${idModelo}/${hash}.${extensaoPorMime(mimeType)}`;
}

export function urlPublicaStorage(caminhoArquivo: string): string {
  const { data } = supabase.storage
    .from(env.supabase.bucketImagens)
    .getPublicUrl(caminhoArquivo);
  return data.publicUrl;
}
