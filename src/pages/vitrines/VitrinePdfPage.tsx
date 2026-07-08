import { PDFDownloadLink, PDFViewer } from "@react-pdf/renderer";
import { useParams } from "react-router-dom";
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

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        title="PDF da vitrine"
        breadcrumbs={[{ label: "Operação" }, { label: "Vitrines", to: "/vitrines" }, { label: "PDF" }]}
        backTo={id ? `/vitrines/${id}` : "/vitrines"}
        actions={
          pdfPronto ? (
            <PDFDownloadLink
              document={
                <VitrinePdfDocument
                  vitrine={vitrine.data!}
                  thumbs={thumbs.data}
                  imageDataUrls={pdfImagens.imageDataUrls}
                />
              }
              fileName={`${vitrine.data!.titulo.replace(/[^\w-]+/g, "-").toLowerCase()}.pdf`}
            >
              {({ loading }) => (
                <span className="btn-primary">
                  Baixar PDF
                  {loading ? "…" : ""}
                </span>
              )}
            </PDFDownloadLink>
          ) : null
        }
      />

      {!pdfPronto ? (
        <SectionCard><p className="text-sm text-ink-soft">Preparando imagens do PDF…</p></SectionCard>
      ) : (
        <SectionCard noPadding>
          <div className="h-[75vh] overflow-hidden rounded-xl">
            <PDFViewer width="100%" height="100%">
              <VitrinePdfDocument
                vitrine={vitrine.data!}
                thumbs={thumbs.data}
                imageDataUrls={pdfImagens.imageDataUrls}
              />
            </PDFViewer>
          </div>
        </SectionCard>
      )}
      {vitrine.error ? <p className="mt-3 text-sm text-red-700">{vitrine.error.message}</p> : null}
      {pdfImagens.error ? <p className="mt-3 text-sm text-red-700">{pdfImagens.error.message}</p> : null}
    </div>
  );
}
