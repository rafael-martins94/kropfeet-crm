import { env } from "../lib/env";
import { supabase } from "../lib/supabase";

type ImagemComUrl = {
  url_origem?: string | null;
  caminho_arquivo?: string | null;
};

function urlStorageImagem(caminho: string): string {
  if (caminho.startsWith("http://") || caminho.startsWith("https://")) return caminho;
  const { data } = supabase.storage.from(env.supabase.bucketImagens).getPublicUrl(caminho);
  return data.publicUrl;
}

/** URL para exibição na UI — prefere arquivo no bucket (fetchável) e cai no Tiny só se necessário. */
export function urlImagemModelo(imagem: ImagemComUrl | null | undefined): string | null {
  if (!imagem) return null;

  const caminho = imagem.caminho_arquivo?.trim();
  if (caminho) return urlStorageImagem(caminho);

  const urlOrigem = imagem.url_origem?.trim();
  if (urlOrigem) return urlOrigem;

  return null;
}

/** Normaliza valor único (URL absoluta ou caminho no bucket). */
export function normalizarUrlImagemValor(valor: string | null | undefined): string | null {
  if (!valor?.trim()) return null;
  const v = valor.trim();
  if (v.startsWith("data:") || v.startsWith("http://") || v.startsWith("https://")) return v;
  return urlStorageImagem(v);
}

/** Indica se a URL pode ser baixada via fetch/storage no browser (ex.: PDF). */
export function urlImagemFetchavelNoBrowser(valor: string | null | undefined): boolean {
  const url = normalizarUrlImagemValor(valor);
  if (!url) return false;
  if (url.startsWith("data:")) return true;
  if (!url.startsWith("http")) return true;
  return url.includes(".supabase.co/storage/");
}

/** Extrai caminho relativo no bucket a partir da URL pública do Supabase Storage. */
export function extrairCaminhoStorageSupabase(url: string): string | null {
  const marker = `/storage/v1/object/public/${env.supabase.bucketImagens}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}
