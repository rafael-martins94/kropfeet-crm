import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DataTable, type Column } from "../../components/DataTable";
import { IconEye, IconPlus } from "../../components/Icons";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScrollableListShell } from "../../components/ScrollableListShell";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { SearchInput } from "../../components/SearchInput";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import { ordensCompraService, type OrdemCompraDetalhada } from "../../services/ordens-compra";
import { formatarData, formatarMoeda } from "../../utils/format";

export default function OrdensCompraListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const searchDebounced = useDebounce(search, 400);

  const { data, loading, error } = useAsync(
    () => ordensCompraService.listar({ page, pageSize: 25, search: searchDebounced }),
    [page, searchDebounced],
  );

  const columns: Column<OrdemCompraDetalhada>[] = [
    {
      key: "data",
      header: "Data",
      width: "120px",
      render: (o) => formatarData(o.data_compra),
    },
    {
      key: "item",
      header: "Item",
      render: (o) => (
        <div className="min-w-0">
          {o.item ? (
            <>
              <Link
                to={`/itens-estoque/${o.item.id}`}
                className="block truncate font-medium text-ink hover:text-brand-700"
              >
                {o.item.nome_produto}
              </Link>
              <div className="truncate font-numeric tabular-nums text-xs text-ink-soft">
                SKU {o.item.sku}
              </div>
            </>
          ) : (
            "—"
          )}
        </div>
      ),
    },
    {
      key: "fornecedor",
      header: "Fornecedor",
      render: (o) =>
        o.fornecedor ? (
          <Link to={`/fornecedores/${o.fornecedor.id}`} className="text-brand-600 hover:text-brand-700">
            {o.fornecedor.nome}
          </Link>
        ) : (
          "—"
        ),
    },
    {
      key: "valor",
      header: "Valor",
      width: "140px",
      render: (o) => formatarMoeda(o.valor_pago_original, o.moeda_compra),
    },
    {
      key: "status",
      header: "Status item",
      width: "150px",
      render: (o) => (o.item ? <StatusBadge value={o.item.status_item} /> : "—"),
    },
    {
      key: "acoes",
      header: <span className="sr-only">Ações</span>,
      width: "80px",
      className: "text-right",
      render: (o) => (
        <div className="flex justify-end">
          <button
            type="button"
            className="btn-ghost h-8 w-8 p-0"
            onClick={() => navigate(`/ordens-compra/${o.id}`)}
            title="Ver ordem"
          >
            <IconEye width={16} height={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeader
        title="Ordens de compra"
        breadcrumbs={[{ label: "Operação" }, { label: "Ordens de compra" }]}
        actions={
          <PrimaryButton icon={<IconPlus width={16} height={16} />} onClick={() => navigate("/ordens-compra/novo")}>
            Nova ordem
          </PrimaryButton>
        }
      />

      <SectionCard
        noPadding
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <ScrollableListShell
          toolbar={
            <div className="border-b border-line px-5 py-4">
              <SearchInput
                placeholder="Buscar por moeda ou observações…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                wrapperClassName="w-full sm:max-w-sm"
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
                rowKey={(o) => o.id}
                loading={loading}
                emptyTitle="Nenhuma ordem de compra encontrada"
              />
            )
          }
          footer={
            data ? (
              <Pagination
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPageChange={setPage}
              />
            ) : null
          }
        />
      </SectionCard>
    </div>
  );
}
