import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  FILTRO_CATEGORIA_SEM,
  FILTRO_LOCAL_SEM,
  idsLocaisPorRegiao,
  type RegiaoEstoqueFiltro,
} from "../services/itens-estoque";
import {
  catalogoKropCafeService,
  type EstoqueCatalogo,
  type ItemEstoqueCatalogo,
  type LocalEstoqueCatalogo,
} from "../services/catalogo-kropcafe";
import { cn } from "../utils/cn";
import { mensagemErro } from "../utils/errors";
import { formatarMoeda } from "../utils/format";
import {
  formatSizeLabel,
  getSizeByDisplaySystem,
  getUsDisplayLabel,
  matchesSizeFilter,
  type DisplaySizeSystem,
} from "../utils/sizeConversion";

const POR_PAGINA = 24;

const PADROES: Array<{ value: DisplaySizeSystem; label: string }> = [
  { value: "br", label: "BR" },
  { value: "eu", label: "EU" },
  { value: "us", label: "US" },
];

const REGIOES: Array<{ value: RegiaoEstoqueFiltro; label: string }> = [
  { value: "", label: "Todas" },
  { value: "br", label: "BR" },
  { value: "eu", label: "EU" },
];

const PAIS_REGIAO: Record<Exclude<RegiaoEstoqueFiltro, "">, string[]> = {
  br: ["Brasil"],
  eu: ["Portugal"],
};

const campoClasse =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d7b56d]";

function rotuloNumeracao(item: ItemEstoqueCatalogo, padrao: DisplaySizeSystem): string {
  if (padrao === "us") return getUsDisplayLabel(item);
  return formatSizeLabel(getSizeByDisplaySystem(item, padrao), padrao);
}

function passaLista(selecionados: string[], id: string | null, semValor: string): boolean {
  if (selecionados.length === 0) return true;
  const sem = selecionados.includes(semValor);
  const ids = selecionados.filter((valor) => valor !== semValor);
  if (id == null) return sem;
  return ids.includes(id);
}

function passaRegiao(
  item: ItemEstoqueCatalogo,
  regiao: RegiaoEstoqueFiltro,
  locais: LocalEstoqueCatalogo[],
): boolean {
  if (!regiao) return true;
  const ids = new Set(idsLocaisPorRegiao(locais, regiao));
  if (!item.id_local_estoque || !ids.has(item.id_local_estoque)) return false;
  return item.local_pais != null && PAIS_REGIAO[regiao].includes(item.local_pais);
}

