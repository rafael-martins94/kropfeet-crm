import { useState } from "react";
import { Link } from "react-router-dom";
import { DataTable, type Column } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { movimentacoesService, type MovimentacaoDetalhada } from "../../services/movimentacoes";
import { useAsync } from "../../hooks/useAsync";
import { formatarDataHora } from "../../utils/format";

export default function MovimentacoesListPage() {
  const [page, setPage] = useState(1);
  const { data, loading, error } = useAsync(
    () => movimentacoesService.listarComRelacoes({ page, pageSize: 25 }),
    [page],
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
          <Link
            to={`/itens-estoque/${m.item_estoque.id}`}
            className="font-medium text-ink hover:text-brand-700"
          >
            {m.item_estoque.nome_completo}
            <span className="ml-2 font-numeric tabular-nums text-xs text-ink-soft">
              SKU {m.item_estoque.sku}
            </span>
          </Link>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    {
      key: "origem",
      header: "Origem",
      render: (m) =>
        m.origem ? (
          <span className="text-ink-soft">{m.origem.codigo} · {m.origem.nome}</span>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    {
      key: "destino",
      header: "Destino",
      render: (m) =>
        m.destino ? (
          <span className="text-ink-soft">{m.destino.codigo} · {m.destino.nome}</span>
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
          <Link
            to={`/vendas/${m.venda.id}`}
            className="font-numeric tabular-nums text-xs text-brand-600 hover:text-brand-700"
          >
            #{m.venda.id.slice(0, 8)}
          </Link>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Movimentações de estoque"
        description="Histórico auditável de entradas, saídas, transferências, reservas e vendas do estoque."
        breadcrumbs={[{ label: "Operação" }, { label: "Movimentações" }]}
      />

      <SectionCard noPadding>
        {error ? (
          <div className="p-5 text-sm text-red-700">Erro: {error.message}</div>
        ) : (
          <DataTable
            columns={columns}
            rows={data?.data ?? []}
            rowKey={(m) => m.id}
            loading={loading}
            emptyTitle="Nenhuma movimentação"
            emptyDescription="As movimentações aparecerão aqui conforme o estoque for sendo operado."
          />
        )}
        {data ? (
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        ) : null}
      </SectionCard>
    </div>
  );
}
