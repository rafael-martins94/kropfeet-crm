import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DataTable, type Column } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { PrimaryButton } from "../../components/PrimaryButton";
import { SearchInput } from "../../components/SearchInput";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { IconEdit, IconEye, IconPlus } from "../../components/Icons";
import { fornecedoresService } from "../../services/fornecedores";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import type { Fornecedor } from "../../types/entities";

export default function FornecedoresListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const searchDebounced = useDebounce(search, 400);

  const { data, loading, error } = useAsync(
    () => fornecedoresService.listar({ page, pageSize: 25, search: searchDebounced }),
    [page, searchDebounced],
  );

  const columns: Column<Fornecedor>[] = [
    {
      key: "nome",
      header: "Fornecedor",
      render: (f) => (
        <div className="min-w-0">
          <Link
            to={`/fornecedores/${f.id}`}
            className="block truncate font-medium text-ink hover:text-brand-700"
          >
            {f.nome}
          </Link>
          {f.fantasia ? (
            <div className="truncate text-xs text-ink-soft">{f.fantasia}</div>
          ) : null}
        </div>
      ),
    },
    {
      key: "documento",
      header: "CPF/CNPJ",
      width: "180px",
      render: (f) => <span className="font-numeric tabular-nums text-xs">{f.cpf_cnpj ?? "—"}</span>,
    },
    {
      key: "local",
      header: "Localidade",
      render: (f) => (
        <span className="text-ink-soft">
          {[f.cidade, f.uf, f.pais].filter(Boolean).join(" · ") || "—"}
        </span>
      ),
    },
    {
      key: "contato",
      header: "Contato",
      render: (f) => (
        <div className="min-w-0 text-xs text-ink-soft">
          <div className="truncate">{f.email ?? "—"}</div>
          <div className="truncate">{f.telefone ?? f.celular ?? ""}</div>
        </div>
      ),
    },
    {
      key: "situacao",
      header: "Situação",
      width: "120px",
      render: (f) => <StatusBadge value={f.situacao} />,
    },
    {
      key: "acoes",
      header: <span className="sr-only">Ações</span>,
      width: "100px",
      className: "text-right",
      render: (f) => (
        <div className="flex justify-end gap-1">
          <button
            className="btn-ghost h-8 w-8 p-0"
            onClick={() => navigate(`/fornecedores/${f.id}`)}
            title="Ver"
          >
            <IconEye width={16} height={16} />
          </button>
          <button
            className="btn-ghost h-8 w-8 p-0"
            onClick={() => navigate(`/fornecedores/${f.id}/editar`)}
            title="Editar"
          >
            <IconEdit width={16} height={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Fornecedores"
        description="Base de fornecedores sincronizada com o Tiny."
        breadcrumbs={[{ label: "Operação" }, { label: "Fornecedores" }]}
        actions={
          <PrimaryButton
            icon={<IconPlus width={16} height={16} />}
            onClick={() => navigate("/fornecedores/novo")}
          >
            Novo fornecedor
          </PrimaryButton>
        }
      />

      <SectionCard noPadding>
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            placeholder="Buscar por nome, fantasia, CPF/CNPJ, e-mail…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            wrapperClassName="w-full sm:max-w-sm"
          />
          <div className="text-xs text-ink-soft">
            {data ? `${data.total.toLocaleString("pt-BR")} fornecedores` : ""}
          </div>
        </div>

        {error ? (
          <div className="p-5 text-sm text-red-700">Erro: {error.message}</div>
        ) : (
          <DataTable
            columns={columns}
            rows={data?.data ?? []}
            rowKey={(f) => f.id}
            loading={loading}
            emptyTitle="Nenhum fornecedor encontrado"
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
