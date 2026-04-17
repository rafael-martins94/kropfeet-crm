import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DataTable, type Column } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { PrimaryButton } from "../../components/PrimaryButton";
import { SearchInput } from "../../components/SearchInput";
import { SectionCard } from "../../components/SectionCard";
import { IconEdit, IconEye, IconPlus, IconTrash } from "../../components/Icons";
import { categoriasService } from "../../services/categorias";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import { formatarData } from "../../utils/format";
import type { Categoria } from "../../types/entities";

export default function CategoriasListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const searchDebounced = useDebounce(search, 300);

  const { data, loading, error, reload } = useAsync(
    () => categoriasService.listar({ page, pageSize: 20, search: searchDebounced }),
    [page, searchDebounced],
  );

  const handleDelete = async (c: Categoria) => {
    if (!window.confirm(`Excluir a categoria "${c.nome}"?`)) return;
    try {
      await categoriasService.deletar(c.id);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao excluir.");
    }
  };

  const columns: Column<Categoria>[] = [
    {
      key: "nome",
      header: "Nome",
      render: (c) => (
        <Link to={`/categorias/${c.id}`} className="font-medium text-ink hover:text-brand-700">
          {c.nome}
        </Link>
      ),
    },
    {
      key: "criado_em",
      header: "Criado em",
      width: "180px",
      render: (c) => <span className="text-ink-soft">{formatarData(c.criado_em)}</span>,
    },
    {
      key: "acoes",
      header: <span className="sr-only">Ações</span>,
      width: "140px",
      className: "text-right",
      render: (c) => (
        <div className="flex justify-end gap-1">
          <button
            className="btn-ghost h-8 w-8 p-0"
            onClick={() => navigate(`/categorias/${c.id}`)}
            title="Ver"
          >
            <IconEye width={16} height={16} />
          </button>
          <button
            className="btn-ghost h-8 w-8 p-0"
            onClick={() => navigate(`/categorias/${c.id}/editar`)}
            title="Editar"
          >
            <IconEdit width={16} height={16} />
          </button>
          <button
            className="btn-ghost h-8 w-8 p-0 hover:!text-red-600"
            onClick={() => handleDelete(c)}
            title="Excluir"
          >
            <IconTrash width={16} height={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Categorias"
        description="Categorias usadas para organizar os modelos de produto."
        breadcrumbs={[{ label: "Catálogo" }, { label: "Categorias" }]}
        actions={
          <PrimaryButton
            icon={<IconPlus width={16} height={16} />}
            onClick={() => navigate("/categorias/nova")}
          >
            Nova categoria
          </PrimaryButton>
        }
      />

      <SectionCard noPadding>
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            placeholder="Buscar por nome…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            wrapperClassName="w-full sm:max-w-xs"
          />
          <div className="text-xs text-ink-soft">
            {data ? `${data.total.toLocaleString("pt-BR")} categorias` : ""}
          </div>
        </div>

        {error ? (
          <div className="p-5 text-sm text-red-700">Erro: {error.message}</div>
        ) : (
          <DataTable
            columns={columns}
            rows={data?.data ?? []}
            rowKey={(c) => c.id}
            loading={loading}
            emptyTitle="Nenhuma categoria encontrada"
          />
        )}

        {data ? (
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPageChange={setPage}
          />
        ) : null}
      </SectionCard>
    </div>
  );
}
