import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DataTable, type Column } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { PrimaryButton } from "../../components/PrimaryButton";
import { SearchInput } from "../../components/SearchInput";
import { ScrollableListShell } from "../../components/ScrollableListShell";
import { SectionCard } from "../../components/SectionCard";
import { IconEdit, IconEye, IconPlus, IconTrash } from "../../components/Icons";
import { categoriasService } from "../../services/categorias";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import type { Categoria } from "../../types/entities";
import { CategoriaFormModal } from "./CategoriaFormModal";

export default function CategoriasListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const searchDebounced = useDebounce(search, 300);

  const [modalAberto, setModalAberto] = useState(false);
  const [categoriaEditando, setCategoriaEditando] = useState<Categoria | null>(null);

  const { data, loading, error, reload } = useAsync(
    () => categoriasService.listar({ page, pageSize: 20, search: searchDebounced }),
    [page, searchDebounced],
  );

  const idsPagina = (data?.data ?? []).map((c) => c.id);
  const idsChave = idsPagina.join(",");
  const contadores = useAsync(
    () =>
      idsPagina.length > 0
        ? categoriasService.contarRelacionados(idsPagina)
        : Promise.resolve({} as Record<string, { modelos: number; itens: number }>),
    [idsChave],
  );

  const abrirNovo = () => {
    setCategoriaEditando(null);
    setModalAberto(true);
  };

  const abrirEdicao = (c: Categoria) => {
    setCategoriaEditando(c);
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setCategoriaEditando(null);
  };

  const handleDelete = async (c: Categoria) => {
    if (!window.confirm(`Excluir a categoria "${c.nome}"?`)) return;
    try {
      await categoriasService.deletar(c.id);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao excluir.");
    }
  };

  const renderContador = (categoriaId: string, chave: "modelos" | "itens") => {
    const valor = contadores.data?.[categoriaId]?.[chave];
    if (valor === undefined) {
      return <span className="inline-block h-3 w-8 rounded bg-line/60 animate-pulse" />;
    }
    return (
      <span className="font-numeric tabular-nums text-ink">
        {valor.toLocaleString("pt-BR")}
      </span>
    );
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
      key: "modelos",
      header: "Modelos",
      width: "120px",
      className: "text-center",
      headerClassName: "!text-center",
      render: (c) => renderContador(c.id, "modelos"),
    },
    {
      key: "itens",
      header: "Itens em estoque",
      width: "160px",
      className: "text-center",
      headerClassName: "!text-center",
      render: (c) => renderContador(c.id, "itens"),
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
            title="Ver tênis desta categoria"
          >
            <IconEye width={16} height={16} />
          </button>
          <button
            className="btn-ghost h-8 w-8 p-0"
            onClick={() => abrirEdicao(c)}
            title="Editar nome"
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
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeader
        title="Categorias"
        breadcrumbs={[{ label: "Catálogo" }, { label: "Categorias" }]}
        actions={
          <PrimaryButton
            icon={<IconPlus width={16} height={16} />}
            onClick={abrirNovo}
          >
            Nova categoria
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
                emptyTitle="Nenhuma categoria encontrada"
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

      <CategoriaFormModal
        open={modalAberto}
        onClose={fecharModal}
        categoria={categoriaEditando}
        onSaved={() => reload()}
      />
    </div>
  );
}
