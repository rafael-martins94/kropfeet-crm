import { useEffect, useMemo, useState } from "react";
import { IconPlus, IconTrash } from "../Icons";
import { SearchableSelectDropdown } from "../SearchableSelectDropdown";
import { StatusBadge } from "../StatusBadge";
import { BotaoStatusConta } from "../financeiro/BotaoStatusConta";
import { SituacaoContaBadge } from "../financeiro/SituacaoContaBadge";
import { formatarData, formatarMoeda } from "../../utils/format";
import {
  formaPermiteParcelar,
  formasPagamentoDaRegiao,
  labelFormaPagamento,
  meioEhSumup,
  meiosPagamentoDaForma,
  type OpcaoSimples,
} from "../../pages/vendas/vendaOpcoes";
import {
  gerarParcelas,
  interpretarCondicao,
  somarDias,
  primeiroVencimentoPadrao,
  type CondicaoPagamento,
} from "../../utils/condicaoPagamento";
import { resumoFinanceiroVenda } from "../../services/vendas";
import { contaContaComoRecebida, statusPodeSerAlteradoNaOrdem } from "../../utils/situacaoContaExibida";
import type { ContaReceber } from "../../types/entities";
import { cn } from "../../utils/cn";

export type ParcelaVendaFormLinha = {
  key: string;
  /** Id da parcela gravada; `null` para linhas novas. */
  id: string | null;
  data_vencimento: string;
  /** Dias após a data do pedido; mantido em sincronia com o vencimento. */
  dias: string;
  valor: string;
  forma_pagamento: string;
  meio_pagamento: string;
  codigo_transacao: string;
};

interface ParcelasVendaEditorProps {
  value: ParcelaVendaFormLinha[];
  onChange: (parcelas: ParcelaVendaFormLinha[]) => void;
  valorTotalPedido: number;
  moeda: string;
  regiao: string;
  /** Data do pedido (YYYY-MM-DD), base para os vencimentos gerados. */
  dataBase: string;
  condicao: string;
  onCondicaoChange: (condicao: string) => void;
  /** Contas a receber já lançadas para esta venda. */
  contas: ContaReceber[];
  /** Estorna a baixa na hora, destravando a parcela para edição. */
  onEstornarConta?: (conta: ContaReceber) => Promise<void>;
  /** Marca a parcela como recebida na data de vencimento. */
  onMarcarRecebida?: (conta: ContaReceber) => Promise<void>;
}

export function novaParcelaVendaLinha(
  parcial?: Partial<ParcelaVendaFormLinha>,
): ParcelaVendaFormLinha {
  return {
    key: parcial?.key ?? `parcela-${crypto.randomUUID()}`,
    id: parcial?.id ?? null,
    data_vencimento: parcial?.data_vencimento ?? "",
    dias: parcial?.dias ?? "",
    valor: parcial?.valor ?? "0",
    forma_pagamento: parcial?.forma_pagamento ?? "",
    meio_pagamento: parcial?.meio_pagamento ?? "",
    codigo_transacao: parcial?.codigo_transacao ?? "",
  };
}

function numLinha(valor: string): number {
  const n = Number(String(valor).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function diasEntre(deIso: string, ateIso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deIso) || !/^\d{4}-\d{2}-\d{2}$/.test(ateIso)) return null;
  const [y1, m1, d1] = deIso.split("-").map(Number);
  const [y2, m2, d2] = ateIso.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

function hojeIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const OPCOES_PARCELAS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24];

/** Condição que não cabe na lista de quantidades (ex.: "30 60 90", "0 30 60"). */
function condicaoEhPersonalizada(condicao: string): boolean {
  const c = interpretarCondicao(condicao);
  if (!c) return condicao.trim() !== "";
  return c.tipo === "dias" && !(c.dias.length === 1 && c.dias[0] === 0);
}

function comValorLegado(base: OpcaoSimples[], atual: string, vazio: string): OpcaoSimples[] {
  const opcoes = [{ value: "", label: vazio }, ...base];
  if (atual && !opcoes.some((o) => o.value.toLowerCase() === atual.toLowerCase())) {
    opcoes.push({ value: atual, label: `${labelFormaPagamento(atual)} (antigo)` });
  }
  return opcoes;
}

