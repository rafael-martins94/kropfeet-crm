import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { SumupVendaModal } from "../../components/sumup/SumupVendaModal";
import {
  extrairCodigosSumup,
  obterVendaSumupPorCodigo,
  type ContaSumup,
  type VendaSumup,
} from "../../services/sumup";
import { PageHeader } from "../../components/PageHeader";
import { SecondaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { EmptyState } from "../../components/EmptyState";
import { FotoThumbnailHover } from "../../components/FotoThumbnailHover";
import { IconCalendar, IconCart, IconEdit, IconTag, IconArrowUpRight } from "../../components/Icons";
import { EntityLink } from "../../components/EntityLink";
import { resumoFinanceiroVenda, vendasService } from "../../services/vendas";
import { contasReceberService } from "../../services/contasReceber";
import type { ContaReceber } from "../../types/entities";
import { BotaoStatusConta } from "../../components/financeiro/BotaoStatusConta";
import { SituacaoContaBadge } from "../../components/financeiro/SituacaoContaBadge";
import { useToast } from "../../contexts/ToastContext";
import { mensagemErro } from "../../utils/errors";
import { statusPodeSerAlteradoNaOrdem } from "../../utils/situacaoContaExibida";
import { modelosProdutoService } from "../../services/modelos-produto";
import { useAsync } from "../../hooks/useAsync";
import { formatarData, formatarDataHora, formatarMoeda, traduzirEnum } from "../../utils/format";
import { obterCustoPrincipal } from "../../utils/custoItem";
import { formatarEnderecoLinha, formatarLocalidade } from "../../utils/endereco";
import {
  caminhoListaVendas,
  labelFormaPagamento,
  labelFreteStatus,
  labelLocalVenda,
  moedaDoFrete,
  valorFreteCobrado,
  lerMarcadores,
  moedaDaVenda,
} from "./vendaOpcoes";

export default function VendaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const venda = useAsync(() => (id ? vendasService.obterDetalhada(id) : Promise.resolve(null)), [id]);
  const itens = useAsync(() => (id ? vendasService.obterItens(id) : Promise.resolve([])), [id]);
  const parcelasAsync = useAsync(
    () => (id ? vendasService.obterParcelas(id) : Promise.resolve([])),
    [id],
  );
  const contasAsync = useAsync(
    () => (id ? contasReceberService.listarPorVenda(id) : Promise.resolve([] as ContaReceber[])),
    [id],
  );
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
  const marcadores = lerMarcadores(venda.data?.marcadores);
  const parcelas = parcelasAsync.data ?? [];
  const contas = contasAsync.data ?? [];
  const contaPorParcela = new Map(
    contas.filter((c) => c.id_parcela_venda).map((c) => [c.id_parcela_venda!, c]),
  );
  const listaRegiao = caminhoListaVendas(venda.data?.regiao_venda);
  const moeda = venda.data ? moedaDaVenda(venda.data) : "BRL";
  const moedaFrete = venda.data ? moedaDoFrete(venda.data) : moeda;
  const labelRegiao = traduzirEnum(venda.data?.regiao_venda);
  const resumo = resumoFinanceiroVenda(Number(venda.data?.valor_total ?? 0), parcelas, contas);
  const codigosSumup = [
    venda.data?.codigo_venda_adquirente,
    ...parcelas.map((p) => p.codigo_transacao),
  ]
    .filter(Boolean)
    .join(" ");

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
                    <EntityLink to={`/clientes/${cliente.id}`}>{cliente.nome}</EntityLink>
                  ) : (
                    venda.data.nome_cliente ?? "—"
                  )
                }
              />
              <F label="Vendedor" value={venda.data.vendedor?.nome ?? "—"} />
              <F label="Local de venda" value={labelLocalVenda(venda.data.local_venda)} />
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
              <F label="Desconto" value={formatarMoeda(Number(venda.data.valor_desconto), moeda)} />
              <F label="Outras despesas" value={formatarMoeda(Number(venda.data.outras_despesas), moeda)} />
              <F label="Total do pedido" value={formatarMoeda(Number(venda.data.valor_total), moeda)} />
            </dl>
          </SectionCard>

          <SectionCard
            title="Frete"
            description="Independente do total do pedido e das parcelas do produto."
            titleAccessory={
              <StatusBadge
                value={venda.data.frete_status}
                label={labelFreteStatus(venda.data.frete_status)}
              />
            }
          >
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div className="rounded-xl border border-line bg-surface-subtle px-4 py-3 sm:col-span-1">
                <div className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">
                  A pagar pelo frete
                </div>
                <div className="mt-1 font-numeric text-xl font-semibold tabular-nums text-ink">
                  {formatarMoeda(
                    valorFreteCobrado(venda.data.frete_status, Number(venda.data.valor_frete)),
                    moedaFrete,
                  )}
                </div>
                <p className="mt-1 text-xs text-ink-soft">
                  {venda.data.frete_status === "pendente"
                    ? "Ainda não foi pago."
                    : venda.data.frete_status === "pago"
                      ? venda.data.data_pagamento_frete
                        ? `Quitado em ${formatarData(venda.data.data_pagamento_frete)}.`
                        : "Quitado, sem data informada."
                      : venda.data.frete_status === "cortesia"
                        ? "Oferecido sem cobrança."
                        : "Não há frete neste pedido."}
                </p>
              </div>
              <dl className="grid grid-cols-1 gap-5 sm:col-span-2 sm:grid-cols-2">
                <F label="Valor do frete" value={formatarMoeda(Number(venda.data.valor_frete), moedaFrete)} />
                <F label="Moeda" value={moedaFrete} />
                <F label="Situação" value={labelFreteStatus(venda.data.frete_status)} />
                {venda.data.frete_status === "pago" ? (
                  <F label="Pago em" value={formatarData(venda.data.data_pagamento_frete)} />
                ) : null}
              </dl>
            </div>
          </SectionCard>

          <SectionCard
            title="Pagamento e parcelas"
            actions={
              contas.length > 0 ? (
                <Link
                  to={`/financeiro/contas-receber/${venda.data.regiao_venda === "europa" ? "europa" : "brasil"}?busca=${encodeURIComponent(venda.data.numero ?? "")}`}
                  className="text-sm text-brand-700 hover:text-brand-800"
                >
                  Ver em Contas a receber
                </Link>
              ) : null
            }
          >
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <F
                label="Forma de pagamento"
                value={labelFormaPagamento(venda.data.forma_pagamento)}
              />
              <F
                label="Condição"
                value={
                  venda.data.condicao_pagamento ||
                  (parcelas.length > 1 ? `${parcelas.length} parcelas` : parcelas.length === 1 ? "À vista" : "—")
                }
              />
              <F
                label="Código SumUp"
                value={
                  <VinculoSumup
                    codigo={codigosSumup || null}
                    conta={venda.data.regiao_venda === "europa" ? "pt" : "br"}
                    ordem={{ id: venda.data.id, numero: venda.data.numero }}
                  />
                }
              />
              <F label="Depósito" value={venda.data.deposito ?? "—"} />
              <F label="Data faturamento" value={formatarData(venda.data.data_faturamento)} />
            </dl>

            {parcelas.length > 0 ? (
              <div className="mt-5 border-t border-line pt-4">
                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <ResumoValor rotulo="Total parcelado" valor={formatarMoeda(resumo.totalParcelado, moeda)} />
                  <ResumoValor rotulo="Recebido" valor={formatarMoeda(resumo.recebido, moeda)} />
                  <ResumoValor
                    rotulo="Em aberto"
                    valor={formatarMoeda(resumo.emAberto, moeda)}
                    destaque
                  />
                </div>
                {Math.abs(resumo.faltaParcelar) >= 0.01 && venda.data.status_venda !== "cancelado" ? (
                  <p className="mb-4 text-xs text-amber-800">
                    {resumo.faltaParcelar > 0
                      ? `As parcelas somam ${formatarMoeda(resumo.faltaParcelar, moeda)} a menos que o total do pedido.`
                      : `As parcelas somam ${formatarMoeda(-resumo.faltaParcelar, moeda)} a mais que o total do pedido.`}
                  </p>
                ) : null}

                <div className="mb-2 text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">
                  Detalhe das parcelas
                </div>
                {parcelasAsync.loading ? (
                  <div className="text-sm text-ink-soft">Carregando parcelas…</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table-base">
                      <thead>
                        <tr>
                          <th className="w-16">Nº</th>
                          <th>Data</th>
                          <th className="text-right">Valor</th>
                          <th>Forma de pagamento</th>
                          <th>Meio</th>
                          <th>Código SumUp</th>
                          <th>Situação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parcelas.map((p) => {
                          const conta = contaPorParcela.get(p.id);
                          return (
                            <tr key={p.id}>
                              <td className="font-numeric tabular-nums text-xs">
                                {p.numero}/{parcelas.length}
                              </td>
                              <td className="font-numeric tabular-nums text-xs">
                                {formatarData(p.data_vencimento)}
                              </td>
                              <td className="text-right font-numeric tabular-nums text-xs">
                                {formatarMoeda(Number(p.valor), moeda)}
                              </td>
                              <td className="text-sm">
                                {labelFormaPagamento(p.forma_pagamento)}
                              </td>
                              <td className="text-sm text-ink-soft">
                                {p.meio_pagamento ?? "—"}
                              </td>
                              <td className="font-numeric text-xs text-ink-soft">
                                {p.codigo_transacao ?? "—"}
                              </td>
                              <td>
                                <SituacaoContaAcao
                                  conta={conta}
                                  codigo={p.codigo_transacao}
                                  onAlterado={() => contasAsync.reload()}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null}
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
                            {iv.item_estoque ? null : (
                              <div className="mt-1">
                                <StatusBadge value="sem_par" label="Sem par no estoque" tom="aviso" />
                              </div>
                            )}
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

          <SectionCard title="Envio e observações">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <F label="Forma de envio" value={venda.data.forma_envio?.nome ?? "—"} />
              <F
                label="Rastreamento"
                value={
                  venda.data.codigo_rastreamento ? (
                    venda.data.url_rastreamento ? (
                      <a
                        href={venda.data.url_rastreamento}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-full items-center gap-1 text-brand-700 underline decoration-brand-300 underline-offset-2 transition hover:text-brand-800 hover:decoration-brand-500"
                      >
                        <span className="min-w-0 truncate">{venda.data.codigo_rastreamento}</span>
                        <IconArrowUpRight width={13} height={13} className="shrink-0 opacity-80" aria-hidden />
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
            {venda.data.obs || venda.data.obs_interna ? (
              <div className="mt-5 space-y-2 border-t border-line pt-4">
                {venda.data.obs ? (
                  <p className="whitespace-pre-wrap text-sm text-ink">{venda.data.obs}</p>
                ) : null}
                {venda.data.obs_interna ? (
                  <p className="whitespace-pre-wrap text-xs text-ink-soft">
                    Interna: {venda.data.obs_interna}
                  </p>
                ) : null}
              </div>
            ) : null}
          </SectionCard>

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

function VinculoSumup({
  codigo,
  conta,
  ordem,
}: {
  codigo: string | null;
  conta: ContaSumup;
  ordem: { id: string; numero: string | null };
}) {
  const codigos = extrairCodigosSumup(codigo);
  const [aberta, setAberta] = useState<VendaSumup | null>(null);
  const consulta = useAsync(async () => {
    if (codigos.length === 0) return [] as Array<{ codigo: string; venda: VendaSumup | null }>;
    return Promise.all(
      codigos.map(async (item) => ({
        codigo: item,
        venda: (await obterVendaSumupPorCodigo(item, conta)).item,
      })),
    );
  }, [codigos.join("|"), conta]);

  if (!codigo?.trim()) return "—";
  if (codigos.length === 0) return codigo;

  if (consulta.loading) {
    return <span className="font-numeric tabular-nums text-xs">{codigos.join(" / ")}</span>;
  }

  if (consulta.error) {
    return (
      <span>
        <span className="font-numeric tabular-nums text-xs">{codigos.join(" / ")}</span>
        <span className="mt-1 block text-xs text-ink-soft">Não foi possível consultar a SumUp.</span>
      </span>
    );
  }

  return (
    <>
      <span className="flex flex-col gap-1">
        {(consulta.data ?? []).map((item) =>
          item.venda ? (
            <button
              key={item.codigo}
              type="button"
              onClick={() => setAberta(item.venda)}
              className="w-fit font-numeric tabular-nums text-xs text-brand-700 hover:underline"
            >
              {item.codigo}
            </button>
          ) : (
            <span key={item.codigo} className="block">
              <span className="font-numeric tabular-nums text-xs">{item.codigo}</span>
              <span className="mt-0.5 block text-xs text-ink-soft">
                Código informado na ordem. A {conta === "pt" ? "SumUp Portugal" : "SumUp Brasil"} não
                devolveu essa venda.
              </span>
            </span>
          ),
        )}
      </span>
      <SumupVendaModal venda={aberta} conta={conta} ordem={ordem} onClose={() => setAberta(null)} />
    </>
  );
}

function SituacaoContaAcao({
  conta,
  codigo,
  onAlterado,
}: {
  conta: ContaReceber | undefined;
  codigo: string | null;
  onAlterado: () => void;
}) {
  const toast = useToast();
  const [ocupado, setOcupado] = useState(false);
  if (!conta) return <SituacaoConta conta={conta} />;

  const recebida = conta.situacao === "recebido";
  const podeAlterar = statusPodeSerAlteradoNaOrdem(codigo) && conta.situacao !== "cancelado";

  const alternar = async () => {
    const confirmar = window.confirm(
      recebida
        ? "Estornar o recebimento desta parcela?"
        : "Marcar esta parcela como recebida na data de vencimento?",
    );
    if (!confirmar) return;
    setOcupado(true);
    try {
      if (recebida) await contasReceberService.estornarBaixa([conta.id]);
      else await contasReceberService.baixar([conta.id], null);
      toast.sucesso(recebida ? "Recebimento estornado." : "Parcela marcada como recebida.");
      onAlterado();
    } catch (erro) {
      toast.erro(mensagemErro(erro), "Não foi possível alterar a situação");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <SituacaoContaBadge conta={conta} />
      {podeAlterar ? (
        <BotaoStatusConta tipo={recebida ? "estornar" : "receber"} ocupado={ocupado} onClick={alternar} />
      ) : null}
    </div>
  );
}

function SituacaoConta({ conta }: { conta: ContaReceber | undefined }) {
  if (!conta) {
    return (
      <span className="text-xs text-ink-faint" title="Esta parcela não gera conta a receber">
        —
      </span>
    );
  }
  return <SituacaoContaBadge conta={conta} />;
}

function ResumoValor({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div>
      <div className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">
        {rotulo}
      </div>
      <div
        className={`mt-1 font-numeric tabular-nums text-sm font-semibold ${destaque ? "text-brand-700" : "text-ink"}`}
      >
        {valor}
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
