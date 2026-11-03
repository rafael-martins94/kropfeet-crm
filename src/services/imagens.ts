import { supabase } from "../lib/supabase";
import { FILTRO_CATEGORIA_SEM } from "./itens-estoque";
import { compareNatural } from "../utils/naturalSort";
import type { PaginationParams, StatusItem } from "../types/entities";
import {
  formatSizeLabel,
  getAllSizeEquivalences,
  getUsDisplayLabel,
  matchesSizeFilter,
  type DisplaySizeSystem,
} from "../utils/sizeConversion";

/** Região do estoque onde o par está. */
export type FiltroRegiaoImagens = "" | "brasil" | "europa";

type ParamsListagemImagens = PaginationParams & {
  apenasPrincipais?: boolean;
  categoriaIds?: string[];
  /** Status dos itens do modelo (vazio = todo o catálogo, sem olhar o estoque). */
  status?: StatusItem[];
  regiao?: FiltroRegiaoImagens;
  numeracao?: string;
  /** Tabela da numeração digitada (BR, EU ou US). */
  padraoNumeracao?: DisplaySizeSystem;
};

/** Par em estoque do modelo que atende aos filtros, para abrir o item. */
export interface ItemEstoqueDaImagem {
  id: string;
  sku: string;
  numeracao: string;
  regiao: string | null;
  status: StatusItem;
}

type ParEmEstoque = {
  id: string;
  sku: string;
  id_modelo_produto: string;
  numeracao_br: number | null;
  numeracao_eu: number | null;
  numeracao_us: string | null;
  nome_produto: string | null;
  status_item: StatusItem;
  local: { tipo_regiao: string | null } | null;
};

const LOTE_PARES = 1000;
/** Ids por requisição no filtro `in` (mantém a URL curta). */
const LOTE_MODELOS = 150;

function rotuloNumeracao(par: ParEmEstoque, padrao: DisplaySizeSystem): string {
  if (padrao === "us") return getUsDisplayLabel(par);
  return formatSizeLabel(getAllSizeEquivalences(par)[padrao], padrao);
}

/** Itens por modelo, já filtrados por status, região e numeração. */
async function paresEmEstoquePorModelo(
  status: StatusItem[],
  regiao: FiltroRegiaoImagens,
  numeracao: string,
  padrao: DisplaySizeSystem,
): Promise<Map<string, ItemEstoqueDaImagem[]>> {
  const pares: ParEmEstoque[] = [];
  for (let offset = 0; ; offset += LOTE_PARES) {
    let consulta = supabase
      .from("itens_estoque")
      .select(
        "id, sku, id_modelo_produto, numeracao_br, numeracao_eu, numeracao_us, nome_produto, status_item, local:locais_estoque(tipo_regiao)",
      );
    if (status.length > 0) consulta = consulta.in("status_item", status);
    const { data, error } = await consulta
      .order("id", { ascending: true })
      .range(offset, offset + LOTE_PARES - 1);
    if (error) throw error;
    const lote = (data ?? []) as unknown as ParEmEstoque[];
    pares.push(...lote);
    if (lote.length < LOTE_PARES) break;
  }

  // O número é lido na tabela escolhida; "BR 37", "EU 42" e "9Y" valem em qualquer uma.
  const porModelo = new Map<string, ItemEstoqueDaImagem[]>();
  for (const par of pares) {
    if (!par.id_modelo_produto) continue;
    if (regiao && par.local?.tipo_regiao !== regiao) continue;
    if (numeracao && !matchesSizeFilter(par, padrao, numeracao)) continue;
    const lista = porModelo.get(par.id_modelo_produto) ?? [];
    lista.push({
      id: par.id,
      sku: par.sku,
      numeracao: rotuloNumeracao(par, padrao),
      regiao: par.local?.tipo_regiao ?? null,
      status: par.status_item,
    });
    porModelo.set(par.id_modelo_produto, lista);
  }
  return porModelo;
}

function montarConsultaImagens(params: ParamsListagemImagens | undefined, contar: boolean) {
  const termo = params?.search?.trim();
  const categoriaIds = params?.categoriaIds ?? [];
  const filtroCat = categoriaIds.length > 0;
  const precisaInnerModelo = filtroCat || Boolean(termo);

  const modeloEmbed = precisaInnerModelo
    ? "modelo:modelos_produto!inner(id, nome_modelo, slug, id_categoria, categoria:categorias(id, nome))"
    : "modelo:modelos_produto(id, nome_modelo, slug, id_categoria, categoria:categorias(id, nome))";

  let query = supabase
    .from("imagens_modelo_produto")
    .select(`*, ${modeloEmbed}`, contar ? { count: "exact" } : undefined);

  if (params?.apenasPrincipais) query = query.eq("imagem_principal", true);

  if (filtroCat) {
    const semCategoria = categoriaIds.includes(FILTRO_CATEGORIA_SEM);
    const idsCategoria = categoriaIds.filter((v) => v !== FILTRO_CATEGORIA_SEM);

    if (semCategoria && idsCategoria.length === 0) {
      query = query.is("modelo.id_categoria", null);
    } else if (semCategoria && idsCategoria.length > 0) {
      query = query.or(
        `modelo.id_categoria.is.null,modelo.id_categoria.in.(${idsCategoria.join(",")})`,
      );
    } else if (idsCategoria.length === 1) {
      query = query.eq("modelo.id_categoria", idsCategoria[0]);
    } else if (idsCategoria.length > 1) {
      query = query.in("modelo.id_categoria", idsCategoria);
    }
  }

  if (termo) {
    const padrao = `%${termo.replace(/%/g, "")}%`;
    query = query.ilike("modelo.nome_modelo", padrao);
  }

  return query;
}

