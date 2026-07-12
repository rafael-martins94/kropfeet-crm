import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DataTable, type Column } from "../../components/DataTable";
import { EntityLink } from "../../components/EntityLink";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { SearchInput } from "../../components/SearchInput";
import { SearchableSelectDropdown } from "../../components/SearchableSelectDropdown";
import { ScrollableListShell } from "../../components/ScrollableListShell";
import { SectionCard } from "../../components/SectionCard";
import { useToast } from "../../contexts/ToastContext";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import { categoriasService } from "../../services/categorias";
import {
  modelosProdutoService,
  type ModeloProdutoDetalhado,
} from "../../services/modelos-produto";
import { mensagemErro } from "../../utils/errors";

const SEM_CATEGORIA = "";

export default function CategoriasAjustePage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const searchDebounced = useDebounce(search, 300);
  const [filtroCategoria, setFiltroCategoria] = useState<string>("");
  const [valoresLocais, setValoresLocais] = useState<Record<string, string>>({});
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  const categorias = useAsync(() => categoriasService.listarTodas(), []);
  const modelos = useAsync(
    () =>
      modelosProdutoService.listarComRelacoes({
        page,
        pageSize: 40,
        search: searchDebounced,
        idCategoria: filtroCategoria || undefined,
        orderBy: "nome_modelo",
        ascending: true,
      }),
    [page, searchDebounced, filtroCategoria],
  );

  useEffect(() => {
    const mapa: Record<string, string> = {};
    for (const m of modelos.data?.data ?? []) {
      mapa[m.id] = m.id_categoria ?? SEM_CATEGORIA;
    }
    setValoresLocais(mapa);
  }, [modelos.data]);

  const opcoesCategoria = useMemo(
    () =>
      [...(categorias.data ?? [])]
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }))
        .map((c) => ({ value: c.id, label: c.nome })),
    [categorias.data],
  );

  const opcoesCategoriaComVazio = useMemo(
    () => [{ value: SEM_CATEGORIA, label: "— Sem categoria —" }, ...opcoesCategoria],
    [opcoesCategoria],
  );

  const opcoesFiltro = useMemo(
    () => [{ value: "", label: "Todas as categorias" }, ...opcoesCategoria],
    [opcoesCategoria],
  );

  const alterarCategoria = async (modelo: ModeloProdutoDetalhado, novoId: string) => {
    const anterior = valoresLocais[modelo.id] ?? modelo.id_categoria ?? SEM_CATEGORIA;
    if (novoId === anterior) return;

    setValoresLocais((prev) => ({ ...prev, [modelo.id]: novoId }));
    setSalvandoId(modelo.id);
    try {
      await modelosProdutoService.atualizar(modelo.id, {
        id_categoria: novoId || null,
      });
      toast.sucesso(
        novoId
          ? `Categoria de “${modelo.nome_modelo}” atualizada.`
          : `Categoria removida de “${modelo.nome_modelo}”.`,
      );
    } catch (error) {
      setValoresLocais((prev) => ({ ...prev, [modelo.id]: anterior }));
      toast.erro(mensagemErro(error));
    } finally {
      setSalvandoId(null);
    }
  };

  const columns: Column<ModeloProdutoDetalhado>[] = [
    {
      key: "modelo",
      header: "Modelo",
      render: (m) => (
        <div className="min-w-0">
          <EntityLink
            to={`/modelos-produto/${m.id}`}
            appearance="plain"
            className="font-medium"
          >
            {m.nome_modelo}
          </EntityLink>
          {m.marca?.nome ? (
            <p className="truncate text-xs text-ink-soft">{m.marca.nome}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "categoria",
      header: "Categoria",
      width: "280px",
      render: (m) => {
        const valor = valoresLocais[m.id] ?? m.id_categoria ?? SEM_CATEGORIA;
        const salvando = salvandoId === m.id;
        return (
          <SearchableSelectDropdown
            value={valor}
            onChange={(v) => void alterarCategoria(m, v)}
            options={opcoesCategoriaComVazio}
            loading={categorias.loading}
            disabled={salvando}
            emptyLabel="— Sem categoria —"
            searchPlaceholder="Buscar categoria…"
            className="w-full min-w-[12rem]"
            triggerClassName="py-2 text-sm"
          />
        );
      },
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeader
        title="Ajustar categorias"
        breadcrumbs={[
          { label: "Catálogo" },
          { label: "Categorias", to: "/categorias" },
          { label: "Ajustar" },
        ]}
        backTo="/categorias"
      />

      <p className="-mt-3 mb-1 text-sm text-ink-soft">
        Altere a categoria de cada modelo pelo dropdown — a mudança é salva na hora.
      </p>

      <SectionCard
        noPadding
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <ScrollableListShell
          toolbar={
            <div className="flex flex-col gap-3 border-b border-line px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                <SearchInput
                  placeholder="Buscar modelo…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  wrapperClassName="w-full sm:max-w-xs"
                />
                <SearchableSelectDropdown
                  value={filtroCategoria}
                  onChange={(v) => {
                    setFiltroCategoria(v);
                    setPage(1);
                  }}
                  options={opcoesFiltro}
                  loading={categorias.loading}
                  emptyLabel="Todas as categorias"
                  searchPlaceholder="Filtrar categoria…"
                  className="w-full min-w-[14rem] sm:w-auto"
                  triggerClassName="py-2 text-sm"
                />
              </div>
              <div className="text-xs text-ink-soft">
                {modelos.data
                  ? `${modelos.data.total.toLocaleString("pt-BR")} modelos`
                  : ""}
                {" · "}
                <Link to="/categorias" className="font-medium text-brand-700 hover:underline">
                  Voltar às categorias
                </Link>
              </div>
            </div>
          }
          body={
            modelos.error ? (
              <div className="p-5 text-sm text-red-700">Erro: {modelos.error.message}</div>
            ) : (
              <DataTable
                columns={columns}
                rows={modelos.data?.data ?? []}
                rowKey={(m) => m.id}
                loading={modelos.loading}
                emptyTitle="Nenhum modelo encontrado"
              />
            )
          }
          footer={
            modelos.data ? (
              <Pagination
                page={modelos.data.page}
                pageSize={modelos.data.pageSize}
                total={modelos.data.total}
                onPageChange={setPage}
              />
            ) : null
          }
        />
      </SectionCard>
    </div>
  );
}
