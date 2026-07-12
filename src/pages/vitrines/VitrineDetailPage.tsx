import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { VitrineTituloEditavel } from "../../components/vitrines/VitrineTituloEditavel";
import { SectionCard } from "../../components/SectionCard";
import { CaixaResumoCard, LinkPdfVitrine, VitrineMeta } from "../../components/vitrines/VitrineShared";
import { StatusBadge } from "../../components/StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import { vitrinesService, type VitrineVersaoResumo } from "../../services/vitrines";
import { formatarData } from "../../utils/format";
import { cn } from "../../utils/cn";

const MOTIVO_LABEL: Record<string, string> = {
  publicacao: "Publicação",
  venda: "Venda",
  substituicao: "Substituição",
  cancelamento: "Cancelamento",
};

export default function VitrineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const vitrine = useAsync(() => (id ? vitrinesService.obterComItens(id) : Promise.resolve(null)), [id]);
  const versoes = useAsync(
    () => (id ? vitrinesService.listarVersoes(id) : Promise.resolve([])),
    [id],
  );

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
          <SectionCard title="Caixas" description="Estado atual das 22 caixas desta vitrine.">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {itens.map((item) => {
                const vendida = item.estado_caixa === "vendida";
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "rounded-xl border p-4",
                      vendida ? "border-amber-300 ring-1 ring-amber-200" : "border-line",
                    )}
                  >
                    <CaixaResumoCard item={item} numeroCaixa={item.numero_caixa} />
                    <div className="mt-3 border-t border-line pt-3 text-xs text-ink-muted">
                      {vendida ? (
                        <span className="font-medium text-amber-900">
                          Vendido
                          {item.venda_saida ? ` · OV #${item.venda_saida.numero ?? "—"}` : ""}
                        </span>
                      ) : item.snapshot?.item_unico ? (
                        <span className="font-semibold text-amber-800">Único</span>
                      ) : (
                        <span>{item.snapshot?.correspondencias?.length ?? 0} correspondência(s)</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
          {vitrine.data.status !== "rascunho" ? (
            <SectionCard title="Histórico de versões">
              {versoes.loading ? (
                <p className="text-sm text-ink-soft">Carregando…</p>
              ) : (versoes.data?.length ?? 0) === 0 ? (
                <p className="text-sm text-ink-soft">Nenhuma versão registrada.</p>
              ) : (
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {(versoes.data as VitrineVersaoResumo[]).map((versao) => (
                    <li key={versao.id} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
                      <span className="font-semibold text-ink">Versão {versao.numero}</span>
                      <StatusBadge
                        value={versao.motivo}
                        label={MOTIVO_LABEL[versao.motivo] ?? versao.motivo}
                        tom={versao.motivo === "venda" ? "aviso" : versao.motivo === "cancelamento" ? "erro" : "neutro"}
                      />
                      <span className="text-ink-soft">{formatarData(versao.criado_em)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          ) : null}
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
