import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState";
import { GaleriaImagensLightbox } from "../../components/imagens/GaleriaImagensLightbox";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { ScrollableListShell } from "../../components/ScrollableListShell";
import { SearchInput } from "../../components/SearchInput";
import { SearchableSelectDropdown } from "../../components/SearchableSelectDropdown";
import { SectionCard } from "../../components/SectionCard";
import { StatusSelectDropdown } from "../../components/StatusSelectDropdown";
import { categoriasService } from "../../services/categorias";
import { modelosProdutoService } from "../../services/modelos-produto";
import { useToast } from "../../contexts/ToastContext";
import { mensagemErro } from "../../utils/errors";
import {
  imagensService,
  type FiltroRegiaoImagens,
  type ImagemDetalhada,
} from "../../services/imagens";
import { StatusItemFilterDropdown } from "../../components/StatusItemFilterDropdown";
import { statusOpcoesFiltro } from "../../components/itens-estoque/itensEstoqueFiltrosConstants";
import type { StatusItem } from "../../types/entities";
import { traduzirEnum } from "../../utils/format";
import { useStateComOrigem } from "../../hooks/useListDetailNavigation";
import type { DisplaySizeSystem } from "../../utils/sizeConversion";

const NOME_REGIAO: Record<string, string> = { brasil: "Brasil", europa: "Europa", outros: "Outros" };
const EXEMPLO_NUMERACAO: Record<DisplaySizeSystem, string> = {
  br: "Numeração BR: 37, 41,5…",
  eu: "Numeração EU: 42, 38,5…",
  us: "Numeração US: 9, 7W, 5Y…",
};
import { FILTRO_CATEGORIA_SEM } from "../../services/itens-estoque";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import { urlImagemModelo } from "../../utils/imagemModelo";

