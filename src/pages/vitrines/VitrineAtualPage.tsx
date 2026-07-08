import { useMemo, useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { SectionCard } from "../../components/SectionCard";
import { LinkPdfVitrine, CaixaResumoCard, VitrineMeta } from "../../components/vitrines/VitrineShared";
import { VitrineTituloEditavel } from "../../components/vitrines/VitrineTituloEditavel";
import { SearchInput } from "../../components/SearchInput";
import { useAsync } from "../../hooks/useAsync";
import { vitrinesService } from "../../services/vitrines";

export default function VitrineAtualPage() {
  const [buscaCaixa, setBuscaCaixa] = useState("");
  const vitrine = useAsync(() => vitrinesService.obterAtualComItens(), []);

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
            <SearchInput
              value={buscaCaixa}
              onChange={(event) => setBuscaCaixa(event.target.value)}
              placeholder="Pesquisar por caixa, ex.: Caixa 8"
              wrapperClassName="max-w-sm"
            />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {itens.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-line bg-surface p-4"
                  id={`caixa-${item.numero_caixa}`}
                >
                  <CaixaResumoCard item={item} numeroCaixa={item.numero_caixa} />
                  <div className="mt-3 border-t border-line pt-3 text-xs text-ink-muted">
                    {item.snapshot?.item_unico ? (
                      <span className="font-semibold text-amber-800">Único</span>
                    ) : (
                      <span>
                        {item.snapshot?.correspondencias?.length ?? 0} correspondência(s) disponíveis
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {vitrine.error ? <p className="mt-3 text-sm text-red-700">{vitrine.error.message}</p> : null}
      </SectionCard>
    </div>
  );
}
