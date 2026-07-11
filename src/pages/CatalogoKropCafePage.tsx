import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  catalogoKropCafeService,
  type ItemCatalogoKropCafePublico,
} from "../services/catalogo-kropcafe";
import { cn } from "../utils/cn";
import { mensagemErro } from "../utils/errors";
import { formatarPrecoVendaDoItem } from "../utils/moedaItemEstoque";
import {
  SHOE_SIZE_EQUIVALENCE_TABLE,
  type DisplaySizeSystem,
} from "../utils/sizeConversion";

type RegiaoCatalogo = "brasil" | "europa" | "usa";
type SegmentoCatalogo = "adult" | "adult_w" | "youth" | "kids";
type IdiomaCatalogo = "pt" | "en" | "es" | "fr";

type RegiaoConfig = {
  label: string;
  description: string;
  displaySystem: DisplaySizeSystem;
  segmentos: Array<{ id: SegmentoCatalogo; label: string; description: string; tamanhos: string[] }>;
};

type CatalogoState = {
  itens: ItemCatalogoKropCafePublico[];
  fotos: Record<string, string[]>;
};

const ETAPAS = [1, 2, 3, 4, 5] as const;

type ItemSelecionadoCatalogo = {
  item: ItemCatalogoKropCafePublico;
  fotos: string[];
  numeracaoLabel: string;
};

const REGIOES: Record<RegiaoCatalogo, RegiaoConfig> = {
  usa: {
    label: "USA",
    description: "Numeração americana",
    displaySystem: "us",
    segmentos: [
      {
        id: "adult",
        label: "Adult",
        description: "Numeração adulta americana",
        tamanhos: [
          "3.5",
          "4",
          "4.5",
          "5",
          "5.5",
          "6",
          "6.5",
          "7",
          "7.5",
          "8",
          "8.5",
          "9",
          "9.5",
          "10",
          "10.5",
          "11",
          "11.5",
          "12",
          "12.5",
          "13",
          "14",
          "15",
        ],
      },
      {
        id: "adult_w",
        label: "Adult feminino W",
        description: "Numeração feminina americana",
        tamanhos: [
          "5W",
          "5.5W",
          "6W",
          "6.5W",
          "7W",
          "7.5W",
          "8W",
          "8.5W",
          "9W",
          "9.5W",
          "10W",
          "10.5W",
          "11W",
          "11.5W",
          "12W",
          "12.5W",
          "13W",
          "13.5W",
          "14W",
          "14.5W",
          "15.5W",
          "16.5W",
        ],
      },
      {
        id: "youth",
        label: "Youth",
        description: "Numeração juvenil americana",
        tamanhos: ["3.5Y", "4Y", "4.5Y", "5Y", "5.5Y", "6Y", "6.5Y", "7Y"],
      },
      {
        id: "kids",
        label: "Kids",
        description: "Numeração infantil americana",
        tamanhos: [
          "8.5C",
          "9C",
          "9.5C",
          "10C",
          "10.5C",
          "11C",
          "11.5C",
          "12C",
          "12.5C",
          "13C",
          "13.5C",
          "1Y",
          "1.5Y",
          "2Y",
          "2.5Y",
          "3Y",
        ],
      },
    ],
  },
  brasil: {
    label: "Brasil",
    description: "Numeração brasileira",
    displaySystem: "br",
    segmentos: [
      {
        id: "adult",
        label: "Adult",
        description: "Numeração adulta brasileira",
        tamanhos: [
          "34",
          "34.5",
          "35",
          "35.5",
          "36",
          "37",
          "37.5",
          "38",
          "39",
          "39.5",
          "40",
          "40.5",
          "41",
          "42",
          "42.5",
          "43",
          "43.5",
          "44",
          "45",
          "45.5",
          "46.5",
          "49.5",
          "50.5",
        ],
      },
      {
        id: "youth",
        label: "Youth",
        description: "Numeração juvenil brasileira",
        tamanhos: ["34", "34.5", "35", "35.5", "36", "37", "37.5", "38"],
      },
      {
        id: "kids",
        label: "Kids",
        description: "Numeração infantil brasileira",
        tamanhos: [
          "24.5",
          "25",
          "25.5",
          "26",
          "26.5",
          "27",
          "28",
          "28.5",
          "29",
          "30",
          "30.5",
          "31",
          "32",
          "32.5",
          "33",
          "33.5",
        ],
      },
    ],
  },
  europa: {
    label: "Europa",
    description: "Numeração europeia",
    displaySystem: "eu",
    segmentos: [
      {
        id: "adult",
        label: "Adult",
        description: "Numeração adulta europeia",
        tamanhos: [
          "35.5",
          "36",
          "36.5",
          "37.5",
          "38",
          "38.5",
          "39",
          "40",
          "40.5",
          "41",
          "42",
          "42.5",
          "43",
          "44",
          "44.5",
          "45",
          "45.5",
          "46",
          "47",
        ],
      },
      {
        id: "youth",
        label: "Youth",
        description: "Numeração juvenil europeia",
        tamanhos: ["35.5", "36", "36.6", "37.5", "38", "38.5", "39", "40"],
      },
      {
        id: "kids",
        label: "Kids",
        description: "Numeração infantil europeia",
        tamanhos: [
          "25.5",
          "26",
          "26.5",
          "27",
          "27.5",
          "28",
          "28.5",
          "29.5",
          "30",
          "31",
          "31.5",
          "32",
          "33",
          "33.5",
          "34",
          "35",
        ],
      },
    ],
  },
};

