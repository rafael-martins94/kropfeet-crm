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
import { itensEstoqueService, type ItemEstoqueDetalhado } from "../../services/itens-estoque";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import { formatarMoeda } from "../../utils/format";
import type { StatusItem } from "../../types/entities";

const statusOpcoes: Array<{ value: StatusItem | ""; label: string }> = [
  { value: "", label: "Todos os status" },
  { value: "em_estoque", label: "Em estoque" },
  { value: "reservado", label: "Reservado" },
  { value: "vendido", label: "Vendido" },
  { value: "aguardando_chegada", label: "Aguardando chegada" },
  { value: "devolvido", label: "Devolvido" },
  { value: "inativo", label: "Inativo" },
];

export default function ItensEstoqueListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusItem | "">("");
  const searchDebounced = useDebounce(search, 400);

  const { data, loading, error } = useAsync(
    () =>
      itensEstoqueService.listarComRelacoes({
        page,
        pageSize: 25,
        search: searchDebounced,
        status,
      }),
    [page, searchDebounced, status],
  );

  const columns: Column<ItemEstoqueDetalhado>[] = [
    {
      key: "sku",
      header: "SKU",
      width: "140px",
      render: (it) => <span className="font-numeric tabular-nums text-xs">{it.sku}</span>,
    },
    {
      key: "produto",
      header: "Produto",
      render: (it) => (
        <div className="min-w-0">
          <Link
            to={`/itens-estoque/${it.id}`}
            className="block truncate font-medium text-ink hover:text-brand-700"
          >
            {it.nome_completo}
          </Link>
          {it.modelo ? (
            <Link
              to={`/modelos-produto/${it.modelo.id}`}
              className="block truncate text-xs text-ink-soft hover:text-brand-600"
            >
              {it.modelo.nome_modelo}
            </Link>
          ) : null}
        </div>
      ),
    },
    {
      key: "numeracao",
      header: "Numeração",
      width: "110px",
      render: (it) => (
        <span className="text-ink-muted">
          {it.numeracao_br
            ? `BR ${it.numeracao_br}`
            : it.numeracao_eu
              ? `EU ${it.numeracao_eu}`
              : it.numeracao_us
                ? `US ${it.numeracao_us}`
                : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "130px",
      render: (it) => <StatusBadge value={it.status_item} />,
    },
    {
      key: "condicao",
      header: "Condição",
      width: "110px",
      render: (it) => <StatusBadge value={it.condicao_item} />,
    },
    {
      key: "local",
      header: "Local",
      render: (it) => (
        <span className="text-ink-soft">
          {it.local ? `${it.local.codigo} · ${it.local.nome}` : "—"}
        </span>
      ),
    },
    {
      key: "preco",
      header: "Preço sugerido",
      width: "150px",
      className: "text-right",
      render: (it) => (
        <span className="font-numeric tabular-nums text-xs">
          {formatarMoeda(it.preco_sugerido_real, "BRL")}
        </span>
      ),
    },
    {
      key: "acoes",
      header: <span className="sr-only">Ações</span>,
      width: "96px",
      className: "text-right",
      render: (it) => (
        <div className="flex justify-end gap-1">
          <button className="btn-ghost h-8 w-8 p-0" onClick={() => navigate(`/itens-estoque/${it.id}`)}><IconEye width={16} height={16} /></button>
          <button className="btn-ghost h-8 w-8 p-0" onClick={() => navigate(`/itens-estoque/${it.id}/editar`)}><IconEdit width={16} height={16} /></button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Itens de estoque"
        description="Cada linha representa um par físico único, com SKU, numeração e controle unitário."
        breadcrumbs={[{ label: "Catálogo" }, { label: "Itens de estoque" }]}
        actions={
          <PrimaryButton
            icon={<IconPlus width={16} height={16} />}
            onClick={() => navigate("/itens-estoque/novo")}
          >
            Novo item
          </PrimaryButton>
        }
      />

      <SectionCard noPadding>
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:max-w-2xl">
            <SearchInput
              placeholder="Buscar por SKU, nome completo, código…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              wrapperClassName="w-full sm:max-w-sm"
            />
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as StatusItem | "");
                setPage(1);
              }}
              className="input-base w-full sm:w-52"
            >
              {statusOpcoes.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="text-xs text-ink-soft">
            {data ? `${data.total.toLocaleString("pt-BR")} itens` : ""}
          </div>
        </div>

        {error ? (
          <div className="p-5 text-sm text-red-700">Erro: {error.message}</div>
        ) : (
          <DataTable
            columns={columns}
            rows={data?.data ?? []}
            rowKey={(it) => it.id}
            loading={loading}
            emptyTitle="Nenhum item encontrado"
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
