import { env } from "../lib/env";
import { supabase } from "../lib/supabase";
import {
  extrairCaminhoStorageSupabase,
  normalizarUrlImagemValor,
  urlImagemFetchavelNoBrowser,
} from "./imagemModelo";

const cacheDataUrl = new Map<string, string>();

type FormatoImagemPdf = "jpeg" | "png" | "webp" | "outro";

function detectarFormatoImagem(bytes: Uint8Array): FormatoImagemPdf {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return "jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
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
    return "webp";
  }
  return "outro";
}

function bytesParaDataUrl(bytes: Uint8Array, mime: string): string {
  let binario = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binario += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(binario)}`;
}

/** Converte qualquer bitmap decodificável pelo browser (ex.: WebP) para PNG — formato aceito pelo react-pdf. */
async function converterBlobParaPngDataUrl(blob: Blob): Promise<string | null> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        bitmap.close();
        return null;
      }
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      return canvas.toDataURL("image/png");
    } catch {
      // fallback abaixo
    }
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx || !canvas.width || !canvas.height) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(null);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
    img.src = objectUrl;
  });
}

/**
 * Prepara blob para o PDF: JPEG/PNG passam direto (com MIME correto pelos magic bytes);
 * WebP e formatos desconhecidos são convertidos para PNG via canvas.
 */
async function blobParaDataUrlPdf(blob: Blob): Promise<string | null> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length === 0) return null;

  const formato = detectarFormatoImagem(bytes);
  if (formato === "jpeg") return bytesParaDataUrl(bytes, "image/jpeg");
  if (formato === "png") return bytesParaDataUrl(bytes, "image/png");

  // WebP (ou MIME mentiroso: .png/.jpg com bytes WebP) — react-pdf não embute WebP.
  return converterBlobParaPngDataUrl(new Blob([bytes], { type: blob.type || "image/webp" }));
}

async function baixarDoStorage(caminho: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(env.supabase.bucketImagens).download(caminho);
  if (error || !data) return null;
  return blobParaDataUrlPdf(data);
}

export async function urlParaDataUrlPdf(url: string): Promise<string | null> {
  if (url.startsWith("data:")) {
    // data:image/webp → converter; jpeg/png ok
    if (url.startsWith("data:image/webp")) {
      const res = await fetch(url);
      return blobParaDataUrlPdf(await res.blob());
    }
    return url;
  }

  const cached = cacheDataUrl.get(url);
  if (cached) return cached;

  const normalizada = normalizarUrlImagemValor(url);
  if (!normalizada) return null;

  if (!urlImagemFetchavelNoBrowser(normalizada)) return null;

  if (!normalizada.startsWith("http")) {
    const dataUrl = await baixarDoStorage(normalizada);
    if (dataUrl) {
      cacheDataUrl.set(url, dataUrl);
      cacheDataUrl.set(normalizada, dataUrl);
      return dataUrl;
    }
  }

  const caminhoStorage = extrairCaminhoStorageSupabase(normalizada);
  if (caminhoStorage) {
    const dataUrl = await baixarDoStorage(caminhoStorage);
    if (dataUrl) {
      cacheDataUrl.set(url, dataUrl);
      cacheDataUrl.set(normalizada, dataUrl);
      return dataUrl;
    }
  }

  try {
    const res = await fetch(normalizada);
    if (!res.ok) return null;
    const dataUrl = await blobParaDataUrlPdf(await res.blob());
    if (!dataUrl) return null;
    cacheDataUrl.set(url, dataUrl);
    cacheDataUrl.set(normalizada, dataUrl);
    return dataUrl;
  } catch {
    return null;
  }
}

export async function carregarDataUrlsParaPdf(urls: string[]): Promise<Record<string, string>> {
  const unicas = [...new Set(urls.filter(Boolean))];
  const pares = await Promise.all(
    unicas.map(async (url) => {
      const dataUrl = await urlParaDataUrlPdf(url);
      return dataUrl ? ([url, dataUrl] as const) : null;
    }),
  );
  return Object.fromEntries(pares.filter((p): p is readonly [string, string] => p != null));
}

export function resolverSrcImagemPdf(
  url: string | null | undefined,
  dataUrls: Record<string, string>,
): string | null {
  const normalizada = normalizarUrlImagemValor(url);
  if (!normalizada) return null;
  if (normalizada.startsWith("data:")) return normalizada;
  return dataUrls[normalizada] ?? dataUrls[url ?? ""] ?? null;
}