const ORDEM_REGIOES: RegiaoCatalogo[] = ["brasil", "europa", "usa"];

const IDIOMAS: Array<{ id: IdiomaCatalogo; label: string }> = [
  { id: "pt", label: "PT" },
  { id: "en", label: "EN" },
  { id: "es", label: "ES" },
  { id: "fr", label: "FR" },
];

const TEXTOS: Record<
  IdiomaCatalogo,
  {
    catalogo: string;
    titulo: string;
    subtitulo: string;
    idioma: string;
    passo: string;
    regioesTitulo: string;
    regioesAjuda: string;
    segmentosTitulo: string;
    tamanhosTitulo: string;
    resultadoTitulo: string;
    aguardando: string;
    carregando: string;
    semFoto: string;
    precoConsulta: string;
    gostei: string;
    selecionado: string;
    escolher: string;
    selecionados: string;
    limparSelecao: string;
    verCarrinho: string;
    carrinhoTitulo: string;
    continuarEscolhendo: string;
    carrinhoVazio: string;
    remover: string;
    voltar: string;
    recomecar: string;
    erroCatalogo: string;
    nenhumItem: string;
    itens: string;
    regionDescriptions: Record<RegiaoCatalogo, string>;
    segmentLabels: Record<SegmentoCatalogo, string>;
    segmentDescriptions: Record<SegmentoCatalogo, string>;
  }
