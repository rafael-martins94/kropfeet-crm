import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DataTable, type Column } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { DangerButton, SecondaryButton } from "../../components/PrimaryButton";
import { SearchInput } from "../../components/SearchInput";
import { ScrollableListShell } from "../../components/ScrollableListShell";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { IconEdit, IconEye, IconTrash } from "../../components/Icons";
import {
  itensEstoqueService,
  type ItemEstoqueDetalhado,
} from "../../services/itens-estoque";
import { locaisEstoqueService } from "../../services/locais-estoque";
import { modelosProdutoService } from "../../services/modelos-produto";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import { formatarDataHora } from "../../utils/format";
import {
  formatSizeLabel,
  getAllSizeEquivalences,
  getUsDisplayLabel,
} from "../../utils/sizeConversion";

function FotoProdutoMini({
  url,
  nome,
  to,
}: {
  url: string | null | undefined;
  nome: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="inline-flex shrink-0"
      title={nome}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-surface-subtle">
        {url ? (
          <img src={url} alt="" className="h-full w-full object-contain" loading="lazy" />
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
        )}
      </span>
    </Link>
  );
}

export default function LocalEstoqueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const searchDebounced = useDebounce(search, 400);

  const { data, loading } = useAsync(
    () => (id ? locaisEstoqueService.obter(id) : Promise.resolve(null)),
    [id],
  );

  const itens = useAsync(
    () =>
      id
        ? itensEstoqueService.listarComRelacoes({
            page,
            pageSize: 20,
            search: searchDebounced,
            idLocalEstoque: id,
          })
        : Promise.resolve(null),
    [id, page, searchDebounced],
  );

  const thumbs = useAsync(() => modelosProdutoService.listarUrlsPrincipaisPorModelo(), []);

  const handleDelete = async () => {
    if (!id || !data) return;
    if (!window.confirm(`Excluir local "${data.nome}"?`)) return;
    try {
      await locaisEstoqueService.deletar(id);
      navigate("/locais-estoque");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao excluir.");
    }
  };

  const columns: Column<ItemEstoqueDetalhado>[] = [
    {
      key: "foto",
      header: <span className="sr-only">Foto</span>,
      headerClassName: "w-[4.5rem] px-2",
      width: "72px",
      className: "w-[4.5rem] shrink-0 px-2 align-middle",
      render: (it) => (
        <FotoProdutoMini
          url={it.id_modelo_produto ? thumbs.data?.[it.id_modelo_produto] : null}
          nome={it.nome_produto}
          to={`/itens-estoque/${it.id}`}
        />
      ),
    },
    {
      key: "sku",
      header: "SKU",
      width: "88px",
      className: "w-[5.5rem] shrink-0 px-2",
      render: (it) => (
        <span className="block truncate font-numeric tabular-nums text-xs">{it.sku}</span>
      ),
    },
    {
      key: "produto",
      header: "Produto",
      render: (it) => (
        <Link
          to={`/itens-estoque/${it.id}`}
          className="block truncate text-sm font-medium text-ink hover:text-brand-700"
          title={it.nome_produto}
        >
          {it.nome_produto}
        </Link>
      ),
    },
    {
      key: "numeracao",
      header: "NUM",
      width: "96px",
      render: (it) => {
        const eq = getAllSizeEquivalences(it);
        return (
          <span className="font-numeric text-sm tabular-nums text-ink-muted">
            {formatSizeLabel(eq.br, "br")}
          </span>
        );
      },
    },
    {
      key: "us",
      header: "US",
      width: "88px",
      render: (it) => (
        <span className="font-numeric text-sm tabular-nums text-ink-muted">
          {getUsDisplayLabel(it)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "140px",
      render: (it) => <StatusBadge value={it.status_item} />,
    },
    {
      key: "acoes",
      header: <span className="sr-only">Ações</span>,
      width: "56px",
      className: "text-right",
      render: (it) => (
        <button
          type="button"
          className="btn-ghost h-8 w-8 p-0"
          onClick={() => navigate(`/itens-estoque/${it.id}`)}
          title="Ver item"
        >
          <IconEye width={16} height={16} />
        </button>
      ),
    },
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        title={data?.nome ?? "Local"}
        breadcrumbs={[
          { label: "Operação" },
          { label: "Locais de estoque", to: "/locais-estoque" },
          { label: data?.nome ?? "…" },
        ]}
        backTo="/locais-estoque"
        actions={
          data ? (
            <>
              <SecondaryButton
                icon={<IconEdit width={16} height={16} />}
                onClick={() => navigate(`/locais-estoque/${data.id}/editar`)}
              >
                Editar
              </SecondaryButton>
              <DangerButton icon={<IconTrash width={16} height={16} />} onClick={handleDelete}>
                Excluir
              </DangerButton>
            </>
          ) : null
        }
      />

      {loading ? (
        <SectionCard><div className="text-sm text-ink-soft">Carregando…</div></SectionCard>
      ) : !data ? (
        <SectionCard><div className="text-sm text-ink-soft">Local não encontrado.</div></SectionCard>
      ) : (
        <div className="space-y-6">
          <SectionCard title="Informações do local">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Código" value={data.codigo} mono />
              <Field label="Nome" value={data.nome} />
              <Field label="Região" value={<StatusBadge value={data.tipo_regiao} />} />
              <Field label="País" value={data.pais ?? "—"} />
              <Field label="Status" value={<StatusBadge value={data.ativo ? "ativo" : "inativo"} />} />
              <Field label="Criado em" value={formatarDataHora(data.criado_em)} />
              <Field label="ID" value={data.id} mono />
            </dl>
          </SectionCard>

          <SectionCard
            title="Itens neste local"
            noPadding
            className="flex min-h-0 flex-col overflow-hidden"
            bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <ScrollableListShell
              toolbar={
                <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <SearchInput
                    placeholder="Buscar por SKU, produto ou código…"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
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
                    columns={columns}
                    rows={itens.data?.data ?? []}
                    rowKey={(it) => it.id}
                    loading={itens.loading}
                    emptyTitle="Nenhum item neste local"
                    emptyDescription="Os itens de estoque vinculados a este local aparecerão aqui."
                    onRowClick={(it) => navigate(`/itens-estoque/${it.id}`)}
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
