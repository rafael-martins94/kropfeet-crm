import { env } from "../lib/env";
import { supabase } from "../lib/supabase";

type ImagemComUrl = {
  url_origem?: string | null;
  caminho_arquivo?: string | null;
};

export function urlImagemModelo(imagem: ImagemComUrl | null | undefined): string | null {
  if (!imagem) return null;

  const urlOrigem = imagem.url_origem?.trim();
  if (urlOrigem) return urlOrigem;

  const caminho = imagem.caminho_arquivo?.trim();
  if (!caminho) return null;
  if (caminho.startsWith("http://") || caminho.startsWith("https://")) return caminho;

  const { data } = supabase.storage.from(env.supabase.bucketImagens).getPublicUrl(caminho);
  return data.publicUrl;
}