> = {
  pt: {
    catalogo: "Catálogo de loja",
    titulo: "Escolha sua numeração e navegue pelos pares disponíveis.",
    subtitulo: "Mostramos apenas itens em estoque na Europa, com foto, SKU e valor para facilitar o atendimento.",
    idioma: "Idioma",
    passo: "Passo",
    regioesTitulo: "Escolha a região da sua numeração",
    regioesAjuda: "Primeiro selecione Brasil, Europa ou USA.",
    segmentosTitulo: "Escolha o segmento",
    tamanhosTitulo: "Escolha a numeração",
    resultadoTitulo: "Pares disponíveis",
    aguardando: "Selecione uma numeração para ver os pares disponíveis na loja da Europa.",
    carregando: "Carregando...",
    semFoto: "Sem foto",
    precoConsulta: "Preço sob consulta",
    gostei: "Gostei deste",
    selecionado: "Selecionado",
    escolher: "Escolher",
    selecionados: "Selecionados pelo cliente",
    limparSelecao: "Limpar seleção",
    verCarrinho: "Ver selecionados",
    carrinhoTitulo: "Itens selecionados",
    continuarEscolhendo: "Continuar escolhendo",
    carrinhoVazio: "Nenhum item selecionado ainda.",
    remover: "Remover",
    voltar: "Voltar",
    recomecar: "Recomeçar",
    erroCatalogo: "Não foi possível carregar o catálogo",
    nenhumItem: "Nenhum item em estoque na Europa para esta numeração.",
    itens: "item(ns)",
    regionDescriptions: {
      brasil: "Numeração brasileira",
      europa: "Numeração europeia",
      usa: "Numeração americana",
    },
    segmentLabels: {
      adult: "Adult",
      adult_w: "Adult feminino W",
      youth: "Youth",
      kids: "Kids",
    },
    segmentDescriptions: {
      adult: "Numeração adulta",
      adult_w: "Numeração feminina americana",
      youth: "Numeração juvenil",
      kids: "Numeração infantil",
    },
  },
  en: {
    catalogo: "Store catalog",
    titulo: "Choose your size and browse available pairs.",
    subtitulo: "We only show items in stock in Europe, with photo, SKU and price for easier service.",
    idioma: "Language",
    passo: "Step",
    regioesTitulo: "Choose your size region",
    regioesAjuda: "First select Brazil, Europe or USA.",
    segmentosTitulo: "Choose the segment",
    tamanhosTitulo: "Choose the size",
    resultadoTitulo: "Available pairs",
    aguardando: "Choose a size to see the pairs available in the Europe store.",
    carregando: "Loading...",
    semFoto: "No photo",
    precoConsulta: "Price on request",
    gostei: "I like this one",
    selecionado: "Selected",
    escolher: "Choose",
    selecionados: "Customer selections",
    limparSelecao: "Clear selection",
    verCarrinho: "View selections",
    carrinhoTitulo: "Selected items",
    continuarEscolhendo: "Continue browsing",
    carrinhoVazio: "No items selected yet.",
    remover: "Remove",
    voltar: "Back",
    recomecar: "Start over",
    erroCatalogo: "Could not load the catalog",
    nenhumItem: "No item in stock in Europe for this size.",
    itens: "item(s)",
    regionDescriptions: {
      brasil: "Brazilian size",
      europa: "European size",
      usa: "American size",
    },
    segmentLabels: {
      adult: "Adult",
      adult_w: "Adult W",
      youth: "Youth",
      kids: "Kids",
    },
    segmentDescriptions: {
      adult: "Adult size",
      adult_w: "American women's size",
      youth: "Youth size",
      kids: "Kids size",
    },
  },
  es: {
    catalogo: "Catálogo de tienda",
    titulo: "Elige tu talla y mira los pares disponibles.",
    subtitulo: "Mostramos solo artículos en stock en Europa, con foto, SKU y precio para facilitar la atención.",
    idioma: "Idioma",
    passo: "Paso",
    regioesTitulo: "Elige la región de tu talla",
    regioesAjuda: "Primero selecciona Brasil, Europa o USA.",
    segmentosTitulo: "Elige el segmento",
    tamanhosTitulo: "Elige la talla",
    resultadoTitulo: "Pares disponibles",
    aguardando: "Selecciona una talla para ver los pares disponibles en la tienda de Europa.",
    carregando: "Cargando...",
    semFoto: "Sin foto",
    precoConsulta: "Precio a consultar",
    gostei: "Me gusta este",
    selecionado: "Seleccionado",
    escolher: "Elegir",
    selecionados: "Seleccionados por el cliente",
    limparSelecao: "Limpiar selección",
    verCarrinho: "Ver seleccionados",
    carrinhoTitulo: "Artículos seleccionados",
    continuarEscolhendo: "Seguir eligiendo",
    carrinhoVazio: "Aún no hay artículos seleccionados.",
    remover: "Quitar",
    voltar: "Volver",
    recomecar: "Empezar de nuevo",
    erroCatalogo: "No fue posible cargar el catálogo",
    nenhumItem: "No hay artículos en stock en Europa para esta talla.",
    itens: "artículo(s)",
    regionDescriptions: {
      brasil: "Talla brasileña",
      europa: "Talla europea",
      usa: "Talla americana",
    },
    segmentLabels: {
      adult: "Adult",
      adult_w: "Adult femenino W",
      youth: "Youth",
      kids: "Kids",
    },
    segmentDescriptions: {
      adult: "Talla adulta",
      adult_w: "Talla femenina americana",
      youth: "Talla juvenil",
      kids: "Talla infantil",
    },
  },
  fr: {
    catalogo: "Catalogue boutique",
    titulo: "Choisissez votre pointure et parcourez les paires disponibles.",
    subtitulo: "Nous affichons uniquement les articles en stock en Europe, avec photo, SKU et prix.",
    idioma: "Langue",
    passo: "Étape",
    regioesTitulo: "Choisissez la région de pointure",
    regioesAjuda: "Sélectionnez d'abord Brésil, Europe ou USA.",
    segmentosTitulo: "Choisissez le segment",
    tamanhosTitulo: "Choisissez la pointure",
    resultadoTitulo: "Paires disponibles",
    aguardando: "Choisissez une pointure pour voir les paires disponibles dans la boutique Europe.",
    carregando: "Chargement...",
    semFoto: "Sans photo",
    precoConsulta: "Prix sur demande",
    gostei: "J'aime celui-ci",
    selecionado: "Sélectionné",
    escolher: "Choisir",
    selecionados: "Sélections du client",
    limparSelecao: "Effacer la sélection",
    verCarrinho: "Voir la sélection",
    carrinhoTitulo: "Articles sélectionnés",
    continuarEscolhendo: "Continuer à choisir",
    carrinhoVazio: "Aucun article sélectionné pour le moment.",
    remover: "Retirer",
    voltar: "Retour",
    recomecar: "Recommencer",
    erroCatalogo: "Impossible de charger le catalogue",
    nenhumItem: "Aucun article en stock en Europe pour cette pointure.",
    itens: "article(s)",
    regionDescriptions: {
      brasil: "Pointure brésilienne",
      europa: "Pointure européenne",
      usa: "Pointure américaine",
    },
    segmentLabels: {
      adult: "Adulte",
      adult_w: "Adulte femme W",
      youth: "Youth",
      kids: "Kids",
    },
    segmentDescriptions: {
      adult: "Pointure adulte",
      adult_w: "Pointure américaine femme",
      youth: "Pointure jeune",
      kids: "Pointure enfant",
    },
  },
};