/** Item do modelo para o modal "Ver detalhes" da galeria. */
export interface ItemDetalheModelo {
  id: string;
  sku: string;
  numeracao: string;
  status: StatusItem;
  precoVenda: number | null;
  moedaVenda: string | null;
  local: string | null;
  regiao: string | null;
}

type ItemModeloBruto = ParEmEstoque & {
  preco_venda: number | null;
  moeda_venda: string | null;
  local: { tipo_regiao: string | null; nome: string | null } | null;
};

function compararImagens(a: ImagemDetalhada, b: ImagemDetalhada): number {
  if (a.imagem_principal !== b.imagem_principal) return a.imagem_principal ? -1 : 1;
  return b.criado_em.localeCompare(a.criado_em);
}

export interface ImagemDetalhada {
  id: string;
  id_modelo_produto: string;
  url_origem: string | null;
  caminho_arquivo: string | null;
  ordem_exibicao: number;
  imagem_principal: boolean;
  tipo_origem: string;
  criado_em: string;
  modelo: {
    id: string;
    nome_modelo: string;
    slug: string;
    id_categoria?: string | null;
    categoria?: { id: string; nome: string } | null;
  } | null;
  /** Pares em estoque do modelo que atendem ao filtro (só com filtro de estoque/numeração). */
  itensEstoque?: ItemEstoqueDaImagem[];
}

export const imagensService = {
  /** Itens de um modelo com os mesmos filtros de status, região e numeração da galeria. */
  itensDoModelo: async (
    idModelo: string,
    filtros: {
      status?: StatusItem[];
      regiao?: FiltroRegiaoImagens;
      numeracao?: string;
      padraoNumeracao?: DisplaySizeSystem;
    },
  ): Promise<ItemDetalheModelo[]> => {
    const status = filtros.status ?? [];
    const regiao = filtros.regiao ?? "";
    const numeracao = filtros.numeracao?.trim() ?? "";
    const padrao = filtros.padraoNumeracao ?? "br";

    let consulta = supabase
      .from("itens_estoque")
      .select(
        "id, sku, id_modelo_produto, numeracao_br, numeracao_eu, numeracao_us, nome_produto, status_item, preco_venda, moeda_venda, local:locais_estoque(nome, tipo_regiao)",
      )
      .eq("id_modelo_produto", idModelo);
    if (status.length > 0) consulta = consulta.in("status_item", status);
    const { data, error } = await consulta;
    if (error) throw error;

    return ((data ?? []) as unknown as ItemModeloBruto[])
      .filter((item) => !regiao || item.local?.tipo_regiao === regiao)
      .filter((item) => !numeracao || matchesSizeFilter(item, padrao, numeracao))
      .map((item) => ({
        id: item.id,
        sku: item.sku,
        numeracao: rotuloNumeracao(item, padrao),
        status: item.status_item,
        precoVenda: item.preco_venda,
        moedaVenda: item.moeda_venda,
        local: item.local?.nome ?? null,
        regiao: item.local?.tipo_regiao ?? null,
      }))
      .sort((a, b) => compareNatural(a.sku, b.sku));
  },

  listar: async (params?: ParamsListagemImagens) => {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 24;
    const numeracao = params?.numeracao?.trim() ?? "";
    const regiao = params?.regiao ?? "";
    const status = params?.status ?? [];
    // Com status, região ou numeração, a galeria mostra só os modelos que têm itens assim.
    const filtrarPorEstoque = status.length > 0 || Boolean(regiao || numeracao);

    if (filtrarPorEstoque) {
      const pares = await paresEmEstoquePorModelo(
        status,
        regiao,
        numeracao,
        params?.padraoNumeracao ?? "br",
      );
      const idsModelo = [...pares.keys()];
      const imagens: ImagemDetalhada[] = [];
      for (let i = 0; i < idsModelo.length; i += LOTE_MODELOS) {
        const { data, error } = await montarConsultaImagens(params, false).in(
          "id_modelo_produto",
          idsModelo.slice(i, i + LOTE_MODELOS),
        );
        if (error) throw error;
        imagens.push(...((data ?? []) as unknown as ImagemDetalhada[]));
      }
      imagens.sort(compararImagens);
      const from = (page - 1) * pageSize;
      return {
        data: imagens
          .slice(from, from + pageSize)
          .map((img) => ({ ...img, itensEstoque: pares.get(img.id_modelo_produto) ?? [] })),
        total: imagens.length,
        page,
        pageSize,
      };
    }

    let query = montarConsultaImagens(params, true)
      .order("imagem_principal", { ascending: false })
      .order("criado_em", { ascending: false });

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;
    return {
      data: (data ?? []) as unknown as ImagemDetalhada[],
      total: count ?? 0,
      page,
      pageSize,
    };
  },
};
