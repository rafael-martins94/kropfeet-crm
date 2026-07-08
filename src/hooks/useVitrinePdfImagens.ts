import { useMemo } from "react";
import type { VitrineComItens } from "../services/vitrines";
import { fotoItemVitrinePdf } from "../components/vitrines/VitrineShared";
import { normalizarUrlImagemValor, urlImagemFetchavelNoBrowser } from "../utils/imagemModelo";
import { carregarDataUrlsParaPdf } from "../utils/pdfImagens";
import { useAsync } from "./useAsync";

function coletarUrlsImagensVitrine(
  vitrine: VitrineComItens,
  thumbs?: Record<string, string> | null,
): string[] {
  const urls = new Set<string>();
  for (const item of vitrine.itens) {
    const candidato = fotoItemVitrinePdf(item, thumbs);
    const normalizada = normalizarUrlImagemValor(candidato);
    if (normalizada && urlImagemFetchavelNoBrowser(normalizada)) {
      urls.add(normalizada);
    }
  }
  return [...urls];
}

export function useVitrinePdfImagens(
  vitrine: VitrineComItens | null | undefined,
  thumbs: Record<string, string> | null | undefined,
) {
  const urls = useMemo(
    () => (vitrine ? coletarUrlsImagensVitrine(vitrine, thumbs) : []),
    [vitrine, thumbs],
  );
  const urlsKey = urls.join("\0");

  const dataUrls = useAsync(
    () => (urls.length > 0 ? carregarDataUrlsParaPdf(urls) : Promise.resolve({})),
    [urlsKey],
  );

  return {
    imageDataUrls: dataUrls.data ?? {},
    loading: dataUrls.loading,
    error: dataUrls.error,
    totalUrls: urls.length,
    carregadas: Object.keys(dataUrls.data ?? {}).length,
  };
}
