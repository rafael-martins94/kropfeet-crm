import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DataTable, type Column } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { PrimaryButton } from "../../components/PrimaryButton";
import { SearchInput } from "../../components/SearchInput";
import { ScrollableListShell } from "../../components/ScrollableListShell";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { IconEdit, IconEye, IconPlus } from "../../components/Icons";
import { modelosProdutoService, type ModeloProdutoDetalhado } from "../../services/modelos-produto";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import { formatarDataHora } from "../../utils/format";

export default function ModelosListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const searchDebounced = useDebounce(search, 400);

  const { data, loading, error } = useAsync(
    () =>
      modelosProdutoService.listarComRelacoes({
        page,
        pageSize: 20,
        search: searchDebounced,
      }),
    [page, searchDebounced],
  );

  const columns: Column<ModeloProdutoDetalhado>[] = [
    {
      key: "nome",
      header: "Modelo",
      render: (m) => (
        <div className="min-w-0">
          <Link
            to={`/modelos-produto/${m.id}`}
            className="block truncate font-medium text-ink hover:text-brand-700"
          >
            {m.nome_modelo}
          </Link>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-soft">
            <span className="truncate">{m.slug}</span>
            {m.cor ? (
              <>
                <span className="h-1 w-1 flex-shrink-0 rounded-full bg-line" />
                <span className="truncate">{m.cor}</span>
              </>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: "marca",
      header: "Marca",
      width: "160px",
      render: (m) => (
        <span className="text-ink-muted">{m.marca?.nome ?? "—"}</span>
      ),
    },
    {
      key: "categoria",
      header: "Categoria",
      width: "180px",
      render: (m) => (
        <span className="text-ink-soft">{m.categoria?.nome ?? "—"}</span>
      ),
    },
    {
      key: "codigo",
      header: "Referência",
      width: "150px",
      render: (m) => (
        <span className="font-numeric tabular-nums text-xs text-ink-soft">
          {m.codigo_referencia ?? m.codigo_fabricante ?? "—"}
        </span>
      ),
    },
    {
      key: "origem",
      header: "Origem",
      width: "120px",
      render: (m) => <StatusBadge value={m.origem_cadastro} />,
    },
    {
      key: "ativo",
      header: "Status",
      width: "100px",
      render: (m) => <StatusBadge value={m.ativo ? "ativo" : "inativo"} />,
    },
    {
      key: "atualizado",
      header: "Atualizado",
      width: "160px",
      render: (m) => (
        <span className="text-xs text-ink-soft">{formatarDataHora(m.atualizado_em)}</span>
      ),
    },
    {
      key: "acoes",
      header: <span className="sr-only">Ações</span>,
      width: "96px",
      className: "text-right",
      render: (m) => (
        <div className="flex justify-end gap-1">
          <button className="btn-ghost h-8 w-8 p-0" onClick={() => navigate(`/modelos-produto/${m.id}`)}><IconEye width={16} height={16} /></button>
          <button className="btn-ghost h-8 w-8 p-0" onClick={() => navigate(`/modelos-produto/${m.id}/editar`)}><IconEdit width={16} height={16} /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeader
        title="Modelos de produto"
        breadcrumbs={[{ label: "Catálogo" }, { label: "Modelos" }]}
        actions={
          <PrimaryButton
            icon={<IconPlus width={16} height={16} />}
            onClick={() => navigate("/modelos-produto/novo")}
          >
            Novo modelo
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
              <SearchInput
                placeholder="Buscar por nome, slug, referência, cor…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                wrapperClassName="w-full sm:max-w-sm"
              />
              <div className="text-xs text-ink-soft">
                {data ? `${data.total.toLocaleString("pt-BR")} modelos` : ""}
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
                rowKey={(m) => m.id}
                loading={loading}
                emptyTitle="Nenhum modelo encontrado"
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