function SituacaoParcela({
  linha,
  conta,
}: {
  linha: ParcelaVendaFormLinha;
  conta: ContaReceber | undefined;
}) {
  if (!conta) {
    return linha.id ? (
      <span className="text-xs text-ink-faint" title="Esta parcela não gera conta a receber">
        —
      </span>
    ) : (
      <StatusBadge value="nova" label="Nova" tom="neutro" />
    );
  }
  return <SituacaoContaBadge conta={conta} />;
}

export function ParcelasVendaEditor({
  value,
  onChange,
  valorTotalPedido,
  moeda,
  regiao,
  dataBase,
  condicao,
  onCondicaoChange,
  contas,
  onEstornarConta,
  onMarcarRecebida,
}: ParcelasVendaEditorProps) {
  const formas = formasPagamentoDaRegiao(regiao);
  const [estornando, setEstornando] = useState<string | null>(null);
  const [marcando, setMarcando] = useState<string | null>(null);

  const estornar = async (conta: ContaReceber, numero: number) => {
    if (!onEstornarConta) return;
    const aviso =
      conta.origem_baixa === "sumup"
        ? `A parcela ${numero} foi baixada pela conciliação SumUp. Estornar e liberar para edição?`
        : `Estornar o recebimento da parcela ${numero} e liberar para edição?`;
    if (!window.confirm(aviso)) return;
    setEstornando(conta.id);
    try {
      await onEstornarConta(conta);
    } finally {
      setEstornando(null);
    }
  };

  const marcarRecebida = async (conta: ContaReceber, numero: number) => {
    if (!onMarcarRecebida) return;
    if (!window.confirm(`Marcar a parcela ${numero} como recebida na data de vencimento?`)) return;
    setMarcando(conta.id);
    try {
      await onMarcarRecebida(conta);
    } finally {
      setMarcando(null);
    }
  };
  const [formaGerar, setFormaGerar] = useState(formas[0]?.value ?? "");
  const [meioGerar, setMeioGerar] = useState(() => {
    const meios = meiosPagamentoDaForma(regiao, formas[0]?.value);
    return meios.length === 1 ? meios[0].value : "";
  });
  const [valorGerar, setValorGerar] = useState("");
  const [erroGerar, setErroGerar] = useState<string | null>(null);

  useEffect(() => {
    const primeira = formasPagamentoDaRegiao(regiao)[0]?.value ?? "";
    setFormaGerar(primeira);
    const meios = meiosPagamentoDaForma(regiao, primeira);
    setMeioGerar(meios.length === 1 ? meios[0].value : "");
  }, [regiao]);

  const contaPorParcela = useMemo(() => {
    const mapa = new Map<string, ContaReceber>();
    for (const c of contas) if (c.id_parcela_venda) mapa.set(c.id_parcela_venda, c);
    return mapa;
  }, [contas]);
  const recebidasSemParcela = contas.filter((c) => !c.id_parcela_venda && contaContaComoRecebida(c));

  const resumo = resumoFinanceiroVenda(
    valorTotalPedido,
    value.map((p) => ({ valor: numLinha(p.valor) })),
    contas,
  );

  const permiteParcelar = formaPermiteParcelar(regiao, formaGerar);
  const meiosGerar = meiosPagamentoDaForma(regiao, formaGerar);
  const valorParaGerar = valorGerar.trim() ? numLinha(valorGerar) : Math.max(0, resumo.faltaParcelar);
  const dataBaseIso = dataBase || hojeIso();

  const [personalizada, setPersonalizada] = useState(() => condicaoEhPersonalizada(condicao));
  const [primeiroVencimento, setPrimeiroVencimento] = useState("");
  useEffect(() => {
    if (condicaoEhPersonalizada(condicao)) setPersonalizada(true);
  }, [condicao]);

  const condicaoInterpretada: CondicaoPagamento | null = permiteParcelar
    ? interpretarCondicao(condicao)
    : { tipo: "dias", dias: [0] };
  const quantidadeEscolhida =
    condicaoInterpretada?.tipo === "mensal" ? condicaoInterpretada.parcelas : 1;
  const opcoesQuantidade = OPCOES_PARCELAS.includes(quantidadeEscolhida)
    ? OPCOES_PARCELAS
    : [...OPCOES_PARCELAS, quantidadeEscolhida].sort((a, b) => a - b);
  const modoDias = permiteParcelar && personalizada;
  const vencimentoPadrao = condicaoInterpretada
    ? primeiroVencimentoPadrao(condicaoInterpretada, dataBaseIso)
    : dataBaseIso;
  const previa =
    condicaoInterpretada && valorParaGerar > 0
      ? gerarParcelas({
          valor: valorParaGerar,
          condicao: condicaoInterpretada,
          dataBaseIso,
          primeiroVencimentoIso: modoDias ? null : primeiroVencimento || null,
        })
      : [];

  const escolherQuantidade = (valor: string) => {
    setErroGerar(null);
    if (valor === "personalizada") {
      setPersonalizada(true);
      if (!condicaoEhPersonalizada(condicao)) onCondicaoChange("30 60 90");
      return;
    }
    setPersonalizada(false);
    const n = Number(valor);
    onCondicaoChange(n > 1 ? `${n}x` : "");
    setPrimeiroVencimento("");
  };

  const escolherFormaGerar = (forma: string) => {
    setFormaGerar(forma);
    const meios = meiosPagamentoDaForma(regiao, forma);
    setMeioGerar(meios.length === 1 ? meios[0].value : "");
    setPrimeiroVencimento("");
    setErroGerar(null);
  };

  const gerar = () => {
    if (!formaGerar) {
      setErroGerar("Escolha a forma de pagamento.");
      return;
    }
    if (!condicaoInterpretada) {
      setErroGerar("Dias inválidos. Use números em ordem, como 30 60 90 ou 0 30 60.");
      return;
    }
    if (valorParaGerar <= 0) {
      setErroGerar("Não há valor restante para parcelar. Informe o valor.");
      return;
    }
    setErroGerar(null);
    onChange([
      ...value,
      ...previa.map((p) =>
        novaParcelaVendaLinha({
          data_vencimento: p.data_vencimento,
          dias: String(diasEntre(dataBaseIso, p.data_vencimento) ?? ""),
          valor: String(p.valor),
          forma_pagamento: formaGerar,
          meio_pagamento: meioGerar,
        }),
      ),
    ]);
    setValorGerar("");
  };

  const estaTravada = (linha: ParcelaVendaFormLinha) => {
    const conta = linha.id ? contaPorParcela.get(linha.id) : undefined;
    return Boolean(conta && contaContaComoRecebida(conta));
  };

  const atualizar = (key: string, patch: Partial<ParcelaVendaFormLinha>) => {
    onChange(
      value.map((linha) => {
        if (linha.key !== key) return linha;
        const proxima = { ...linha, ...patch };
        if (patch.dias !== undefined) {
          const n = Number(patch.dias);
          if (patch.dias.trim() !== "" && Number.isInteger(n) && n >= 0) {
            proxima.data_vencimento = somarDias(dataBaseIso, n);
          }
        } else if (patch.data_vencimento !== undefined) {
          const n = diasEntre(dataBaseIso, patch.data_vencimento);
          proxima.dias = n != null && n >= 0 ? String(n) : "";
        }
        if (patch.forma_pagamento !== undefined && patch.forma_pagamento !== linha.forma_pagamento) {
          const meios = meiosPagamentoDaForma(regiao, patch.forma_pagamento);
          if (!meios.some((m) => m.value === proxima.meio_pagamento)) {
            proxima.meio_pagamento = meios.length === 1 ? meios[0].value : "";
          }
        }
        return proxima;
      }),
    );
  };

  const remover = (key: string) => onChange(value.filter((p) => p.key !== key));
  const limparNaoRecebidas = () => onChange(value.filter(estaTravada));
  const adicionarManual = () =>
    onChange([
      ...value,
      novaParcelaVendaLinha({
        data_vencimento: dataBaseIso,
        dias: "0",
        forma_pagamento: formaGerar,
        meio_pagamento: meioGerar,
        valor: String(Math.max(0, resumo.faltaParcelar)),
      }),
    ]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-surface-subtle/40 p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_0.9fr_1fr_0.9fr_auto] lg:items-end">
          <label className="block space-y-1">
            <span className="label-base">Forma</span>
            <SearchableSelectDropdown
              value={formaGerar}
              options={formas}
              searchPlaceholder="Buscar forma…"
              emptyLabel="— Forma —"
              onChange={escolherFormaGerar}
            />
          </label>
          <label className="block space-y-1">
            <span className="label-base">Meio</span>
            <SearchableSelectDropdown
              value={meioGerar}
              options={[{ value: "", label: "— Sem meio —" }, ...meiosGerar]}
              searchPlaceholder="Buscar meio…"
              emptyLabel="— Sem meio —"
              disabled={meiosGerar.length === 0}
              onChange={setMeioGerar}
            />
          </label>
          <label className="block space-y-1">
            <span className="label-base">Parcelas</span>
            <select
              className="input-base w-full"
              value={!permiteParcelar ? "1" : personalizada ? "personalizada" : String(quantidadeEscolhida)}
              disabled={!permiteParcelar}
              title={permiteParcelar ? undefined : "Esta forma é sempre à vista"}
              onChange={(e) => escolherQuantidade(e.target.value)}
            >
              {opcoesQuantidade.map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "À vista" : `${n}x`}
                </option>
              ))}
              <option value="personalizada">Personalizada (dias)</option>
            </select>
          </label>
          {modoDias ? (
            <label className="block space-y-1">
              <span className="label-base">Dias após o pedido</span>
              <input
                type="text"
                className="input-base w-full font-numeric"
                value={condicao}
                placeholder="30 60 90"
                title="Um número por parcela, separados por espaço. 0 = entrada no dia do pedido."
                onChange={(e) => {
                  onCondicaoChange(e.target.value);
                  setErroGerar(null);
                }}
              />
            </label>
          ) : (
            <label className="block space-y-1">
              <span className="label-base">
                {quantidadeEscolhida > 1 && permiteParcelar ? "1º vencimento" : "Vencimento"}
              </span>
              <input
                type="date"
                className="input-base w-full"
                value={primeiroVencimento || vencimentoPadrao}
                onChange={(e) => setPrimeiroVencimento(e.target.value)}
              />
            </label>
          )}
          <label className="block space-y-1">
            <span className="label-base">Valor</span>
            <input
              type="text"
              inputMode="decimal"
              className="input-base w-full text-right font-numeric"
              value={valorGerar}
              placeholder={formatarMoeda(Math.max(0, resumo.faltaParcelar), moeda)}
              onChange={(e) => setValorGerar(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={gerar}
            title="Gerar parcelas"
            aria-label="Gerar parcelas"
            className="inline-flex h-[2.4rem] w-[2.4rem] items-center justify-center rounded-lg bg-brand-600 text-white hover:bg-brand-700"
          >
            <IconPlus width={18} height={18} />
          </button>
        </div>
        {erroGerar ? (
          <p className="mt-2 text-xs text-red-700">{erroGerar}</p>
        ) : modoDias && !condicaoInterpretada ? (
          <p className="mt-2 text-xs text-amber-800">
            Informe os dias de cada parcela em ordem, separados por espaço. Ex.: 30 60 90, ou 0 30 60
            com entrada no dia do pedido.
          </p>
        ) : previa.length > 0 ? (
          <div className="mt-2 space-y-1.5">
            <p className="text-xs text-ink-soft">
              {previa.length === 1
                ? `1 parcela de ${formatarMoeda(previa[0].valor, moeda)}`
                : `${previa.length} parcelas, total ${formatarMoeda(valorParaGerar, moeda)}`}
              {valorGerar.trim() ? "" : " (o que falta parcelar)"}:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {previa.map((p, i) => (
                <span
                  key={`${p.data_vencimento}-${i}`}
                  className="inline-flex items-baseline gap-1 rounded-md border border-line bg-white px-2 py-0.5 text-[0.7rem]"
                >
                  <span className="text-ink-faint">{i + 1}ª</span>
                  <span className="font-numeric text-ink">{formatarData(p.data_vencimento)}</span>
                  <span className="font-numeric font-medium text-ink">{formatarMoeda(p.valor, moeda)}</span>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-ink-faint">
            Tudo já está parcelado. Informe um valor para gerar mais parcelas.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-xs text-ink-soft">
        <span>
          Total do pedido{" "}
          <strong className="font-numeric tabular-nums text-ink">
            {formatarMoeda(valorTotalPedido, moeda)}
          </strong>
        </span>
        <span>
          Parcelado{" "}
          <strong className="font-numeric tabular-nums text-ink">
            {formatarMoeda(resumo.totalParcelado, moeda)}
          </strong>
        </span>
        {Math.abs(resumo.faltaParcelar) >= 0.01 ? (
          <span className={resumo.faltaParcelar > 0 ? "text-amber-800" : "text-red-700"}>
            {resumo.faltaParcelar > 0 ? "Falta parcelar " : "Parcelas passam do total em "}
            <strong className="font-numeric tabular-nums">
              {formatarMoeda(Math.abs(resumo.faltaParcelar), moeda)}
            </strong>
          </span>
        ) : null}
        <span>
          Recebido{" "}
          <strong className="font-numeric tabular-nums text-ink">
            {formatarMoeda(resumo.recebido, moeda)}
          </strong>
        </span>
        <span>
          Em aberto{" "}
          <strong className="font-numeric tabular-nums text-brand-700">
            {formatarMoeda(resumo.emAberto, moeda)}
          </strong>
        </span>
      </div>

      {value.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface-subtle/30 px-4 py-6 text-center">
          <p className="text-sm text-ink-soft">Nenhuma parcela.</p>
          <p className="mt-1 text-xs text-ink-faint">
            Escolha a condição acima e clique em +. Cada parcela vira um lançamento em Contas a receber ao salvar.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[50rem] table-fixed border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-subtle/60 text-left text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">
                <th className="w-10 px-2 py-2">Nº</th>
                <th className="w-[4.5rem] px-2 py-2" title="Dias após a data do pedido">
                  Dias
                </th>
                <th className="w-[8.5rem] px-2 py-2">Vencimento</th>
                <th className="w-[6.5rem] px-2 py-2 text-right">Valor</th>
                <th className="px-2 py-2">Forma</th>
                <th className="px-2 py-2">Meio</th>
                <th className="w-[8rem] px-2 py-2">Código SumUp</th>
                <th className="w-[7.5rem] px-2 py-2">Situação</th>
                <th className="w-9 px-1 py-2">
                  <span className="sr-only">Remover</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {value.map((p, idx) => {
                const travada = estaTravada(p);
                const conta = p.id ? contaPorParcela.get(p.id) : undefined;
                const meios = meiosPagamentoDaForma(regiao, p.forma_pagamento);
                const podeAlterarStatus = statusPodeSerAlteradoNaOrdem(
                  p.codigo_transacao || conta?.codigo_transacao,
                );
                const dicaTravada = podeAlterarStatus
                  ? "Parcela já recebida. Use Estornar para editar."
                  : "O recebimento desta parcela segue o código da SumUp.";
                return (
                  <tr key={p.key} className="border-b border-line last:border-b-0">
                    <td className="px-2 py-2 align-middle font-numeric tabular-nums text-xs text-ink-soft">
                      {idx + 1}
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <input
                        type="text"
                        inputMode="numeric"
                        className="input-base w-full min-w-0 px-2 py-1.5 text-right font-numeric text-xs"
                        value={p.dias}
                        placeholder={String(diasEntre(dataBaseIso, p.data_vencimento) ?? 0)}
                        disabled={travada}
                        title={travada ? dicaTravada : "Dias após a data do pedido (0 = no dia)"}
                        onChange={(e) =>
                          atualizar(p.key, { dias: e.target.value.replace(/\D/g, "") })
                        }
                      />
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <input
                        type="date"
                        className="input-base w-full min-w-0 px-2 py-1.5 text-xs"
                        value={p.data_vencimento}
                        disabled={travada}
                        title={travada ? dicaTravada : undefined}
                        onChange={(e) => atualizar(p.key, { data_vencimento: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <input
                        type="text"
                        inputMode="decimal"
                        className="input-base w-full min-w-0 px-2 py-1.5 text-right font-numeric text-xs"
                        value={p.valor}
                        disabled={travada}
                        title={travada ? dicaTravada : undefined}
                        onChange={(e) => atualizar(p.key, { valor: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <SearchableSelectDropdown
                        value={p.forma_pagamento}
                        options={comValorLegado(formas, p.forma_pagamento, "— Forma —")}
                        searchPlaceholder="Buscar forma…"
                        emptyLabel="— Forma —"
                        disabled={travada}
                        onChange={(v) => atualizar(p.key, { forma_pagamento: v })}
                        className="min-w-0 [&_button]:px-2 [&_button]:py-1.5 [&_button]:text-xs"
                      />
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <SearchableSelectDropdown
                        value={p.meio_pagamento}
                        options={comValorLegado(meios, p.meio_pagamento, "— Meio —")}
                        searchPlaceholder="Buscar meio…"
                        emptyLabel="— Meio —"
                        disabled={travada}
                        onChange={(v) => atualizar(p.key, { meio_pagamento: v })}
                        className="min-w-0 [&_button]:px-2 [&_button]:py-1.5 [&_button]:text-xs"
                      />
                    </td>
                    <td className="px-2 py-2 align-middle">
                      {meioEhSumup(p.meio_pagamento) || p.codigo_transacao ? (
                        <input
                          type="text"
                          className="input-base w-full min-w-0 px-2 py-1.5 font-numeric text-xs uppercase"
                          value={p.codigo_transacao}
                          placeholder="T…"
                          onChange={(e) =>
                            atualizar(p.key, { codigo_transacao: e.target.value.toUpperCase() })
                          }
                        />
                      ) : (
                        <span className="text-xs text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <div className="flex items-center gap-1.5">
                        <SituacaoParcela linha={p} conta={conta} />
                        {podeAlterarStatus && travada && conta && onEstornarConta ? (
                          <BotaoStatusConta
                            tipo="estornar"
                            ocupado={estornando === conta.id}
                            onClick={() => estornar(conta, idx + 1)}
                          />
                        ) : null}
                        {podeAlterarStatus && !travada && conta && onMarcarRecebida ? (
                          <BotaoStatusConta
                            tipo="receber"
                            ocupado={marcando === conta.id}
                            onClick={() => marcarRecebida(conta, idx + 1)}
                          />
                        ) : null}
                      </div>
                    </td>
                    <td className="px-1 py-2 text-center align-middle">
                      <button
                        type="button"
                        disabled={travada}
                        title={travada ? dicaTravada : undefined}
                        className="rounded p-1 text-ink-soft hover:bg-surface-subtle hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
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

      {recebidasSemParcela.length > 0 ? (
        <p className="text-xs text-amber-800">
          {recebidasSemParcela.length === 1
            ? "Há 1 recebimento sem parcela correspondente neste pedido."
            : `Há ${recebidasSemParcela.length} recebimentos sem parcela correspondente neste pedido.`}{" "}
          Confira em Contas a receber.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={adicionarManual}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-ink hover:bg-surface-subtle"
        >
          <IconPlus width={14} height={14} />
          Adicionar linha
        </button>
        {value.some((p) => !estaTravada(p)) ? (
          <button
            type="button"
            onClick={limparNaoRecebidas}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-ink-soft hover:bg-surface-subtle hover:text-red-700"
          >
            <IconTrash width={14} height={14} />
            Limpar parcelas
          </button>
        ) : null}
      </div>
    </div>
  );
}
