import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { DangerButton, SecondaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { EmptyState } from "../../components/EmptyState";
import { IconCart, IconEdit, IconTrash } from "../../components/Icons";
import { vendasService } from "../../services/vendas";
import { clientesService } from "../../services/clientes";
import { useAsync } from "../../hooks/useAsync";
import { formatarDataHora, formatarMoeda } from "../../utils/format";

export default function VendaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const venda = useAsync(() => (id ? vendasService.obter(id) : Promise.resolve(null)), [id]);
  const cliente = useAsync(
    () => (venda.data?.id_cliente ? clientesService.obter(venda.data.id_cliente) : Promise.resolve(null)),
    [venda.data?.id_cliente],
  );
  const itens = useAsync(() => (id ? vendasService.obterItens(id) : Promise.resolve([])), [id]);

  const handleDelete = async () => {
    if (!id || !venda.data) return;
    if (!window.confirm("Excluir esta venda?")) return;
    try {
      await vendasService.deletar(id);
      navigate("/vendas");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao excluir.");
    }
  };

  return (
    <div>
      <PageHeader
        title={venda.data ? `Venda de ${formatarDataHora(venda.data.data_venda)}` : "Venda"}
        breadcrumbs={[
          { label: "Comercial" },
          { label: "Vendas", to: "/vendas" },
          { label: "Detalhes" },
        ]}
        backTo="/vendas"
        actions={
          venda.data ? (
            <>
              <SecondaryButton icon={<IconEdit width={16} height={16} />} onClick={() => navigate(`/vendas/${venda.data!.id}/editar`)}>
                Editar
              </SecondaryButton>
              <DangerButton icon={<IconTrash width={16} height={16} />} onClick={handleDelete}>
                Excluir
              </DangerButton>
            </>
          ) : null
        }
      />

      {venda.loading ? (
        <SectionCard><div className="text-sm text-ink-soft">Carregando…</div></SectionCard>
      ) : !venda.data ? (
        <SectionCard><div className="text-sm text-ink-soft">Venda não encontrada.</div></SectionCard>
      ) : (
        <div className="space-y-6">
          <SectionCard
            title="Resumo"
            actions={
              <div className="flex items-center gap-2">
                <StatusBadge value={venda.data.status_venda} />
                {venda.data.canal_venda ? <StatusBadge value={venda.data.canal_venda} /> : null}
              </div>
            }
          >
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <F label="Data da venda" value={formatarDataHora(venda.data.data_venda)} />
              <F
                label="Cliente"
                value={
                  cliente.data ? (
                    <Link to={`/clientes/${cliente.data.id}`} className="text-brand-600 hover:text-brand-700">
                      {cliente.data.nome}
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
              <F label="Moeda" value={venda.data.moeda_venda} />
              <F label="Subtotal" value={formatarMoeda(Number(venda.data.valor_subtotal), venda.data.moeda_venda)} />
              <F label="Desconto" value={formatarMoeda(Number(venda.data.valor_desconto), venda.data.moeda_venda)} />
              <F label="Total" value={formatarMoeda(Number(venda.data.valor_total), venda.data.moeda_venda)} />
              <F label="Câmbio → BRL" value={venda.data.cambio_venda_para_real ?? "—"} />
              <F label="Câmbio → EUR" value={venda.data.cambio_venda_para_euro ?? "—"} />
            </dl>
          </SectionCard>

          <SectionCard
            title="Itens da venda"
            description={`${itens.data?.length ?? 0} item(ns)`}
            noPadding
          >
            {itens.loading ? (
              <div className="p-5 text-sm text-ink-soft">Carregando itens…</div>
            ) : (itens.data ?? []).length === 0 ? (
              <EmptyState
                icon={<IconCart />}
                title="Sem itens vinculados"
                description="Esta venda ainda não possui itens de estoque associados."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="text-right">Valor original</th>
                      <th>Moeda</th>
                      <th className="text-right">Valor BRL</th>
                      <th className="text-right">Valor EUR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(itens.data as any[]).map((iv) => (
                      <tr key={iv.id}>
                        <td>
                          {iv.item_estoque ? (
                            <Link
                              to={`/itens-estoque/${iv.item_estoque.id}`}
                              className="font-medium text-ink hover:text-brand-700"
                            >
                              {iv.item_estoque.nome_completo}
                            </Link>
                          ) : (
                            "—"
                          )}
                          {iv.item_estoque?.sku ? (
                            <div className="font-numeric tabular-nums text-xs text-ink-soft">
                              SKU {iv.item_estoque.sku}
                            </div>
                          ) : null}
                        </td>
                        <td className="text-right font-numeric tabular-nums text-xs">
                          {formatarMoeda(Number(iv.valor_venda_original), iv.moeda_venda)}
                        </td>
                        <td>{iv.moeda_venda}</td>
                        <td className="text-right font-numeric tabular-nums text-xs">
                          {formatarMoeda(iv.valor_venda_real, "BRL")}
                        </td>
                        <td className="text-right font-numeric tabular-nums text-xs">
                          {formatarMoeda(iv.valor_venda_euro, "EUR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {venda.data.observacoes ? (
            <SectionCard title="Observações">
              <p className="whitespace-pre-wrap text-sm text-ink">{venda.data.observacoes}</p>
            </SectionCard>
          ) : null}

          <SectionCard title="Auditoria">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <F label="Criado em" value={formatarDataHora(venda.data.criado_em)} />
              <F label="Atualizado em" value={formatarDataHora(venda.data.atualizado_em)} />
              <F label="ID" value={venda.data.id} mono />
            </dl>
          </SectionCard>
        </div>
      )}
    </div>
  );
}

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
