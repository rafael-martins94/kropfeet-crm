import { BlobProvider } from "@react-pdf/renderer";
import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { SectionCard } from "../../components/SectionCard";
import { VitrinePdfDocument } from "../../components/vitrines/VitrinePdfDocument";
import { useAsync } from "../../hooks/useAsync";
import { useVitrinePdfImagens } from "../../hooks/useVitrinePdfImagens";
import { modelosProdutoService } from "../../services/modelos-produto";
import { vitrinesService } from "../../services/vitrines";

export default function VitrinePdfPage() {
  const { id } = useParams<{ id: string }>();
  const vitrine = useAsync(() => (id ? vitrinesService.obterComItens(id) : Promise.resolve(null)), [id]);
  const thumbs = useAsync(() => modelosProdutoService.listarUrlsPrincipaisPorModelo(), []);
  const pdfImagens = useVitrinePdfImagens(vitrine.data, thumbs.data);
  const pdfPronto =
    !vitrine.loading &&
    !thumbs.loading &&
    !pdfImagens.loading &&
    vitrine.data &&
    (pdfImagens.totalUrls === 0 || pdfImagens.carregadas > 0);

  const documento = useMemo(() => {
    if (!pdfPronto || !vitrine.data) return null;
    return (
      <VitrinePdfDocument
        vitrine={vitrine.data}
        thumbs={thumbs.data}
        imageDataUrls={pdfImagens.imageDataUrls}
      />
    );
  }, [pdfPronto, vitrine.data, thumbs.data, pdfImagens.imageDataUrls]);

  const fileName = vitrine.data
    ? `${vitrine.data.titulo.replace(/[^\w-]+/g, "-").toLowerCase()}-v${vitrine.data.versao_atual ?? 1}.pdf`
    : "vitrine.pdf";

  const labelPreparacao =
    vitrine.loading || thumbs.loading ? "Carregando vitrine…" : "Preparando imagens do PDF…";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {documento ? (
        <BlobProvider document={documento}>
          {({ url, loading, error }) => (
            <>
              <PageHeader
                title="PDF da vitrine"
                breadcrumbs={[{ label: "Operação" }, { label: "Vitrines", to: "/vitrines" }, { label: "PDF" }]}
                backTo={id ? `/vitrines/${id}` : "/vitrines"}
                actions={
                  url ? (
                    <a href={url} download={fileName} className="btn-primary">
                      Baixar PDF
                    </a>
                  ) : null
                }
              />
              <SectionCard noPadding>
                <div className="h-[75vh] overflow-hidden rounded-xl">
                  {loading || !url ? (
                    <LoadingState label="Montando o PDF…" className="h-full" />
                  ) : (
                    <iframe title="PDF da vitrine" src={`${url}#toolbar=1`} className="h-full w-full border-0" />
                  )}
                </div>
              </SectionCard>
              {error ? <p className="mt-3 text-sm text-red-700">{error.message}</p> : null}
            </>
          )}
        </BlobProvider>
      ) : (
        <>
          <PageHeader
            title="PDF da vitrine"
            breadcrumbs={[{ label: "Operação" }, { label: "Vitrines", to: "/vitrines" }, { label: "PDF" }]}
            backTo={id ? `/vitrines/${id}` : "/vitrines"}
          />
          {!vitrine.error ? (
            <SectionCard>
              <LoadingState label={labelPreparacao} className="min-h-[50vh]" />
            </SectionCard>
          ) : null}
        </>
      )}
      {vitrine.error ? <p className="mt-3 text-sm text-red-700">{vitrine.error.message}</p> : null}
      {pdfImagens.error ? <p className="mt-3 text-sm text-red-700">{pdfImagens.error.message}</p> : null}
    </div>
  );
}
