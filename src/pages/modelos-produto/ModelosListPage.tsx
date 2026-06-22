import { Link, useNavigate } from "react-router-dom";
import { DataTable, type Column } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { PrimaryButton } from "../../components/PrimaryButton";
import { SearchInput } from "../../components/SearchInput";
import { SearchableSelectDropdown } from "../../components/SearchableSelectDropdown";
import { ScrollableListShell } from "../../components/ScrollableListShell";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { IconEdit, IconEye, IconPlus } from "../../components/Icons";
import { modelosProdutoService, type ModeloProdutoDetalhado } from "../../services/modelos-produto";
import { useAsync } from "../../hooks/useAsync";
import { useListDetailNavigation } from "../../hooks/useListDetailNavigation";
import { useModelosProdutoFiltros } from "../../hooks/useModelosProdutoFiltros";
import { formatarDataHora } from "../../utils/format";
import { cn } from "../../utils/cn";

export default function ModelosListPage() {
  const navigate = useNavigate();
  const filtros = useModelosProdutoFiltros();
  const { toDetail } = useListDetailNavigation();
  const linkModelo = (path: string) => toDetail(path);

  const { data, loading, error } = useAsync(
    () =>
      modelosProdutoService.listarComRelacoes({
        page: filtros.page,
        pageSize: 20,
        ...filtros.paramsListagem,
      }),
    [filtros.page, filtros.paramsListagem],
  );

  const columns: Column<ModeloProdutoDetalhado>[] = [
    {
      key: "nome",
      header: "Modelo",
      render: (m) => {
        const detalhe = linkModelo(`/modelos-produto/${m.id}`);
        return (
        <div className="min-w-0">
          <Link
            to={detalhe.to}
            state={detalhe.options?.state}
            className="block truncate font-medium text-ink hover:text-brand-700"
          >
            {m.nome_modelo}
          </Link>
          {m.cor ? (
            <p className="mt-0.5 truncate text-xs text-ink-soft">{m.cor}</p>
          ) : null}
        </div>
        );
      },
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
      header: "Cód. fabricante",
      width: "150px",
      render: (m) => (
        <span className="font-numeric tabular-nums text-xs text-ink-soft">
          {m.codigo_fabricante ?? "—"}
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
      render: (m) => {
        const detalhe = linkModelo(`/modelos-produto/${m.id}`);
        const editar = linkModelo(`/modelos-produto/${m.id}/editar`);
        return (
        <div className="flex justify-end gap-1">
          <button className="btn-ghost h-8 w-8 p-0" onClick={() => navigate(detalhe.to, detalhe.options)}><IconEye width={16} height={16} /></button>
          <button className="btn-ghost h-8 w-8 p-0" onClick={() => navigate(editar.to, editar.options)}><IconEdit width={16} height={16} /></button>
        </div>
        );
      },
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
            <div className="border-b border-line px-5 py-4">
              <div
                className={cn(
                  "grid min-w-0 items-end gap-x-3 gap-y-4",
                  "[grid-template-columns:repeat(auto-fit,minmax(10rem,1fr))]",
                  "lg:[grid-template-columns:minmax(0,2.1fr)_minmax(0,1.05fr)_minmax(0,1.05fr)_auto]",
                )}
              >
                <SearchInput
                  placeholder="Buscar por nome, slug, código, cor…"
                  value={filtros.search}
                  onChange={(e) => {
                    filtros.setSearch(e.target.value);
                  }}
                  wrapperClassName="min-w-0 w-full"
                />
                <SearchableSelectDropdown
                  label="Marca"
                  value={filtros.idMarca}
                  options={filtros.opcoesMarca}
                  emptyLabel="Todas as marcas"
                  loading={filtros.marcas.loading}
                  searchPlaceholder="Buscar marca…"
                  triggerClassName="w-full min-w-0"
                  className="min-w-0 w-full"
                  onChange={filtros.setIdMarca}
                />
                <SearchableSelectDropdown
                  label="Categoria"
                  value={filtros.idCategoria}
                  options={filtros.opcoesCategoria}
                  emptyLabel="Todas as categorias"
                  loading={filtros.categorias.loading}
                  searchPlaceholder="Buscar categoria…"
                  triggerClassName="w-full min-w-0"
                  className="min-w-0 w-full"
                  onChange={filtros.setIdCategoria}
                />
                <div className="flex items-end justify-end pb-2 text-xs text-ink-soft lg:pb-0 lg:pl-2">
                  {data ? `${data.total.toLocaleString("pt-BR")} modelos` : ""}
                </div>
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
                onPageChange={filtros.setPage}
              />
            ) : null
          }
        />
      </SectionCard>
    </div>
  );
}