export default function ImagensListPage() {
  const [page, setPage] = useState(1);
  // Um card por modelo (só a foto principal).
  const apenasPrincipais = true;
  const [search, setSearch] = useState("");
  const [categoriaIds, setCategoriaIds] = useState<string[]>([]);
  // Começa em "Em estoque": é o que dá para mostrar a um cliente.
  const [statusFiltro, setStatusFiltro] = useState<StatusItem | "">("em_estoque");
  const status = useMemo<StatusItem[]>(() => (statusFiltro ? [statusFiltro] : []), [statusFiltro]);
  const [regiao, setRegiao] = useState<FiltroRegiaoImagens>("");
  const [numeracao, setNumeracao] = useState("");
  const [padraoNumeracao, setPadraoNumeracao] = useState<DisplaySizeSystem>("br");
  const stateComOrigem = useStateComOrigem();
  // Fotos do modelo clicado: o visualizador navega entre elas, não entre os modelos.
  const [galeria, setGaleria] = useState<{ imagens: ImagemDetalhada[]; indice: number } | null>(null);
  const [abrindoModelo, setAbrindoModelo] = useState<string | null>(null);
  const toast = useToast();

  const searchDebounced = useDebounce(search, 400);
  const numeracaoDebounced = useDebounce(numeracao, 400);
  const filtroEstoqueAtivo = Boolean(status.length > 0 || regiao || numeracaoDebounced.trim());
  const soEmEstoque = status.length === 1 && status[0] === "em_estoque";

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
        status,
        regiao,
        numeracao: numeracaoDebounced,
        padraoNumeracao,
      }),
    [page, apenasPrincipais, searchDebounced, categoriaIds, status, regiao, numeracaoDebounced, padraoNumeracao],
  );

  const abrirFotosDoModelo = async (img: ImagemDetalhada) => {
    setAbrindoModelo(img.id);
    try {
      const fotos = await modelosProdutoService.obterImagens(img.id_modelo_produto);
      const imagens: ImagemDetalhada[] =
        fotos.length > 0
          ? fotos.map((foto) => ({ ...foto, modelo: img.modelo, itensEstoque: img.itensEstoque }) as ImagemDetalhada)
          : [img];
      const indice = Math.max(0, imagens.findIndex((foto) => foto.id === img.id));
      setGaleria({ imagens, indice });
    } catch (falha) {
      toast.erro(mensagemErro(falha));
    } finally {
      setAbrindoModelo(null);
    }
  };

  /** Links para o estoque da imagem: o item (ou os itens) que atendem ao filtro, senão o modelo. */
  const linksEstoque = (img: ImagemDetalhada, tema: "claro" | "escuro") => {
    const classeLink =
      tema === "escuro"
        ? "rounded-full border border-white/20 px-2.5 py-1 text-xs font-medium text-white/90 transition hover:border-brand-300 hover:text-brand-200"
        : "text-[11px] font-semibold text-brand-700 hover:text-brand-800 hover:underline";
    const itens = img.itensEstoque;
    if (!itens) {
      return img.modelo ? (
        <Link to={`/modelos-produto/${img.modelo.id}`} state={stateComOrigem()} className={classeLink}>
          Ver itens do modelo
        </Link>
      ) : null;
    }
    return itens.map((item) => (
      <Link
        key={item.id}
        to={`/itens-estoque/${item.id}`}
        state={stateComOrigem()}
        className={classeLink}
        title={`Abrir o item SKU ${item.sku}`}
      >
        {tema === "escuro"
          ? `SKU ${item.sku} · ${item.numeracao}${item.regiao ? ` · ${NOME_REGIAO[item.regiao] ?? item.regiao}` : ""}${soEmEstoque ? "" : ` · ${traduzirEnum(item.status)}`}`
          : `Ver item ${item.sku}`}
      </Link>
    ));
  };

  const resetPage = () => setPage(1);

  useEffect(() => {
    setGaleria(null);
  }, [page, searchDebounced, categoriaIds, apenasPrincipais, status, regiao, numeracaoDebounced, padraoNumeracao]);

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
          <div className="grid w-full min-w-0 grid-cols-1 items-center gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,1.3fr)]">
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
            <StatusItemFilterDropdown
              value={statusFiltro}
              options={statusOpcoesFiltro}
              className="w-full min-w-0"
              onChange={(valor) => {
                setStatusFiltro(valor);
                resetPage();
              }}
            />
            <StatusSelectDropdown
              value={regiao}
              options={[
                { value: "", label: "Todas as regiões", tom: "neutro" },
                { value: "brasil", label: "Brasil", tom: "brand" },
                { value: "europa", label: "Europa", tom: "info" },
              ]}
              onChange={(valor) => {
                setRegiao(valor as FiltroRegiaoImagens);
                resetPage();
              }}
              className="w-full min-w-0"
            />
            <div className="flex w-full min-w-0 items-center gap-2">
              <SearchInput
                placeholder={EXEMPLO_NUMERACAO[padraoNumeracao]}
                value={numeracao}
                onChange={(e) => {
                  setNumeracao(e.target.value);
                  resetPage();
                }}
                wrapperClassName="w-full min-w-0"
              />
              <div className="w-[5.5rem] shrink-0">
              <StatusSelectDropdown
                value={padraoNumeracao}
                options={[
                  { value: "br", label: "BR", tom: "brand" },
                  { value: "eu", label: "EU", tom: "info" },
                  { value: "us", label: "US", tom: "teal" },
                ]}
                onChange={(valor) => {
                  setPadraoNumeracao(valor as DisplaySizeSystem);
                  resetPage();
                }}
              />
              </div>
            </div>
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
                {data.data.map((img) => {
                  const src = urlImagemModelo(img) ?? "";
                  const nome = img.modelo?.nome_modelo ?? "—";
                  const itens = img.itensEstoque;
                  return (
                    <div
                      key={img.id}
                      className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface-alt transition hover:border-brand-300 hover:shadow-sm"
                    >
                    <button
                      type="button"
                      onClick={() => void abrirFotosDoModelo(img)}
                      aria-busy={abrindoModelo === img.id}
                      className={`group flex flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${abrindoModelo === img.id ? "cursor-wait opacity-60" : ""}`}
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
                      <p className="line-clamp-2 px-2 pt-2 text-xs font-medium leading-snug text-ink">
                        {nome}
                      </p>
                      {filtroEstoqueAtivo && itens && itens.length > 0 ? (
                        <p className="px-2 pt-0.5 text-[11px] font-semibold text-emerald-700">
                          {itens.length} {itens.length === 1 ? "par" : "pares"}
                          {soEmEstoque ? " em estoque" : ""}
                          {regiao === "brasil" ? " no Brasil" : regiao === "europa" ? " na Europa" : ""}
                        </p>
                      ) : null}
                    </button>
                    <div className="mt-auto flex flex-wrap gap-x-3 gap-y-0.5 px-2 pb-2 pt-1">
                      {itens && itens.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => void abrirFotosDoModelo(img)}
                          className="text-[11px] font-semibold text-brand-700 hover:text-brand-800 hover:underline"
                        >
                          Ver os {itens.length} itens
                        </button>
                      ) : (
                        linksEstoque(img, "claro")
                      )}
                    </div>
                    </div>
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

      {galeria ? (
        <GaleriaImagensLightbox
          imagens={galeria.imagens}
          indice={galeria.indice}
          onClose={() => setGaleria(null)}
          onIndiceChange={(indice) => setGaleria((atual) => (atual ? { ...atual, indice } : atual))}
          acoesRodape={(img) => linksEstoque(img, "escuro")}
        />
      ) : null}
    </div>
  );
}
