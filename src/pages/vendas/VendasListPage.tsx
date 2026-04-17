import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DataTable, type Column } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { PrimaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { IconEdit, IconEye, IconPlus } from "../../components/Icons";
import { vendasService, type VendaDetalhada } from "../../services/vendas";
import { useAsync } from "../../hooks/useAsync";
import { formatarDataHora, formatarMoeda } from "../../utils/format";
import type { StatusVenda } from "../../types/entities";

const statusOpcoes: Array<{ value: StatusVenda | ""; label: string }> = [
  { value: "", label: "Todos os status" },
  { value: "pendente", label: "Pendente" },
  { value: "paga", label: "Paga" },
  { value: "cancelada", label: "Cancelada" },
  { value: "devolvida", label: "Devolvida" },
];

export default function VendasListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusVenda | "">("");

  const { data, loading, error } = useAsync(
    () => vendasService.listarComRelacoes({ page, pageSize: 20, status }),
    [page, status],
  );

  const columns: Column<VendaDetalhada>[] = [
    {
      key: "data",
      header: "Data",
      width: "150px",
      render: (v) => (
        <Link to={`/vendas/${v.id}`} className="text-xs text-ink hover:text-brand-700">
          {formatarDataHora(v.data_venda)}
        </Link>
      ),
    },
    {
      key: "cliente",
      header: "Cliente",
      render: (v) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-ink">
            {v.cliente?.nome ?? <span className="text-ink-faint">Sem cliente vinculado</span>}
          </div>
          {v.cliente?.email ? (
            <div className="truncate text-xs text-ink-soft">{v.cliente.email}</div>
          ) : null}
        </div>
      ),
    },
    {
      key: "canal",
      header: "Canal",
      width: "140px",
      render: (v) => <StatusBadge value={v.canal_venda ?? ""} />,
    },
    {
      key: "total",
      header: "Total",
      width: "150px",
      className: "text-right",
      render: (v) => (
        <span className="font-numeric tabular-nums text-sm">
          {formatarMoeda(Number(v.valor_total), v.moeda_venda ?? "BRL")}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "120px",
      render: (v) => <StatusBadge value={v.status_venda} />,
    },
    {
      key: "acoes",
      header: <span className="sr-only">Ações</span>,
      width: "96px",
      className: "text-right",
      render: (v) => (
        <div className="flex justify-end gap-1">
          <button className="btn-ghost h-8 w-8 p-0" onClick={() => navigate(`/vendas/${v.id}`)}><IconEye width={16} height={16} /></button>
          <button className="btn-ghost h-8 w-8 p-0" onClick={() => navigate(`/vendas/${v.id}/editar`)}><IconEdit width={16} height={16} /></button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Vendas"
        description="Pedidos e vendas registradas na KroopFeet."
        breadcrumbs={[{ label: "Comercial" }, { label: "Vendas" }]}
        actions={
          <PrimaryButton icon={<IconPlus width={16} height={16} />} onClick={() => navigate("/vendas/nova")}>
            Nova venda
          </PrimaryButton>
        }
      />

      <SectionCard noPadding>
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as StatusVenda | "");
              setPage(1);
            }}
            className="input-base w-full sm:w-60"
          >
            {statusOpcoes.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <div className="text-xs text-ink-soft">
            {data ? `${data.total.toLocaleString("pt-BR")} vendas` : ""}
          </div>
        </div>

        {error ? (
          <div className="p-5 text-sm text-red-700">Erro: {error.message}</div>
        ) : (
          <DataTable
            columns={columns}
            rows={data?.data ?? []}
            rowKey={(v) => v.id}
            loading={loading}
            emptyTitle="Nenhuma venda registrada"
            emptyDescription="Registre a primeira venda para começar a acompanhar o comercial."
            emptyAction={
              <PrimaryButton onClick={() => navigate("/vendas/nova")}>Nova venda</PrimaryButton>
            }
          />
        )}

        {data ? (
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        ) : null}
      </SectionCard>
    </div>
  );
}
