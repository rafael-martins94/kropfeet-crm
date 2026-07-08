import { env } from "../lib/env";
import { supabase } from "../lib/supabase";
import {
  extrairCaminhoStorageSupabase,
  normalizarUrlImagemValor,
  urlImagemFetchavelNoBrowser,
} from "./imagemModelo";

const cacheDataUrl = new Map<string, string>();

async function blobParaDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function baixarDoStorage(caminho: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(env.supabase.bucketImagens).download(caminho);
  if (error || !data) return null;
  return blobParaDataUrl(data);
}

export async function urlParaDataUrlPdf(url: string): Promise<string | null> {
  if (url.startsWith("data:")) return url;

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
    const dataUrl = await blobParaDataUrl(await res.blob());
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
