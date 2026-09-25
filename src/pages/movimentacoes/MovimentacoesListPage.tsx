import { useState } from "react";
import { DataTable, type Column } from "../../components/DataTable";
import { DateRangePicker, paraIsoData } from "../../components/DateRangePicker";
import { EntityLink } from "../../components/EntityLink";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { ScrollableListShell } from "../../components/ScrollableListShell";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { movimentacoesService, type MovimentacaoDetalhada } from "../../services/movimentacoes";
import { useAsync } from "../../hooks/useAsync";
import { formatarDataHora } from "../../utils/format";

function isoLocal(data: Date): string {
  return paraIsoData(data.getFullYear(), data.getMonth(), data.getDate());
}

/** Janela inclusiva dos últimos 30 dias, no calendário local. */
function periodoUltimos30Dias(): { de: string; ate: string } {
  const fim = new Date();
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - 29);
  return { de: isoLocal(inicio), ate: isoLocal(fim) };
}

export default function MovimentacoesListPage() {
  const padrao = periodoUltimos30Dias();
  const [page, setPage] = useState(1);
  const [dataDe, setDataDe] = useState(padrao.de);
  const [dataAte, setDataAte] = useState(padrao.ate);
  const { data, loading, error } = useAsync(
    () =>
      movimentacoesService.listarComRelacoes({
        page,
        pageSize: 25,
        dataDe,
        dataAte,
      }),
    [page, dataDe, dataAte],
  );

  const columns: Column<MovimentacaoDetalhada>[] = [
    {
      key: "data",
      header: "Data",
      width: "160px",
      render: (m) => <span className="text-xs">{formatarDataHora(m.data_movimentacao)}</span>,
    },
    {
      key: "tipo",
      header: "Tipo",
      width: "150px",
      render: (m) => <StatusBadge value={m.tipo_movimentacao} />,
    },
    {
      key: "item",
      header: "Item",
      render: (m) =>
        m.item_estoque ? (
          <EntityLink to={`/itens-estoque/${m.item_estoque.id}`} appearance="plain" className="font-medium">
            {m.item_estoque.nome_produto}
            <span className="ml-2 font-numeric tabular-nums text-xs text-ink-soft">
              SKU {m.item_estoque.sku}
            </span>
          </EntityLink>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    {
      key: "origem",
      header: "Origem",
      render: (m) =>
        m.origem ? (
          <span className="text-ink-soft">{m.origem.nome}</span>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    {
      key: "destino",
      header: "Destino",
      render: (m) =>
        m.destino ? (
          <span className="text-ink-soft">{m.destino.nome}</span>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    {
      key: "venda",
      header: "Venda",
      width: "120px",
      render: (m) =>
        m.venda ? (
          <EntityLink
            to={`/vendas/${m.venda.id}`}
            appearance="plain"
            className="font-numeric tabular-nums text-xs"
          >
            {m.venda.numero ? `#${m.venda.numero}` : "Pedido"}
          </EntityLink>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeader
        title="Movimentações de estoque"
        breadcrumbs={[{ label: "Operação" }, { label: "Movimentações" }]}
      />

      <SectionCard
        noPadding
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <ScrollableListShell
          toolbar={
            <div className="flex items-center gap-2 border-b border-line px-5 py-3">
              <DateRangePicker
                value={{ de: dataDe, ate: dataAte }}
                onChange={({ de, ate }) => {
                  if (!de && !ate) {
                    const novamente = periodoUltimos30Dias();
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
            </div>
          }
          body={
            error ? (
              <div className="p-5 text-sm text-red-700">Erro: {error.message}</div>
            ) : (
              <DataTable
                columns={columns}
                rows={data?.data ?? []}
                rowKey={(m) => m.id}
                loading={loading}
                emptyTitle="Nenhuma movimentação no período"
                emptyDescription="Não há movimentos entre as datas selecionadas. Ajuste o início e o término no calendário."
              />
            )
          }
          footer={
            data ? (
              <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
            ) : null
          }
        />
      </SectionCard>
    </div>
  );
}
