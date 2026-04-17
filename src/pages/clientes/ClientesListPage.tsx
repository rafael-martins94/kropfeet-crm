import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DataTable, type Column } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { PrimaryButton } from "../../components/PrimaryButton";
import { SearchInput } from "../../components/SearchInput";
import { SectionCard } from "../../components/SectionCard";
import { IconEdit, IconEye, IconPlus, IconTrash } from "../../components/Icons";
import { clientesService } from "../../services/clientes";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import { formatarData } from "../../utils/format";
import type { Cliente } from "../../types/entities";

export default function ClientesListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const searchDebounced = useDebounce(search, 300);

  const { data, loading, error, reload } = useAsync(
    () => clientesService.listar({ page, pageSize: 20, search: searchDebounced }),
    [page, searchDebounced],
  );

  const handleDelete = async (c: Cliente) => {
    if (!window.confirm(`Excluir "${c.nome}"?`)) return;
    try {
      await clientesService.deletar(c.id);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao excluir.");
    }
  };

  const columns: Column<Cliente>[] = [
    {
      key: "nome",
      header: "Cliente",
      render: (c) => (
        <div className="min-w-0">
          <Link
            to={`/clientes/${c.id}`}
            className="block truncate font-medium text-ink hover:text-brand-700"
          >
            {c.nome}
          </Link>
          {c.instagram ? (
            <div className="truncate text-xs text-ink-soft">@{c.instagram.replace(/^@/, "")}</div>
          ) : null}
        </div>
      ),
    },
    { key: "email", header: "E-mail", render: (c) => <span className="text-ink-soft">{c.email ?? "—"}</span> },
    { key: "telefone", header: "Telefone", render: (c) => <span className="text-ink-soft">{c.telefone ?? "—"}</span>, width: "160px" },
    { key: "pais", header: "País", render: (c) => <span className="text-ink-soft">{c.pais ?? "—"}</span>, width: "140px" },
    { key: "criado", header: "Cadastro", render: (c) => <span className="text-xs text-ink-soft">{formatarData(c.criado_em)}</span>, width: "140px" },
    {
      key: "acoes",
      header: <span className="sr-only">Ações</span>,
      width: "140px",
      className: "text-right",
      render: (c) => (
        <div className="flex justify-end gap-1">
          <button className="btn-ghost h-8 w-8 p-0" onClick={() => navigate(`/clientes/${c.id}`)}><IconEye width={16} height={16} /></button>
          <button className="btn-ghost h-8 w-8 p-0" onClick={() => navigate(`/clientes/${c.id}/editar`)}><IconEdit width={16} height={16} /></button>
          <button className="btn-ghost h-8 w-8 p-0 hover:!text-red-600" onClick={() => handleDelete(c)}><IconTrash width={16} height={16} /></button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Base de contatos comerciais da KroopFeet."
        breadcrumbs={[{ label: "Comercial" }, { label: "Clientes" }]}
        actions={
          <PrimaryButton icon={<IconPlus width={16} height={16} />} onClick={() => navigate("/clientes/novo")}>
            Novo cliente
          </PrimaryButton>
        }
      />

      <SectionCard noPadding>
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            placeholder="Buscar por nome, e-mail, Instagram…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            wrapperClassName="w-full sm:max-w-sm"
          />
          <div className="text-xs text-ink-soft">
            {data ? `${data.total.toLocaleString("pt-BR")} clientes` : ""}
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
            emptyTitle="Nenhum cliente cadastrado"
            emptyDescription="Cadastre seu primeiro cliente para começar."
            emptyAction={
              <PrimaryButton onClick={() => navigate("/clientes/novo")}>
                Cadastrar cliente
              </PrimaryButton>
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
