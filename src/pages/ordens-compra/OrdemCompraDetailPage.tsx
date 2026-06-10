import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { SecondaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { IconBox } from "../../components/Icons";
import { ordensCompraService } from "../../services/ordens-compra";
import { useAsync } from "../../hooks/useAsync";
import { formatarData, formatarDataHora, formatarMoeda } from "../../utils/format";

function F({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">
        {label}
      </dt>
      <dd className={`mt-1 text-sm text-ink ${mono ? "font-numeric tabular-nums text-xs break-all" : ""}`}>
        {value}
      </dd>
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

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        title={ordem.data?.item ? `Ordem — ${ordem.data.item.sku}` : "Ordem de compra"}
        breadcrumbs={[
          { label: "Operação" },
          { label: "Ordens de compra", to: "/ordens-compra" },
          { label: ordem.data?.item?.sku ?? "…" },
        ]}
        backTo="/ordens-compra"
        actions={
          ordem.data?.item ? (
            <SecondaryButton
              icon={<IconBox width={16} height={16} />}
              onClick={() => navigate(`/itens-estoque/${ordem.data!.item!.id}`)}
            >
              Ver item
            </SecondaryButton>
          ) : null
        }
      />

      {ordem.loading ? (
        <SectionCard><div className="text-sm text-ink-soft">Carregando…</div></SectionCard>
      ) : !ordem.data ? (
        <SectionCard><div className="text-sm text-ink-soft">Ordem não encontrada.</div></SectionCard>
      ) : (
        <div className="space-y-6">
          <SectionCard title="Item vinculado">
            {ordem.data.item ? (
              <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <F
                  label="Item"
                  value={
                    <Link
                      to={`/itens-estoque/${ordem.data.item.id}`}
                      className="text-brand-600 hover:text-brand-700"
                    >
                      {ordem.data.item.nome_produto}
                    </Link>
                  }
                />
                <F label="SKU" value={ordem.data.item.sku} mono />
                <F
                  label="Status"
                  value={<StatusBadge value={ordem.data.item.status_item} />}
                />
              </dl>
            ) : (
              <p className="text-sm text-ink-soft">Nenhum item vinculado.</p>
            )}
          </SectionCard>

          <SectionCard title="Compra">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <F label="Data da compra" value={formatarData(ordem.data.data_compra)} />
              <F
                label="Fornecedor"
                value={
                  ordem.data.fornecedor ? (
                    <Link
                      to={`/fornecedores/${ordem.data.fornecedor.id}`}
                      className="text-brand-600 hover:text-brand-700"
                    >
                      {ordem.data.fornecedor.nome}
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
              <F label="Moeda" value={ordem.data.moeda_compra} />
              <F
                label="Valor pago (original)"
                value={formatarMoeda(ordem.data.valor_pago_original, ordem.data.moeda_compra)}
              />
              <F label="Câmbio → BRL" value={ordem.data.cambio_compra_para_real ?? "—"} />
              <F
                label="Valor pago (BRL)"
                value={formatarMoeda(ordem.data.valor_pago_real, "BRL")}
              />
              <F label="Câmbio → EUR" value={ordem.data.cambio_compra_para_euro ?? "—"} />
              <F
                label="Valor pago (EUR)"
                value={formatarMoeda(ordem.data.valor_pago_euro, "EUR")}
              />
            </dl>
          </SectionCard>

          {ordem.data.observacoes ? (
            <SectionCard title="Observações">
              <p className="whitespace-pre-wrap text-sm text-ink">{ordem.data.observacoes}</p>
            </SectionCard>
          ) : null}

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
