import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Modal } from "../Modal";
import { SecondaryButton } from "../PrimaryButton";
import { StatusBadge } from "../StatusBadge";
import { BotaoStatusConta } from "./BotaoStatusConta";
import { SituacaoContaBadge } from "./SituacaoContaBadge";
import { useToast } from "../../contexts/ToastContext";
import { useAsync } from "../../hooks/useAsync";
import { contasReceberService, type ContaReceberDetalhada } from "../../services/contasReceber";
import { resumoFinanceiroVenda, vendasService } from "../../services/vendas";
import type { ParcelaVenda } from "../../types/entities";
import { cn } from "../../utils/cn";
import { mensagemErro } from "../../utils/errors";
import { formatarData, formatarDataHora, formatarMoeda } from "../../utils/format";
import { contaContaComoRecebida } from "../../utils/situacaoContaExibida";
import { labelFormaPagamento, labelFreteStatus, moedaDaVenda, moedaDoFrete, valorFreteCobrado } from "../../pages/vendas/vendaOpcoes";

interface LinhaPagamento {
  chave: string;
  numero: number | null;
  conta: ContaReceberDetalhada | null;
  parcela: ParcelaVenda | null;
  selecionada: boolean;
}

function montarLinhas(
  parcelas: ParcelaVenda[],
  contas: ContaReceberDetalhada[],
  idConta: string,
): LinhaPagamento[] {
  const contaPorParcela = new Map(
    contas.filter((c) => c.id_parcela_venda).map((c) => [c.id_parcela_venda!, c]),
  );
  const usadas = new Set<string>();
  const linhas: LinhaPagamento[] = parcelas.map((parcela) => {
    const conta = contaPorParcela.get(parcela.id) ?? null;
    if (conta) usadas.add(conta.id);
    return {
      chave: parcela.id,
      numero: parcela.numero,
      conta,
      parcela,
      selecionada: conta?.id === idConta,
    };
  });
  for (const conta of contas) {
    if (usadas.has(conta.id)) continue;
    linhas.push({
      chave: conta.id,
      numero: null,
      conta,
      parcela: null,
      selecionada: conta.id === idConta,
    });
  }
  return linhas;
}

function Fato({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[0.68rem] font-medium uppercase tracking-wider text-ink-soft">{rotulo}</div>
      <div className="mt-0.5 truncate text-sm text-ink">{valor}</div>
    </div>
  );
}

function AcaoRecebimento({
  conta,
  onAlterado,
}: {
  conta: ContaReceberDetalhada;
  onAlterado: () => void;
}) {
  const toast = useToast();
  const [ocupado, setOcupado] = useState(false);
  const recebida = conta.situacao === "recebido";
  const podeReceber = conta.situacao === "aberto";
  const podeEstornar = recebida && Boolean(conta.id_parcela_venda);
  if (!podeReceber && !podeEstornar) return null;

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

  return <BotaoStatusConta tipo={recebida ? "estornar" : "receber"} ocupado={ocupado} onClick={alternar} />;
}

