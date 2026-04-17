import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DataTable, type Column } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { PrimaryButton } from "../../components/PrimaryButton";
import { SearchInput } from "../../components/SearchInput";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { IconEdit, IconEye, IconPlus, IconTrash } from "../../components/Icons";
import { locaisEstoqueService } from "../../services/locais-estoque";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import type { LocalEstoque } from "../../types/entities";

export default function LocaisEstoqueListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const searchDebounced = useDebounce(search, 300);

  const { data, loading, error, reload } = useAsync(
    () => locaisEstoqueService.listar({ page, pageSize: 20, search: searchDebounced }),
    [page, searchDebounced],
  );

  const handleDelete = async (l: LocalEstoque) => {
    if (!window.confirm(`Excluir o local "${l.nome}"?`)) return;
    try {
      await locaisEstoqueService.deletar(l.id);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao excluir.");
    }
  };

  const columns: Column<LocalEstoque>[] = [
    {
      key: "codigo",
      header: "Código",
      width: "140px",
      render: (l) => <span className="font-numeric tabular-nums text-xs">{l.codigo}</span>,
    },
    {
      key: "nome",
      header: "Nome",
      render: (l) => (
        <Link to={`/locais-estoque/${l.id}`} className="font-medium text-ink hover:text-brand-700">
          {l.nome}
        </Link>
      ),
    },
    {
      key: "regiao",
      header: "Região",
      width: "140px",
      render: (l) => <StatusBadge value={l.tipo_regiao} />,
    },
    {
      key: "pais",
      header: "País",
      width: "140px",
      render: (l) => <span className="text-ink-soft">{l.pais ?? "—"}</span>,
    },
    {
      key: "ativo",
      header: "Status",
      width: "110px",
      render: (l) => <StatusBadge value={l.ativo ? "ativo" : "inativo"} />,
    },
    {
      key: "acoes",
      header: <span className="sr-only">Ações</span>,
      width: "140px",
      className: "text-right",
      render: (l) => (
        <div className="flex justify-end gap-1">
          <button className="btn-ghost h-8 w-8 p-0" onClick={() => navigate(`/locais-estoque/${l.id}`)}><IconEye width={16} height={16} /></button>
          <button className="btn-ghost h-8 w-8 p-0" onClick={() => navigate(`/locais-estoque/${l.id}/editar`)}><IconEdit width={16} height={16} /></button>
          <button className="btn-ghost h-8 w-8 p-0 hover:!text-red-600" onClick={() => handleDelete(l)}><IconTrash width={16} height={16} /></button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Locais de estoque"
        description="Armazéns, showrooms e locais de controle físico do estoque."
        breadcrumbs={[{ label: "Operação" }, { label: "Locais de estoque" }]}
        actions={
          <PrimaryButton icon={<IconPlus width={16} height={16} />} onClick={() => navigate("/locais-estoque/novo")}>
            Novo local
          </PrimaryButton>
        }
      />

      <SectionCard noPadding>
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            placeholder="Buscar por nome, código, país…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            wrapperClassName="w-full sm:max-w-sm"
          />
          <div className="text-xs text-ink-soft">{data ? `${data.total} locais` : ""}</div>
        </div>

        {error ? (
          <div className="p-5 text-sm text-red-700">Erro: {error.message}</div>
        ) : (
          <DataTable
            columns={columns}
            rows={data?.data ?? []}
            rowKey={(l) => l.id}
            loading={loading}
            emptyTitle="Nenhum local de estoque"
          />
        )}

        {data ? (
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        ) : null}
      </SectionCard>
    </div>
  );
}
