import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DataTable, type Column } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { DangerButton, PrimaryButton, SecondaryButton } from "../../components/PrimaryButton";
import { SearchInput } from "../../components/SearchInput";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { IconEdit, IconEye, IconShoe, IconTrash } from "../../components/Icons";
import { categoriasService } from "../../services/categorias";
import {
  modelosProdutoService,
  type ModeloProdutoDetalhado,
} from "../../services/modelos-produto";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import { formatarDataHora } from "../../utils/format";
import { CategoriaFormModal } from "./CategoriaFormModal";

export default function CategoriaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [modalAberto, setModalAberto] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const searchDebounced = useDebounce(search, 400);

  const { data, loading, error, reload } = useAsync(
    () => (id ? categoriasService.obter(id) : Promise.resolve(null)),
    [id],
  );

  const tenis = useAsync(
    () =>
      id
        ? modelosProdutoService.listarComRelacoes({
            page,
            pageSize: 10,
            search: searchDebounced,
            idCategoria: id,
          })
        : Promise.resolve(null),
    [id, page, searchDebounced],
  );

  const handleDelete = async () => {
    if (!id || !data) return;
    if (!window.confirm(`Excluir a categoria "${data.nome}"?`)) return;
    try {
      await categoriasService.deletar(id);
      navigate("/categorias");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao excluir.");
    }
  };

  const columns: Column<ModeloProdutoDetalhado>[] = [
    {
      key: "nome",
      header: "Modelo",
      render: (m) => (
        <div className="min-w-0">
          <Link
            to={`/modelos-produto/${m.id}`}
            className="block truncate font-medium text-ink hover:text-brand-700"
          >
            {m.nome_modelo}
          </Link>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-soft">
            <span className="truncate">{m.slug}</span>
            {m.cor ? (
              <>
                <span className="h-1 w-1 flex-shrink-0 rounded-full bg-line" />
                <span className="truncate">{m.cor}</span>
              </>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: "marca",
      header: "Marca",
      width: "160px",
      render: (m) => <span className="text-ink-muted">{m.marca?.nome ?? "—"}</span>,
    },
    {
      key: "codigo",
      header: "Referência",
      width: "150px",
      render: (m) => (
        <span className="font-numeric tabular-nums text-xs text-ink-soft">
          {m.codigo_referencia ?? m.codigo_fabricante ?? "—"}
        </span>
      ),
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
      width: "60px",
      className: "text-right",
      render: (m) => (
        <button
          className="btn-ghost h-8 w-8 p-0"
          onClick={() => navigate(`/modelos-produto/${m.id}`)}
          title="Ver modelo"
        >
          <IconEye width={16} height={16} />
        </button>
      ),
    },
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        title={data?.nome ?? "Categoria"}
        breadcrumbs={[
          { label: "Catálogo" },
          { label: "Categorias", to: "/categorias" },
          { label: data?.nome ?? "…" },
        ]}
        backTo="/categorias"
        actions={
          data ? (
            <>
              <SecondaryButton
                icon={<IconEdit width={16} height={16} />}
                onClick={() => setModalAberto(true)}
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

      {loading ? (
        <SectionCard>
          <div className="text-sm text-ink-soft">Carregando…</div>
        </SectionCard>
      ) : error ? (
        <SectionCard>
          <div className="text-sm text-red-700">Erro: {error.message}</div>
        </SectionCard>
      ) : !data ? (
        <SectionCard>
          <div className="text-sm text-ink-soft">Categoria não encontrada.</div>
          <div className="mt-4">
            <PrimaryButton onClick={() => navigate("/categorias")}>Voltar</PrimaryButton>
          </div>
        </SectionCard>
      ) : (
        <div className="space-y-6">
          <SectionCard>
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <Field label="Nome" value={data.nome} />
              <Field label="Criado em" value={formatarDataHora(data.criado_em)} />
              <Field label="ID" value={data.id} mono />
            </dl>
          </SectionCard>

          <SectionCard title="Tênis nesta categoria" noPadding>
            <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <SearchInput
                placeholder="Buscar por nome, slug, referência, cor…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                wrapperClassName="w-full sm:max-w-sm"
              />
            </div>

            {tenis.error ? (
              <div className="p-5 text-sm text-red-700">Erro: {tenis.error.message}</div>
            ) : (
              <DataTable
                columns={columns}
                rows={tenis.data?.data ?? []}
                rowKey={(m) => m.id}
                loading={tenis.loading}
                emptyTitle="Nenhum tênis nesta categoria"
                emptyDescription="Os modelos cadastrados com esta categoria aparecerão aqui."
                emptyAction={
                  <PrimaryButton
                    icon={<IconShoe width={16} height={16} />}
                    onClick={() => navigate("/modelos-produto/novo")}
                  >
                    Cadastrar modelo
                  </PrimaryButton>
                }
              />
            )}

            {tenis.data && tenis.data.total > 0 ? (
              <Pagination
                page={tenis.data.page}
                pageSize={tenis.data.pageSize}
                total={tenis.data.total}
                onPageChange={setPage}
              />
            ) : null}
          </SectionCard>
        </div>
      )}

      <CategoriaFormModal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        categoria={data ?? null}
        onSaved={() => reload()}
      />
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
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
