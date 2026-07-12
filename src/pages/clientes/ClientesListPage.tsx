import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable, type Column } from "../../components/DataTable";
import { EntityLink } from "../../components/EntityLink";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { PrimaryButton } from "../../components/PrimaryButton";
import { SearchInput } from "../../components/SearchInput";
import { ScrollableListShell } from "../../components/ScrollableListShell";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { StatusSelectDropdown } from "../../components/StatusSelectDropdown";
import { IconEdit, IconEye, IconPlus } from "../../components/Icons";
import { clientesService, type ClienteComEnderecos } from "../../services/clientes";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import { formatarDocumento, inferirTipoPessoa, labelDocumento } from "../../utils/documento";
import { paisClienteOpcoes } from "./clienteOpcoes";

const paisFiltroOpcoes = [
  { value: "", label: "Todos os países" },
  ...paisClienteOpcoes,
];

export default function ClientesListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [pais, setPais] = useState("");
  const searchDebounced = useDebounce(search, 300);

  const { data, loading, error } = useAsync(
    () =>
      clientesService.listar({
        page,
        pageSize: 20,
        search: searchDebounced,
        pais,
      }),
    [page, searchDebounced, pais],
  );

  const columns: Column<ClienteComEnderecos>[] = [
    {
      key: "nome",
      header: "Cliente",
      render: (c) => {
        const principal = clientesService.resolverEnderecoPrincipal(c);
        return (
          <div className="min-w-0">
            <EntityLink to={`/clientes/${c.id}`} appearance="plain" truncate className="font-medium">
              {c.nome}
            </EntityLink>
            <div className="truncate text-xs text-ink-soft">
              {[principal?.cidade, principal?.uf].filter(Boolean).join(" · ") || c.cpf_cnpj || "—"}
            </div>
          </div>
        );
      },
    },
    {
      key: "contato",
      header: "Contato",
      render: (c) => (
        <div className="min-w-0">
          <div className="truncate text-sm text-ink">{c.email ?? "—"}</div>
          {c.telefone ? (
            <div className="truncate text-xs text-ink-soft">{c.telefone}</div>
          ) : null}
        </div>
      ),
    },
    {
      key: "documento",
      header: "Documento",
      width: "170px",
      render: (c) => {
        const tipo = c.tipo_pessoa ?? inferirTipoPessoa(c.cpf_cnpj);
        return (
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
              {labelDocumento(tipo)}
            </div>
            <span className="font-numeric tabular-nums text-xs text-ink-soft">
              {c.cpf_cnpj ? formatarDocumento(c.cpf_cnpj, tipo) : "—"}
            </span>
          </div>
        );
      },
    },
    {
      key: "tipo",
      header: "Tipo",
      width: "130px",
      render: (c) =>
        c.tipo_pessoa ? <StatusBadge value={c.tipo_pessoa} /> : <span className="text-ink-faint">—</span>,
    },
    {
      key: "pais",
      header: "País",
      width: "120px",
      render: (c) => <span className="text-sm text-ink-soft">{c.pais ?? "—"}</span>,
    },
    {
      key: "acoes",
      header: <span className="sr-only">Ações</span>,
      width: "96px",
      className: "text-right",
      render: (c) => (
        <div className="flex justify-end gap-1">
          <button className="btn-ghost h-8 w-8 p-0" onClick={() => navigate(`/clientes/${c.id}`)}><IconEye width={16} height={16} /></button>
          <button className="btn-ghost h-8 w-8 p-0" onClick={() => navigate(`/clientes/${c.id}/editar`)}><IconEdit width={16} height={16} /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeader
        title="Clientes"
        breadcrumbs={[{ label: "Comercial" }, { label: "Clientes" }]}
        actions={
          <PrimaryButton icon={<IconPlus width={16} height={16} />} onClick={() => navigate("/clientes/novo")}>
            Novo cliente
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
                <SearchInput
                  placeholder="Buscar por nome, e-mail, CPF ou telefone…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  wrapperClassName="w-full sm:w-72"
                />
                <StatusSelectDropdown
                  value={pais}
                  options={paisFiltroOpcoes}
                  onChange={(v) => {
                    setPais(v);
                    setPage(1);
                  }}
                  className="w-full sm:w-48"
                />
              </div>
              <div className="text-xs text-ink-soft">
                {data ? `${data.total.toLocaleString("pt-BR")} clientes` : ""}
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
                emptyTitle="Nenhum cliente cadastrado"
                emptyDescription="Cadastre seu primeiro cliente para começar."
                emptyAction={
                  <PrimaryButton onClick={() => navigate("/clientes/novo")}>
                    Cadastrar cliente
                  </PrimaryButton>
                }
              />
            )
          }
          footer={
            data ? (
              <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
            ) : null
          }
        />
      </SectionCard>
    </div>
  );
}