function formatarTamanho(regiao: RegiaoCatalogo, tamanho: string): string {
  if (regiao === "brasil") return `BR ${tamanho.replace(".", ",")}`;
  if (regiao === "europa") return `EU ${tamanho.replace(".", ",")}`;
  return `US ${tamanho.replace(".", ",")}`;
}

function compactarTamanho(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toString();
}

function tamanhosPorEquivalencia(
  regiao: RegiaoCatalogo,
  segmento: SegmentoCatalogo,
): string[] {
  const valores: string[] = [];

  for (const row of SHOE_SIZE_EQUIVALENCE_TABLE) {
    const isKids = row.us_y !== null && (row.us_y_suffix === "C" || row.us_y < 3.5);
    const isYouth = row.us_y !== null && row.us_y_suffix === "Y" && row.us_y >= 3.5;
    const isAdult = !isKids;

    if (segmento === "kids" && !isKids) continue;
    if (segmento === "youth" && !isYouth) continue;
    if ((segmento === "adult" || segmento === "adult_w") && !isAdult) continue;

    if (regiao === "brasil" && row.br !== null) {
      valores.push(compactarTamanho(row.br));
    } else if (regiao === "europa" && row.eu !== null) {
      valores.push(compactarTamanho(row.eu));
    } else if (regiao === "usa") {
      if (segmento === "adult_w" && row.us_w !== null) {
        valores.push(`${compactarTamanho(row.us_w)}W`);
      } else if (segmento === "adult" && row.us_m !== null) {
        valores.push(compactarTamanho(row.us_m));
      } else if ((segmento === "youth" || segmento === "kids") && row.us_y !== null) {
        valores.push(`${compactarTamanho(row.us_y)}${row.us_y_suffix ?? "Y"}`);
      }
    }
  }

  return [...new Set(valores)];
}

function AreaRolavel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-1 [scrollbar-width:thin] [scrollbar-color:#d7b56d_rgba(255,255,255,0.12)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function ProdutoGaleria({
  fotos,
  sku,
  semFoto,
  prioridade,
}: {
  fotos: string[];
  sku: string;
  semFoto: string;
  prioridade?: boolean;
}) {
  const [indice, setIndice] = useState(0);
  const [erros, setErros] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    setIndice(0);
    setErros(new Set());
  }, [fotos]);

  const fotoAtual = fotos[indice];
  const mostrarFoto = Boolean(fotoAtual) && !erros.has(indice);
  const total = fotos.length;

  const anterior = () => setIndice((i) => (i - 1 + total) % total);
  const proxima = () => setIndice((i) => (i + 1) % total);

  return (
    <div className="bg-[#f7f2ea]">
      <div className="relative aspect-square w-full">
        {mostrarFoto ? (
          <img
            src={fotoAtual}
            alt={`SKU ${sku}`}
            className="absolute inset-0 h-full w-full object-contain p-3"
            loading={prioridade && indice === 0 ? "eager" : "lazy"}
            decoding="async"
            draggable={false}
            onError={() => setErros((prev) => new Set(prev).add(indice))}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs font-semibold text-stone-400">
            {semFoto}
          </div>
        )}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                anterior();
              }}
              className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-stone-950/75 text-white backdrop-blur"
              aria-label="Foto anterior"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                proxima();
              }}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-stone-950/75 text-white backdrop-blur"
              aria-label="Próxima foto"
            >
              ›
            </button>
            <span className="absolute bottom-2 right-2 rounded-full bg-stone-950/75 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
              {indice + 1}/{total}
            </span>
          </>
        )}
      </div>
      {total > 1 && (
        <div className="flex gap-2 overflow-x-auto border-t border-stone-200/80 p-2 [scrollbar-width:thin]">
          {fotos.map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              onClick={() => setIndice(i)}
              className={cn(
                "h-10 w-10 shrink-0 overflow-hidden rounded-lg border-2 bg-white transition sm:h-12 sm:w-12",
                i === indice ? "border-[#d7b56d]" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              <img src={url} alt="" className="h-full w-full object-contain p-0.5" loading="lazy" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProdutoCard({
  item,
  fotos,
  selecionado,
  onToggle,
  labels,
  prioridadeImagem,
  numeracaoLabel,
}: {
  item: ItemCatalogoKropCafePublico;
  fotos: string[];
  selecionado: boolean;
  onToggle: () => void;
  prioridadeImagem?: boolean;
  numeracaoLabel?: string | null;
  labels: {
    semFoto: string;
    precoConsulta: string;
    gostei: string;
    selecionado: string;
  };
}) {
  const preco = formatarPrecoVendaDoItem(item) ?? labels.precoConsulta;

  return (
    <article
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_12px_40px_rgba(0,0,0,0.14)] transition",
        selecionado ? "border-[#d7b56d] ring-2 ring-[#d7b56d]/35" : "border-stone-200",
      )}
    >
      <ProdutoGaleria
        fotos={fotos}
        sku={item.sku}
        semFoto={labels.semFoto}
        prioridade={prioridadeImagem}
      />
      <div className="flex flex-1 flex-col justify-between gap-1.5 border-t border-stone-100 p-2.5 sm:gap-2 sm:p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-stone-400 sm:text-[9px] sm:tracking-[0.24em]">SKU</p>
            <p className="truncate text-base font-black tracking-tight text-stone-950 sm:text-lg">
              {item.sku}
              {numeracaoLabel ? (
                <span className="font-bold text-stone-500"> · {numeracaoLabel}</span>
              ) : null}
            </p>
          </div>
          <p className="shrink-0 rounded-full bg-stone-950 px-2 py-0.5 text-[10px] font-bold text-white sm:px-2.5 sm:py-1 sm:text-xs">{preco}</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "w-full rounded-lg px-2.5 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-xs sm:tracking-[0.14em]",
            selecionado
              ? "bg-[#d7b56d] text-stone-950"
              : "bg-stone-950 text-white hover:bg-stone-800",
          )}
        >
          {selecionado ? labels.selecionado : labels.gostei}
        </button>
      </div>
    </article>
  );
}

