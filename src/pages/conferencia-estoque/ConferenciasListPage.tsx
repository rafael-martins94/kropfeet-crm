import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable, type Column } from "../../components/DataTable";
import { IconPlus } from "../../components/Icons";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScrollableListShell } from "../../components/ScrollableListShell";
import { SectionCard } from "../../components/SectionCard";
import { SearchInput } from "../../components/SearchInput";
import { StatusBadge } from "../../components/StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import {
  conferenciasEstoqueService,
  type ConferenciaResumo,
} from "../../services/conferencias-estoque";
import { formatarDataHora } from "../../utils/format";
import { NovaConferenciaModal } from "./NovaConferenciaModal";

function rotuloItensConferidos(total: number): string {
  if (total === 1) return "1 item conferido";
  return `${total.toLocaleString("pt-BR")} itens conferidos`;
}

export default function ConferenciasListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const searchDebounced = useDebounce(search, 400);
  const [modalAberto, setModalAberto] = useState(false);

  const { data, loading, error, reload } = useAsync(
    () =>
      conferenciasEstoqueService.listar({
        page,
        pageSize: 25,
        search: searchDebounced,
      }),
    [page, searchDebounced],
  );

  const columns: Column<ConferenciaResumo>[] = [
    {
      key: "nome",
      header: "Nome",
      render: (c) => (
        <span className="block truncate font-medium text-ink" title={c.nome}>
          {c.nome}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "120px",
      render: (c) => <StatusBadge value={c.status} />,
    },
    {
      key: "itens",
      header: "Itens",
      width: "160px",
      render: (c) => (
        <span className="text-sm text-ink-muted">{rotuloItensConferidos(c.totalItensConferidos)}</span>
      ),
    },
    {
      key: "criado_em",
      header: "Criada em",
      width: "170px",
      render: (c) => (
        <span className="text-sm text-ink-muted tabular-nums">{formatarDataHora(c.criado_em)}</span>
      ),
    },
    {
      key: "criador",
      header: "Criada por",
      width: "160px",
      render: (c) => (
        <span className="block truncate text-sm text-ink-muted" title={c.nomeUsuario ?? undefined}>
          {c.nomeUsuario ?? "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeader
        title="Conferência de estoque"
        breadcrumbs={[{ label: "Operação" }, { label: "Conferência de estoque" }]}
        actions={
          <PrimaryButton
            icon={<IconPlus width={16} height={16} />}
            onClick={() => setModalAberto(true)}
          >
            Nova conferência
          </PrimaryButton>
        }
      />

      <NovaConferenciaModal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        onCriada={(id) => {
          setModalAberto(false);
          void reload();
          navigate(`/conferencia-estoque/${id}`);
        }}
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
                placeholder="Buscar por nome…"
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
                rowKey={(c) => c.id}
                loading={loading}
                emptyTitle="Nenhuma conferência encontrada"
                emptyDescription="Crie uma nova conferência para começar a verificar itens de estoque."
                onRowClick={(c) => navigate(`/conferencia-estoque/${c.id}`)}
                rowClassName={() => "cursor-pointer hover:bg-surface-muted/60"}
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
