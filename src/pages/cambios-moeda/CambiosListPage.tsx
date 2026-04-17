import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { DataTable, type Column } from "../../components/DataTable";
import { FormInput } from "../../components/FormField";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { PrimaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { IconPlus, IconRefresh, IconSwap, IconTrash } from "../../components/Icons";
import { cambiosMoedaService } from "../../services/cambios-moeda";
import { cotacaoApi, type CotacaoAtual } from "../../services/cotacao-api";
import { useAsync } from "../../hooks/useAsync";
import { formatarData, formatarDataHora, formatarMoeda } from "../../utils/format";
import type { CambioMoeda, CambioMoedaInsert } from "../../types/entities";
import { cn } from "../../utils/cn";

const MOEDAS_CONVERSOR = ["USD", "EUR", "BRL", "CNY"] as const;
type MoedaConversor = (typeof MOEDAS_CONVERSOR)[number];

interface ParMonitorado {
  origem: string;
  destino: string;
  destaque?: boolean;
}

const PARES_PAINEL: ParMonitorado[] = [
  { origem: "USD", destino: "BRL", destaque: true },
  { origem: "EUR", destino: "BRL", destaque: true },
  { origem: "EUR", destino: "USD", destaque: true },
  { origem: "CNY", destino: "BRL" },
  { origem: "USD", destino: "EUR" },
  { origem: "GBP", destino: "BRL" },
];

const parKey = (origem: string, destino: string) =>
  `${origem.toUpperCase()}-${destino.toUpperCase()}`;

function formatarCotacao(valor: number, destino: string): string {
  const digits = destino === "BRL" ? 4 : 4;
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(valor);
}

function formatarPercentual(valor: number): string {
  const sinal = valor > 0 ? "+" : "";
  return `${sinal}${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor)}%`;
}

function tempoRelativo(data: Date | null): string {
  if (!data) return "—";
  const diff = (Date.now() - data.getTime()) / 1000;
  if (diff < 60) return "agora mesmo";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  return formatarDataHora(data.toISOString());
}

export default function CambiosListPage() {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(
    () => cambiosMoedaService.listar({ page, pageSize: 20 }),
    [page],
  );

  // Cotações ao vivo --------------------------------------------------------
  const [cotacoes, setCotacoes] = useState<Record<string, CotacaoAtual>>({});
  const [erroCotacoes, setErroCotacoes] = useState<string | null>(null);
  const [buscandoCotacoes, setBuscandoCotacoes] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const [registrandoPar, setRegistrandoPar] = useState<string | null>(null);

  const carregarCotacoes = useCallback(async () => {
    setBuscandoCotacoes(true);
    setErroCotacoes(null);
    try {
      const resultados = await cotacaoApi.buscarVariosPares(
        PARES_PAINEL.map((p) => ({ origem: p.origem, destino: p.destino })),
      );
      const mapa: Record<string, CotacaoAtual> = {};
      for (const r of resultados) {
        mapa[parKey(r.moedaOrigem, r.moedaDestino)] = r;
      }
      setCotacoes(mapa);
      setUltimaAtualizacao(new Date());
      if (resultados.length === 0) {
        setErroCotacoes(
          "Não foi possível obter nenhuma cotação. Verifique sua conexão.",
        );
      }
    } catch (e) {
      setErroCotacoes(
        e instanceof Error ? e.message : "Falha ao buscar cotações.",
      );
    } finally {
      setBuscandoCotacoes(false);
    }
  }, []);

  useEffect(() => {
    void carregarCotacoes();
  }, [carregarCotacoes]);

  const registrarDoPainel = async (par: ParMonitorado) => {
    const chave = parKey(par.origem, par.destino);
    const cotacao = cotacoes[chave];
    if (!cotacao) return;

    setRegistrandoPar(chave);
    try {
      const payload: CambioMoedaInsert = {
        moeda_origem: cotacao.moedaOrigem,
        moeda_destino: cotacao.moedaDestino,
        data_cotacao: cotacao.dataCotacao,
        valor_cotacao: cotacao.valor,
        fonte: cotacao.fonte,
      };
      await cambiosMoedaService.criar(payload);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao registrar cotação.");
    } finally {
      setRegistrandoPar(null);
    }
  };

  // Conversor ---------------------------------------------------------------
  const [conversorValor, setConversorValor] = useState("100");
  const [conversorDe, setConversorDe] = useState<MoedaConversor>("USD");
  const [conversorPara, setConversorPara] = useState<MoedaConversor>("BRL");

  const taxaConversor = useMemo<number | null>(() => {
    if (conversorDe === conversorPara) return 1;
    const direto = cotacoes[parKey(conversorDe, conversorPara)];
    if (direto) return direto.valor;
    const inverso = cotacoes[parKey(conversorPara, conversorDe)];
    if (inverso && inverso.valor > 0) return 1 / inverso.valor;
    // Triangulação via USD
    if (conversorDe !== "USD" && conversorPara !== "USD") {
      const deParaUsd = cotacoes[parKey(conversorDe, "USD")];
      const usdParaDestino = cotacoes[parKey("USD", conversorPara)];
      if (deParaUsd && usdParaDestino) {
        return deParaUsd.valor * usdParaDestino.valor;
      }
      const usdParaOrigem = cotacoes[parKey("USD", conversorDe)];
      const destinoParaUsd = cotacoes[parKey(conversorPara, "USD")];
      if (usdParaOrigem && destinoParaUsd && usdParaOrigem.valor > 0 && destinoParaUsd.valor > 0) {
        return (1 / usdParaOrigem.valor) * (1 / destinoParaUsd.valor);
      }
    }
    return null;
  }, [cotacoes, conversorDe, conversorPara]);

  const valorConvertido = useMemo(() => {
    const n = Number(conversorValor.replace(",", "."));
    if (!Number.isFinite(n) || taxaConversor === null) return null;
    return n * taxaConversor;
  }, [conversorValor, taxaConversor]);

  const inverterConversor = () => {
    setConversorDe(conversorPara);
    setConversorPara(conversorDe);
  };

  // Registro manual ---------------------------------------------------------
  const [moedaOrigem, setMoedaOrigem] = useState("");
  const [moedaDestino, setMoedaDestino] = useState("");
  const [dataCotacao, setDataCotacao] = useState("");
  const [valorCotacao, setValorCotacao] = useState("");
  const [fonte, setFonte] = useState("");
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [buscandoManual, setBuscandoManual] = useState(false);

  const buscarCotacaoManual = async () => {
    if (!moedaOrigem || !moedaDestino) {
      setErroForm("Informe as moedas antes de buscar.");
      return;
    }
    setErroForm(null);
    setBuscandoManual(true);
    try {
      const c = await cotacaoApi.buscarCotacaoAtual(moedaOrigem, moedaDestino);
      setMoedaOrigem(c.moedaOrigem);
      setMoedaDestino(c.moedaDestino);
      setDataCotacao(c.dataCotacao);
      setValorCotacao(String(c.valor));
      setFonte(c.fonte);
    } catch (e) {
      setErroForm(e instanceof Error ? e.message : "Falha ao buscar cotação.");
    } finally {
      setBuscandoManual(false);
    }
  };

  const handleCriar = async (e: FormEvent) => {
    e.preventDefault();
    setErroForm(null);
    setSalvando(true);
    try {
      const payload: CambioMoedaInsert = {
        moeda_origem: moedaOrigem.toUpperCase().trim(),
        moeda_destino: moedaDestino.toUpperCase().trim(),
        data_cotacao: dataCotacao,
        valor_cotacao: Number(valorCotacao.replace(",", ".")),
        fonte: fonte.trim() || null,
      };
      await cambiosMoedaService.criar(payload);
      setMoedaOrigem("");
      setMoedaDestino("");
      setDataCotacao("");
      setValorCotacao("");
      setFonte("");
      reload();
    } catch (e) {
      setErroForm(e instanceof Error ? e.message : "Falha ao criar.");
    } finally {
      setSalvando(false);
    }
  };

  const handleDelete = async (c: CambioMoeda) => {
    if (!window.confirm(`Excluir esta cotação (${c.moeda_origem}→${c.moeda_destino})?`)) return;
    try {
      await cambiosMoedaService.deletar(c.id);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao excluir.");
    }
  };

  const columns: Column<CambioMoeda>[] = [
    { key: "data", header: "Data", width: "140px", render: (c) => formatarData(c.data_cotacao) },
    {
      key: "par",
      header: "Par",
      width: "160px",
      render: (c) => (
        <span className="font-numeric tabular-nums text-sm font-medium">
          {c.moeda_origem} → {c.moeda_destino}
        </span>
      ),
    },
    {
      key: "valor",
      header: "Cotação",
      className: "text-right font-numeric tabular-nums",
      render: (c) =>
        Number(c.valor_cotacao).toLocaleString("pt-BR", {
          maximumFractionDigits: 6,
        }),
    },
    {
      key: "fonte",
      header: "Fonte",
      render: (c) => <span className="text-ink-soft">{c.fonte ?? "—"}</span>,
    },
    {
      key: "acoes",
      header: <span className="sr-only">Ações</span>,
      width: "80px",
      className: "text-right",
      render: (c) => (
        <button
          className="btn-ghost h-8 w-8 p-0 hover:!text-red-600"
          onClick={() => handleDelete(c)}
          title="Excluir"
        >
          <IconTrash width={16} height={16} />
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Câmbio de moeda"
        description="Painel consultivo em tempo real (AwesomeAPI) e histórico de cotações utilizadas na precificação."
        breadcrumbs={[{ label: "Operação" }, { label: "Câmbio de moeda" }]}
        actions={
          <button
            type="button"
            onClick={() => void carregarCotacoes()}
            disabled={buscandoCotacoes}
            className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink-muted transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IconRefresh
              width={16}
              height={16}
              className={buscandoCotacoes ? "animate-spin" : undefined}
            />
            {buscandoCotacoes ? "Atualizando…" : "Atualizar cotações"}
          </button>
        }
      />

      {/* Painel de cotações ao vivo ------------------------------------- */}
      <SectionCard
        title="Cotações ao vivo"
        description={
          ultimaAtualizacao
            ? `Atualizado ${tempoRelativo(ultimaAtualizacao)} · fonte: AwesomeAPI`
            : "Buscando cotações…"
        }
      >
        {erroCotacoes ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {erroCotacoes}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PARES_PAINEL.map((par) => {
            const chave = parKey(par.origem, par.destino);
            const cotacao = cotacoes[chave];
            const subindo = cotacao ? cotacao.variacaoPercentual > 0 : false;
            const descendo = cotacao ? cotacao.variacaoPercentual < 0 : false;
            const registrando = registrandoPar === chave;

            return (
              <div
                key={chave}
                className={cn(
                  "card p-5 transition",
                  par.destaque && "ring-1 ring-brand-100",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
                      {par.origem} → {par.destino}
                    </div>
                    <div className="mt-2 font-numeric text-3xl font-medium tabular-nums tracking-tight text-brand-800">
                      {buscandoCotacoes && !cotacao ? (
                        <span className="skeleton inline-block h-8 w-28 rounded" />
                      ) : cotacao ? (
                        formatarCotacao(cotacao.valor, par.destino)
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </div>
                  </div>

                  {cotacao ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold font-numeric tabular-nums",
                        subindo && "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
                        descendo && "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
                        !subindo && !descendo &&
                          "bg-surface-subtle text-ink-soft ring-1 ring-inset ring-line",
                      )}
                    >
                      {subindo ? "▲" : descendo ? "▼" : "■"}{" "}
                      {formatarPercentual(cotacao.variacaoPercentual)}
                    </span>
                  ) : null}
                </div>

                {cotacao ? (
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3 text-xs">
                    <div>
                      <div className="text-ink-faint">Máx.</div>
                      <div className="font-numeric font-medium tabular-nums text-ink">
                        {formatarCotacao(cotacao.high, par.destino)}
                      </div>
                    </div>
                    <div>
                      <div className="text-ink-faint">Mín.</div>
                      <div className="font-numeric font-medium tabular-nums text-ink">
                        {formatarCotacao(cotacao.low, par.destino)}
                      </div>
                    </div>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => void registrarDoPainel(par)}
                  disabled={!cotacao || registrando}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <IconPlus width={16} height={16} />
                  {registrando ? "Registrando…" : "Registrar no histórico"}
                </button>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Conversor + Registro manual ----------------------------------- */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <SectionCard
          title="Conversor"
          description="Use os valores ao vivo para converter entre moedas."
          className="lg:col-span-2"
        >
          <div className="space-y-4">
            <FormInput
              label="Valor"
              inputMode="decimal"
              value={conversorValor}
              onChange={(e) => setConversorValor(e.target.value)}
              placeholder="100"
            />

            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <SeletorMoeda
                label="De"
                value={conversorDe}
                onChange={setConversorDe}
              />
              <button
                type="button"
                onClick={inverterConversor}
                className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface text-ink-muted transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                title="Inverter moedas"
                aria-label="Inverter moedas"
              >
                <IconSwap width={18} height={18} />
              </button>
              <SeletorMoeda
                label="Para"
                value={conversorPara}
                onChange={setConversorPara}
              />
            </div>

            <div className="rounded-xl bg-gradient-to-br from-brand-50 to-accent-50 p-5 ring-1 ring-inset ring-brand-100">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
                Resultado
              </div>
              <div className="mt-1 font-numeric text-3xl font-medium tabular-nums tracking-tight text-brand-800">
                {valorConvertido === null ? (
                  <span className="text-ink-faint">—</span>
                ) : (
                  formatarMoeda(valorConvertido, conversorPara)
                )}
              </div>
              {taxaConversor !== null && conversorDe !== conversorPara ? (
                <div className="mt-2 text-xs text-ink-soft">
                  1 {conversorDe} ={" "}
                  <span className="font-numeric font-medium tabular-nums">
                    {formatarCotacao(taxaConversor, conversorPara)}
                  </span>{" "}
                  {conversorPara}
                </div>
              ) : (
                <div className="mt-2 text-xs text-ink-soft">
                  Cotação indisponível para este par.
                </div>
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Registrar outra cotação"
          description="Para pares fora do painel ou valores manuais."
          className="lg:col-span-3"
        >
          <form onSubmit={handleCriar} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormInput
                label="Moeda origem"
                required
                maxLength={3}
                value={moedaOrigem}
                onChange={(e) => setMoedaOrigem(e.target.value.toUpperCase())}
                placeholder="USD"
              />
              <FormInput
                label="Moeda destino"
                required
                maxLength={3}
                value={moedaDestino}
                onChange={(e) => setMoedaDestino(e.target.value.toUpperCase())}
                placeholder="BRL"
              />
            </div>

            <button
              type="button"
              onClick={() => void buscarCotacaoManual()}
              disabled={buscandoManual || salvando || !moedaOrigem || !moedaDestino}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-accent-200 bg-accent-50 px-3 py-2 text-sm font-medium text-accent-700 transition hover:border-accent-300 hover:bg-accent-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IconRefresh
                width={16}
                height={16}
                className={buscandoManual ? "animate-spin" : undefined}
              />
              {buscandoManual ? "Buscando…" : "Buscar cotação atual"}
            </button>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormInput
                label="Data da cotação"
                type="date"
                required
                value={dataCotacao}
                onChange={(e) => setDataCotacao(e.target.value)}
              />
              <FormInput
                label="Valor"
                required
                inputMode="decimal"
                value={valorCotacao}
                onChange={(e) => setValorCotacao(e.target.value)}
                placeholder="5.4321"
              />
            </div>

            <FormInput
              label="Fonte"
              value={fonte}
              onChange={(e) => setFonte(e.target.value)}
              placeholder="AwesomeAPI, BCB, Wise, manual…"
            />

            {erroForm ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {erroForm}
              </div>
            ) : null}

            <PrimaryButton
              type="submit"
              className="w-full"
              icon={<IconPlus width={16} height={16} />}
              loading={salvando}
            >
              Adicionar cotação
            </PrimaryButton>
          </form>
        </SectionCard>
      </div>

      {/* Histórico ------------------------------------------------------ */}
      <div className="mt-6">
        <SectionCard title="Histórico de cotações" noPadding>
          {error ? (
            <div className="p-5 text-sm text-red-700">Erro: {error.message}</div>
          ) : (
            <DataTable
              columns={columns}
              rows={data?.data ?? []}
              rowKey={(c) => c.id}
              loading={loading}
              emptyTitle="Nenhuma cotação registrada"
              emptyDescription="Registre uma cotação do painel acima ou pelo formulário manual."
            />
          )}
          {data ? (
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onPageChange={setPage}
            />
          ) : null}
        </SectionCard>
      </div>
    </div>
  );
}

interface SeletorMoedaProps {
  label: string;
  value: MoedaConversor;
  onChange: (v: MoedaConversor) => void;
}

function SeletorMoeda({ label, value, onChange }: SeletorMoedaProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-ink-soft">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as MoedaConversor)}
        className="h-10 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
      >
        {MOEDAS_CONVERSOR.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </label>
  );
}
