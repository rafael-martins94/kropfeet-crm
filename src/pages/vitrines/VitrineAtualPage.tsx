import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { SectionCard } from "../../components/SectionCard";
import { PrimaryButton } from "../../components/PrimaryButton";
import { LinkPdfVitrine, CaixaResumoCard, VitrineMeta } from "../../components/vitrines/VitrineShared";
import { SubstituirCaixaModal } from "../../components/vitrines/SubstituirCaixaModal";
import { VitrineTituloEditavel } from "../../components/vitrines/VitrineTituloEditavel";
import { SearchInput } from "../../components/SearchInput";
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

export default function VitrineAtualPage() {
  const [buscaCaixa, setBuscaCaixa] = useState("");
  const [substituirId, setSubstituirId] = useState<string | null>(null);
  const vitrine = useAsync(() => vitrinesService.obterAtualComItens(), []);
  const versoes = useAsync(
    () => (vitrine.data?.id ? vitrinesService.listarVersoes(vitrine.data.id) : Promise.resolve([])),
    [vitrine.data?.id],
  );

  const caixaFiltro = useMemo(() => {
    const match = buscaCaixa.match(/\d+/);
    return match ? Number(match[0]) : null;
  }, [buscaCaixa]);

  const itens = useMemo(() => {
    const base = [...(vitrine.data?.itens ?? [])].sort(
      (a, b) => (a.numero_caixa ?? 999) - (b.numero_caixa ?? 999),
    );
    return caixaFiltro ? base.filter((item) => item.numero_caixa === caixaFiltro) : base;
  }, [vitrine.data?.itens, caixaFiltro]);

  const itemSubstituir = itens.find((item) => item.id === substituirId) ?? null;
  const caixasVazias = (vitrine.data?.itens ?? []).filter((item) => item.estado_caixa === "vendida").length;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        title="Vitrine atual"
        breadcrumbs={[{ label: "Operação" }, { label: "Vitrines", to: "/vitrines" }, { label: "Atual" }]}
        backTo="/vitrines"
        actions={vitrine.data ? <LinkPdfVitrine id={vitrine.data.id} /> : null}
      />

      <SectionCard
        title={
          vitrine.data ? (
            <VitrineTituloEditavel
              idVitrine={vitrine.data.id}
              titulo={vitrine.data.titulo}
              className="font-display text-lg font-semibold whitespace-nowrap text-ink"
              onAtualizado={() => vitrine.reload()}
            />
          ) : (
            "Vitrine atual"
          )
        }
        description="Itens ordenados da Caixa 1 até a Caixa 22."
      >
        {vitrine.loading ? (
          <p className="text-sm text-ink-soft">Carregando…</p>
        ) : !vitrine.data ? (
          <p className="text-sm text-ink-soft">Nenhuma vitrine publicada.</p>
        ) : (
          <div className="space-y-5">
            <VitrineMeta vitrine={vitrine.data} />
            {caixasVazias > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                {caixasVazias === 1
                  ? "Há 1 caixa vazia. Substitua o par para manter a vitrine completa."
                  : `Há ${caixasVazias} caixas vazias. Substitua os pares para manter a vitrine completa.`}
              </div>
            ) : null}
            <SearchInput
              value={buscaCaixa}
              onChange={(event) => setBuscaCaixa(event.target.value)}
              placeholder="Pesquisar por caixa, ex.: Caixa 8"
              wrapperClassName="max-w-sm"
            />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {itens.map((item) => {
                const vendida = item.estado_caixa === "vendida";
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "rounded-xl border bg-surface p-4",
                      vendida ? "border-amber-300 ring-1 ring-amber-200" : "border-line",
                    )}
                    id={`caixa-${item.numero_caixa}`}
                  >
                    <CaixaResumoCard item={item} numeroCaixa={item.numero_caixa} />
                    <div className="mt-3 border-t border-line pt-3 text-xs text-ink-muted">
                      {vendida ? (
                        <div className="space-y-2">
                          <p className="font-medium text-amber-900">
                            Vendido
                            {item.venda_saida ? (
                              <>
                                {" · "}
                                <Link
                                  to={`/vendas/${item.venda_saida.id}`}
                                  className="underline hover:text-brand-700"
                                >
                                  OV #{item.venda_saida.numero ?? "—"}
                                </Link>
                              </>
                            ) : null}
                          </p>
                          <PrimaryButton className="w-full" onClick={() => setSubstituirId(item.id)}>
                            Substituir par
                          </PrimaryButton>
                        </div>
                      ) : item.snapshot?.item_unico ? (
                        <span className="font-semibold text-amber-800">Único</span>
                      ) : (
                        <span>
                          {item.snapshot?.correspondencias?.length ?? 0} correspondência(s) disponíveis
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {vitrine.error ? <p className="mt-3 text-sm text-red-700">{vitrine.error.message}</p> : null}
      </SectionCard>

      {vitrine.data ? (
        <SectionCard
          className="mt-5"
          title="Histórico de versões"
          description="Cada venda, substituição ou cancelamento gera uma nova versão da mesma vitrine."
        >
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
          {versoes.error ? <p className="mt-3 text-sm text-red-700">{versoes.error.message}</p> : null}
        </SectionCard>
      ) : null}

      <SubstituirCaixaModal
        open={Boolean(substituirId)}
        idVitrineItem={substituirId ?? ""}
        numeroCaixa={itemSubstituir?.numero_caixa ?? null}
        onClose={() => setSubstituirId(null)}
        onSubstituido={() => {
          vitrine.reload();
          versoes.reload();
        }}
      />
    </div>
  );
}
