import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { DataTable, type Column } from "../../components/DataTable";
import { EntityLink } from "../../components/EntityLink";
import { DateRangePicker, paraIsoData } from "../../components/DateRangePicker";
import { SumupVendaModal } from "../../components/sumup/SumupVendaModal";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { ScrollableListShell } from "../../components/ScrollableListShell";
import { SearchInput } from "../../components/SearchInput";
import { SectionCard } from "../../components/SectionCard";
import { StatCard } from "../../components/StatCard";
import { StatusBadge } from "../../components/StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import {
  listarVendasSumup,
  type ContaSumup,
  type VendaSumup,
} from "../../services/sumup";
import { vendasService } from "../../services/vendas";
import {
  dataCalendarioPortugal,
  formatarDataHoraPortugal,
  formatarEuro,
} from "../../utils/fusoPortugal";
import {
  FILTROS_STATUS_SUMUP,
  rotuloPagamentoSumup,
  rotuloParcelasSumup,
  rotuloStatusSumup,
  tomStatusSumup,
} from "../../utils/sumupRotulos";

const PAGE_SIZE = 25;

function periodoMesAtual(): { de: string; ate: string } {
  const { ano, mes, dia } = dataCalendarioPortugal();
  return { de: paraIsoData(ano, mes - 1, 1), ate: paraIsoData(ano, mes - 1, dia) };
}

function dataIso(valor: string | null): string | null {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  return valor;
}

function periodoDaUrl(params: URLSearchParams): { de: string; ate: string; busca: string } {
  const padrao = periodoMesAtual();
  const de = dataIso(params.get("de"));
  const ate = dataIso(params.get("ate"));
  return {
    de: de && ate ? de : padrao.de,
    ate: de && ate ? ate : padrao.ate,
    busca: (params.get("codigo") ?? "").trim(),
  };
}

function somarPorMoeda(itens: VendaSumup[], pegar: (venda: VendaSumup) => number) {
  const mapa = new Map<string, number>();
  for (const venda of itens) {
    const valor = pegar(venda);
    if (!valor) continue;
    mapa.set(venda.moeda, (mapa.get(venda.moeda) ?? 0) + valor);
  }
  return [...mapa.entries()];
}

function TextoMoedas({ pares }: { pares: [string, number][] }) {
  if (pares.length === 0) return <>—</>;
  return (
    <span>
      {pares.map(([moeda, valor]) => formatarEuro(valor, moeda)).join(" · ")}
    </span>
  );
}

