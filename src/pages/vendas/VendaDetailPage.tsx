import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { SecondaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { EmptyState } from "../../components/EmptyState";
import { FotoThumbnailHover } from "../../components/FotoThumbnailHover";
import { IconCalendar, IconCart, IconEdit, IconTag } from "../../components/Icons";
import { vendasService } from "../../services/vendas";
import { modelosProdutoService } from "../../services/modelos-produto";
import { useAsync } from "../../hooks/useAsync";
import { formatarData, formatarDataHora, formatarMoeda, traduzirEnum } from "../../utils/format";
import { obterCustoPrincipal } from "../../utils/custoItem";
import { formatarEnderecoLinha, formatarLocalidade } from "../../utils/endereco";
import { caminhoListaVendas, moedaDaVenda } from "./vendaOpcoes";

interface MarcadorPedido {
  id?: string;
  descricao?: string;
  cor?: string;
}

export default function VendaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const venda = useAsync(() => (id ? vendasService.obterDetalhada(id) : Promise.resolve(null)), [id]);
  const itens = useAsync(() => (id ? vendasService.obterItens(id) : Promise.resolve([])), [id]);
  const modeloIds = (itens.data ?? [])
    .map((iv) => iv.item_estoque?.id_modelo_produto)
    .filter((v): v is string => Boolean(v));
  const thumbs = useAsync(
    () =>
      modeloIds.length > 0
        ? modelosProdutoService.listarUrlsPorModelos(modeloIds)
        : Promise.resolve({} as Record<string, string>),
    [modeloIds.join(",")],
  );

  const cliente = venda.data?.cliente ?? null;
  const enderecoEntrega = venda.data?.endereco_entrega ?? null;
  const enderecoLinha = enderecoEntrega ? formatarEnderecoLinha(enderecoEntrega) : "";
  const localidadeEntrega = enderecoEntrega ? formatarLocalidade(enderecoEntrega) : "";
  const marcadores = Array.isArray(venda.data?.marcadores)
    ? (venda.data?.marcadores as MarcadorPedido[])
    : [];
  const listaRegiao = caminhoListaVendas(venda.data?.regiao_venda);
  const moeda = venda.data ? moedaDaVenda(venda.data) : "BRL";
  const labelRegiao = traduzirEnum(venda.data?.regiao_venda);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        title={venda.data ? `Pedido ${venda.data.numero ?? ""}`.trim() : "Ordem de venda"}
        breadcrumbs={[
          { label: "Comercial" },
          { label: "Ordens de venda", to: "/vendas" },
          ...(venda.data
            ? [{ label: labelRegiao, to: listaRegiao }]
            : []),
          { label: "Detalhes" },
        ]}
        backTo={listaRegiao}
        actions={
          venda.data ? (
            <SecondaryButton icon={<IconEdit width={16} height={16} />} onClick={() => navigate(`/vendas/${venda.data!.id}/editar`)}>
              Editar
            </SecondaryButton>
          ) : null
        }
      />

      {venda.loading ? (
        <SectionCard><div className="text-sm text-ink-soft">Carregando…</div></SectionCard>
      ) : !venda.data ? (
        <SectionCard><div className="text-sm text-ink-soft">Ordem de venda não encontrada.</div></SectionCard>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Total do pedido"
              value={formatarMoeda(Number(venda.data.valor_total), moeda)}
              destaque
            />
            <KpiCard
              label="Itens"
              value={String(
                (itens.data ?? []).reduce((acc, iv) => acc + Number(iv.quantidade || 0), 0),
              )}
              icon={<IconCart width={16} height={16} />}
            />
            <KpiCard
              label="Data do pedido"
              value={formatarData(venda.data.data_pedido)}
              icon={<IconCalendar width={16} height={16} />}
            />
            <KpiCard
              label="Status"
              value={<StatusBadge value={venda.data.status_venda} />}
            />
          </div>

          <SectionCard
            title="Resumo"
            actions={<StatusBadge value={venda.data.status_venda} />}
          >
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <F label="Número" value={venda.data.numero ?? "—"} />
              <F label="Nº e-commerce" value={venda.data.numero_ecommerce ?? "—"} />
              <F label="Região" value={<StatusBadge value={venda.data.regiao_venda} />} />
              <F label="Moeda" value={moeda} />
              <F label="Situação (Tiny)" value={venda.data.situacao_tiny ?? "—"} />
              <F
                label="Cliente"
                value={
                  cliente ? (
                    <Link to={`/clientes/${cliente.id}`} className="text-brand-600 hover:text-brand-700">
                      {cliente.nome}
                    </Link>
                  ) : (
                    venda.data.nome_cliente ?? "—"
                  )
                }
              />
              <F label="Data do pedido" value={formatarDataHora(venda.data.data_pedido)} />
            </dl>
            {marcadores.length > 0 ? (
              <div className="mt-5 border-t border-line pt-4">
                <div className="mb-2 flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">
                  <IconTag width={13} height={13} />
                  Marcadores
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {marcadores.map((m, i) => (
                    <span
                      key={m.id ?? i}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-subtle px-2.5 py-0.5 text-xs text-ink"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: m.cor || "#808080" }}
                      />
                      {m.descricao ?? "—"}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </SectionCard>

          {cliente ? (
            <SectionCard title="Dados do cliente">
              <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <F label="CPF/CNPJ" value={cliente.cpf_cnpj ?? "—"} mono />
                <F label="E-mail" value={cliente.email ?? "—"} />
                <F label="Telefone" value={cliente.telefone ?? "—"} />
                <F label="País" value={cliente.pais ?? "—"} />
              </dl>
            </SectionCard>
          ) : null}

          {enderecoEntrega ? (
            <SectionCard
              title="Endereço de entrega"
              titleAccessory={
                enderecoEntrega.cep ? (
                  <span className="font-numeric tabular-nums text-xs text-ink-soft">
                    CEP {enderecoEntrega.cep}
                  </span>
                ) : null
              }
            >
              <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <F label="Endereço" value={enderecoLinha || "—"} />
                <F label="Bairro" value={enderecoEntrega.bairro ?? "—"} />
                <F
                  label="Cidade / UF"
                  value={localidadeEntrega || "—"}
                />
                <F label="País" value={enderecoEntrega.pais ?? "—"} />
                {enderecoEntrega.rotulo ? (
                  <F label="Rótulo" value={enderecoEntrega.rotulo} />
                ) : null}
              </dl>
            </SectionCard>
          ) : null}

          <SectionCard title="Valores">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <F label="Total produtos" value={formatarMoeda(Number(venda.data.total_produtos), moeda)} />
              <F label="Frete" value={formatarMoeda(Number(venda.data.valor_frete), moeda)} />
              <F label="Desconto" value={formatarMoeda(Number(venda.data.valor_desconto), moeda)} />
              <F label="Outras despesas" value={formatarMoeda(Number(venda.data.outras_despesas), moeda)} />
              <F label="Total do pedido" value={formatarMoeda(Number(venda.data.valor_total), moeda)} />
            </dl>
          </SectionCard>

          <SectionCard title="Pagamento e envio">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <F label="Forma de pagamento" value={venda.data.forma_pagamento ?? "—"} />
              <F label="Meio de pagamento" value={venda.data.meio_pagamento ?? "—"} />
              <F label="Depósito" value={venda.data.deposito ?? "—"} />
              <F label="Data faturamento" value={formatarData(venda.data.data_faturamento)} />
              <F
                label="Rastreamento"
                value={
                  venda.data.codigo_rastreamento ? (
                    venda.data.url_rastreamento ? (
                      <a href={venda.data.url_rastreamento} target="_blank" rel="noreferrer" className="text-brand-600 hover:text-brand-700">
                        {venda.data.codigo_rastreamento}
                      </a>
                    ) : (
                      venda.data.codigo_rastreamento
                    )
                  ) : (
                    "—"
                  )
                }
              />
            </dl>
          </SectionCard>

          <SectionCard title="Itens da ordem" noPadding>
            {itens.loading ? (
              <div className="p-5 text-sm text-ink-soft">Carregando itens…</div>
            ) : (itens.data ?? []).length === 0 ? (
              <EmptyState
                icon={<IconCart />}
                title="Sem itens vinculados"
                description="Esta ordem não possui itens."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th className="w-[4.5rem]"><span className="sr-only">Foto</span></th>
                      <th>Item</th>
                      <th className="text-right">Qtd</th>
                      <th className="text-right">Valor unitário</th>
                      <th className="text-right">Custo</th>
                      <th className="text-right">Lucro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(itens.data ?? []).map((iv) => {
                      const tipoRegiao = iv.item_estoque?.local?.tipo_regiao;
                      const custoExibido = obterCustoPrincipal(iv.custo, tipoRegiao);
                      const lucro = iv.lucroCalculado?.lucroReal;
                      const idModelo = iv.item_estoque?.id_modelo_produto;
                      const fotoUrl = idModelo ? thumbs.data?.[idModelo] : null;

                      return (
                        <tr key={iv.id}>
                          <td className="w-[4.5rem] px-2 align-middle">
                            <FotoThumbnailHover
                              url={fotoUrl}
                              alt={iv.item_estoque?.nome_produto ?? iv.descricao ?? "Item"}
                              to={iv.item_estoque ? `/itens-estoque/${iv.item_estoque.id}` : undefined}
                              size="sm"
                            />
                          </td>
                          <td>
                            {iv.item_estoque ? (
                              <Link
                                to={`/itens-estoque/${iv.item_estoque.id}`}
                                className="font-medium text-ink hover:text-brand-700"
                              >
                                {iv.item_estoque.nome_produto}
                              </Link>
                            ) : (
                              <span className="font-medium text-ink">{iv.descricao ?? "—"}</span>
                            )}
                            {iv.codigo ? (
                              <div className="font-numeric tabular-nums text-xs text-ink-soft">
                                SKU {iv.codigo}
                              </div>
                            ) : null}
                          </td>
                          <td className="text-right font-numeric tabular-nums text-xs">
                            {iv.quantidade}
                          </td>
                          <td className="text-right font-numeric tabular-nums text-xs">
                            {formatarMoeda(Number(iv.valor_unitario), moeda)}
                          </td>
                          <td className="text-right font-numeric tabular-nums text-xs">
                            {custoExibido
                              ? formatarMoeda(custoExibido.valor, custoExibido.moeda)
                              : "—"}
                          </td>
                          <td className="text-right font-numeric tabular-nums text-xs">
                            {lucro != null ? formatarMoeda(lucro, moeda) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {venda.data.obs || venda.data.obs_interna ? (
            <SectionCard title="Observações">
              {venda.data.obs ? (
                <p className="whitespace-pre-wrap text-sm text-ink">{venda.data.obs}</p>
              ) : null}
              {venda.data.obs_interna ? (
                <p className="mt-2 whitespace-pre-wrap text-xs text-ink-soft">
                  Interna: {venda.data.obs_interna}
                </p>
              ) : null}
            </SectionCard>
          ) : null}

          <SectionCard title="Auditoria">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <F label="Criado em" value={formatarDataHora(venda.data.criado_em)} />
              <F label="Atualizado em" value={formatarDataHora(venda.data.atualizado_em)} />
              <F label="ID Tiny" value={venda.data.id_tiny ?? "—"} mono />
            </dl>
          </SectionCard>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  destaque,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  destaque?: boolean;
}) {
  return (
    <div
      className={
        destaque
          ? "card flex flex-col justify-between gap-1 border-brand-200 bg-brand-50/40 p-4"
          : "card flex flex-col justify-between gap-1 p-4"
      }
    >
      <div className="flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">
        {icon}
        {label}
      </div>
      <div
        className={
          destaque
            ? "font-numeric tabular-nums text-xl font-semibold text-brand-700"
            : "text-lg font-semibold text-ink"
        }
      >
        {value}
      </div>
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
