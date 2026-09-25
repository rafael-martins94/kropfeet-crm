import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DataTable, type Column } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { PrimaryButton, SecondaryButton } from "../../components/PrimaryButton";
import { VitrineTituloEditavel } from "../../components/vitrines/VitrineTituloEditavel";
import { SectionCard } from "../../components/SectionCard";
import { NomePdfVitrineField } from "../../components/vitrines/NomePdfVitrineField";
import { VitrineMapaCaixas } from "../../components/vitrines/VitrineMapaCaixas";
import { CaixaResumoCard, LinkPdfVitrine, VitrineMeta } from "../../components/vitrines/VitrineShared";
import { SubstituirCaixaModal } from "../../components/vitrines/SubstituirCaixaModal";
import { StatusBadge } from "../../components/StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import { vitrinesService, type VitrineItemDetalhado, type VitrineVersaoResumo } from "../../services/vitrines";
import { formatarData } from "../../utils/format";
import { cn } from "../../utils/cn";

const MOTIVO_LABEL: Record<string, string> = {
  publicacao: "Publicação",
  venda: "Venda",
  substituicao: "Substituição",
  cancelamento: "Cancelamento",
  edicao_nome: "Nome no PDF",
};

export default function VitrineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [substituirId, setSubstituirId] = useState<string | null>(null);
  const [visao, setVisao] = useState<"lista" | "cards" | "caixas">("lista");
  const vitrine = useAsync(() => (id ? vitrinesService.obterComItens(id) : Promise.resolve(null)), [id]);
  const versoes = useAsync(
    () => (id ? vitrinesService.listarVersoes(id) : Promise.resolve([])),
    [id],
  );

  const itens = [...(vitrine.data?.itens ?? [])].sort(
    (a, b) => (a.numero_caixa ?? 999) - (b.numero_caixa ?? 999),
  );
  const publicada = vitrine.data?.status === "publicada";
  const itemSubstituir = itens.find((item) => item.id === substituirId) ?? null;
  const colunasLista = useMemo<Column<VitrineItemDetalhado>[]>(() => {
    const colunas: Column<VitrineItemDetalhado>[] = [
      {
        key: "caixa",
        header: "Caixa",
        width: "88px",
        render: (item) => (
          <span className="font-semibold text-ink">{item.numero_caixa ?? "—"}</span>
        ),
      },
      {
        key: "item",
        header: "Tênis",
        render: (item) => <CaixaResumoCard item={item} compact />,
      },
      {
        key: "nome",
        header: "Nome no PDF",
        render: (item) =>
          publicada ? (
            <NomePdfVitrineField
              className="mt-0 min-w-52"
              ocultarRotulo
              item={item}
              onSalvo={() => {
                vitrine.reload();
                versoes.reload();
              }}
            />
          ) : (
            <span className="text-sm text-ink">{item.nome_exibicao?.trim() || item.snapshot?.nome_exibicao || "—"}</span>
          ),
      },
      {
        key: "situacao",
        header: "Situação",
        render: (item) =>
          item.estado_caixa === "vendida" ? (
            <span className="font-medium text-amber-900">
              Vendido
              {item.venda_saida ? ` · OV #${item.venda_saida.numero ?? "—"}` : ""}
            </span>
          ) : item.snapshot?.item_unico ? (
            <span className="font-semibold text-amber-800">Único</span>
          ) : (
            <span className="text-ink-soft">
              {item.snapshot?.correspondencias?.length ?? 0} correspondência(s)
            </span>
          ),
      },
    ];
    if (publicada) {
      colunas.push({
        key: "acao",
        header: "",
        width: "160px",
        render: (item) =>
          item.estado_caixa === "vendida" ? (
            <PrimaryButton onClick={() => setSubstituirId(item.id)}>Substituir par</PrimaryButton>
          ) : (
            <SecondaryButton onClick={() => setSubstituirId(item.id)}>Trocar par</SecondaryButton>
          ),
      });
    }
    return colunas;
  }, [publicada, versoes, vitrine]);

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
          <SectionCard
            title="Caixas"
            description={
              visao === "caixas"
                ? "Disposição das 22 caixas na vitrine."
                : visao === "lista"
                  ? "Lista das caixas, da 1 à 22."
                  : publicada
                    ? "Trocar par ou editar o nome no PDF gera uma versão. O nome do tênis no estoque não muda."
                    : "Estado atual das 22 caixas desta vitrine."
            }
            actions={
              <div className="inline-flex rounded-lg border border-line bg-surface p-1">
                {(
                  [
                    ["lista", "Lista"],
                    ["cards", "Cards"],
                    ["caixas", "Caixas"],
                  ] as const
                ).map(([idVisao, rotulo]) => (
                  <button
                    key={idVisao}
                    type="button"
                    onClick={() => setVisao(idVisao)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                      visao === idVisao
                        ? "bg-brand-600 text-white"
                        : "text-ink-muted hover:bg-surface-muted hover:text-ink",
                    )}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
            }
          >
            {visao === "caixas" ? (
              <VitrineMapaCaixas itens={itens} />
            ) : visao === "lista" ? (
              <DataTable
                columns={colunasLista}
                rows={itens}
                rowKey={(item) => item.id}
                rowClassName={(item) => (item.estado_caixa === "vendida" ? "bg-amber-50/70" : undefined)}
                emptyTitle="Nenhuma caixa nesta vitrine"
              />
            ) : (
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
                    {publicada ? (
                      <NomePdfVitrineField
                        item={item}
                        onSalvo={() => {
                          vitrine.reload();
                          versoes.reload();
                        }}
                      />
                    ) : null}
                    <div className="mt-3 border-t border-line pt-3 text-xs text-ink-muted">
                      {vendida ? (
                        <div className="space-y-2">
                          <p className="font-medium text-amber-900">
                            Vendido
                            {item.venda_saida ? ` · OV #${item.venda_saida.numero ?? "—"}` : ""}
                          </p>
                          {publicada ? (
                            <PrimaryButton className="w-full" onClick={() => setSubstituirId(item.id)}>
                              Substituir par
                            </PrimaryButton>
                          ) : null}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {item.snapshot?.item_unico ? (
                            <span className="font-semibold text-amber-800">Único</span>
                          ) : (
                            <span>{item.snapshot?.correspondencias?.length ?? 0} correspondência(s)</span>
                          )}
                          {publicada ? (
                            <SecondaryButton className="w-full" onClick={() => setSubstituirId(item.id)}>
                              Trocar par
                            </SecondaryButton>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            )}
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

      <SubstituirCaixaModal
        open={Boolean(substituirId)}
        idVitrineItem={substituirId ?? ""}
        numeroCaixa={itemSubstituir?.numero_caixa ?? null}
        caixaOcupada={itemSubstituir?.estado_caixa === "ocupada"}
        onClose={() => setSubstituirId(null)}
        onSubstituido={() => {
          vitrine.reload();
          versoes.reload();
        }}
      />
    </div>
  );
}
