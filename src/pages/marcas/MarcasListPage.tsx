import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DataTable, type Column } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { PrimaryButton } from "../../components/PrimaryButton";
import { SearchInput } from "../../components/SearchInput";
import { SectionCard } from "../../components/SectionCard";
import { IconEdit, IconEye, IconPlus, IconTrash } from "../../components/Icons";
import { marcasService } from "../../services/marcas";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import { formatarData } from "../../utils/format";
import type { Marca } from "../../types/entities";

export default function MarcasListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const searchDebounced = useDebounce(search, 300);

  const { data, loading, error, reload } = useAsync(
    () => marcasService.listar({ page, pageSize: 20, search: searchDebounced }),
    [page, searchDebounced],
  );

  const handleDelete = async (m: Marca) => {
    if (!window.confirm(`Excluir a marca "${m.nome}"?`)) return;
    try {
      await marcasService.deletar(m.id);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao excluir.");
    }
  };

  const columns: Column<Marca>[] = [
    {
      key: "nome",
      header: "Nome",
      render: (m) => (
        <Link
          to={`/marcas/${m.id}`}
          className="font-medium text-ink hover:text-brand-700"
        >
          {m.nome}
        </Link>
      ),
    },
    {
      key: "criado_em",
      header: "Criado em",
      render: (m) => <span className="text-ink-soft">{formatarData(m.criado_em)}</span>,
      width: "180px",
    },
    {
      key: "acoes",
      header: <span className="sr-only">Ações</span>,
      width: "140px",
      className: "text-right",
      render: (m) => (
        <div className="flex justify-end gap-1">
          <button
            className="btn-ghost h-8 w-8 p-0"
            title="Ver"
            onClick={() => navigate(`/marcas/${m.id}`)}
          >
            <IconEye width={16} height={16} />
          </button>
          <button
            className="btn-ghost h-8 w-8 p-0"
            title="Editar"
            onClick={() => navigate(`/marcas/${m.id}/editar`)}
          >
            <IconEdit width={16} height={16} />
          </button>
          <button
            className="btn-ghost h-8 w-8 p-0 hover:!text-red-600"
            title="Excluir"
            onClick={() => handleDelete(m)}
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
        title="Marcas"
        description="Marcas cadastradas no catálogo da KroopFeet."
        breadcrumbs={[{ label: "Catálogo" }, { label: "Marcas" }]}
        actions={
          <PrimaryButton
            icon={<IconPlus width={16} height={16} />}
            onClick={() => navigate("/marcas/nova")}
          >
            Nova marca
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
            {data ? `${data.total.toLocaleString("pt-BR")} marcas` : ""}
          </div>
        </div>

        {error ? (
          <div className="p-5 text-sm text-red-700">Erro: {error.message}</div>
        ) : (
          <DataTable
            columns={columns}
            rows={data?.data ?? []}
            rowKey={(m) => m.id}
            loading={loading}
            emptyTitle="Nenhuma marca encontrada"
            emptyDescription="Crie a primeira marca para começar."
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