export default function SumupVendasPage() {
  const { regiao } = useParams<{ regiao: string }>();
  const regiaoValida = regiao === "portugal" || regiao === "brasil";
  const conta: ContaSumup = regiao === "brasil" ? "br" : "pt";
  const nomeRegiao = conta === "pt" ? "Portugal" : "Brasil";
  const [params] = useSearchParams();
  const inicio = useRef(periodoDaUrl(params)).current;
  const codigoInicial = inicio.busca.toUpperCase();
  const jaAbriu = useRef(false);
  const [dataDe, setDataDe] = useState(inicio.de);
  const [dataAte, setDataAte] = useState(inicio.ate);
  const [status, setStatus] = useState("");
  const [busca, setBusca] = useState(inicio.busca);
  const [page, setPage] = useState(1);
  const [selecionada, setSelecionada] = useState<VendaSumup | null>(null);
  const buscaDebounced = useDebounce(busca, 300);

  const { data, loading, error, reload } = useAsync(
    () => listarVendasSumup({ conta, de: dataDe, ate: dataAte, status: status || undefined }),
    [conta, dataDe, dataAte, status],
  );

  useEffect(() => {
    setPage(1);
    setSelecionada(null);
  }, [conta]);

  useEffect(() => {
    if (jaAbriu.current || !codigoInicial || !data?.itens) return;
    const achada = data.itens.find((venda) => venda.codigo?.toUpperCase() === codigoInicial);
    if (!achada) return;
    jaAbriu.current = true;
    setSelecionada(achada);
  }, [data, codigoInicial]);

  const codigosSumup = useMemo(
    () => (data?.itens ?? []).map((venda) => venda.codigo).filter((codigo): codigo is string => Boolean(codigo)),
    [data],
  );
  const ordens = useAsync(
    () => vendasService.listarPorCodigosSumup(codigosSumup),
    [codigosSumup.join("|")],
  );
  const ordemPorCodigo = useMemo(() => {
    const mapa = new Map<string, { id: string; numero: string | null }>();
    for (const ordem of ordens.data ?? []) {
      for (const parte of (ordem.codigo_venda_adquirente ?? "").split(/[^A-Za-z0-9]+/)) {
        const chave = parte.trim().toUpperCase();
        if (chave.length >= 4) mapa.set(chave, { id: ordem.id, numero: ordem.numero });
      }
    }
    return mapa;
  }, [ordens.data]);

  const filtradas = useMemo(() => {
    const itens = data?.itens ?? [];
    const termo = buscaDebounced.trim().toLowerCase();
    if (!termo) return itens;
    return itens.filter((venda) =>
      [venda.codigo, venda.descricao, venda.usuario, rotuloPagamentoSumup(venda), venda.cartao]
        .some((campo) => campo?.toLowerCase().includes(termo)),
    );
  }, [data, buscaDebounced]);

  const pageSegura = Math.min(page, Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE)));
  const paginaAtual = filtradas.slice((pageSegura - 1) * PAGE_SIZE, pageSegura * PAGE_SIZE);
  const aprovadas = useMemo(
    () =>
      somarPorMoeda(
        filtradas.filter((venda) => venda.status === "SUCCESSFUL" && venda.tipo !== "REFUND"),
        (venda) => venda.valor,
      ),
    [filtradas],
  );
  const estornos = useMemo(
    () =>
      somarPorMoeda(filtradas, (venda) => {
        if (venda.tipo === "REFUND") return venda.valor;
        return venda.valorEstornado ?? 0;
      }),
    [filtradas],
  );

  const ordemSelecionada = selecionada?.codigo
    ? ordemPorCodigo.get(selecionada.codigo.toUpperCase())
    : undefined;

  const columns: Column<VendaSumup>[] = [
    {
      key: "data",
      header: "Data",
      width: "150px",
      render: (venda) => <span className="text-xs">{formatarDataHoraPortugal(venda.data)}</span>,
    },
    {
      key: "codigo",
      header: "Código",
      width: "130px",
      render: (venda) => (
        <span className="font-numeric tabular-nums text-xs">{venda.codigo ?? "—"}</span>
      ),
    },
    {
      key: "ordem",
      header: "Ordem",
      width: "110px",
      render: (venda) => {
        const ordem = venda.codigo ? ordemPorCodigo.get(venda.codigo.toUpperCase()) : undefined;
        if (!ordem) return <span className="text-ink-faint">—</span>;
        return (
          <span onClick={(evento) => evento.stopPropagation()}>
            <EntityLink
              to={`/vendas/${ordem.id}`}
              appearance="plain"
              className="font-numeric tabular-nums text-xs"
            >
              {ordem.numero ?? "Pedido"}
            </EntityLink>
          </span>
        );
      },
    },
    {
      key: "descricao",
      header: "Descrição",
      render: (venda) => <span className="text-ink-soft">{venda.descricao ?? "—"}</span>,
    },
    {
      key: "pagamento",
      header: "Pagamento",
      width: "180px",
      render: (venda) => <span className="text-xs">{rotuloPagamentoSumup(venda)}</span>,
    },
    {
      key: "parcelas",
      header: "Parcelas",
      width: "90px",
      render: (venda) => <span className="text-xs">{rotuloParcelasSumup(venda.parcelas)}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "130px",
      render: (venda) => (
        <StatusBadge
          value={venda.status}
          label={rotuloStatusSumup(venda.status)}
          tom={tomStatusSumup(venda.status)}
        />
      ),
    },
    {
      key: "valor",
      header: "Valor",
      width: "120px",
      headerClassName: "text-right",
      className: "text-right",
      render: (venda) => (
        <span className="font-numeric tabular-nums text-sm font-medium">
          {formatarEuro(venda.valor, venda.moeda)}
        </span>
      ),
    },
  ];

  if (!regiaoValida) return <Navigate to="/financeiro/sumup/portugal" replace />;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <PageHeader
        compacto
        title="Transações SumUp"
        breadcrumbs={[
          { label: "Financeiro", to: "/financeiro/contas-receber/brasil" },
          { label: "Transações SumUp" },
          { label: nomeRegiao },
        ]}
        actions={
          <button type="button" className="btn-secondary" onClick={reload} disabled={loading}>
            Atualizar
          </button>
        }
      />

      <div className="grid shrink-0 gap-2 sm:grid-cols-3">
        <StatCard
          compact
          label="Transações"
          value={error ? "—" : filtradas.length}
          loading={loading}
        />
        <StatCard
          compact
          label="Aprovadas"
          value={error ? "—" : <TextoMoedas pares={aprovadas} />}
          loading={loading}
          tone="accent"
        />
        <StatCard
          compact
          label="Estornos"
          value={error ? "—" : <TextoMoedas pares={estornos} />}
          loading={loading}
          tone="neutral"
        />
      </div>

      <SectionCard
        noPadding
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <ScrollableListShell
          toolbar={
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
              <DateRangePicker
                value={{ de: dataDe, ate: dataAte }}
                onChange={({ de, ate }) => {
                  if (!de && !ate) {
                    const novamente = periodoMesAtual();
                    setDataDe(novamente.de);
                    setDataAte(novamente.ate);
                  } else {
                    setDataDe(de ?? dataDe);
                    setDataAte(ate ?? de ?? dataAte);
                  }
                  setPage(1);
                }}
                placeholder="Período"
                className="w-72 max-w-full shrink-0"
              />
              <select
                className="input-base h-10 w-44 max-w-full shrink-0"
                value={status}
                onChange={(evento) => {
                  setStatus(evento.target.value);
                  setPage(1);
                }}
                aria-label="Status da venda"
              >
                {FILTROS_STATUS_SUMUP.map((opcao) => (
                  <option key={opcao.value || "todos"} value={opcao.value}>
                    {opcao.label}
                  </option>
                ))}
              </select>
              <SearchInput
                value={busca}
                onChange={(evento) => {
                  setBusca(evento.target.value);
                  setPage(1);
                }}
                placeholder="Código, descrição ou cartão"
                wrapperClassName="w-64 max-w-full"
                aria-label="Buscar venda"
              />
            </div>
          }
          banner={
            data?.truncado ? (
              <div className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-900">
                O período tem vendas demais para uma única consulta. Os totais mostram só o que foi
                carregado. Encurte as datas para ver o restante.
              </div>
            ) : null
          }
          body={
            error ? (
              <div className="p-5 text-sm text-red-700">{error.message}</div>
            ) : (
              <DataTable
                columns={columns}
                rows={paginaAtual}
                rowKey={(venda) => venda.id}
                loading={loading}
                onRowClick={setSelecionada}
                emptyTitle={`Nenhuma transação da SumUp ${nomeRegiao} no período`}
                emptyDescription="Não há transações entre as datas selecionadas. Ajuste o calendário ou o status."
              />
            )
          }
          footer={
            !error && !loading ? (
              <Pagination
                page={pageSegura}
                pageSize={PAGE_SIZE}
                total={filtradas.length}
                onPageChange={setPage}
              />
            ) : null
          }
        />
      </SectionCard>

      <SumupVendaModal
        venda={selecionada}
        conta={conta}
        ordem={ordemSelecionada ?? null}
        onClose={() => setSelecionada(null)}
      />
    </div>
  );
}
