import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "../../components/EmptyState";
import { GaleriaImagensLightbox } from "../../components/imagens/GaleriaImagensLightbox";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { ScrollableListShell } from "../../components/ScrollableListShell";
import { SearchInput } from "../../components/SearchInput";
import { SearchableSelectDropdown } from "../../components/SearchableSelectDropdown";
import { SectionCard } from "../../components/SectionCard";
import { categoriasService } from "../../services/categorias";
import { imagensService } from "../../services/imagens";
import { FILTRO_CATEGORIA_SEM } from "../../services/itens-estoque";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import { urlImagemModelo } from "../../utils/imagemModelo";

export default function ImagensListPage() {
  const [page, setPage] = useState(1);
  const [apenasPrincipais, setApenasPrincipais] = useState(true);
  const [search, setSearch] = useState("");
  const [categoriaIds, setCategoriaIds] = useState<string[]>([]);
  const [lightboxIndice, setLightboxIndice] = useState<number | null>(null);

  const searchDebounced = useDebounce(search, 400);

  const categoriasLista = useAsync(() => categoriasService.listarTodas(), []);

  const opcoesCategoriaFiltro = useMemo(
    () => [
      { value: FILTRO_CATEGORIA_SEM, label: "Sem categoria" },
      ...(categoriasLista.data ?? []).map((c) => ({ value: c.id, label: c.nome })),
    ],
    [categoriasLista.data],
  );

  const { data, loading, error } = useAsync(
    () =>
      imagensService.listar({
        page,
        pageSize: 24,
        apenasPrincipais,
        search: searchDebounced,
        categoriaIds,
      }),
    [page, apenasPrincipais, searchDebounced, categoriaIds],
  );

  const resetPage = () => setPage(1);

  useEffect(() => {
    setLightboxIndice(null);
  }, [page, searchDebounced, categoriaIds, apenasPrincipais]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeader
        title="Galeria de imagens"
        breadcrumbs={[{ label: "Catálogo" }, { label: "Imagens" }]}
      />

      <SectionCard
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
        actions={
          <div className="grid w-full min-w-0 grid-cols-1 items-center gap-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto]">
            <SearchInput
              placeholder="Buscar por nome do modelo…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                resetPage();
              }}
              wrapperClassName="w-full min-w-0"
            />
            <SearchableSelectDropdown
              multiple
              value={categoriaIds}
              options={opcoesCategoriaFiltro}
              emptyLabel="Todas as categorias"
              loading={categoriasLista.loading}
              searchPlaceholder="Buscar categoria…"
              triggerClassName="w-full min-w-0"
              onChange={(v) => {
                setCategoriaIds(v);
                resetPage();
              }}
              className="w-full min-w-0"
            />
            <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-ink-soft sm:justify-self-end">
              <input
                type="checkbox"
                checked={apenasPrincipais}
                onChange={(e) => {
                  setApenasPrincipais(e.target.checked);
                  resetPage();
                }}
                className="h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-500"
              />
              Apenas principais
            </label>
          </div>
        }
      >
        {loading ? (
          <LoadingState />
        ) : error ? (
          <div className="p-5 text-sm text-red-700">Erro: {error.message}</div>
        ) : !data || data.data.length === 0 ? (
          <EmptyState title="Nenhuma imagem encontrada" />
        ) : (
          <ScrollableListShell
            body={
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {data.data.map((img, index) => {
                  const src = urlImagemModelo(img) ?? "";
                  const nome = img.modelo?.nome_modelo ?? "—";
                  return (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => setLightboxIndice(index)}
                      className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface-alt text-left transition hover:border-brand-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                    >
                      <div className="relative aspect-square overflow-hidden bg-surface-subtle">
                        {src ? (
                          <img
                            src={src}
                            alt={nome}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-ink-faint">
                            sem imagem
                          </div>
                        )}
                        {img.imagem_principal ? (
                          <span className="absolute left-2 top-2 rounded-full bg-brand-700/90 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white shadow-sm">
                            Principal
                          </span>
                        ) : null}
                      </div>
                      <p className="line-clamp-2 px-2 py-2 text-xs font-medium leading-snug text-ink">
                        {nome}
                      </p>
                    </button>
                  );
                })}
              </div>
            }
            footer={
              <Pagination
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPageChange={setPage}
              />
            }
          />
        )}
      </SectionCard>

      {lightboxIndice !== null && data ? (
        <GaleriaImagensLightbox
          imagens={data.data}
          indice={lightboxIndice}
          onClose={() => setLightboxIndice(null)}
          onIndiceChange={setLightboxIndice}
        />
      ) : null}
    </div>
  );
}
