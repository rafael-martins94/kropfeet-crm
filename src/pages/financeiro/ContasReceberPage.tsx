import { useMemo, useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { DataTable, type Column } from "../../components/DataTable";
import { DateRangePicker } from "../../components/DateRangePicker";
import { Modal } from "../../components/Modal";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { PrimaryButton, SecondaryButton } from "../../components/PrimaryButton";
import { ScrollableListShell } from "../../components/ScrollableListShell";
import { SearchInput } from "../../components/SearchInput";
import { SectionCard } from "../../components/SectionCard";
import { StatusSelectDropdown } from "../../components/StatusSelectDropdown";
import type { Tom } from "../../components/StatusBadge";
import { ResumoVendaContaModal } from "../../components/financeiro/ResumoVendaContaModal";
import { SituacaoContaBadge } from "../../components/financeiro/SituacaoContaBadge";
import { useToast } from "../../contexts/ToastContext";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import {
  contasReceberService,
  somarDiasIso,
  type ContaReceberDetalhada,
  type FiltroContasReceber,
  FORMA_SEM_PAGAMENTO,
  MEIO_SEM_PAGAMENTO,
  type RegiaoContasReceber,
  type SituacaoFiltroValor,
  type TotaisContasReceber,
} from "../../services/contasReceber";
import {
  CONTAS_SUMUP,
  listarSugestoesVinculoSumup,
  sincronizarSumup,
  vincularTransacaoSumup,
  type ContaSumup,
  type ResultadoSincronizacaoSumup,
  type SugestaoVinculoSumup,
} from "../../services/sumup";
import { mensagemErro } from "../../utils/errors";
import { cn } from "../../utils/cn";
import { formatarData, formatarMoeda, traduzirEnum } from "../../utils/format";
import { formatarDataHoraPortugal } from "../../utils/fusoPortugal";
import { rotuloStatusSumup } from "../../utils/sumupRotulos";
import { contaContaComoEmAberto, contaContaComoRecebida } from "../../utils/situacaoContaExibida";
import {
  formasPagamentoDaRegiao,
  labelFormaPagamento,
  meiosPagamentoDaForma,
} from "../vendas/vendaOpcoes";

const PAGE_SIZE = 50;

const SITUACOES: Array<{ value: SituacaoFiltroValor; label: string; tom?: Tom }> = [
  { value: "aberto", label: "Em aberto", tom: "aviso" },
  { value: "vencida", label: "Vencida", tom: "erro" },
  { value: "recebido", label: "Recebido", tom: "sucesso" },
  { value: "cancelado", label: "Cancelada", tom: "zinco" },
  { value: "divergente", label: "Divergente", tom: "laranja" },
];

const FORMAS_FORA_DO_CATALOGO: Record<RegiaoContasReceber, string[]> = {
  brasil: ["boleto"],
  europa: ["Best"],
};

const MEIOS_FORA_DO_CATALOGO: Record<RegiaoContasReceber, string[]> = {
  brasil: [],
  europa: ["SumUp"],
};

function opcoesForma(regiao: RegiaoContasReceber) {
  const catalogo = formasPagamentoDaRegiao(regiao);
  const extras = FORMAS_FORA_DO_CATALOGO[regiao].filter(
    (forma) => !catalogo.some((opcao) => opcao.value === forma),
  );
  return [
    { value: FORMA_SEM_PAGAMENTO, label: "Sem forma" },
    ...catalogo,
    ...extras.map((forma) => ({ value: forma, label: labelFormaPagamento(forma) })),
  ];
}

function meiosDaSelecao(regiao: RegiaoContasReceber, formas: string[]): string[] {
  const meios = new Set<string>();
  const formasComMeio = formas.filter((forma) => forma !== FORMA_SEM_PAGAMENTO);
  const todas = formasComMeio.length === 0;
  if (todas) {
    for (const opcao of formasPagamentoDaRegiao(regiao)) {
      for (const meio of meiosPagamentoDaForma(regiao, opcao.value)) meios.add(meio.value);
    }
    for (const extra of MEIOS_FORA_DO_CATALOGO[regiao]) meios.add(extra);
  } else {
    for (const forma of formasComMeio) {
      for (const meio of meiosPagamentoDaForma(regiao, forma)) meios.add(meio.value);
      if (regiao === "europa" && forma === "cartao") meios.add("SumUp");
    }
  }
  return [...meios].sort((a, b) => a.localeCompare(b, "pt"));
}

function opcoesMeio(regiao: RegiaoContasReceber, formas: string[]) {
  return [
    { value: MEIO_SEM_PAGAMENTO, label: "Sem meio" },
    ...meiosDaSelecao(regiao, formas).map((meio) => ({ value: meio, label: meio })),
  ];
}

function mesmoConjunto(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const outros = new Set(b);
  return a.every((valor) => outros.has(valor));
}

function hojeIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ResumoTotal({
  rotulo,
  valores,
  loading,
  destaque,
  alerta,
}: {
  rotulo: string;
  valores: Array<[string, number]>;
  loading: boolean;
  destaque?: boolean;
  alerta?: boolean;
}) {
  const comValor = valores.filter(([, v]) => Math.abs(v) >= 0.01);
  return (
    <div className="card px-3 py-2">
      <div className="text-[0.68rem] font-medium uppercase tracking-wider text-ink-soft">{rotulo}</div>
      <div
        className={cn(
          "mt-0.5 flex flex-wrap items-baseline gap-x-3 font-numeric text-base font-medium leading-tight tabular-nums",
          destaque ? "text-brand-800" : alerta && comValor.length > 0 ? "text-amber-800" : "text-ink",
        )}
      >
        {loading ? (
          <span className="skeleton inline-block h-5 w-24 rounded" />
        ) : comValor.length === 0 ? (
          "—"
        ) : (
          comValor.map(([moeda, valor]) => <span key={moeda}>{formatarMoeda(valor, moeda)}</span>)
        )}
      </div>
    </div>
  );
}

export default function ContasReceberPage() {
  const toast = useToast();
  const { regiao: regiaoParam } = useParams();
  const regiao: RegiaoContasReceber | null =
    regiaoParam === "brasil" || regiaoParam === "europa" ? regiaoParam : null;
  const [params] = useSearchParams();
  const buscaInicial = params.get("busca") ?? "";
  const situacaoPadrao: SituacaoFiltroValor[] = buscaInicial ? [] : ["aberto"];
  const [situacoes, setSituacoes] = useState<SituacaoFiltroValor[]>(situacaoPadrao);
  const [formas, setFormas] = useState<string[]>([]);
  const [meiosSelecionados, setMeiosSelecionados] = useState<string[]>([]);
  const [contaResumo, setContaResumo] = useState<ContaReceberDetalhada | null>(null);
  const [periodo, setPeriodo] = useState<{ de: string | null; ate: string | null }>({
    de: null,
    ate: null,
  });
  const [busca, setBusca] = useState(buscaInicial);
  const buscaDebounced = useDebounce(busca, 300);
  const [page, setPage] = useState(1);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [regiaoVista, setRegiaoVista] = useState(regiao);
  if (regiao !== regiaoVista) {
    setRegiaoVista(regiao);
    setFormas([]);
    setMeiosSelecionados([]);
    setPage(1);
    setSelecionadas(new Set());
  }
  const [modalBaixa, setModalBaixa] = useState(false);
  const [modalConciliar, setModalConciliar] = useState(false);
  const [processando, setProcessando] = useState(false);

  const filtro: FiltroContasReceber = {
    situacoes,
    regiao: regiao ?? undefined,
    formas,
    meios: meiosSelecionados,
    de: periodo.de,
    ate: periodo.ate,
    busca: buscaDebounced,
  };
  const chaveFiltro = JSON.stringify(filtro);

  const lista = useAsync(
    () =>
      regiao
        ? contasReceberService.listar(filtro, { page, pageSize: PAGE_SIZE })
        : Promise.resolve({ data: [] as ContaReceberDetalhada[], total: 0 }),
    [chaveFiltro, page, regiao],
  );
  const totais = useAsync<TotaisContasReceber>(
    () => (regiao ? contasReceberService.totais(filtro) : Promise.resolve({})),
    [chaveFiltro, regiao],
  );

  const recarregar = () => {
    setSelecionadas(new Set());
    lista.reload();
    totais.reload();
  };

  const linhas = lista.data?.data ?? [];
  const selecionadasLinhas = linhas.filter((c) => selecionadas.has(c.id));
  const abertasSelecionadas = selecionadasLinhas.filter((c) => contaContaComoEmAberto(c));
  const recebidasSelecionadas = selecionadasLinhas.filter(
    (c) => contaContaComoRecebida(c) && c.id_parcela_venda,
  );

  const alternar = (id: string) =>
    setSelecionadas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  const todasMarcadas = linhas.length > 0 && linhas.every((c) => selecionadas.has(c.id));
  const alternarTodas = () =>
    setSelecionadas(todasMarcadas ? new Set() : new Set(linhas.map((c) => c.id)));

  const mudarFiltro = <T,>(setter: (v: T) => void) => (valor: T) => {
    setter(valor);
    setPage(1);
    setSelecionadas(new Set());
  };

  const filtrosForaDoPadrao =
    !mesmoConjunto(situacoes, situacaoPadrao) ||
    formas.length > 0 ||
    meiosSelecionados.length > 0 ||
    Boolean(periodo.de || periodo.ate) ||
    busca !== buscaInicial;

  const limparFiltros = () => {
    setSituacoes(situacaoPadrao);
    setFormas([]);
    setMeiosSelecionados([]);
    setPeriodo({ de: null, ate: null });
    setBusca(buscaInicial);
    setPage(1);
    setSelecionadas(new Set());
  };

  const escolherFormas = (valores: string[]) => {
    setFormas(valores);
    const permitidos = new Set(meiosDaSelecao(regiao ?? "brasil", valores));
    setMeiosSelecionados((atual) =>
      atual.filter((meio) => meio === MEIO_SEM_PAGAMENTO || permitidos.has(meio)),
    );
    setPage(1);
    setSelecionadas(new Set());
  };

  const estornar = async () => {
    if (recebidasSelecionadas.length === 0) return;
    setProcessando(true);
    try {
      const total = await contasReceberService.estornarBaixa(recebidasSelecionadas.map((c) => c.id));
      toast.sucesso(total === 1 ? "Baixa estornada." : `${total} baixas estornadas.`);
      recarregar();
    } catch (err) {
      toast.erro(mensagemErro(err), "Não foi possível estornar");
    } finally {
      setProcessando(false);
    }
  };

  const totaisVazios: TotaisContasReceber = {};
  const totaisPorMoeda = Object.entries(totais.data ?? totaisVazios);

  const columns: Column<ContaReceberDetalhada>[] = [
    {
      key: "sel",
      header: (
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-line text-brand-600"
          checked={todasMarcadas}
          onChange={alternarTodas}
          aria-label="Selecionar todas desta página"
        />
      ),
      width: "40px",
      render: (c) => (
        <label
          className="-m-2 flex cursor-pointer p-2"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-line text-brand-600"
            checked={selecionadas.has(c.id)}
            onChange={() => alternar(c.id)}
            aria-label={`Selecionar ${c.documento ?? "conta"}`}
          />
        </label>
      ),
    },
    {
      key: "documento",
      header: "Documento",
      width: "120px",
      render: (c) => (
        <span className="font-numeric text-xs text-brand-700">{c.documento ?? "—"}</span>
      ),
    },
    {
      key: "cliente",
      header: "Cliente",
      render: (c) => (
        <span className="text-sm">{c.cliente?.nome ?? c.venda?.nome_cliente ?? "—"}</span>
      ),
    },
    {
      key: "vencimento",
      header: "Vencimento",
      width: "110px",
      render: (c) => (
        <span className="font-numeric text-xs">
          {formatarData(c.data_vencimento)}
          {c.id_recebivel_sumup ? (
            <span className="block text-[0.68rem] text-ink-faint" title="Data prevista do repasse pela SumUp">
              prevista SumUp
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: "pago_sumup",
      header: "Pago SumUp",
      width: "110px",
      render: (c) => (
        <span className="font-numeric text-xs" title="Data em que a SumUp pagou este repasse">
          {formatarData(c.data_pagamento_sumup)}
        </span>
      ),
    },
    {
      key: "pagamento",
      header: "Forma · meio",
      width: "190px",
      render: (c) => (
        <span className="text-xs text-ink-soft">
          {labelFormaPagamento(c.forma_pagamento)}
          {c.meio_pagamento ? ` · ${c.meio_pagamento}` : ""}
          {c.codigo_transacao ? (
            <span className="block font-numeric text-ink-faint">{c.codigo_transacao}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: "situacao",
      header: "Situação",
      width: "120px",
      render: (c) => (
        <div className="flex flex-col items-start gap-0.5">
          <SituacaoContaBadge conta={c} />
          {contaContaComoRecebida(c) ? (
            <span className="text-[0.68rem] text-ink-faint">
              {formatarData(c.data_recebimento)}
              {c.origem_baixa === "sumup" ? " · SumUp" : c.origem_baixa === "automatica" ? " · auto" : ""}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "valor",
      header: "Valor",
      width: "130px",
      headerClassName: "text-right",
      className: "text-right",
      render: (c) => (
        <span className="font-numeric tabular-nums">
          <span className="text-sm font-medium">{formatarMoeda(Number(c.valor), c.moeda)}</span>
          {c.taxa != null && Number(c.taxa) > 0 ? (
            <span className="block text-[0.68rem] text-ink-faint">
              taxa {formatarMoeda(Number(c.taxa), c.moeda)} · líq.{" "}
              {formatarMoeda(Number(c.valor_liquido ?? Number(c.valor) - Number(c.taxa)), c.moeda)}
            </span>
          ) : null}
        </span>
      ),
    },
  ];

  if (!regiao) {
    const consulta = params.toString();
    return (
      <Navigate to={`/financeiro/contas-receber/brasil${consulta ? `?${consulta}` : ""}`} replace />
    );
  }

  const opcoesDeForma = opcoesForma(regiao);
  const opcoesDeMeio = opcoesMeio(regiao, formas);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <PageHeader
        compacto
        title="Contas a receber"
        breadcrumbs={[
          { label: "Financeiro" },
          { label: "Contas a receber" },
          { label: traduzirEnum(regiao) },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={() => setModalConciliar(true)}>Sincronizar SumUp</SecondaryButton>
            <SecondaryButton onClick={recarregar} disabled={lista.loading}>
              Atualizar
            </SecondaryButton>
          </div>
        }
      />

      <div className="grid shrink-0 gap-2 sm:grid-cols-3">
        <ResumoTotal
          rotulo="Em aberto"
          valores={totaisPorMoeda.map(([m, t]) => [m, t.emAberto])}
          loading={totais.loading}
          destaque
        />
        <ResumoTotal
          rotulo="Vencido"
          valores={totaisPorMoeda.map(([m, t]) => [m, t.vencido])}
          loading={totais.loading}
          alerta
        />
        <ResumoTotal
          rotulo="Recebido"
          valores={totaisPorMoeda.map(([m, t]) => [m, t.recebido])}
          loading={totais.loading}
        />
      </div>

      <SectionCard
        noPadding
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <ScrollableListShell
          toolbar={
            <div className="border-b border-line px-5 py-2.5">
              <div className="grid min-w-0 items-end gap-x-3 gap-y-3 [grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))] lg:[grid-template-columns:minmax(0,1.35fr)_minmax(10rem,0.8fr)_minmax(10.5rem,0.85fr)_minmax(10rem,0.75fr)_minmax(11.5rem,0.85fr)_auto]">
                <SearchInput
                  value={busca}
                  onChange={(e) => mudarFiltro(setBusca)(e.target.value)}
                  placeholder="Buscar pedido, cliente ou código…"
                  wrapperClassName="min-w-0 w-full"
                  aria-label="Buscar conta"
                />
                <div className="flex min-w-0 w-full flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                    Situação
                  </span>
                  <StatusSelectDropdown
                    multiple
                    value={situacoes}
                    options={SITUACOES}
                    emptyLabel="Todas"
                    onChange={(v) => mudarFiltro(setSituacoes)(v as SituacaoFiltroValor[])}
                  />
                </div>
                <div className="flex min-w-0 w-full flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                    Forma
                  </span>
                  <StatusSelectDropdown
                    multiple
                    value={formas}
                    options={opcoesDeForma}
                    emptyLabel="Todas"
                    onChange={escolherFormas}
                  />
                </div>
                <div className="flex min-w-0 w-full flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                    Meio
                  </span>
                  <StatusSelectDropdown
                    multiple
                    value={meiosSelecionados}
                    options={opcoesDeMeio}
                    emptyLabel="Todos"
                    onChange={(v) => mudarFiltro(setMeiosSelecionados)(v)}
                  />
                </div>
                <div className="flex min-w-0 w-full flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                    Vencimento
                  </span>
                  <DateRangePicker
                    value={periodo}
                    onChange={(v) =>
                      mudarFiltro(setPeriodo)({ de: v.de ?? null, ate: v.ate ?? v.de ?? null })
                    }
                    placeholder="Qualquer data"
                    className="w-full"
                  />
                </div>
                <div className="flex items-center justify-end gap-3">
                  {filtrosForaDoPadrao ? (
                    <button
                      type="button"
                      className="text-sm font-medium text-brand-700 hover:text-brand-800"
                      onClick={limparFiltros}
                    >
                      Limpar
                    </button>
                  ) : null}
                  <span className="whitespace-nowrap text-xs tabular-nums text-ink-soft">
                    {lista.loading || lista.data == null
                      ? ""
                      : `${lista.data.total.toLocaleString("pt-BR")} ${lista.data.total === 1 ? "conta" : "contas"}`}
                  </span>
                </div>
              </div>
            </div>
          }
          banner={
            selecionadasLinhas.length > 0 ? (
              <div className="flex flex-wrap items-center gap-3 border-b border-line bg-brand-50/50 px-5 py-2 text-sm">
                <span className="text-ink">
                  {selecionadasLinhas.length === 1
                    ? "1 conta selecionada"
                    : `${selecionadasLinhas.length} contas selecionadas`}
                </span>
                {abertasSelecionadas.length > 0 ? (
                  <PrimaryButton onClick={() => setModalBaixa(true)} disabled={processando}>
                    Dar baixa ({abertasSelecionadas.length})
                  </PrimaryButton>
                ) : null}
                {recebidasSelecionadas.length > 0 ? (
                  <SecondaryButton onClick={estornar} disabled={processando}>
                    Estornar baixa ({recebidasSelecionadas.length})
                  </SecondaryButton>
                ) : null}
                <button
                  type="button"
                  className="text-xs text-ink-soft hover:text-ink"
                  onClick={() => setSelecionadas(new Set())}
                >
                  Limpar seleção
                </button>
              </div>
            ) : null
          }
          body={
            lista.error ? (
              <div className="p-5 text-sm text-red-700">{lista.error.message}</div>
            ) : (
              <DataTable
                columns={columns}
                rows={linhas}
                rowKey={(c) => c.id}
                loading={lista.loading}
                onRowClick={setContaResumo}
                emptyTitle="Nenhuma conta encontrada"
                emptyDescription="Ajuste os filtros. As contas nascem das parcelas das ordens de venda."
              />
            )
          }
          footer={
            !lista.error && !lista.loading ? (
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={lista.data?.total ?? 0}
                onPageChange={(p) => {
                  setPage(p);
                  setSelecionadas(new Set());
                }}
              />
            ) : null
          }
        />
      </SectionCard>

      {contaResumo ? (
        <ResumoVendaContaModal
          conta={contaResumo}
          onClose={() => setContaResumo(null)}
          onAlterado={recarregar}
        />
      ) : null}

      <BaixaModal
        open={modalBaixa}
        contas={abertasSelecionadas}
        onClose={() => setModalBaixa(false)}
        onConcluido={() => {
          setModalBaixa(false);
          recarregar();
        }}
      />

      <SincronizarSumupModal
        open={modalConciliar}
        onClose={() => setModalConciliar(false)}
        onConcluido={() => {
          setModalConciliar(false);
          recarregar();
        }}
      />
    </div>
  );
}

function BaixaModal({
  open,
  contas,
  onClose,
  onConcluido,
}: {
  open: boolean;
  contas: ContaReceberDetalhada[];
  onClose: () => void;
  onConcluido: () => void;
}) {
  const toast = useToast();
  const [modo, setModo] = useState<"vencimento" | "data">("vencimento");
  const [data, setData] = useState(hojeIso());
  const [salvando, setSalvando] = useState(false);

  const totalPorMoeda = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const c of contas) mapa.set(c.moeda, (mapa.get(c.moeda) ?? 0) + Number(c.valor));
    return [...mapa.entries()];
  }, [contas]);

  const confirmar = async () => {
    setSalvando(true);
    try {
      const total = await contasReceberService.baixar(
        contas.map((c) => c.id),
        modo === "data" ? data : null,
      );
      toast.sucesso(total === 1 ? "Baixa registrada." : `${total} baixas registradas.`);
      onConcluido();
    } catch (err) {
      toast.erro(mensagemErro(err), "Não foi possível dar baixa");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Dar baixa"
      description={`${contas.length} ${contas.length === 1 ? "conta" : "contas"} · ${totalPorMoeda
        .map(([m, v]) => formatarMoeda(v, m))
        .join(" + ")}`}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <PrimaryButton onClick={confirmar} loading={salvando}>
            Confirmar baixa
          </PrimaryButton>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="radio"
            className="mt-0.5"
            checked={modo === "vencimento"}
            onChange={() => setModo("vencimento")}
          />
          <span>
            Na data de vencimento de cada conta
            <span className="block text-xs text-ink-faint">
              Bom para repasses de cartão que já caíram.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2">
          <input type="radio" className="mt-0.5" checked={modo === "data"} onChange={() => setModo("data")} />
          <span className="flex-1">
            Em uma data
            <input
              type="date"
              className="input-base mt-1 block w-full"
              value={data}
              disabled={modo !== "data"}
              onChange={(e) => setData(e.target.value)}
            />
          </span>
        </label>
        <p className="text-xs text-ink-faint">O valor recebido será o valor de cada conta.</p>
      </div>
    </Modal>
  );
}

function SincronizarSumupModal({
  open,
  onClose,
  onConcluido,
}: {
  open: boolean;
  onClose: () => void;
  onConcluido: () => void;
}) {
  const toast = useToast();
  const [conta, setConta] = useState<ContaSumup>("pt");
  const [periodo, setPeriodo] = useState(() => ({ de: somarDiasIso(hojeIso(), -60), ate: hojeIso() }));
  const [sincronizando, setSincronizando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoSincronizacaoSumup | null>(null);
  const [sugestoes, setSugestoes] = useState<SugestaoVinculoSumup[] | null>(null);
  const [carregandoSugestoes, setCarregandoSugestoes] = useState(false);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [vinculando, setVinculando] = useState(false);
  const [alterou, setAlterou] = useState(false);

  const chaveSugestao = (s: SugestaoVinculoSumup) => `${s.id_transacao}|${s.id_venda}`;

  const carregarSugestoes = async () => {
    setCarregandoSugestoes(true);
    try {
      const lista = await listarSugestoesVinculoSumup(conta, periodo.de, periodo.ate);
      setSugestoes(lista);
      setMarcadas(new Set());
    } catch (err) {
      toast.erro(mensagemErro(err), "Não foi possível buscar sugestões");
    } finally {
      setCarregandoSugestoes(false);
    }
  };

  const sincronizar = async () => {
    setSincronizando(true);
    setResultado(null);
    try {
      const r = await sincronizarSumup(conta, periodo.de, periodo.ate);
      setResultado(r);
      setAlterou(true);
      await carregarSugestoes();
    } catch (err) {
      toast.erro(mensagemErro(err), "Não foi possível sincronizar a SumUp");
    } finally {
      setSincronizando(false);
    }
  };

  const escolhidas = (sugestoes ?? []).filter((s) => marcadas.has(chaveSugestao(s)));
  const transacaoRepetida = (() => {
    const vistas = new Set<string>();
    for (const s of escolhidas) {
      if (vistas.has(s.id_transacao)) return true;
      vistas.add(s.id_transacao);
    }
    return false;
  })();

  const vincular = async () => {
    setVinculando(true);
    let feitas = 0;
    try {
      for (const s of escolhidas) {
        await vincularTransacaoSumup(s.id_transacao, s.id_venda);
        feitas += 1;
      }
      toast.sucesso(feitas === 1 ? "1 pedido vinculado à SumUp." : `${feitas} pedidos vinculados à SumUp.`);
      setAlterou(true);
      await carregarSugestoes();
    } catch (err) {
      toast.erro(mensagemErro(err), `Parou depois de ${feitas} vínculo(s)`);
    } finally {
      setVinculando(false);
    }
  };

  const fechar = () => {
    setResultado(null);
    setSugestoes(null);
    if (alterou) {
      setAlterou(false);
      onConcluido();
    } else {
      onClose();
    }
  };

  const alternar = (chave: string) =>
    setMarcadas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(chave)) proximo.delete(chave);
      else proximo.add(chave);
      return proximo;
    });

  const c = resultado?.conciliacao;

  return (
    <Modal
      open={open}
      onClose={fechar}
      title="Sincronizar SumUp"
      description="Traz as transações e os recebíveis da SumUp. A conta só fica recebida quando a SumUp informa o repasse como pago, com a data e o valor líquido dela."
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={fechar}>Fechar</SecondaryButton>
          {sugestoes && sugestoes.length > 0 ? (
            <PrimaryButton
              onClick={vincular}
              loading={vinculando}
              disabled={escolhidas.length === 0 || transacaoRepetida}
            >
              Vincular ({escolhidas.length})
            </PrimaryButton>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <select
            className="input-base h-10 w-44"
            value={conta}
            onChange={(e) => {
              setConta(e.target.value as ContaSumup);
              setResultado(null);
              setSugestoes(null);
            }}
            aria-label="Conta SumUp"
          >
            {CONTAS_SUMUP.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </select>
          <DateRangePicker
            value={periodo}
            onChange={(v) => setPeriodo({ de: v.de ?? periodo.de, ate: v.ate ?? v.de ?? periodo.ate })}
            placeholder="Período das vendas"
            className="w-64 max-w-full"
          />
          <PrimaryButton onClick={sincronizar} loading={sincronizando}>
            Sincronizar
          </PrimaryButton>
          <button
            type="button"
            className="h-10 text-xs text-ink-soft hover:text-ink disabled:opacity-50"
            onClick={carregarSugestoes}
            disabled={carregandoSugestoes || sincronizando}
          >
            Só ver sugestões
          </button>
        </div>

        {resultado ? (
          <div className="rounded-lg border border-line bg-brand-50/40 px-4 py-3 text-sm">
            <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              <span>
                <strong className="font-numeric">{resultado.transacoes ?? 0}</strong> transações lidas
              </span>
              <span>
                <strong className="font-numeric">{resultado.recebiveis ?? 0}</strong> recebíveis atualizados
              </span>
              <span>
                <strong className="font-numeric">{c?.baixadas ?? 0}</strong> contas baixadas (repasse pago)
              </span>
              <span>
                <strong className="font-numeric">{c?.atualizadas ?? 0}</strong> contas com data/taxa ajustadas
              </span>
              {c?.divergentes ? (
                <span className="text-amber-800">
                  <strong className="font-numeric">{c.divergentes}</strong> contas marcadas como divergentes
                </span>
              ) : null}
            </div>
            {resultado.restantes ? (
              <p className="mt-2 text-xs text-amber-800">
                Ainda faltam {resultado.restantes} transações para detalhar. Clique em Sincronizar de novo.
              </p>
            ) : null}
            {resultado.truncado ? (
              <p className="mt-2 text-xs text-amber-800">
                O período tem transações demais; encurte as datas para trazer tudo.
              </p>
            ) : null}
            {resultado.falhas && resultado.falhas.length > 0 ? (
              <p className="mt-2 text-xs text-red-700">Falhas: {resultado.falhas.join("; ")}</p>
            ) : null}
          </div>
        ) : null}

        {carregandoSugestoes ? (
          <p className="text-sm text-ink-soft">Buscando sugestões…</p>
        ) : sugestoes ? (
          sugestoes.length === 0 ? (
            <p className="text-sm text-ink-soft">
              Nenhuma transação sem pedido que case com parcelas SumUp sem código no período.
            </p>
          ) : (
            <div>
              <div className="mb-1 text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">
                Sugestões de vínculo ({sugestoes.length})
              </div>
              <p className="mb-2 text-xs text-ink-faint">
                Transações da SumUp sem pedido, com o mesmo total e data próxima de um pedido cujas
                parcelas SumUp não têm código. Ao vincular, o código é gravado nas parcelas e os
                recebíveis passam a valer para elas.
              </p>
              {transacaoRepetida ? (
                <p className="mb-2 text-xs text-red-700">
                  A mesma transação foi marcada para mais de um pedido. Deixe só um.
                </p>
              ) : null}
              <ul className="divide-y divide-line rounded-lg border border-line">
                {sugestoes.map((s) => (
                  <li key={chaveSugestao(s)} className="flex items-start gap-2 px-3 py-2 text-xs">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-line text-brand-600"
                      checked={marcadas.has(chaveSugestao(s))}
                      onChange={() => alternar(chaveSugestao(s))}
                      aria-label={`Vincular ${s.codigo} ao pedido ${s.numero ?? ""}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="font-medium text-ink">
                          Pedido {s.numero ?? "—"} · {s.cliente ?? "—"}
                        </span>
                        <span className="font-numeric">{formatarMoeda(Number(s.valor), s.moeda)}</span>
                      </div>
                      <div className="text-ink-soft">
                        SumUp {s.codigo} de {formatarDataHoraPortugal(s.data)}
                        {s.parcelas_sumup && s.parcelas_sumup > 1 ? ` · ${s.parcelas_sumup}x` : ""} · pedido
                        de {formatarData(s.data_pedido)} com {s.parcelas_pedido}{" "}
                        {s.parcelas_pedido === 1 ? "parcela" : "parcelas"}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )
        ) : null}
      </div>
    </Modal>
  );
}

