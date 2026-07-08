import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FotoThumbnailHover } from "../../components/FotoThumbnailHover";
import { IconBox } from "../../components/Icons";
import { PageHeader } from "../../components/PageHeader";
import { SecondaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import { modelosProdutoService } from "../../services/modelos-produto";
import { ordensCompraService } from "../../services/ordens-compra";
import { cn } from "../../utils/cn";
import { formatarData, formatarDataHora, formatarMoeda } from "../../utils/format";
import {
  formatSizeLabel,
  getAllSizeEquivalences,
  getUsDisplayLabel,
} from "../../utils/sizeConversion";

function F({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">
        {label}
      </dt>
      <dd className={cn("mt-1 text-sm text-ink", mono && "font-numeric tabular-nums text-xs break-all")}>
        {value}
      </dd>
    </div>
  );
}

function ChipNumeracao({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-muted/40 px-3 py-2 text-center">
      <p className="text-[0.62rem] font-semibold uppercase tracking-wider text-ink-soft">{label}</p>
      <p className="mt-0.5 font-numeric text-sm font-semibold tabular-nums text-ink">{valor}</p>
    </div>
  );
}

export default function OrdemCompraDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const ordem = useAsync(
    () => (id ? ordensCompraService.obter(id) : Promise.resolve(null)),
    [id],
  );
  const thumbs = useAsync(() => modelosProdutoService.listarUrlsPrincipaisPorModelo(), []);

  const item = ordem.data?.item;
  const equivalencias = item ? getAllSizeEquivalences(item) : null;
  const fotoUrl = item?.id_modelo_produto ? thumbs.data?.[item.id_modelo_produto] : null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        title="Ordem de compra"
        titleAccessory={
          ordem.data ? (
            <div className="flex flex-wrap items-center gap-2">
              {ordem.data.fornecedor ? (
                <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs font-medium text-ink">
                  {ordem.data.fornecedor.nome}
                </span>
              ) : null}
              <span className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 font-numeric text-xs font-semibold tabular-nums text-brand-800">
                {formatarMoeda(ordem.data.valor_custo, ordem.data.moeda_compra)}
              </span>
              <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs font-medium text-ink-muted">
                {formatarData(ordem.data.data_compra)}
              </span>
              <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs font-medium text-ink-muted">
                {ordem.data.moeda_compra}
              </span>
            </div>
          ) : null
        }
        breadcrumbs={[
          { label: "Operação" },
          { label: "Ordens de compra", to: "/ordens-compra" },
          { label: item?.codigo_fornecedor ?? item?.sku ?? "…" },
        ]}
        backTo="/ordens-compra"
        actions={
          item ? (
            <SecondaryButton
              icon={<IconBox width={16} height={16} />}
              onClick={() => navigate(`/itens-estoque/${item.id}`)}
            >
              Ver item
            </SecondaryButton>
          ) : null
        }
      />

      {ordem.loading ? (
        <SectionCard>
          <div className="text-sm text-ink-soft">Carregando…</div>
        </SectionCard>
      ) : !ordem.data ? (
        <SectionCard>
          <div className="text-sm text-ink-soft">Ordem não encontrada.</div>
        </SectionCard>
      ) : (
        <div className="space-y-6">
          <SectionCard noPadding>
            <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
              <div className="flex flex-col gap-6 border-b border-line p-5 lg:border-b-0 lg:border-r lg:p-6">
                <div className="space-y-1">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">
                    Fornecedor
                  </p>
                  <p className="text-lg font-semibold text-ink">
                    {ordem.data.fornecedor ? (
                      <Link
                        to={`/fornecedores/${ordem.data.fornecedor.id}`}
                        className="text-brand-700 hover:text-brand-800"
                      >
                        {ordem.data.fornecedor.nome}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </p>
                </div>

                <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <F label="Data da compra" value={formatarData(ordem.data.data_compra)} />
                  <F label="Moeda" value={ordem.data.moeda_compra} />
                </dl>

                {ordem.data.observacoes ? (
                  <div className="space-y-1">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">
                      Observações
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                      {ordem.data.observacoes}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col justify-center gap-4 p-5 lg:p-6">
                <div className="rounded-xl border border-line bg-surface px-4 py-4 shadow-sm">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">
                    Valor custo
                  </p>
                  <p className="mt-1 font-numeric text-3xl font-semibold tabular-nums text-ink">
                    {formatarMoeda(ordem.data.valor_custo, ordem.data.moeda_compra)}
                  </p>
                  <p className="mt-2 text-xs text-ink-soft">
                    Valor registrado na moeda da compra ({ordem.data.moeda_compra}).
                  </p>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Item vinculado"
            description="Produto de estoque associado a esta ordem de compra."
          >
            {item ? (
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="shrink-0">
                  <FotoThumbnailHover url={fotoUrl} alt={item.nome_produto} size="md" />
                </div>

                <div className="min-w-0 flex-1 space-y-4">
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-ink">{item.nome_produto}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 font-numeric text-xs font-semibold tabular-nums text-ink-muted">
                        SKU {item.sku}
                      </span>
                      {item.codigo_fornecedor ? (
                        <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 font-numeric text-xs font-semibold tabular-nums text-ink-muted">
                          Cód. {item.codigo_fornecedor}
                        </span>
                      ) : null}
                      <StatusBadge value={item.status_item} />
                    </div>
                  </div>

                  <div className="grid max-w-md grid-cols-3 gap-3">
                    <ChipNumeracao
                      label="BR"
                      valor={formatSizeLabel(equivalencias?.br ?? null, "br")}
                    />
                    <ChipNumeracao
                      label="EU"
                      valor={formatSizeLabel(equivalencias?.eu ?? null, "eu")}
                    />
                    <ChipNumeracao label="US" valor={getUsDisplayLabel(item)} />
                  </div>
                </div>

                <SecondaryButton
                  className="shrink-0 self-start"
                  icon={<IconBox width={16} height={16} />}
                  onClick={() => navigate(`/itens-estoque/${item.id}`)}
                >
                  Abrir item
                </SecondaryButton>
              </div>
            ) : (
              <p className="text-sm text-ink-soft">Nenhum item vinculado a esta ordem.</p>
            )}
          </SectionCard>

          <SectionCard title="Auditoria">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <F label="Criado em" value={formatarDataHora(ordem.data.criado_em)} />
              <F label="Atualizado em" value={formatarDataHora(ordem.data.atualizado_em)} />
              <F label="ID" value={ordem.data.id} mono />
            </dl>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