export default function CatalogoEstoquePage() {
  const navigate = useNavigate();
  const [estoque, setEstoque] = useState<EstoqueCatalogo | null>(null);
  const [fotos, setFotos] = useState<Record<string, string[]>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [locaisSelecionados, setLocaisSelecionados] = useState<string[]>([]);
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<string[]>([]);
  const [numeracao, setNumeracao] = useState("");
  const [padrao, setPadrao] = useState<DisplaySizeSystem>("br");
  const [regiao, setRegiao] = useState<RegiaoEstoqueFiltro>("");
  const [pagina, setPagina] = useState(1);
  const [filtroAberto, setFiltroAberto] = useState<"local" | "categoria" | null>(null);
  const filtrosRef = useRef<HTMLDivElement>(null);
  const fotosPedidas = useRef(new Set<string>());

  useEffect(() => {
    let ativo = true;
    catalogoKropCafeService
      .listarEstoque()
      .then((dados) => {
        if (ativo) setEstoque(dados);
      })
      .catch((err) => {
        if (ativo) setErro(mensagemErro(err));
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (!filtroAberto) return;
    const fechar = (event: MouseEvent) => {
      if (!filtrosRef.current?.contains(event.target as Node)) setFiltroAberto(null);
    };
    const tecla = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFiltroAberto(null);
    };
    document.addEventListener("mousedown", fechar);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fechar);
      document.removeEventListener("keydown", tecla);
    };
  }, [filtroAberto]);

  const locais = estoque?.locais ?? [];
  const categorias = estoque?.categorias ?? [];

  const opcoesLocal = useMemo(
    () => [
      { value: FILTRO_LOCAL_SEM, label: "Sem local definido" },
      ...locais.map((local) => ({ value: local.id, label: local.nome })),
    ],
    [locais],
  );

  const opcoesCategoria = useMemo(
    () => [
      { value: FILTRO_CATEGORIA_SEM, label: "Sem categoria" },
      ...categorias.map((categoria) => ({ value: categoria.id, label: categoria.nome })),
    ],
    [categorias],
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const itens = estoque?.itens ?? [];
    return itens
      .filter((item) => {
        if (
          termo &&
          !item.sku.toLowerCase().includes(termo) &&
          !item.nome_produto.toLowerCase().includes(termo)
        ) {
          return false;
        }
        if (!passaLista(locaisSelecionados, item.id_local_estoque, FILTRO_LOCAL_SEM)) return false;
        if (!passaLista(categoriasSelecionadas, item.id_categoria, FILTRO_CATEGORIA_SEM)) return false;
        if (!passaRegiao(item, regiao, locais)) return false;
        if (numeracao.trim() && !matchesSizeFilter(item, padrao, numeracao)) return false;
        return true;
      })
      .sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true }) || a.id.localeCompare(b.id));
  }, [estoque, busca, locaisSelecionados, categoriasSelecionadas, regiao, locais, numeracao, padrao]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  const idsFoto = visiveis
    .map((item) => item.id_modelo_produto)
    .filter(Boolean)
    .join("|");

  useEffect(() => {
    const ids = [...new Set(idsFoto.split("|").filter(Boolean))].filter(
      (id) => !fotosPedidas.current.has(id),
    );
    if (ids.length === 0) return;
    ids.forEach((id) => fotosPedidas.current.add(id));
    let ativo = true;
    catalogoKropCafeService
      .listarGaleriaUrlsPorModelos(ids)
      .then((mapa) => {
        if (!ativo) return;
        setFotos((atual) => {
          const proximo = { ...atual };
          for (const id of ids) proximo[id] = mapa[id] ?? [];
          return proximo;
        });
      })
      .catch(() => {
        ids.forEach((id) => fotosPedidas.current.delete(id));
      });
    return () => {
      ativo = false;
    };
  }, [idsFoto]);

  const alterarFiltro = (atualizar: () => void) => {
    atualizar();
    setPagina(1);
  };

  const temFiltro =
    busca.trim() !== "" ||
    numeracao.trim() !== "" ||
    regiao !== "" ||
    locaisSelecionados.length > 0 ||
    categoriasSelecionadas.length > 0;

  const limparFiltros = () => {
    setBusca("");
    setNumeracao("");
    setRegiao("");
    setLocaisSelecionados([]);
    setCategoriasSelecionadas([]);
    setPagina(1);
  };

  const nomeOpcao = (opcoes: Array<{ value: string; label: string }>, valor: string) =>
    opcoes.find((opcao) => opcao.value === valor)?.label ?? valor;

  return (
    <main className="min-h-dvh bg-[#050505] text-white selection:bg-[#d7b56d] selection:text-stone-950">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#050505]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2 sm:px-6 sm:py-3">
          <img
            src="/kropcafe-logo-white-glow.png?v=2"
            alt="KropCafé"
            className="h-auto w-24 shrink-0 object-contain sm:w-32"
            draggable={false}
          />
          <h1 className="min-w-0 flex-1 truncate text-xl font-black tracking-tight sm:text-2xl">Estoque</h1>
          <button
            type="button"
            onClick={() => navigate("/catalogo-kropcafe")}
            className="shrink-0 rounded-full border border-[#7eb6e0]/50 bg-[#7eb6e0]/12 px-3 py-1.5 text-xs font-bold text-[#d6ebff] transition hover:border-[#7eb6e0] hover:bg-[#7eb6e0]/22 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7eb6e0] sm:px-4 sm:py-2 sm:text-sm"
          >
            Voltar
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-3 py-4 sm:px-6 sm:py-5">
        <section className="rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(215,181,109,0.14),rgba(255,255,255,0.055)_34%,rgba(255,255,255,0.035))] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:rounded-[2rem] sm:p-4">
          <div ref={filtrosRef} className="flex flex-col gap-3">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(10rem,0.7fr)]">
              <Campo label="Busca">
                <input
                  value={busca}
                  onChange={(event) => alterarFiltro(() => setBusca(event.target.value))}
                  placeholder="SKU ou nome do produto"
                  className={campoClasse}
                />
              </Campo>
              <Campo label="Numeração">
                <input
                  value={numeracao}
                  onChange={(event) => alterarFiltro(() => setNumeracao(event.target.value))}
                  placeholder="US 6, BR 37"
                  className={campoClasse}
                />
              </Campo>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <GrupoRotulo label="Padrão">
                <Segmentos
                  ariaLabel="Padrão de numeração"
                  valor={padrao}
                  opcoes={PADROES}
                  onChange={(valor) => alterarFiltro(() => setPadrao(valor))}
                />
              </GrupoRotulo>
              <GrupoRotulo label="Região">
                <Segmentos
                  ariaLabel="Região do estoque"
                  valor={regiao}
                  opcoes={REGIOES}
                  onChange={(valor) => alterarFiltro(() => setRegiao(valor))}
                />
              </GrupoRotulo>
              <FiltroMulti
                label="Local"
                vazio="Todos os locais"
                buscar="Buscar local"
                opcoes={opcoesLocal}
                selecionados={locaisSelecionados}
                aberto={filtroAberto === "local"}
                onAbrir={() => setFiltroAberto((atual) => (atual === "local" ? null : "local"))}
                onChange={(valores) => alterarFiltro(() => setLocaisSelecionados(valores))}
              />
              <FiltroMulti
                label="Categoria"
                vazio="Todas as categorias"
                buscar="Buscar categoria"
                opcoes={opcoesCategoria}
                selecionados={categoriasSelecionadas}
                aberto={filtroAberto === "categoria"}
                onAbrir={() => setFiltroAberto((atual) => (atual === "categoria" ? null : "categoria"))}
                onChange={(valores) => alterarFiltro(() => setCategoriasSelecionadas(valores))}
              />
            </div>

            {temFiltro ? (
              <div className="flex flex-wrap items-center gap-2">
                {busca.trim() ? (
                  <Chip onRemove={() => alterarFiltro(() => setBusca(""))}>{busca.trim()}</Chip>
                ) : null}
                {numeracao.trim() ? (
                  <Chip onRemove={() => alterarFiltro(() => setNumeracao(""))}>{numeracao.trim()}</Chip>
                ) : null}
                {regiao ? (
                  <Chip onRemove={() => alterarFiltro(() => setRegiao(""))}>
                    {regiao === "br" ? "Região BR" : "Região EU"}
                  </Chip>
                ) : null}
                {locaisSelecionados.map((valor) => (
                  <Chip
                    key={valor}
                    onRemove={() =>
                      alterarFiltro(() =>
                        setLocaisSelecionados((atual) => atual.filter((item) => item !== valor)),
                      )
                    }
                  >
                    {nomeOpcao(opcoesLocal, valor)}
                  </Chip>
                ))}
                {categoriasSelecionadas.map((valor) => (
                  <Chip
                    key={valor}
                    onRemove={() =>
                      alterarFiltro(() =>
                        setCategoriasSelecionadas((atual) => atual.filter((item) => item !== valor)),
                      )
                    }
                  >
                    {nomeOpcao(opcoesCategoria, valor)}
                  </Chip>
                ))}
                <button
                  type="button"
                  onClick={limparFiltros}
                  className="rounded-full px-3 py-1 text-xs font-bold text-white/55 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d7b56d]"
                >
                  Limpar
                </button>
              </div>
            ) : null}
          </div>
        </section>

        <p className="text-sm font-bold text-white/55" aria-live="polite">
          {carregando ? "Carregando o estoque…" : `${filtrados.length} pares em estoque`}
        </p>

        {erro ? (
          <p className="rounded-2xl border border-[#e07a5f]/40 bg-[#e07a5f]/10 px-4 py-3 text-sm text-[#f6c7b6]">
            {erro}
          </p>
        ) : null}

        {carregando ? (
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, indice) => (
              <li key={indice} className="overflow-hidden rounded-2xl bg-white/10">
                <div className="aspect-square animate-pulse bg-white/10" />
                <div className="space-y-2 p-3">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
                  <div className="h-3 w-full animate-pulse rounded bg-white/10" />
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {!carregando && !erro && filtrados.length === 0 ? (
          <div className="rounded-[1.5rem] border border-white/10 px-6 py-12 text-center">
            <p className="text-lg font-black">Nenhum par com esses filtros</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/55">
              Ajuste a busca, o local ou a numeração. A lista mostra somente o que está em estoque.
            </p>
            {temFiltro ? (
              <button
                type="button"
                onClick={limparFiltros}
                className="mt-5 rounded-full bg-[#d7b56d] px-5 py-2.5 text-sm font-black text-stone-950 transition hover:bg-[#e2c688] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d7b56d]"
              >
                Limpar filtros
              </button>
            ) : null}
          </div>
        ) : null}

        {visiveis.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
            {visiveis.map((item, indice) => (
              <li key={item.id}>
                <CartaoEstoque
                  item={item}
                  foto={fotos[item.id_modelo_produto]?.[0]}
                  numeracaoLabel={rotuloNumeracao(item, padrao)}
                  prioridade={indice < 4}
                />
              </li>
            ))}
          </ul>
        ) : null}

        {totalPaginas > 1 && !carregando ? (
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={paginaAtual <= 1}
              onClick={() => {
                setPagina((atual) => Math.max(1, atual - 1));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d7b56d] disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="text-sm tabular-nums text-white/55">
              {paginaAtual} / {totalPaginas}
            </span>
            <button
              type="button"
              disabled={paginaAtual >= totalPaginas}
              onClick={() => {
                setPagina((atual) => atual + 1);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d7b56d] disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function CartaoEstoque({
  item,
  foto,
  numeracaoLabel,
  prioridade,
}: {
  item: ItemEstoqueCatalogo;
  foto?: string;
  numeracaoLabel: string;
  prioridade?: boolean;
}) {
  const [falhou, setFalhou] = useState(false);
  const preco =
    item.preco_venda == null ? "Sob consulta" : formatarMoeda(item.preco_venda, item.moeda_venda || "EUR");

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white text-stone-950 shadow-[0_12px_40px_rgba(0,0,0,0.14)]">
      <div className="relative aspect-square bg-[#f7f2ea]">
        {foto && !falhou ? (
          <img
            src={foto}
            alt={`SKU ${item.sku}`}
            className="absolute inset-0 h-full w-full object-contain p-3"
            loading={prioridade ? "eager" : "lazy"}
            decoding="async"
            draggable={false}
            onError={() => setFalhou(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-3 text-center text-xs font-semibold text-stone-500">
            Sem foto
          </div>
        )}
        <span className="absolute bottom-2 left-2 rounded-full bg-stone-950/80 px-2 py-0.5 text-[11px] font-black tabular-nums text-white">
          {numeracaoLabel}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2.5 sm:p-3">
        <p className="truncate text-base font-black tracking-tight sm:text-lg">{item.sku || "—"}</p>
        <p className="line-clamp-2 text-xs leading-snug text-stone-600 sm:text-sm">{item.nome_produto || "—"}</p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <p className="min-w-0 truncate text-[11px] font-semibold text-stone-600 sm:text-xs">
            {[item.local_nome || "Sem local", item.categoria_nome || "Sem categoria"].join(" · ")}
          </p>
          <p className="shrink-0 rounded-full bg-stone-950 px-2 py-0.5 text-[10px] font-bold text-white sm:text-xs">
            {preco}
          </p>
        </div>
      </div>
    </article>
  );
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-white/55">{label}</span>
      {children}
    </label>
  );
}

function GrupoRotulo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-white/55">{label}</span>
      {children}
    </div>
  );
}

function Segmentos<T extends string>({
  ariaLabel,
  valor,
  opcoes,
  onChange,
}: {
  ariaLabel: string;
  valor: T;
  opcoes: Array<{ value: T; label: string }>;
  onChange: (valor: T) => void;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex h-[42px] rounded-xl border border-white/10 p-0.5">
      {opcoes.map((opcao) => {
        const ativo = valor === opcao.value;
        return (
          <button
            key={opcao.value || "todas"}
            type="button"
            aria-pressed={ativo}
            onClick={() => onChange(opcao.value)}
            className={cn(
              "flex-1 rounded-[10px] text-xs font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d7b56d]",
              ativo ? "bg-[#d7b56d] text-stone-950" : "text-white/60 hover:text-white",
            )}
          >
            {opcao.label}
          </button>
        );
      })}
    </div>
  );
}

function Chip({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="max-w-[14rem] truncate rounded-full border border-[#d7b56d]/40 bg-[#d7b56d]/15 px-3 py-1 text-xs font-bold text-[#e2c688] transition hover:bg-[#d7b56d] hover:text-stone-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d7b56d]"
    >
      {children}
      <span className="sr-only">, remover</span>
    </button>
  );
}

function FiltroMulti({
  label,
  vazio,
  buscar,
  opcoes,
  selecionados,
  aberto,
  onAbrir,
  onChange,
}: {
  label: string;
  vazio: string;
  buscar: string;
  opcoes: Array<{ value: string; label: string }>;
  selecionados: string[];
  aberto: boolean;
  onAbrir: () => void;
  onChange: (valores: string[]) => void;
}) {
  const [termo, setTermo] = useState("");
  const rotulo =
    selecionados.length === 0
      ? vazio
      : selecionados.length === 1
        ? opcoes.find((opcao) => opcao.value === selecionados[0])?.label ?? vazio
        : `${selecionados.length} selecionados`;
  const visiveis = opcoes.filter((opcao) => opcao.label.toLowerCase().includes(termo.trim().toLowerCase()));

  const alternar = (valor: string) => {
    onChange(
      selecionados.includes(valor)
        ? selecionados.filter((item) => item !== valor)
        : [...selecionados, valor],
    );
  };

  return (
    <div className="relative flex min-w-0 flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-white/55">{label}</span>
      <button
        type="button"
        aria-expanded={aberto}
        aria-haspopup="listbox"
        onClick={onAbrir}
        className={cn(campoClasse, "truncate text-left", selecionados.length === 0 && "text-white/45")}
      >
        {rotulo}
      </button>
      {aberto ? (
        <div className="absolute top-full z-20 mt-1 w-full overflow-hidden rounded-xl border border-white/10 bg-stone-950 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
          <div className="border-b border-white/10 p-2">
            <input
              value={termo}
              onChange={(event) => setTermo(event.target.value)}
              placeholder={buscar}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-sm outline-none placeholder:text-white/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d7b56d]"
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1 [scrollbar-color:#d7b56d_rgba(255,255,255,0.12)] [scrollbar-width:thin]">
            {visiveis.length === 0 ? (
              <p className="px-2 py-3 text-sm text-white/45">Nenhum resultado</p>
            ) : (
              visiveis.map((opcao) => (
                <label
                  key={opcao.value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-white/10"
                >
                  <input
                    type="checkbox"
                    checked={selecionados.includes(opcao.value)}
                    onChange={() => alternar(opcao.value)}
                    className="accent-[#d7b56d]"
                  />
                  <span className="truncate">{opcao.label}</span>
                </label>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
