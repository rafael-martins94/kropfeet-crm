import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DataTable, type Column } from "../../components/DataTable";
import { EntityLink } from "../../components/EntityLink";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { DangerButton, SecondaryButton } from "../../components/PrimaryButton";
import { SearchInput } from "../../components/SearchInput";
import { ScrollableListShell } from "../../components/ScrollableListShell";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { IconEdit, IconEye, IconImage, IconTrash } from "../../components/Icons";
import { EmptyState } from "../../components/EmptyState";
import { modelosProdutoService } from "../../services/modelos-produto";
import { marcasService } from "../../services/marcas";
import { categoriasService } from "../../services/categorias";
import { itensEstoqueService, type ItemEstoqueDetalhado } from "../../services/itens-estoque";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import { useListReturnTo } from "../../hooks/useListDetailNavigation";
import { formatarDataHora, traduzirEnum } from "../../utils/format";
import { formatSizeLabel, getAllSizeEquivalences, getUsDisplayLabel } from "../../utils/sizeConversion";

export default function ModeloDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const returnToLista = useListReturnTo("/modelos-produto");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const searchDebounced = useDebounce(search, 300);

  const modelo = useAsync(
    () => (id ? modelosProdutoService.obter(id) : Promise.resolve(null)),
    [id],
  );
  const imagens = useAsync(
    () => (id ? modelosProdutoService.obterImagens(id) : Promise.resolve([])),
    [id],
  );
  const marca = useAsync(
    () =>
      modelo.data?.id_marca
        ? marcasService.obter(modelo.data.id_marca)
        : Promise.resolve(null),
    [modelo.data?.id_marca],
  );
  const categoria = useAsync(
    () =>
      modelo.data?.id_categoria
        ? categoriasService.obter(modelo.data.id_categoria)
        : Promise.resolve(null),
    [modelo.data?.id_categoria],
  );
  const itens = useAsync(
    () =>
      id
        ? itensEstoqueService.listarComRelacoes({
            page,
            pageSize: 20,
            search: searchDebounced,
            idModeloProduto: id,
            ordenacao: { coluna: "sku", ascendente: true },
          })
        : Promise.resolve(null),
    [id, page, searchDebounced],
  );

  const colunasItens: Column<ItemEstoqueDetalhado>[] = [
    {
      key: "sku",
      header: "SKU",
      width: "88px",
      render: (item) => (
        <EntityLink
          to={`/itens-estoque/${item.id}`}
          appearance="plain"
          className="font-numeric text-sm font-medium tabular-nums"
        >
          {item.sku}
        </EntityLink>
      ),
    },
    {
      key: "numeracao",
      header: "Numeração",
      render: (item) => {
        const eq = getAllSizeEquivalences(item);
        return (
          <span className="font-numeric text-sm tabular-nums text-ink-muted">
            {[formatSizeLabel(eq.br, "br"), formatSizeLabel(eq.eu, "eu"), getUsDisplayLabel(item)]
              .filter((parte) => parte && parte !== "—")
              .join(" · ") || "—"}
          </span>
        );
      },
    },
    {
      key: "local",
      header: "Local",
      render: (item) => (
        <span className="text-sm text-ink-soft">{item.local?.nome ?? "—"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "150px",
      render: (item) => <StatusBadge value={item.status_item} />,
    },
    {
      key: "acoes",
      header: <span className="sr-only">Ações</span>,
      width: "56px",
      className: "text-right",
      render: (item) => (
        <button
          type="button"
          className="btn-ghost h-8 w-8 p-0"
          title="Abrir item"
          onClick={() => navigate(`/itens-estoque/${item.id}`)}
        >
          <IconEye width={16} height={16} />
        </button>
      ),
    },
  ];

  const handleDelete = async () => {
    if (!id || !modelo.data) return;
    if (!window.confirm(`Excluir modelo "${modelo.data.nome_modelo}"?`)) return;
    try {
      await modelosProdutoService.deletar(id);
      navigate(returnToLista);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao excluir.");
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        title={modelo.data?.nome_modelo ?? "Modelo"}
        breadcrumbs={[
          { label: "Catálogo" },
          { label: "Modelos", to: returnToLista },
          { label: modelo.data?.nome_modelo ?? "…" },
        ]}
        backTo={returnToLista}
        actions={
          modelo.data ? (
            <>
              <SecondaryButton
                icon={<IconEdit width={16} height={16} />}
                onClick={() =>
                  navigate(`/modelos-produto/${modelo.data!.id}/editar`, {
                    state: { returnTo: returnToLista },
                  })
                }
              >
                Editar
              </SecondaryButton>
              <DangerButton
                icon={<IconTrash width={16} height={16} />}
                onClick={handleDelete}
              >
                Excluir
              </DangerButton>
            </>
          ) : null
        }
      />

      {modelo.loading ? (
        <SectionCard><div className="text-sm text-ink-soft">Carregando…</div></SectionCard>
      ) : !modelo.data ? (
        <SectionCard><div className="text-sm text-ink-soft">Modelo não encontrado.</div></SectionCard>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <SectionCard
              title="Identificação"
              actions={<StatusBadge value={modelo.data.ativo ? "ativo" : "inativo"} />}
            >
              <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Nome" value={modelo.data.nome_modelo} />
                <Field
                  label="Marca"
                  value={
                    marca.data ? (
                      <EntityLink to={`/marcas/${marca.data.id}`}>{marca.data.nome}</EntityLink>
                    ) : (
                      "—"
                    )
                  }
                />
                <Field
                  label="Categoria"
                  value={
                    categoria.data ? (
                      <EntityLink to={`/categorias/${categoria.data.id}`}>
                        {categoria.data.nome}
                      </EntityLink>
                    ) : (
                      "—"
                    )
                  }
                />
                <Field label="Cor" value={modelo.data.cor ?? "—"} />
                <Field
                  label="Código do fornecedor"
                  value={modelo.data.codigo_fornecedor ?? "—"}
                  mono
                />
                <Field label="Origem do cadastro" value={<StatusBadge value={modelo.data.origem_cadastro} />} />
                <Field label="ID Tiny (pai)" value={modelo.data.id_tiny_pai ?? "—"} mono />
              </dl>
            </SectionCard>

            {modelo.data.descricao ? (
              <SectionCard title="Descrição">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                  {modelo.data.descricao}
                </p>
              </SectionCard>
            ) : null}
          </div>

          <div className="space-y-6">
            <SectionCard title="Imagens" noPadding>
              {imagens.loading ? (
                <div className="p-5 text-sm text-ink-soft">Carregando imagens…</div>
              ) : (imagens.data ?? []).length === 0 ? (
                <EmptyState
                  icon={<IconImage />}
                  title="Sem imagens"
                  description="Este modelo ainda não possui imagens cadastradas."
                />
              ) : (
                <div className="grid grid-cols-2 gap-2 p-3">
                  {(imagens.data ?? []).map((img) => {
                    const src = img.url_origem ?? img.caminho_arquivo ?? "";
                    return (
                      <div
                        key={img.id}
                        className="group relative overflow-hidden rounded-lg border border-line bg-surface-subtle aspect-square"
                      >
                        {src ? (
                          <img
                            src={src}
                            alt={modelo.data!.nome_modelo}
                            loading="lazy"
                            className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                            }}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-ink-faint">
                            <IconImage />
                          </div>
                        )}
                        {img.imagem_principal ? (
                          <span className="absolute left-2 top-2 rounded-full bg-accent-300/90 px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wider text-brand-700">
                            Principal
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </div>
        </div>

        <SectionCard
          title="Itens de estoque"
          noPadding
          className="flex min-h-0 flex-col overflow-hidden"
          bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <ScrollableListShell
            toolbar={
              <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <SearchInput
                  placeholder="Buscar por SKU…"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  wrapperClassName="w-full sm:max-w-sm"
                />
                <div className="text-xs text-ink-soft">
                  {itens.data ? `${itens.data.total.toLocaleString("pt-BR")} item(ns)` : ""}
                </div>
              </div>
            }
            body={
              itens.error ? (
                <div className="p-5 text-sm text-red-700">Erro: {itens.error.message}</div>
              ) : (
                <DataTable
                  columns={colunasItens}
                  rows={itens.data?.data ?? []}
                  rowKey={(item) => item.id}
                  loading={itens.loading}
                  emptyTitle="Nenhum item deste modelo"
                  emptyDescription="Os pares de estoque vinculados a este modelo aparecem aqui, com o status de cada um."
                  onRowClick={(item) => navigate(`/itens-estoque/${item.id}`)}
                  rowClassName={() => "cursor-pointer"}
                />
              )
            }
            footer={
              itens.data && itens.data.total > 0 ? (
                <Pagination
                  page={itens.data.page}
                  pageSize={itens.data.pageSize}
                  total={itens.data.total}
                  onPageChange={setPage}
                />
              ) : null
            }
          />
        </SectionCard>

        <SectionCard title="Auditoria">
          <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Criado em" value={formatarDataHora(modelo.data.criado_em)} />
            <Field label="Atualizado em" value={formatarDataHora(modelo.data.atualizado_em)} />
            <Field label="ID interno" value={modelo.data.id} mono />
            <Field label="Origem" value={traduzirEnum(modelo.data.origem_cadastro)} />
          </dl>
        </SectionCard>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">
        {label}
      </dt>
      <dd className={`mt-1 text-sm text-ink ${mono ? "font-numeric tabular-nums text-xs break-all" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