export default function CatalogoKropCafePage() {
  const [idioma, setIdioma] = useState<IdiomaCatalogo>("pt");
  const [regiao, setRegiao] = useState<RegiaoCatalogo | null>(null);
  const [segmento, setSegmento] = useState<SegmentoCatalogo | null>(null);
  const [tamanho, setTamanho] = useState<string | null>(null);
  const [catalogo, setCatalogo] = useState<CatalogoState>({ itens: [], fotos: {} });
  const [sacola, setSacola] = useState<Record<string, ItemSelecionadoCatalogo>>({});
  const [verCarrinho, setVerCarrinho] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const t = TEXTOS[idioma];
  const regiaoConfig = regiao ? REGIOES[regiao] : null;
  const segmentoConfig = regiaoConfig?.segmentos.find((s) => s.id === segmento) ?? null;
  const etapaAtual = verCarrinho
    ? 5
    : !regiao
      ? 1
      : !segmento
        ? 2
        : !tamanho
          ? 3
          : 4;
  const tamanhoOpcoes = useMemo(
    () => (regiao && segmento ? tamanhosPorEquivalencia(regiao, segmento) : []),
    [regiao, segmento],
  );
  const itensSelecionados = useMemo(() => Object.values(sacola), [sacola]);
  const qtdSelecionados = itensSelecionados.length;
  const numeracaoAtualLabel =
    regiao && tamanho ? formatarTamanho(regiao, tamanho) : "";

  const selecionarRegiao = (id: RegiaoCatalogo) => {
    setIdioma(id === "usa" ? "en" : "pt");
    setRegiao(id);
  };

  useEffect(() => {
    setSegmento(null);
    setTamanho(null);
    setCatalogo({ itens: [], fotos: {} });
    setSacola({});
    setVerCarrinho(false);
    setErro(null);
  }, [regiao]);

  useEffect(() => {
    setTamanho(null);
    setCatalogo({ itens: [], fotos: {} });
    setVerCarrinho(false);
    setErro(null);
  }, [segmento]);

  useEffect(() => {
    let cancelado = false;

    async function carregarCatalogo() {
      if (!regiaoConfig || !tamanho) {
        setCatalogo({ itens: [], fotos: {} });
        return;
      }

      setLoading(true);
      setErro(null);
      setVerCarrinho(false);

      try {
        const itens = await catalogoKropCafeService.buscar({
          displaySizeSystem: regiaoConfig.displaySystem,
          numeracao: tamanho,
        });
        const idsModelo = [...new Set(itens.map((item) => item.id_modelo_produto))];
        const fotosMap = await catalogoKropCafeService.listarGaleriaUrlsPorModelos(idsModelo);

        if (!cancelado) setCatalogo({ itens, fotos: fotosMap });
      } catch (e) {
        if (!cancelado) {
          setCatalogo({ itens: [], fotos: {} });
          setErro(mensagemErro(e));
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    }

    carregarCatalogo();
    return () => {
      cancelado = true;
    };
  }, [regiaoConfig, tamanho]);

  const alternarSelecionado = (
    item: ItemCatalogoKropCafePublico,
    fotos: string[],
    numeracaoLabel: string,
  ) => {
    setSacola((prev) => {
      const next = { ...prev };
      if (next[item.id]) delete next[item.id];
      else next[item.id] = { item, fotos, numeracaoLabel };
      return next;
    });
  };

  const limparSacola = () => {
    setSacola({});
    setVerCarrinho(false);
  };

  const recomecar = () => {
    setRegiao(null);
    setSegmento(null);
    setTamanho(null);
    setCatalogo({ itens: [], fotos: {} });
    setSacola({});
    setVerCarrinho(false);
    setErro(null);
  };

  const voltar = () => {
    if (verCarrinho) {
      setVerCarrinho(false);
      return;
    }
    if (tamanho) {
      setTamanho(null);
      setCatalogo({ itens: [], fotos: {} });
      return;
    }
    if (segmento) {
      setSegmento(null);
      return;
    }
    if (regiao) {
      setRegiao(null);
    }
  };

  const tituloEtapa = verCarrinho
    ? t.carrinhoTitulo
    : !regiao
      ? t.regioesTitulo
      : !segmento
        ? t.segmentosTitulo
        : !tamanho
          ? t.tamanhosTitulo
          : t.resultadoTitulo;

  return (
    <main className="h-screen overflow-hidden bg-[#050505] text-white">
      <section className="mx-auto flex h-screen w-full max-w-7xl flex-col px-3 py-2 sm:px-6 sm:py-3 lg:px-8">
        <header className="flex shrink-0 items-center justify-between gap-2 pb-2 sm:gap-3 sm:pb-3">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <img
              src="/kropcafe-logo-white-glow.png?v=2"
              alt="KropCafé"
              className="h-auto w-24 shrink-0 object-contain sm:w-32 md:w-44"
              draggable={false}
            />
            <div className="hidden items-center gap-2 sm:flex">
              {ETAPAS.map((etapa) => (
                <span
                  key={etapa}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border text-sm font-black transition",
                    etapaAtual === etapa
                      ? "border-[#d7b56d] bg-[#d7b56d] text-stone-950"
                      : etapaAtual > etapa
                        ? "border-[#d7b56d]/50 bg-[#d7b56d]/20 text-[#d7b56d]"
                        : "border-white/10 bg-white/[0.04] text-white/35",
                  )}
                >
                  {etapa}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            {qtdSelecionados > 0 && !verCarrinho ? (
              <button
                type="button"
                onClick={() => setVerCarrinho(true)}
                className="relative rounded-full border border-[#d7b56d]/50 bg-[#d7b56d]/15 px-3 py-1.5 text-[10px] font-bold text-[#d7b56d] transition hover:bg-[#d7b56d] hover:text-stone-950 sm:px-4 sm:py-2 sm:text-xs"
              >
                {t.verCarrinho}
                <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#d7b56d] px-1 text-[10px] font-black text-stone-950">
                  {qtdSelecionados}
                </span>
              </button>
            ) : null}
            <div className="rounded-full border border-white/10 bg-white/[0.06] p-1">
              <span className="sr-only">{t.idioma}</span>
              <div className="flex flex-wrap justify-end gap-1">
                {IDIOMAS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setIdioma(item.id)}
                    className={cn(
                      "rounded-full px-2 py-1.5 text-[10px] font-bold transition sm:px-3 sm:py-2 sm:text-xs",
                      idioma === item.id
                        ? "bg-[#d7b56d] text-stone-950"
                        : "text-white/70 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        <section className="flex min-h-0 flex-1 flex-col rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(215,181,109,0.14),rgba(255,255,255,0.055)_34%,rgba(255,255,255,0.035))] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur sm:rounded-[2rem] sm:p-4">
          <div className="mb-3 grid shrink-0 gap-2 sm:mb-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-3">
            <div className="hidden sm:block" />
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d7b56d] sm:text-xs sm:tracking-[0.24em]">{t.passo} {etapaAtual}</p>
              <h2 className="mt-0.5 text-xl font-black tracking-tight sm:mt-1 sm:text-2xl md:text-3xl lg:text-4xl">
                {tituloEtapa}
              </h2>
            </div>
            <div className="flex justify-center gap-2 sm:justify-end">
              {regiao || verCarrinho ? (
                <button
                  type="button"
                  onClick={voltar}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold text-white/75 transition hover:border-white/40 hover:text-white sm:px-4 sm:py-2 sm:text-sm"
                >
                  {t.voltar}
                </button>
              ) : null}
              {(regiao || segmento || tamanho || verCarrinho) && (
                <button
                  type="button"
                  onClick={recomecar}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold text-white/75 transition hover:border-white/40 hover:text-white sm:px-4 sm:py-2 sm:text-sm"
                >
                  {t.recomecar}
                </button>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {verCarrinho ? (
            <div className="relative flex min-h-0 flex-1 flex-col">
              <div className="mb-2 flex shrink-0 items-center justify-between gap-2 rounded-xl bg-white/[0.06] px-3 py-2 sm:mb-3 sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-3">
                <p className="text-sm font-black sm:text-lg">
                  {qtdSelecionados} {t.itens}
                </p>
                <div className="flex shrink-0 gap-2">
                  {qtdSelecionados > 0 ? (
                    <button
                      type="button"
                      onClick={limparSacola}
                      className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold text-white/75 transition hover:border-white/40 hover:text-white sm:px-4 sm:py-2 sm:text-sm"
                    >
                      {t.limparSelecao}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setVerCarrinho(false)}
                    className="rounded-full bg-[#d7b56d] px-3 py-1.5 text-xs font-black text-stone-950 transition hover:bg-[#e2c688] sm:px-4 sm:py-2 sm:text-sm"
                  >
                    {t.continuarEscolhendo}
                  </button>
                </div>
              </div>

              {qtdSelecionados === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-[1.5rem] border border-dashed border-white/20 bg-white/[0.04] p-8 text-center">
                  <p className="max-w-md text-lg font-semibold text-white/60">{t.carrinhoVazio}</p>
                </div>
              ) : (
                <AreaRolavel className="[scrollbar-color:#111827_rgba(0,0,0,0.08)]">
                  <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-3 pb-4 md:grid-cols-2 md:gap-4">
                    {itensSelecionados.map(({ item, fotos, numeracaoLabel }, index) => (
                      <ProdutoCard
                        key={item.id}
                        item={item}
                        fotos={fotos}
                        selecionado
                        numeracaoLabel={numeracaoLabel}
                        onToggle={() => alternarSelecionado(item, fotos, numeracaoLabel)}
                        prioridadeImagem={index < 4}
                        labels={{
                          semFoto: t.semFoto,
                          precoConsulta: t.precoConsulta,
                          gostei: t.remover,
                          selecionado: t.remover,
                        }}
                      />
                    ))}
                  </div>
                </AreaRolavel>
              )}
            </div>
          ) : !regiao ? (
            <AreaRolavel className="mx-auto w-full max-w-xl">
              <div className="flex flex-col gap-3 py-2">
              {ORDEM_REGIOES.map((id) => {
                const config = REGIOES[id];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => selecionarRegiao(id)}
                    className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.055] p-3 text-left transition hover:-translate-y-1 hover:border-[#d7b56d] hover:bg-white/[0.09] hover:shadow-[0_24px_80px_rgba(215,181,109,0.12)] sm:rounded-3xl sm:p-4"
                  >
                    <span className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#d7b56d]/10 transition group-hover:bg-[#d7b56d]/20" />
                    <span className="relative block text-2xl font-black tracking-tight sm:text-3xl">{config.label}</span>
                    <span className="relative mt-1.5 block text-xs font-medium text-white/60 sm:mt-2 sm:text-sm">{t.regionDescriptions[id]}</span>
                    <span className="relative mt-3 inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/75 group-hover:bg-[#d7b56d] group-hover:text-stone-950 sm:mt-4 sm:px-3 sm:py-1.5 sm:text-xs">
                      {t.escolher}
                    </span>
                  </button>
                );
              })}
              </div>
            </AreaRolavel>
          ) : !segmento && regiaoConfig ? (
            <AreaRolavel className="mx-auto w-full max-w-xl">
              <div className="flex flex-col gap-3 py-2">
              {regiaoConfig.segmentos.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSegmento(item.id)}
                  className="group rounded-2xl border border-white/10 bg-white/[0.055] p-3 text-left transition hover:-translate-y-1 hover:border-[#d7b56d] hover:bg-white/[0.09] hover:shadow-[0_24px_80px_rgba(215,181,109,0.12)] sm:rounded-3xl sm:p-4"
                >
                  <span className="block text-2xl font-black tracking-tight sm:text-3xl">{t.segmentLabels[item.id]}</span>
                  <span className="mt-1.5 block text-xs font-medium text-white/60 sm:mt-2 sm:text-sm">{t.segmentDescriptions[item.id]}</span>
                  <span className="mt-3 inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/75 group-hover:bg-[#d7b56d] group-hover:text-stone-950 sm:mt-4 sm:px-3 sm:py-1.5 sm:text-xs">
                    {t.escolher}
                  </span>
                </button>
              ))}
              </div>
            </AreaRolavel>
          ) : regiao && segmentoConfig && !tamanho ? (
            <AreaRolavel className="flex items-start justify-center">
              <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.18)] sm:rounded-[2rem] sm:p-5">
                <label htmlFor="catalogo-tamanho" className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-[#d7b56d] sm:mb-3 sm:text-sm sm:tracking-[0.24em]">
                  {t.tamanhosTitulo}
                </label>
                <select
                  id="catalogo-tamanho"
                  value=""
                  onChange={(event) => {
                    if (event.target.value) setTamanho(event.target.value);
                  }}
                  className="w-full rounded-xl border border-white/10 bg-stone-950 px-4 py-3.5 text-lg font-black text-white outline-none transition focus:border-[#d7b56d] focus:ring-4 focus:ring-[#d7b56d]/20 sm:rounded-2xl sm:px-5 sm:py-5 sm:text-2xl"
                >
                  <option value="">{t.tamanhosTitulo}</option>
                  {tamanhoOpcoes.map((valor) => (
                    <option key={valor} value={valor}>
                      {formatarTamanho(regiao, valor)}
                    </option>
                  ))}
                </select>
              </div>
            </AreaRolavel>
          ) : (
            <div className="relative flex min-h-0 flex-1 flex-col">
              <div className="mb-2 flex shrink-0 items-center justify-between gap-2 rounded-xl bg-white/[0.06] px-3 py-2 sm:mb-3 sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black sm:text-lg">
                    {tamanho && regiao ? formatarTamanho(regiao, tamanho) : t.aguardando}
                  </p>
                </div>
                {tamanho && (
                  <p className="shrink-0 rounded-full bg-[#d7b56d] px-2 py-1 text-[10px] font-black text-stone-950 sm:px-3 sm:py-1.5 sm:text-xs">
                    {loading ? t.carregando : `${catalogo.itens.length} ${t.itens}`}
                  </p>
                )}
              </div>

              {loading ? (
                <AreaRolavel className="[scrollbar-color:#111827_rgba(0,0,0,0.08)]">
                  <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-3 pb-4 md:grid-cols-2 md:gap-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="aspect-square animate-pulse rounded-2xl bg-white/70" />
                    ))}
                  </div>
                </AreaRolavel>
              ) : erro ? (
                <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-6 text-red-700">
                  {t.erroCatalogo}: {erro}
                </div>
              ) : catalogo.itens.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-[1.5rem] border border-dashed border-white/20 bg-white/[0.04] p-8 text-center">
                  <p className="max-w-md text-lg font-semibold text-white/60">{t.nenhumItem}</p>
                </div>
              ) : (
                <AreaRolavel className="[scrollbar-color:#111827_rgba(0,0,0,0.08)]">
                  <div
                    className={cn(
                      "mx-auto grid w-full max-w-5xl grid-cols-1 gap-3 md:grid-cols-2 md:gap-4",
                      qtdSelecionados > 0 ? "pb-28" : "pb-4",
                    )}
                  >
                    {catalogo.itens.map((item, index) => {
                      const fotos = catalogo.fotos[item.id_modelo_produto] ?? [];
                      const naSacola = sacola[item.id];
                      return (
                      <ProdutoCard
                        key={item.id}
                        item={item}
                        fotos={fotos}
                        selecionado={Boolean(naSacola)}
                        numeracaoLabel={naSacola?.numeracaoLabel ?? numeracaoAtualLabel}
                        onToggle={() =>
                          alternarSelecionado(
                            item,
                            fotos,
                            naSacola?.numeracaoLabel ?? numeracaoAtualLabel,
                          )
                        }
                        prioridadeImagem={index < 4}
                        labels={{
                          semFoto: t.semFoto,
                          precoConsulta: t.precoConsulta,
                          gostei: t.gostei,
                          selecionado: t.selecionado,
                        }}
                      />
                      );
                    })}
                  </div>
                </AreaRolavel>
              )}

              {qtdSelecionados > 0 && (
                <div className="absolute inset-x-0 bottom-0 z-10 rounded-xl border border-[#d7b56d]/40 bg-stone-950/95 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur sm:rounded-[1.5rem] sm:p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#d7b56d] sm:text-xs sm:tracking-[0.2em]">
                        {t.selecionados}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-black sm:mt-1 sm:text-base">
                        {qtdSelecionados} {t.itens}:{" "}
                        {itensSelecionados
                          .map(({ item, numeracaoLabel }) => `${item.sku} (${numeracaoLabel})`)
                          .join(", ")}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={limparSacola}
                        className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold text-white/75 transition hover:border-white/40 hover:text-white sm:px-4 sm:py-2 sm:text-sm"
                      >
                        {t.limparSelecao}
                      </button>
                      <button
                        type="button"
                        onClick={() => setVerCarrinho(true)}
                        className="rounded-full bg-[#d7b56d] px-3 py-1.5 text-xs font-black text-stone-950 transition hover:bg-[#e2c688] sm:px-4 sm:py-2 sm:text-sm"
                      >
                        {t.verCarrinho}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
        </section>
      </section>
    </main>
  );
}
