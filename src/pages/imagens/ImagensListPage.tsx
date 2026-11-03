import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import { Modal } from "../../components/Modal";
import { StatusBadge } from "../../components/StatusBadge";
import { SecondaryButton } from "../../components/PrimaryButton";
import { formatarPrecoVendaItem } from "../../utils/moedaItemEstoque";
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
  // Os filtros vivem na URL: ao abrir um item ou modelo e voltar, a galeria volta igual.
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(() => Math.max(1, Number(searchParams.get("p")) || 1));
  // Um card por modelo (só a foto principal).
  const apenasPrincipais = true;
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [categoriaIds, setCategoriaIds] = useState<string[]>(
    () => searchParams.get("cat")?.split(",").filter(Boolean) ?? [],
  );
  // Começa em "Em estoque": é o que dá para mostrar a um cliente.
  const [statusFiltro, setStatusFiltro] = useState<StatusItem | "">(() => {
    const valor = searchParams.get("status");
    if (valor === "todos") return "";
    return (valor as StatusItem | null) ?? "em_estoque";
  });
  const status = useMemo<StatusItem[]>(() => (statusFiltro ? [statusFiltro] : []), [statusFiltro]);
  const [regiao, setRegiao] = useState<FiltroRegiaoImagens>(
    () => (searchParams.get("regiao") as FiltroRegiaoImagens | null) ?? "",
  );
  const [numeracao, setNumeracao] = useState(() => searchParams.get("num") ?? "");
  const [padraoNumeracao, setPadraoNumeracao] = useState<DisplaySizeSystem>(
    () => (searchParams.get("padrao") as DisplaySizeSystem | null) ?? "br",
  );
  const stateComOrigem = useStateComOrigem();
  // Fotos do modelo clicado: o visualizador navega entre elas, não entre os modelos.
  const [galeria, setGaleria] = useState<{
    idModelo: string;
    imagens: ImagemDetalhada[];
    indice: number;
  } | null>(null);
  // Modal "Ver detalhes": itens do modelo (SKU, preço, estoque e região).
  const [detalhes, setDetalhes] = useState<{ idModelo: string; nome: string } | null>(() => {
    const idModelo = searchParams.get("det");
    return idModelo ? { idModelo, nome: "" } : null;
  });
  // Visualizador aberto ao sair para um item ou modelo: reabre ao voltar.
  const reabrirGaleria = useRef(
    searchParams.get("ver")
      ? { idModelo: searchParams.get("ver")!, foto: Math.max(0, Number(searchParams.get("foto")) || 0) }
      : null,
  );
  const [abrindoModelo, setAbrindoModelo] = useState<string | null>(null);
  const toast = useToast();

  const searchDebounced = useDebounce(search, 400);
  const numeracaoDebounced = useDebounce(numeracao, 400);
  const filtroEstoqueAtivo = Boolean(status.length > 0 || regiao || numeracaoDebounced.trim());
  const soEmEstoque = status.length === 1 && status[0] === "em_estoque";

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchDebounced.trim()) params.set("q", searchDebounced.trim());
    if (categoriaIds.length > 0) params.set("cat", categoriaIds.join(","));
    if (statusFiltro !== "em_estoque") params.set("status", statusFiltro || "todos");
    if (regiao) params.set("regiao", regiao);
    if (numeracaoDebounced.trim()) params.set("num", numeracaoDebounced.trim());
    if (padraoNumeracao !== "br") params.set("padrao", padraoNumeracao);
    if (page > 1) params.set("p", String(page));
    if (galeria) {
      params.set("ver", galeria.idModelo);
      if (galeria.indice > 0) params.set("foto", String(galeria.indice));
    } else if (reabrirGaleria.current) {
      // Ainda reabrindo: mantém o que veio na URL.
      params.set("ver", reabrirGaleria.current.idModelo);
      if (reabrirGaleria.current.foto > 0) params.set("foto", String(reabrirGaleria.current.foto));
    }
    if (detalhes) params.set("det", detalhes.idModelo);
    setSearchParams(params, { replace: true });
  }, [
    galeria,
    detalhes,
    searchDebounced,
    categoriaIds,
    statusFiltro,
    regiao,
    numeracaoDebounced,
    padraoNumeracao,
    page,
    setSearchParams,
  ]);

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

  const abrirFotosDoModelo = async (img: ImagemDetalhada, fotoInicial?: number) => {
    setAbrindoModelo(img.id);
    try {
      const fotos = await modelosProdutoService.obterImagens(img.id_modelo_produto);
      const imagens: ImagemDetalhada[] =
        fotos.length > 0
          ? fotos.map((foto) => ({ ...foto, modelo: img.modelo, itensEstoque: img.itensEstoque }) as ImagemDetalhada)
          : [img];
      const indice =
        fotoInicial != null
          ? Math.min(fotoInicial, imagens.length - 1)
          : Math.max(0, imagens.findIndex((foto) => foto.id === img.id));
      setGaleria({ idModelo: img.id_modelo_produto, imagens, indice });
    } catch (falha) {
      toast.erro(mensagemErro(falha));
    } finally {
      setAbrindoModelo(null);
    }
  };

  const verDetalhes = (img: ImagemDetalhada) =>
    setDetalhes({ idModelo: img.id_modelo_produto, nome: img.modelo?.nome_modelo ?? "" });

  const itensDetalhes = useAsync(
    () =>
      detalhes
        ? imagensService.itensDoModelo(detalhes.idModelo, {
            status,
            regiao,
            numeracao: numeracaoDebounced,
            padraoNumeracao,
          })
        : Promise.resolve([]),
    [detalhes?.idModelo, status, regiao, numeracaoDebounced, padraoNumeracao],
  );
  const nomeDetalhes =
    detalhes?.nome ||
    data?.data.find((img) => img.id_modelo_produto === detalhes?.idModelo)?.modelo?.nome_modelo ||
    "Detalhes do modelo";

  const resetPage = () => setPage(1);

  useEffect(() => {
    const pendente = reabrirGaleria.current;
    if (!pendente || !data) return;
    reabrirGaleria.current = null;
    const img = data.data.find((item) => item.id_modelo_produto === pendente.idModelo);
    // Só depende de data: reabre uma vez, quando a lista chega.
    if (img) void abrirFotosDoModelo(img, pendente.foto);
  }, [data]);

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
                    <div className="mt-auto px-2 pb-2 pt-1.5">
                      <button
                        type="button"
                        onClick={() => verDetalhes(img)}
                        className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-xs font-semibold text-brand-700 transition hover:border-brand-400 hover:bg-brand-50"
                      >
                        Ver detalhes
                      </button>
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
          semLinkModelo
          teclasPausadas={Boolean(detalhes)}
          acoesRodape={(img) => (
            <>
              <button
                type="button"
                onClick={() => verDetalhes(img)}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-brand-50"
              >
                Ver detalhes
              </button>
            </>
          )}
        />
      ) : null}

      <Modal
        open={Boolean(detalhes)}
        onClose={() => setDetalhes(null)}
        acimaDeSobreposicoes
        size="lg"
        title={nomeDetalhes}
        description={
          itensDetalhes.loading
            ? "Carregando itens…"
            : `${itensDetalhes.data?.length ?? 0} ${(itensDetalhes.data?.length ?? 0) === 1 ? "item" : "itens"}${
                statusFiltro ? ` · ${traduzirEnum(statusFiltro)}` : ""
              }${regiao ? ` · ${NOME_REGIAO[regiao]}` : ""}${
                numeracaoDebounced.trim() ? ` · ${padraoNumeracao.toUpperCase()} ${numeracaoDebounced.trim()}` : ""
              }`
        }
        footer={
          <>
            {detalhes ? (
              <Link
                to={`/modelos-produto/${detalhes.idModelo}`}
                state={stateComOrigem()}
                className="mr-auto text-sm font-semibold text-brand-700 hover:text-brand-800 hover:underline"
              >
                Ver modelo
              </Link>
            ) : null}
            <SecondaryButton type="button" onClick={() => setDetalhes(null)}>
              Fechar
            </SecondaryButton>
          </>
        }
      >
        {itensDetalhes.loading ? (
          <LoadingState />
        ) : itensDetalhes.error ? (
          <p className="text-sm text-red-700">Erro: {itensDetalhes.error.message}</p>
        ) : (itensDetalhes.data ?? []).length === 0 ? (
          <p className="text-sm text-ink-soft">Nenhum item deste modelo com os filtros atuais.</p>
        ) : (
          <ul className="divide-y divide-line">
            <li className="hidden grid-cols-[5rem_5.5rem_7rem_minmax(0,1fr)_6rem_auto] gap-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft sm:grid">
              <span>SKU</span>
              <span>Numeração</span>
              <span>Preço</span>
              <span>Estoque</span>
              <span>Região</span>
              <span className="sr-only">Abrir</span>
            </li>
            {(itensDetalhes.data ?? []).map((item) => (
              <li
                key={item.id}
                className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 py-2.5 sm:grid-cols-[5rem_5.5rem_7rem_minmax(0,1fr)_6rem_auto]"
              >
                <span className="font-numeric text-sm font-semibold tabular-nums text-ink">
                  SKU {item.sku}
                  <span className="ml-2 font-normal text-ink-soft sm:hidden">{item.numeracao}</span>
                </span>
                <span className="hidden font-numeric text-sm tabular-nums text-ink sm:block">{item.numeracao}</span>
                <span className="font-numeric text-sm font-semibold tabular-nums text-ink sm:order-none">
                  {formatarPrecoVendaItem(item.precoVenda, item.moedaVenda, item.regiao) ?? "Sem preço"}
                </span>
                <span className="col-span-2 min-w-0 text-sm text-ink sm:col-span-1">
                  <span className="block truncate" title={item.local ?? undefined}>
                    {item.local ?? "Sem local"}
                  </span>
                  {soEmEstoque ? null : (
                    <StatusBadge value={item.status} label={traduzirEnum(item.status)} className="mt-0.5" />
                  )}
                </span>
                <span className="text-sm text-ink-soft">
                  {item.regiao ? NOME_REGIAO[item.regiao] ?? item.regiao : "—"}
                </span>
                <Link
                  to={`/itens-estoque/${item.id}`}
                  state={stateComOrigem()}
                  className="justify-self-end whitespace-nowrap rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-brand-700 transition hover:border-brand-400 hover:bg-brand-50"
                  title={`Abrir o item SKU ${item.sku} no estoque`}
                >
                  Ver no estoque
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
