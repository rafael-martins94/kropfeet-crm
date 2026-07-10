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

/** MIME real pelos magic bytes (não confiar só em file.type / extensão). */
export function detectarMimePorMagicBytes(dados: ArrayBuffer | Uint8Array): string | null {
  const bytes = dados instanceof Uint8Array ? dados : new Uint8Array(dados);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x39 || bytes[4] === 0x37) &&
    bytes[5] === 0x61
  ) {
    return "image/gif";
  }
  return null;
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
