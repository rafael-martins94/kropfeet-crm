import { IconPlus, IconTrash } from "../Icons";
import { SearchableSelectDropdown } from "../SearchableSelectDropdown";
import { formatarMoeda } from "../../utils/format";
import {
  formaPagamentoParcelaOpcoes,
  meioPagamentoOpcoes,
  opcoesComValorAtual,
  parcelaEstaPagaPorForma,
} from "../../pages/vendas/vendaOpcoes";
import { resumoFinanceiroVenda } from "../../services/vendas";
import { cn } from "../../utils/cn";

export type ParcelaVendaFormLinha = {
  key: string;
  data_vencimento: string;
  valor: string;
  forma_pagamento: string;
  meio_pagamento: string;
  pago: boolean;
};

interface ParcelasVendaEditorProps {
  value: ParcelaVendaFormLinha[];
  onChange: (parcelas: ParcelaVendaFormLinha[]) => void;
  valorTotalPedido: number;
  moeda: string;
}

function novaKey() {
  return `parcela-${crypto.randomUUID()}`;
}

export function novaParcelaVendaLinha(
  parcial?: Partial<ParcelaVendaFormLinha>,
): ParcelaVendaFormLinha {
  const forma = parcial?.forma_pagamento ?? "";
  return {
    key: parcial?.key ?? novaKey(),
    data_vencimento: parcial?.data_vencimento ?? "",
    valor: parcial?.valor ?? "0",
    forma_pagamento: forma,
    meio_pagamento: parcial?.meio_pagamento ?? "",
    pago: parcial?.pago ?? parcelaEstaPagaPorForma(forma),
  };
}

function numLinha(valor: string): number {
  const n = Number(String(valor).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function ParcelasVendaEditor({
  value,
  onChange,
  valorTotalPedido,
  moeda,
}: ParcelasVendaEditorProps) {
  const resumo = resumoFinanceiroVenda(
    valorTotalPedido,
    value.map((p) => ({ valor: numLinha(p.valor), pago: p.pago })),
  );
  const diferencaParcelado = Number((valorTotalPedido - resumo.totalParcelado).toFixed(2));

  const atualizar = (key: string, patch: Partial<ParcelaVendaFormLinha>) => {
    onChange(
      value.map((linha) => {
        if (linha.key !== key) return linha;
        const proxima = { ...linha, ...patch };
        if (patch.forma_pagamento !== undefined) {
          if (!parcelaEstaPagaPorForma(proxima.forma_pagamento)) {
            proxima.pago = false;
          } else if (linha.forma_pagamento.trim().toLowerCase() === "contareceber") {
            proxima.pago = true;
          }
        }
        return proxima;
      }),
    );
  };

  const adicionar = () => onChange([...value, novaParcelaVendaLinha()]);
  const remover = (key: string) => onChange(value.filter((p) => p.key !== key));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-ink-soft">
        <span>
          Parcelado{" "}
          <strong className="font-numeric tabular-nums text-ink">
            {formatarMoeda(resumo.totalParcelado, moeda)}
          </strong>
        </span>
        <span>
          Pago{" "}
          <strong className="font-numeric tabular-nums text-ink">
            {formatarMoeda(resumo.valorPago, moeda)}
          </strong>
        </span>
        <span>
          Saldo{" "}
          <strong className="font-numeric tabular-nums text-brand-700">
            {formatarMoeda(resumo.saldoDevedor, moeda)}
          </strong>
        </span>
        {value.length > 0 && Math.abs(diferencaParcelado) >= 0.01 ? (
          <span className="w-full text-ink-faint sm:w-auto">
            {diferencaParcelado > 0
              ? `Faltam ${formatarMoeda(diferencaParcelado, moeda)}`
              : `${formatarMoeda(Math.abs(diferencaParcelado), moeda)} a mais`}
          </span>
        ) : null}
      </div>

      {value.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface-subtle/30 px-4 py-6 text-center">
          <p className="text-sm text-ink-soft">Nenhuma parcela — não é obrigatório.</p>
          <p className="mt-1 text-xs text-ink-faint">
            Sem parcelas, o saldo fica igual ao total do pedido. Adicione para registrar
            vencimento, meio (SumUp, Itaú…) e se já pagou.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-line">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-subtle/60 text-left text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">
                <th className="w-10 px-2 py-2">Nº</th>
                <th className="w-[22%] px-2 py-2">Data</th>
                <th className="w-[16%] px-2 py-2 text-right">Valor</th>
                <th className="w-[24%] px-2 py-2">Forma</th>
                <th className="w-[18%] px-2 py-2">Meio</th>
                <th className="w-14 px-1 py-2 text-center">Pago</th>
                <th className="w-9 px-1 py-2">
                  <span className="sr-only">Remover</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {value.map((p, idx) => {
                const contaReceber = !parcelaEstaPagaPorForma(p.forma_pagamento);
                return (
                  <tr key={p.key} className="border-b border-line last:border-b-0">
                    <td className="px-2 py-2 align-middle font-numeric tabular-nums text-xs text-ink-soft">
                      {idx + 1}
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <input
                        type="date"
                        className="input-base w-full min-w-0 px-2 py-1.5 text-xs"
                        value={p.data_vencimento}
                        onChange={(e) =>
                          atualizar(p.key, { data_vencimento: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <input
                        type="text"
                        inputMode="decimal"
                        className="input-base w-full min-w-0 px-2 py-1.5 text-right font-numeric text-xs"
                        value={p.valor}
                        onChange={(e) => atualizar(p.key, { valor: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <SearchableSelectDropdown
                        value={p.forma_pagamento}
                        options={opcoesComValorAtual(
                          formaPagamentoParcelaOpcoes,
                          p.forma_pagamento,
                          "— Forma —",
                        )}
                        searchPlaceholder="Buscar forma…"
                        emptyLabel="— Forma —"
                        onChange={(v) => atualizar(p.key, { forma_pagamento: v })}
                        className="min-w-0 [&_button]:px-2 [&_button]:py-1.5 [&_button]:text-xs"
                      />
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <SearchableSelectDropdown
                        value={p.meio_pagamento}
                        options={opcoesComValorAtual(
                          meioPagamentoOpcoes,
                          p.meio_pagamento,
                          "— Meio —",
                        )}
                        searchPlaceholder="Buscar meio…"
                        emptyLabel="— Meio —"
                        onChange={(v) => atualizar(p.key, { meio_pagamento: v })}
                        className="min-w-0 [&_button]:px-2 [&_button]:py-1.5 [&_button]:text-xs"
                      />
                    </td>
                    <td className="px-1 py-2 text-center align-middle">
                      <input
                        type="checkbox"
                        className={cn(
                          "h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-500",
                          contaReceber && "cursor-not-allowed opacity-60",
                        )}
                        checked={p.pago}
                        disabled={contaReceber}
                        title={
                          contaReceber
                            ? "Conta a receber permanece em aberto"
                            : "Marcar parcela como paga"
                        }
                        onChange={(e) => atualizar(p.key, { pago: e.target.checked })}
                      />
                    </td>
                    <td className="px-1 py-2 text-center align-middle">
                      <button
                        type="button"
                        className="rounded p-1 text-ink-soft hover:bg-surface-subtle hover:text-red-700"
                        onClick={() => remover(p.key)}
                        aria-label={`Remover parcela ${idx + 1}`}
                      >
                        <IconTrash width={14} height={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <button
        type="button"
        onClick={adicionar}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-ink hover:bg-surface-subtle"
      >
        <IconPlus width={14} height={14} />
        Adicionar parcela
      </button>
    </div>
  );
}
