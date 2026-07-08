import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { VitrineTituloEditavel } from "../../components/vitrines/VitrineTituloEditavel";
import { SectionCard } from "../../components/SectionCard";
import { CaixaResumoCard, LinkPdfVitrine, VitrineMeta } from "../../components/vitrines/VitrineShared";
import { useAsync } from "../../hooks/useAsync";
import { vitrinesService } from "../../services/vitrines";

export default function VitrineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const vitrine = useAsync(() => (id ? vitrinesService.obterComItens(id) : Promise.resolve(null)), [id]);

  const itens = [...(vitrine.data?.itens ?? [])].sort(
    (a, b) => (a.numero_caixa ?? 999) - (b.numero_caixa ?? 999),
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        title={
          vitrine.data ? (
            <VitrineTituloEditavel
              idVitrine={vitrine.data.id}
              titulo={vitrine.data.titulo}
              className="font-display text-2xl font-semibold whitespace-nowrap text-brand-700 sm:text-3xl"
              editavel
              onAtualizado={() => vitrine.reload()}
            />
          ) : (
            "Vitrine"
          )
        }
        breadcrumbs={[{ label: "Operação" }, { label: "Vitrines", to: "/vitrines" }, { label: "Detalhes" }]}
        backTo="/vitrines"
        actions={vitrine.data ? <LinkPdfVitrine id={vitrine.data.id} /> : null}
      />

      {vitrine.loading ? (
        <SectionCard><p className="text-sm text-ink-soft">Carregando…</p></SectionCard>
      ) : !vitrine.data ? (
        <SectionCard><p className="text-sm text-ink-soft">Vitrine não encontrada.</p></SectionCard>
      ) : (
        <div className="space-y-5">
          <SectionCard title="Resumo">
            <VitrineMeta vitrine={vitrine.data} />
          </SectionCard>
          <SectionCard title="Caixas" description="Dados históricos congelados no momento da publicação.">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {itens.map((item) => (
                <div key={item.id} className="rounded-xl border border-line p-4">
                  <CaixaResumoCard item={item} numeroCaixa={item.numero_caixa} />
                  <div className="mt-3 border-t border-line pt-3 text-xs text-ink-muted">
                    {item.snapshot?.item_unico ? (
                      <span className="font-semibold text-amber-800">Único</span>
                    ) : (
                      <span>{item.snapshot?.correspondencias?.length ?? 0} correspondência(s)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
          {vitrine.data.status === "rascunho" ? (
            <SectionCard>
              <Link
                to={`/vitrines/${vitrine.data.id}/editar`}
                className="text-sm font-medium text-brand-700 hover:text-brand-800"
              >
                Continuar edição deste rascunho
              </Link>
            </SectionCard>
          ) : null}
        </div>
      )}
      {vitrine.error ? <p className="mt-3 text-sm text-red-700">{vitrine.error.message}</p> : null}
    </div>
  );
}
