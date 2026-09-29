import { BlobProvider } from "@react-pdf/renderer";
import { useMemo, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { SectionCard } from "../../components/SectionCard";
import {
  MapaColetaPdfDocument,
  fotoItemMapaColetaPdf,
} from "../../components/vitrines/MapaColetaPdfDocument";
import { useAsync } from "../../hooks/useAsync";
import { modelosProdutoService } from "../../services/modelos-produto";
import { vitrinesService } from "../../services/vitrines";
import { normalizarUrlImagemValor, urlImagemFetchavelNoBrowser } from "../../utils/imagemModelo";
import { carregarMiniaturasParaPdf } from "../../utils/pdfImagens";

export default function VitrineMapaColetaPdfPage() {
  const { id } = useParams<{ id: string }>();
  const dados = useAsync(() => (id ? vitrinesService.obterMapaColeta(id) : Promise.resolve(null)), [id]);
  const thumbs = useAsync(() => modelosProdutoService.listarUrlsPrincipaisPorModelo(), []);

  const vitrine = dados.data?.vitrine ?? null;
  const mapa = dados.data?.mapa ?? null;
  const gabarito = dados.data?.gabarito;

  const urls = useMemo(() => {
    if (!mapa) return [];
    const unicas = new Set<string>();
    for (const item of [...mapa.entradas, ...mapa.saidas, ...mapa.trocas_caixa, ...(gabarito ?? [])]) {
      const normalizada = normalizarUrlImagemValor(fotoItemMapaColetaPdf(item, thumbs.data));
      if (normalizada && urlImagemFetchavelNoBrowser(normalizada)) unicas.add(normalizada);
    }
    return [...unicas];
  }, [mapa, gabarito, thumbs.data]);
  const urlsKey = urls.join("\0");
  const imagens = useAsync(
    () => (urls.length > 0 ? carregarMiniaturasParaPdf(urls) : Promise.resolve({})),
    [urlsKey],
  );

  const pdfPronto =
    !dados.loading &&
    !thumbs.loading &&
    !imagens.loading &&
    vitrine &&
    mapa &&
    (urls.length === 0 || Object.keys(imagens.data ?? {}).length > 0);

  const documento = useMemo(() => {
    if (!pdfPronto || !vitrine || !mapa) return null;
    return (
      <MapaColetaPdfDocument
        vitrine={vitrine}
        mapa={mapa}
        tituloVitrineAnterior={dados.data?.tituloVitrineAnterior}
        gabarito={gabarito ?? []}
        thumbs={thumbs.data}
        imageDataUrls={imagens.data ?? {}}
      />
    );
  }, [pdfPronto, vitrine, mapa, gabarito, dados.data?.tituloVitrineAnterior, thumbs.data, imagens.data]);

  const fileName = vitrine
    ? `mapa-coleta-${vitrine.titulo.replace(/[^\w-]+/g, "-").toLowerCase()}.pdf`
    : "mapa-coleta.pdf";

  const header = (acoes?: ReactNode) => (
    <PageHeader
      title="PDF do mapa de coleta"
      breadcrumbs={[
        { label: "Operação" },
        { label: "Vitrines", to: "/vitrines" },
        { label: "Mapa", to: id ? `/vitrines/${id}/mapa` : undefined },
        { label: "PDF" },
      ]}
      backTo={id ? `/vitrines/${id}/mapa` : "/vitrines"}
      actions={acoes}
    />
  );

  const semMapa = !dados.loading && !dados.error && (!vitrine || !mapa);
  const labelPreparacao =
    dados.loading || thumbs.loading ? "Carregando mapa de coleta…" : "Preparando imagens do PDF…";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {documento ? (
        <BlobProvider document={documento}>
          {({ url, loading, error }) => (
            <>
              {header(
                url ? (
                  <a href={url} download={fileName} className="btn-primary">
                    Baixar PDF
                  </a>
                ) : null,
              )}
              <SectionCard noPadding>
                <div className="h-[75vh] overflow-hidden rounded-xl">
                  {loading || !url ? (
                    <LoadingState label="Montando o PDF…" className="h-full" />
                  ) : (
                    <iframe title="PDF do mapa de coleta" src={`${url}#toolbar=1`} className="h-full w-full border-0" />
                  )}
                </div>
              </SectionCard>
              {error ? <p className="mt-3 text-sm text-red-700">{error.message}</p> : null}
            </>
          )}
        </BlobProvider>
      ) : (
        <>
          {header()}
          {semMapa ? (
            <SectionCard>
              <p className="text-sm text-ink-soft">
                {!vitrine ? "Vitrine não encontrada." : "Esta vitrine não tem mapa de coleta registrado."}
              </p>
            </SectionCard>
          ) : !dados.error ? (
            <SectionCard>
              <LoadingState label={labelPreparacao} className="min-h-[50vh]" />
            </SectionCard>
          ) : null}
        </>
      )}
      {dados.error ? <p className="mt-3 text-sm text-red-700">{dados.error.message}</p> : null}
      {imagens.error ? <p className="mt-3 text-sm text-red-700">{imagens.error.message}</p> : null}
    </div>
  );
}
