import { useState } from "react";
import { DataTable, type Column } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { logsTinyService } from "../../services/logs-tiny";
import { useAsync } from "../../hooks/useAsync";
import { formatarDataHora } from "../../utils/format";
import type { LogSincronizacaoTiny } from "../../types/entities";

export default function LogsTinyListPage() {
  const [page, setPage] = useState(1);
  const { data, loading, error } = useAsync(
    () => logsTinyService.listar({ page, pageSize: 25 }),
    [page],
  );

  const columns: Column<LogSincronizacaoTiny>[] = [
    {
      key: "iniciado",
      header: "Início",
      width: "160px",
      render: (l) => <span className="text-xs">{formatarDataHora(l.iniciado_em)}</span>,
    },
    {
      key: "tipo",
      header: "Tipo",
      width: "200px",
      render: (l) => <StatusBadge value={l.tipo_sincronizacao} />,
    },
    {
      key: "endpoint",
      header: "Endpoint",
      render: (l) => (
        <span className="font-numeric tabular-nums text-xs text-ink-soft">{l.endpoint_tiny ?? "—"}</span>
      ),
    },
    {
      key: "pagina",
      header: "Pág.",
      width: "80px",
      className: "text-right",
      render: (l) => <span className="font-numeric tabular-nums text-xs">{l.pagina ?? "—"}</span>,
    },
    {
      key: "qtdRecebida",
      header: "Recebidos",
      width: "90px",
      className: "text-right",
      render: (l) => <span className="font-numeric tabular-nums text-xs">{l.quantidade_recebida}</span>,
    },
    {
      key: "qtdCriada",
      header: "Criados",
      width: "90px",
      className: "text-right",
      render: (l) => <span className="font-numeric tabular-nums text-xs text-emerald-700">{l.quantidade_criada}</span>,
    },
    {
      key: "qtdAtualizada",
      header: "Atualizados",
      width: "100px",
      className: "text-right",
      render: (l) => <span className="font-numeric tabular-nums text-xs text-sky-700">{l.quantidade_atualizada}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "130px",
      render: (l) => <StatusBadge value={l.status} />,
    },
    {
      key: "fim",
      header: "Fim",
      width: "160px",
      render: (l) => <span className="text-xs text-ink-soft">{formatarDataHora(l.finalizado_em)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Logs de sincronização Tiny"
        description="Auditoria das execuções de sincronização com a API do Tiny ERP."
        breadcrumbs={[{ label: "Sistema" }, { label: "Logs Tiny" }]}
      />

      <SectionCard noPadding>
        {error ? (
          <div className="p-5 text-sm text-red-700">Erro: {error.message}</div>
        ) : (
          <DataTable
            columns={columns}
            rows={data?.data ?? []}
            rowKey={(l) => l.id}
            loading={loading}
            emptyTitle="Nenhum log de sincronização"
          />
        )}
        {data ? (
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        ) : null}
      </SectionCard>
    </div>
  );
}