export function ResumoVendaContaModal({
  conta,
  onClose,
  onAlterado,
}: {
  conta: ContaReceberDetalhada;
  onClose: () => void;
  onAlterado?: () => void;
}) {
  const dados = useAsync(async () => {
    const [venda, parcelas, contas] = await Promise.all([
      vendasService.obterDetalhada(conta.id_venda),
      vendasService.obterParcelas(conta.id_venda),
      contasReceberService.listarPorVenda(conta.id_venda),
    ]);
    return { venda, parcelas, contas };
  }, [conta.id_venda]);

  const venda = dados.data?.venda ?? null;
  const parcelas = dados.data?.parcelas ?? [];
  const contas = dados.data?.contas ?? [];
  const moeda = venda ? moedaDaVenda(venda) : conta.moeda;
  const resumo = venda
    ? resumoFinanceiroVenda(Number(venda.valor_total ?? 0), parcelas, contas)
    : null;
  const linhas = montarLinhas(parcelas, contas, conta.id);
  const cliente = venda?.cliente?.nome ?? venda?.nome_cliente ?? conta.cliente?.nome ?? conta.venda?.nome_cliente;

  return (
    <Modal
      open
      size="xl"
      onClose={onClose}
      title={venda ? `Pedido ${venda.numero ?? ""}`.trim() : "Resumo da venda"}
      description={cliente ?? undefined}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Fechar</SecondaryButton>
          <Link to={`/vendas/${conta.id_venda}`} className="btn-primary">
            Ver ordem completa
          </Link>
        </>
      }
    >
      {dados.loading ? (
        <p className="text-sm text-ink-soft">Carregando pagamentos…</p>
      ) : dados.error ? (
        <p className="text-sm text-red-700">{dados.error.message}</p>
      ) : !venda ? (
        <p className="text-sm text-ink-soft">Ordem de venda não encontrada.</p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Fato rotulo="Total do pedido" valor={formatarMoeda(Number(venda.valor_total ?? 0), moeda)} />
            <Fato rotulo="Recebido" valor={formatarMoeda(resumo?.recebido ?? 0, moeda)} />
            <Fato rotulo="Em aberto" valor={formatarMoeda(resumo?.emAberto ?? 0, moeda)} />
            <Fato rotulo="Status" valor={<StatusBadge value={venda.status_venda} />} />
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <Fato rotulo="Cliente" valor={cliente ?? "—"} />
            <Fato rotulo="Data" valor={formatarDataHora(venda.data_pedido)} />
            <Fato rotulo="Vendedor" valor={venda.vendedor?.nome ?? "—"} />
            <Fato
              rotulo="Forma"
              valor={labelFormaPagamento(venda.forma_pagamento)}
            />
            <Fato
              rotulo="Frete a pagar"
              valor={`${formatarMoeda(valorFreteCobrado(venda.frete_status, Number(venda.valor_frete ?? 0)), moedaDoFrete(venda))} · ${labelFreteStatus(venda.frete_status)}`}
            />
          </dl>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-ink">Pagamentos</h4>
            {linhas.length === 0 ? (
              <p className="text-sm text-ink-soft">Esta ordem ainda não tem parcelas nem contas.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-canvas text-[0.68rem] font-medium uppercase tracking-wider text-ink-soft">
                    <tr>
                      <th className="px-3 py-2">Nº</th>
                      <th className="px-3 py-2">Vencimento</th>
                      <th className="px-3 py-2">Pago SumUp</th>
                      <th className="px-3 py-2">Forma · meio</th>
                      <th className="px-3 py-2">Situação</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                      <th className="px-3 py-2">
                        <span className="sr-only">Ação</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((linha) => {
                      const forma = linha.conta?.forma_pagamento ?? linha.parcela?.forma_pagamento;
                      const meio = linha.conta?.meio_pagamento ?? linha.parcela?.meio_pagamento;
                      const codigo = linha.conta?.codigo_transacao ?? linha.parcela?.codigo_transacao;
                      const vencimento = linha.conta?.data_vencimento ?? linha.parcela?.data_vencimento;
                      const valor = Number(linha.conta?.valor ?? linha.parcela?.valor ?? 0);
                      const moedaLinha = linha.conta?.moeda ?? moeda;
                      return (
                        <tr
                          key={linha.chave}
                          className={cn(
                            "border-t border-line",
                            linha.selecionada ? "bg-brand-50" : "bg-surface",
                          )}
                        >
                          <td className="px-3 py-2 font-numeric text-xs">
                            {linha.numero ?? "—"}
                            {linha.selecionada ? (
                              <span className="mt-0.5 block text-[0.68rem] font-medium normal-case tracking-normal text-brand-700">
                                esta conta
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 font-numeric text-xs">{formatarData(vencimento)}</td>
                          <td className="px-3 py-2 font-numeric text-xs" title="Data em que a SumUp pagou este repasse">
                            {formatarData(linha.conta?.data_pagamento_sumup)}
                          </td>
                          <td className="px-3 py-2 text-xs text-ink-soft">
                            {labelFormaPagamento(forma)}
                            {meio ? ` · ${meio}` : ""}
                            {codigo ? (
                              <span className="block font-numeric text-ink-faint">{codigo}</span>
                            ) : null}
                            {linha.conta?.motivo_divergencia ? (
                              <span className="block text-amber-800">{linha.conta.motivo_divergencia}</span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2">
                            {linha.conta ? (
                              <div className="flex flex-col items-start gap-0.5">
                                <SituacaoContaBadge conta={linha.conta} />
                                {contaContaComoRecebida(linha.conta) ? (
                                  <span className="text-[0.68rem] text-ink-faint">
                                    {formatarData(linha.conta.data_recebimento)}
                                    {linha.conta.origem_baixa === "sumup"
                                      ? " · SumUp"
                                      : linha.conta.origem_baixa === "automatica"
                                        ? " · auto"
                                        : ""}
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-xs text-ink-faint">Sem conta</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-numeric tabular-nums">
                            <span className="text-sm font-medium">{formatarMoeda(valor, moedaLinha)}</span>
                            {linha.conta?.taxa != null && Number(linha.conta.taxa) > 0 ? (
                              <span className="block text-[0.68rem] text-ink-faint">
                                taxa {formatarMoeda(Number(linha.conta.taxa), moedaLinha)} · líq.{" "}
                                {formatarMoeda(
                                  Number(linha.conta.valor_liquido ?? valor - Number(linha.conta.taxa)),
                                  moedaLinha,
                                )}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2">
                            {linha.conta ? (
                              <AcaoRecebimento
                                conta={linha.conta}
                                onAlterado={() => {
                                  dados.reload();
                                  onAlterado?.();
                                }}
                              />
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
