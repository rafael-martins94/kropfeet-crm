import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { DataTable, type Column } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScrollableListShell } from "../../components/ScrollableListShell";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { StatusSelectDropdown } from "../../components/StatusSelectDropdown";
import { IconEdit, IconEye, IconPlus } from "../../components/Icons";
import { vendasService, type VendaDetalhada } from "../../services/vendas";
import { clientesService } from "../../services/clientes";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import { formatarData, formatarMoeda, traduzirEnum } from "../../utils/format";
import type { StatusVenda } from "../../types/entities";
import { moedaDaVenda, parseRegiaoVendaRota } from "./vendaOpcoes";

const statusOpcoes: Array<{ value: StatusVenda | ""; label: string }> = [
  { value: "", label: "Todos os status" },
  { value: "em_aberto", label: "Em aberto" },
  { value: "pago", label: "Pago" },
  { value: "preparando_envio", label: "Preparando envio" },
  { value: "enviado", label: "Enviado" },
  { value: "finalizado", label: "Finalizado" },
  { value: "cancelado", label: "Cancelado" },
];

export default function VendasListPage() {
  const { pathname } = useLocation();
  const segmento = pathname.split("/").filter(Boolean).pop();
  const regiao = parseRegiaoVendaRota(segmento);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusVenda | "">("");
  const [busca, setBusca] = useState("");
  const buscaDebounced = useDebounce(busca, 350);

  const { data, loading, error } = useAsync(
    () =>
      regiao
        ? vendasService.listarComRelacoes({
            page,
            pageSize: 20,
            status,
            search: buscaDebounced,
            regiao,
          })
        : Promise.resolve(null),
    [page, status, buscaDebounced, regiao],
  );

  if (!regiao) {
    return <Navigate to="/vendas" replace />;
  }

  const labelRegiao = traduzirEnum(regiao);

  const columns: Column<VendaDetalhada>[] = [
    {
      key: "numero",
      header: "Pedido",
      width: "110px",
      render: (v) => (
        <Link
          to={`/vendas/${v.id}`}
          className="font-numeric tabular-nums text-sm font-medium text-ink hover:text-brand-700"
        >
          {v.numero ?? "—"}
        </Link>
      ),
    },
    {
      key: "cliente",
      header: "Cliente",
      render: (v) => {
        const principal = v.cliente
          ? clientesService.resolverEnderecoPrincipal(v.cliente)
          : null;
        return (
          <div className="min-w-0">
            <div className="truncate font-medium text-ink">
              {v.cliente?.nome ?? v.nome_cliente ?? <span className="text-ink-faint">—</span>}
            </div>
            {principal?.cidade || principal?.uf ? (
              <div className="truncate text-xs text-ink-soft">
                {[principal.cidade, principal.uf].filter(Boolean).join(" · ")}
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "data",
      header: "Data",
      width: "120px",
      render: (v) => (
        <span className="text-xs text-ink-soft">{formatarData(v.data_pedido)}</span>
      ),
    },
    {
      key: "total",
      header: "Total",
      width: "140px",
      className: "text-right",
      render: (v) => (
        <span className="font-numeric tabular-nums text-sm">
          {formatarMoeda(Number(v.valor_total), moedaDaVenda(v))}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "150px",
      render: (v) => <StatusBadge value={v.status_venda} />,
    },
    {
      key: "acoes",
      header: <span className="sr-only">Ações</span>,
      width: "96px",
      className: "text-right",
      render: (v) => (
        <div className="flex justify-end gap-1">
          <button
            className="btn-ghost h-8 w-8 p-0"
            onClick={() => navigate(`/vendas/${v.id}`)}
            aria-label="Ver ordem"
          >
            <IconEye width={16} height={16} />
          </button>
          <button
            className="btn-ghost h-8 w-8 p-0"
            onClick={() => navigate(`/vendas/${v.id}/editar`)}
            aria-label="Editar ordem"
          >
            <IconEdit width={16} height={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeader
        title={`Ordens de venda · ${labelRegiao}`}
        breadcrumbs={[
          { label: "Comercial" },
          { label: "Ordens de venda", to: "/vendas" },
          { label: labelRegiao },
        ]}
        backTo="/vendas"
        actions={
          <PrimaryButton
            icon={<IconPlus width={16} height={16} />}
            onClick={() => navigate(`/vendas/novo?regiao=${regiao}`)}
          >
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
            <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  value={busca}
                  onChange={(e) => {
                    setBusca(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Buscar por nº, cliente ou rastreamento…"
                  className="input-base w-full sm:w-72"
                />
                <StatusSelectDropdown
                  value={status}
                  options={statusOpcoes}
                  onChange={(v) => {
                    setStatus(v as StatusVenda | "");
                    setPage(1);
                  }}
                  className="w-full sm:w-56"
                />
              </div>
              <div className="text-xs text-ink-soft">
                {data ? `${data.total.toLocaleString("pt-BR")} ordens` : ""}
              </div>
            </div>
          }
          body={
            error ? (
              <div className="p-5 text-sm text-red-700">Erro: {error.message}</div>
            ) : (
              <DataTable
                columns={columns}
                rows={data?.data ?? []}
                rowKey={(v) => v.id}
                loading={loading}
                emptyTitle="Nenhuma ordem de venda"
                emptyDescription={`Não há pedidos em ${labelRegiao} ainda. Crie uma nova ordem ou importe do Tiny.`}
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
