import { supabase } from "../lib/supabase";
import type {
  ItemEstoque,
  ItemEstoqueInsert,
  ItemEstoqueUpdate,
  PaginatedResult,
  PaginationParams,
  StatusItem,
} from "../types/entities";
import {
  matchesSizeFilter,
  type DisplaySizeSystem,
} from "../utils/sizeConversion";
import { compareNatural } from "../utils/naturalSort";
import { padraoIlikePostgrest } from "../utils/postgrestFilter";
import { atualizar, deletar, inserir, obterPorId } from "./base";
import { conferenciasEstoqueService, type SituacaoConferenciaFiltro } from "./conferencias-estoque";

export type { SituacaoConferenciaFiltro };

export type RegiaoEstoqueFiltro = "" | "br" | "eu";

const REGIAO_PARA_PAISES_LOCAL: Record<Exclude<RegiaoEstoqueFiltro, "">, string[]> = {
  br: ["Brasil"],
  eu: ["Portugal"],
};

const REGIAO_PARA_TIPO_LOCAL: Record<Exclude<RegiaoEstoqueFiltro, "">, string> = {
  br: "brasil",
  eu: "europa",
};

/** IDs dos locais de estoque que pertencem à região informada. */
export function idsLocaisPorRegiao(
  locais: Array<{ id: string; pais?: string | null; tipo_regiao?: string | null }>,
  regiao: RegiaoEstoqueFiltro,
): string[] {
  if (!regiao) return [];

  const paises = REGIAO_PARA_PAISES_LOCAL[regiao];
  const tipoRegiao = REGIAO_PARA_TIPO_LOCAL[regiao];

  return locais
    .filter(
      (local) =>
        (local.pais != null && paises.includes(local.pais)) || local.tipo_regiao === tipoRegiao,
    )
    .map((local) => local.id);
}

export interface ItemEstoqueDetalhado extends ItemEstoque {
  modelo?: { id: string; nome_modelo: string; slug: string; id_categoria?: string | null } | null;
  fornecedor?: { id: string; nome: string } | null;
  local?: { id: string; nome: string; codigo: string; pais?: string | null; tipo_regiao?: string } | null;
}

export interface ItemEstoqueVitrine extends ItemEstoque {
  modelo?: {
    id: string;
    nome_modelo: string;
    slug: string;
    id_categoria?: string | null;
    id_marca?: string | null;
    marca?: { id: string; nome: string } | null;
    categoria?: { id: string; nome: string } | null;
  } | null;
  local?: { id: string; nome: string; codigo: string; pais?: string | null; tipo_regiao?: string } | null;
  contagem_modelo_disponivel?: number;
}

export type ItemCatalogoKropCafe = Pick<
  ItemEstoque,
  | "id"
  | "sku"
  | "id_modelo_produto"
  | "numeracao_br"
  | "numeracao_eu"
  | "numeracao_us"
  | "preco_venda"
  | "moeda_venda"
> & {
  local?: { tipo_regiao?: string | null } | null;
};

/** Colunas ordenáveis na lista com relacionamentos (alinhado ao PostgREST / FK `locais_estoque`). */
export const COLUNAS_ORDEM_ITEM_ESTOQUE = [
  "sku",
  "nome_produto",
  "numeracao_br",
  "status_item",
  "visivel_cafe",
  "preco_venda",
  "local_nome",
  "atualizado_em",
] as const;

export type ColunaOrdemItemEstoque = (typeof COLUNAS_ORDEM_ITEM_ESTOQUE)[number];

export const COLUNAS_ORDEM_VITRINE = [
  ...COLUNAS_ORDEM_ITEM_ESTOQUE,
  "contagem_modelo_disponivel",
] as const;

export type ColunaOrdemVitrine = (typeof COLUNAS_ORDEM_VITRINE)[number];

function aplicarContagemDisponivelVitrine(
  rows: ItemEstoqueVitrine[],
  porModelo: Map<string, number>,
  opts: {
    disponiveisExatos?: number;
    ordenacao?: { coluna: ColunaOrdemVitrine; ascendente: boolean };
  },
): ItemEstoqueVitrine[] {
  let result = rows.map((row) => ({
    ...row,
    contagem_modelo_disponivel: porModelo.get(row.id_modelo_produto) ?? 0,
  }));

  if (opts.disponiveisExatos != null) {
    result = result.filter((row) => (row.contagem_modelo_disponivel ?? 0) === opts.disponiveisExatos!);
  }

  if (opts.ordenacao?.coluna === "contagem_modelo_disponivel") {
    const asc = opts.ordenacao.ascendente;
    result = [...result].sort((a, b) => {
      const cmp = (a.contagem_modelo_disponivel ?? 0) - (b.contagem_modelo_disponivel ?? 0);
      if (cmp !== 0) return asc ? cmp : -cmp;
      return a.id.localeCompare(b.id);
    });
  } else if (opts.ordenacao?.coluna === "local_nome") {
    result = ordenarPorLocalNome(result, opts.ordenacao.ascendente);
  }

  return result;
}

/** Valor especial para filtrar itens cujo modelo não tem categoria. */
export const FILTRO_CATEGORIA_SEM = "__sem_categoria__" as const;

/** Valor especial para filtrar itens sem local definido. */
export const FILTRO_LOCAL_SEM = "__sem_local__" as const;

export type FiltroLocalItem = "" | typeof FILTRO_LOCAL_SEM | string;

export type FiltroCategoriaItem = "" | typeof FILTRO_CATEGORIA_SEM | string;

export interface ItemEstoquePrecoHistorico {
  id: string;
  id_item_estoque: string;
  preco_anterior: number | null;
  moeda_anterior: string | null;
  preco_novo: number | null;
  moeda_nova: string | null;
  id_usuario: string | null;
  origem: string;
  criado_em: string;
  nome_usuario?: string | null;
}

function normalizarFiltroLista<T extends string>(
  valor: T | T[] | "" | undefined,
): T[] {
  if (valor === undefined || valor === "" || (Array.isArray(valor) && valor.length === 0)) {
    return [];
  }
  return Array.isArray(valor) ? valor : [valor];
}

function compararTextoOrdenacao(
  a: string | null | undefined,
  b: string | null | undefined,
  ascendente: boolean,
): number {
  const textoA = a?.trim() ?? "";
  const textoB = b?.trim() ?? "";
  if (!textoA && !textoB) return 0;
  if (!textoA) return 1;
  if (!textoB) return -1;
  const cmp = textoA.localeCompare(textoB, "pt-BR", { numeric: true, sensitivity: "base" });
  return ascendente ? cmp : -cmp;
}

function ordenarPorLocalNome<T extends { id: string; id_modelo_produto: string; local?: { nome?: string | null } | null }>(
  rows: T[],
  ascendente: boolean,
): T[] {
  return [...rows].sort((a, b) => {
    const cmpLocal = compararTextoOrdenacao(a.local?.nome, b.local?.nome, ascendente);
    if (cmpLocal !== 0) return cmpLocal;
    const cmpModelo = a.id_modelo_produto.localeCompare(b.id_modelo_produto);
    if (cmpModelo !== 0) return cmpModelo;
    return a.id.localeCompare(b.id);
  });
}

export const itensEstoqueService = {
  obter: (id: string) => obterPorId("itens_estoque", id),
  criar: (registro: ItemEstoqueInsert) => inserir("itens_estoque", registro),
  atualizar: (id: string, patch: ItemEstoqueUpdate) =>
    atualizar("itens_estoque", id, patch),

  atualizarPrecoVenda: async (params: {
    idItem: string;
    precoNovo: number;
    moedaNova?: string | null;
    idUsuario: string;
    origem?: string;
  }): Promise<{ preco_venda: number; moeda_venda: string | null }> => {
    const { data, error } = await (supabase as unknown as {
      rpc: (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: Error | null }>;
    }).rpc("atualizar_preco_venda_item", {
      p_id_item: params.idItem,
      p_preco_novo: params.precoNovo,
      p_moeda_nova: params.moedaNova ?? null,
      p_origem: params.origem ?? "manual",
      p_id_usuario: params.idUsuario,
    });
    if (error) throw error;
    const row = data as { preco_venda: number; moeda_venda: string | null };
    return row;
  },

  listarHistoricoPrecoVenda: async (idItem: string): Promise<ItemEstoquePrecoHistorico[]> => {
    const { data, error } = await (supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (c: string, v: string) => {
            order: (c: string, opts: { ascending: boolean }) => Promise<{
              data: ItemEstoquePrecoHistorico[] | null;
              error: Error | null;
            }>;
          };
        };
      };
    })
      .from("itens_estoque_preco_historico")
      .select("*")
      .eq("id_item_estoque", idItem)
      .order("criado_em", { ascending: false });

    if (error) throw error;
    const rows = data ?? [];
    const idsUsuarios = [...new Set(rows.map((r) => r.id_usuario).filter(Boolean))] as string[];

    const nomes = new Map<string, string>();
    if (idsUsuarios.length > 0) {
      const { data: perfis } = await (supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            in: (c: string, v: string[]) => Promise<{
              data: Array<{ id: string; nome: string }> | null;
              error: unknown;
            }>;
          };
        };
      })
        .from("perfis_usuario")
        .select("id, nome")
        .in("id", idsUsuarios);
      for (const p of perfis ?? []) {
        nomes.set(p.id, p.nome);
      }
    }

    return rows.map((row) => ({
      ...row,
      nome_usuario: row.id_usuario ? nomes.get(row.id_usuario) ?? null : null,
    }));
  },

  deletar: (id: string) => deletar("itens_estoque", id),

  /** Atualiza `status_item` de vários itens numa única requisição. */
  atualizarStatusEmMassa: async (ids: string[], status_item: StatusItem): Promise<void> => {
    if (ids.length === 0) return;
    const { error } = await supabase
      .from("itens_estoque")
      .update({ status_item })
      .in("id", ids);
    if (error) throw error;
  },

  /** Remove vários itens numa única requisição. */
  deletarEmMassa: async (ids: string[]): Promise<void> => {
    if (ids.length === 0) return;
    const { error } = await supabase.from("itens_estoque").delete().in("id", ids);
    if (error) throw error;
  },

  listarComRelacoes: async (
    params?: PaginationParams & {
      status?: StatusItem | "" | StatusItem[];
      /** UUID da categoria, `FILTRO_CATEGORIA_SEM`, vazio ou lista (sem filtro). */
      idCategoria?: FiltroCategoriaItem | FiltroCategoriaItem[];
      /** UUID do local, `FILTRO_LOCAL_SEM`, vazio ou lista (sem filtro). */
      idLocalEstoque?: FiltroLocalItem | FiltroLocalItem[];
      /** BR/EU, aplicado a partir do país cadastrado no local de estoque relacionado. */
      regiaoEstoque?: RegiaoEstoqueFiltro;
      ordenacao?: { coluna: ColunaOrdemItemEstoque; ascendente: boolean };
      displaySizeSystem?: DisplaySizeSystem;
      numeracao?: string;
      /** Filtro da tela de conferência: pendentes ou conferidos na sessão. */
      situacaoConferencia?: SituacaoConferenciaFiltro;
      /** UUID da sessão de conferência ativa. */
      idConferencia?: string;
    },
  ) => {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
    const termo = params?.search?.trim();

    const coluna = params?.ordenacao?.coluna ?? "atualizado_em";
    const ascendente = params?.ordenacao?.ascendente ?? false;

    const filtroCatLista = normalizarFiltroLista(params?.idCategoria);
    const filtroLocalLista = normalizarFiltroLista(params?.idLocalEstoque);
    const filtroStatusLista = normalizarFiltroLista(params?.status);
    const filtroRegiao = params?.regiaoEstoque ?? "";
    const filtroNumeracao = params?.numeracao?.trim();
    const displaySizeSystem = params?.displaySizeSystem ?? "br";
    const situacaoConferencia = params?.situacaoConferencia ?? "";
    const idConferencia = params?.idConferencia;
    const ordenarSkuEmMemoria = coluna === "sku";
    const ordenarLocalEmMemoria = coluna === "local_nome";
    const processarEmMemoria = Boolean(filtroNumeracao) || ordenarSkuEmMemoria || ordenarLocalEmMemoria;

    const idsConferidosNaSessao =
      situacaoConferencia === "pendentes" && idConferencia
        ? await conferenciasEstoqueService.idsItensConferidosNaConferencia(idConferencia)
        : [];

    const modeloEmbed =
      filtroCatLista.length > 0
        ? "modelo:modelos_produto!inner(id, nome_modelo, slug, id_categoria)"
        : "modelo:modelos_produto(id, nome_modelo, slug, id_categoria)";
    const localEmbed =
      filtroRegiao
        ? "local:locais_estoque!inner(id, nome, codigo, pais, tipo_regiao)"
        : "local:locais_estoque(id, nome, codigo, pais, tipo_regiao)";
    const conferenciaEmbed =
      situacaoConferencia === "conferidos" && idConferencia
        ? "conferencias_estoque!inner(id, id_conferencia)"
        : null;

    const buildQuery = () => {
      const relacoes = [
        "*",
        modeloEmbed,
        "fornecedor:fornecedores(id, nome)",
        localEmbed,
        ...(conferenciaEmbed ? [conferenciaEmbed] : []),
      ].join(",\n           ");

      let query = supabase
        .from("itens_estoque")
        .select(relacoes, { count: "exact" });

      if (filtroStatusLista.length === 1) {
        query = query.eq("status_item", filtroStatusLista[0]);
      } else if (filtroStatusLista.length > 1) {
        query = query.in("status_item", filtroStatusLista);
      }

      if (filtroCatLista.length > 0) {
        const semCategoria = filtroCatLista.includes(FILTRO_CATEGORIA_SEM);
        const idsCategoria = filtroCatLista.filter((v): v is string => v !== FILTRO_CATEGORIA_SEM);

        if (semCategoria && idsCategoria.length === 0) {
          query = query.is("modelo.id_categoria", null);
        } else if (semCategoria && idsCategoria.length > 0) {
          query = query.or(
            `modelo.id_categoria.is.null,modelo.id_categoria.in.(${idsCategoria.join(",")})`,
          );
        } else if (idsCategoria.length === 1) {
          query = query.eq("modelo.id_categoria", idsCategoria[0]);
        } else {
          query = query.in("modelo.id_categoria", idsCategoria);
        }
      }

      if (filtroLocalLista.length > 0) {
        const semLocal = filtroLocalLista.includes(FILTRO_LOCAL_SEM);
        const idsLocal = filtroLocalLista.filter((v): v is string => v !== FILTRO_LOCAL_SEM);

        if (semLocal && idsLocal.length === 0) {
          query = query.is("id_local_estoque", null);
        } else if (semLocal && idsLocal.length > 0) {
          query = query.or(`id_local_estoque.is.null,id_local_estoque.in.(${idsLocal.join(",")})`);
        } else if (idsLocal.length === 1) {
          query = query.eq("id_local_estoque", idsLocal[0]);
        } else {
          query = query.in("id_local_estoque", idsLocal);
        }
      }

      if (filtroRegiao) {
        query = query.in("local.pais", REGIAO_PARA_PAISES_LOCAL[filtroRegiao]);
      }

      if (situacaoConferencia === "conferidos" && idConferencia) {
        query = query.eq("conferencias_estoque.id_conferencia", idConferencia);
      } else if (
        situacaoConferencia === "pendentes" &&
        idsConferidosNaSessao.length > 0
      ) {
        query = query.not("id", "in", `(${idsConferidosNaSessao.join(",")})`);
      }

      if (termo) {
        const padrao = padraoIlikePostgrest(termo);
        query = query.or(
          `sku.ilike.${padrao},nome_produto.ilike.${padrao}`,
        );
      }

      /** Desempate estável entre páginas */
      const comDesempate = <T extends typeof query>(q: T) =>
        q.order("id", { ascending: true });

      switch (coluna) {
        case "local_nome":
          query = comDesempate(
            query.order("nome", {
              ascending: ascendente,
              foreignTable: "local",
              nullsFirst: false,
            }),
          );
          break;
        case "numeracao_br":
          query = comDesempate(
            query.order("numeracao_br", {
              ascending: ascendente,
              nullsFirst: false,
            }),
          );
          break;
        case "sku":
          // Ordenação natural (100, 103, 1003) feita em memória após buscar os registros.
          query = comDesempate(query.order("id", { ascending: true }));
          break;
        default:
          query = comDesempate(query.order(coluna, { ascending: ascendente }));
      }

      return query;
    };

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    if (processarEmMemoria) {
      const chunkSize = 1000;
      const todos: ItemEstoqueDetalhado[] = [];

      for (let offset = 0; ; offset += chunkSize) {
        const { data, error } = await buildQuery().range(offset, offset + chunkSize - 1);
        if (error) throw error;

        const lote = (data ?? []) as unknown as ItemEstoqueDetalhado[];
        todos.push(...lote);
        if (lote.length < chunkSize) break;
      }

      let filtrados = filtroNumeracao
        ? todos.filter((item) => matchesSizeFilter(item, displaySizeSystem, filtroNumeracao))
        : todos;

      if (ordenarSkuEmMemoria) {
        filtrados = [...filtrados].sort((a, b) => {
          const cmp = compareNatural(a.sku, b.sku);
          if (cmp !== 0) return ascendente ? cmp : -cmp;
          return a.id.localeCompare(b.id);
        });
      }

      if (ordenarLocalEmMemoria) {
        filtrados = ordenarPorLocalNome(filtrados, ascendente);
      }

      return {
        data: filtrados.slice(from, to + 1),
        total: filtrados.length,
        page,
        pageSize,
      };
    }

    const { data, error, count } = await buildQuery().range(from, to);
    if (error) throw error;
    return {
      data: (data ?? []) as unknown as ItemEstoqueDetalhado[],
      total: count ?? 0,
      page,
      pageSize,
    };
  },

  listarParaVitrine: async (
    params: PaginationParams & {
      idsLocaisEuropa: string[];
      idsLocaisContagem?: string[];
      idsExcluidos?: string[];
      idCategoria?: FiltroCategoriaItem | FiltroCategoriaItem[];
      idMarca?: string | string[];
      ordenacao?: { coluna: ColunaOrdemVitrine; ascendente: boolean };
      displaySizeSystem?: DisplaySizeSystem;
      numeracao?: string;
      disponiveisExatos?: number;
      search?: string;
    },
  ): Promise<PaginatedResult<ItemEstoqueVitrine>> => {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 50;
    const termo = params.search?.trim();
    const coluna = params.ordenacao?.coluna ?? "atualizado_em";
    const ascendente = params.ordenacao?.ascendente ?? false;
    const filtroNumeracao = params.numeracao?.trim();
    const displaySizeSystem = params.displaySizeSystem ?? "br";
    const disponiveisExatos = params.disponiveisExatos;
    const idsLocaisEuropa = [...new Set(params.idsLocaisEuropa)].filter(Boolean);
    const idsLocaisContagem = [...new Set(params.idsLocaisContagem ?? idsLocaisEuropa)].filter(Boolean);
    const idsExcluidos = [...new Set(params.idsExcluidos ?? [])].filter(Boolean);
    const filtroCatLista = normalizarFiltroLista(params.idCategoria);
    const filtroMarcaLista = normalizarFiltroLista(params.idMarca as string | string[] | "" | undefined);
    const ordenarSkuEmMemoria = coluna === "sku";
    const ordenarLocalEmMemoria = coluna === "local_nome";
    const ordenarContagemEmMemoria = coluna === "contagem_modelo_disponivel";
    const filtrarDisponiveis = disponiveisExatos != null;
    const precisaContagemCompleta = ordenarContagemEmMemoria || filtrarDisponiveis;
    const processarEmMemoria = Boolean(filtroNumeracao) || ordenarSkuEmMemoria || ordenarLocalEmMemoria || precisaContagemCompleta;

    if (idsLocaisEuropa.length === 0) {
      return { data: [], total: 0, page, pageSize };
    }

    const modeloEmbed =
      filtroCatLista.length > 0 || filtroMarcaLista.length > 0
        ? "modelo:modelos_produto!inner(id, nome_modelo, slug, id_categoria, id_marca, marca:marcas(id, nome), categoria:categorias(id, nome))"
        : "modelo:modelos_produto(id, nome_modelo, slug, id_categoria, id_marca, marca:marcas(id, nome), categoria:categorias(id, nome))";

    const buildQuery = () => {
      let query = supabase
        .from("itens_estoque")
        .select(
          [
            "*",
            modeloEmbed,
            "local:locais_estoque!inner(id, nome, codigo, pais, tipo_regiao)",
          ].join(",\n"),
          { count: "exact" },
        )
        .eq("status_item", "em_estoque")
        .in("id_local_estoque", idsLocaisEuropa);

      if (idsExcluidos.length > 0) {
        query = query.not("id", "in", `(${idsExcluidos.join(",")})`);
      }

      if (filtroCatLista.length > 0) {
        const semCategoria = filtroCatLista.includes(FILTRO_CATEGORIA_SEM);
        const idsCategoria = filtroCatLista.filter((v): v is string => v !== FILTRO_CATEGORIA_SEM);

        if (semCategoria && idsCategoria.length === 0) {
          query = query.is("modelo.id_categoria", null);
        } else if (semCategoria && idsCategoria.length > 0) {
          query = query.or(
            `modelo.id_categoria.is.null,modelo.id_categoria.in.(${idsCategoria.join(",")})`,
          );
        } else if (idsCategoria.length === 1) {
          query = query.eq("modelo.id_categoria", idsCategoria[0]);
        } else {
          query = query.in("modelo.id_categoria", idsCategoria);
        }
      }

      if (filtroMarcaLista.length === 1) {
        query = query.eq("modelo.id_marca", filtroMarcaLista[0]);
      } else if (filtroMarcaLista.length > 1) {
        query = query.in("modelo.id_marca", filtroMarcaLista);
      }

      if (termo) {
        const padrao = padraoIlikePostgrest(termo);
        query = query.or(
          `sku.ilike.${padrao},nome_produto.ilike.${padrao}`,
        );
      }

      const comDesempate = <T extends typeof query>(q: T) =>
        q.order("id_modelo_produto", { ascending: true }).order("id", { ascending: true });

      switch (coluna) {
        case "local_nome":
          query = query
            .order("nome", {
              ascending: ascendente,
              foreignTable: "local",
              nullsFirst: false,
            })
            .order("id_modelo_produto", { ascending: true })
            .order("id", { ascending: true });
          break;
        case "numeracao_br":
          query = comDesempate(
            query.order("numeracao_br", {
              ascending: ascendente,
              nullsFirst: false,
            }),
          );
          break;
        case "sku":
          query = comDesempate(query);
          break;
        case "contagem_modelo_disponivel":
          query = comDesempate(query.order("atualizado_em", { ascending: false }));
          break;
        default:
          query = comDesempate(query.order(coluna, { ascending: ascendente }));
      }

      return query;
    };

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let rows: ItemEstoqueVitrine[];
    let total: number;

    if (processarEmMemoria) {
      const chunkSize = 1000;
      const todos: ItemEstoqueVitrine[] = [];

      for (let offset = 0; ; offset += chunkSize) {
        const { data, error } = await buildQuery().range(offset, offset + chunkSize - 1);
        if (error) throw error;
        const lote = (data ?? []) as unknown as ItemEstoqueVitrine[];
        todos.push(...lote);
        if (lote.length < chunkSize) break;
      }

      let filtrados = filtroNumeracao
        ? todos.filter((item) => matchesSizeFilter(item, displaySizeSystem, filtroNumeracao))
        : todos;

      if (ordenarSkuEmMemoria) {
        filtrados = [...filtrados].sort((a, b) => {
          const cmp = compareNatural(a.sku, b.sku);
          if (cmp !== 0) return ascendente ? cmp : -cmp;
          return a.id.localeCompare(b.id);
        });
      }

      if (ordenarLocalEmMemoria) {
        filtrados = ordenarPorLocalNome(filtrados, ascendente);
      }

      if (precisaContagemCompleta) {
        const idsModelo = [...new Set(filtrados.map((row) => row.id_modelo_produto))];
        const porModelo = await itensEstoqueService.contagemModeloDisponivelVitrine(idsModelo, idsLocaisContagem);
        filtrados = aplicarContagemDisponivelVitrine(filtrados, porModelo, {
          disponiveisExatos: filtrarDisponiveis ? disponiveisExatos : undefined,
          ordenacao: ordenarContagemEmMemoria ? { coluna, ascendente } : undefined,
        });
      }

      total = filtrados.length;
      rows = filtrados.slice(from, to + 1);
    } else {
      const { data, error, count } = await buildQuery().range(from, to);
      if (error) throw error;
      rows = (data ?? []) as unknown as ItemEstoqueVitrine[];
      total = count ?? 0;
    }

    if (!precisaContagemCompleta) {
      const idsModelo = [...new Set(rows.map((row) => row.id_modelo_produto))];
      if (idsModelo.length > 0) {
        const porModelo = await itensEstoqueService.contagemModeloDisponivelVitrine(idsModelo, idsLocaisContagem);
        rows = rows.map((row) => ({
          ...row,
          contagem_modelo_disponivel: porModelo.get(row.id_modelo_produto) ?? 0,
        }));
      }
    }

    return { data: rows, total, page, pageSize };
  },

  aplicarContagemDisponivelVitrine,

  listarCatalogoKropCafe: async (params: {
    idsLocaisEuropa: string[];
    displaySizeSystem: DisplaySizeSystem;
    numeracao: string;
  }): Promise<ItemCatalogoKropCafe[]> => {
    const idsLocaisEuropa = [...new Set(params.idsLocaisEuropa)].filter(Boolean);
    const filtroNumeracao = params.numeracao.trim();
    if (idsLocaisEuropa.length === 0 || !filtroNumeracao) return [];

    const chunkSize = 1000;
    const todos: ItemCatalogoKropCafe[] = [];

    for (let offset = 0; ; offset += chunkSize) {
      const { data, error } = await supabase
        .from("itens_estoque")
        .select(
          [
            "id",
            "sku",
            "id_modelo_produto",
            "numeracao_br",
            "numeracao_eu",
            "numeracao_us",
            "preco_venda",
            "moeda_venda",
            "local:locais_estoque!inner(id, tipo_regiao)",
          ].join(",\n"),
        )
        .eq("status_item", "em_estoque")
        .in("id_local_estoque", idsLocaisEuropa)
        .order("id", { ascending: true })
        .range(offset, offset + chunkSize - 1);

      if (error) throw error;
      const lote = (data ?? []) as unknown as ItemCatalogoKropCafe[];
      todos.push(...lote);
      if (lote.length < chunkSize) break;
    }

    return todos
      .filter((item) => matchesSizeFilter(item, params.displaySizeSystem, filtroNumeracao))
      .sort((a, b) => {
        const cmpSku = compareNatural(a.sku, b.sku);
        if (cmpSku !== 0) return cmpSku;
        return a.id.localeCompare(b.id);
      });
  },

  contagemModeloDisponivelVitrine: async (
    idsModelo: string[],
    idsLocaisEuropa: string[],
  ): Promise<Map<string, number>> => {
    const modeloIds = [...new Set(idsModelo)].filter(Boolean);
    const localIds = [...new Set(idsLocaisEuropa)].filter(Boolean);
    if (modeloIds.length === 0 || localIds.length === 0) return new Map();

    const { data: contagens, error } = await supabase.rpc("vitrines_contagem_modelo", {
      p_modelo_ids: modeloIds,
      p_local_ids: localIds,
    });
    if (error) throw error;
    return new Map((contagens ?? []).map((c) => [c.id_modelo_produto, c.total]));
  },

  resumoPorStatus: async (): Promise<Record<StatusItem, number>> => {
    const statuses: StatusItem[] = [
      "em_estoque",
      "fora_de_estoque",
      "em_processo_de_compra",
      "transferencia",
      "reservado",
      "vendido",
      "devolvido",
      "inativo",
    ];
    const entradas = await Promise.all(
      statuses.map(async (s) => {
        const { count, error } = await supabase
          .from("itens_estoque")
          .select("id", { count: "exact", head: true })
          .eq("status_item", s);
        if (error) throw error;
        return [s, count ?? 0] as const;
      }),
    );
    return Object.fromEntries(entradas) as Record<StatusItem, number>;
  },

  /** Verifica se SKU já existe. */
  skuExiste: async (sku: string, ignorarId?: string): Promise<boolean> => {
    let query = supabase.from("itens_estoque").select("id").eq("sku", sku.trim());
    if (ignorarId) query = query.neq("id", ignorarId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data !== null;
  },

  /**
   * Próximo SKU livre: maior SKU numérico (ordem natural) + 1, ignorando `tiny-*`.
   */
  proximoSkuDisponivel: async (): Promise<string> => {
    const { data, error } = await supabase.from("itens_estoque").select("sku");
    if (error) throw error;

    const skus = (data ?? [])
      .map((r) => r.sku?.trim() ?? "")
      .filter((s) => s && !s.toLowerCase().startsWith("tiny-"));

    const numericos = skus.filter((s) => /^\d+$/.test(s));
    let candidato = 1;

    if (numericos.length > 0) {
      const ordenados = [...numericos].sort((a, b) => compareNatural(a, b));
      const maior = ordenados[ordenados.length - 1]!;
      candidato = Number(maior) + 1;
    }

    const ocupados = new Set(skus.map((s) => s.toLowerCase()));
    while (ocupados.has(String(candidato).toLowerCase())) {
      candidato += 1;
    }

    return String(candidato);
  },

  /** Busca itens em estoque para vincular a uma ordem de venda (filtra pela região do local). */
  buscarParaVenda: async (params: {
    search?: string;
    /** Região da ordem de venda — só retorna itens cujo local tem o mesmo tipo_regiao. */
    regiao?: "brasil" | "europa" | "outros" | "";
    idsExcluidos?: string[];
    limit?: number;
  }): Promise<
    Array<{
      id: string;
      sku: string;
      nome_produto: string;
      preco_venda: number | null;
      moeda_venda: string | null;
      numeracao_br: number | null;
      status_item: StatusItem;
    }>
  > => {
    const termo = params.search?.trim() ?? "";
    const limite = params.limit ?? 25;
    const idsExcluidos = [...new Set(params.idsExcluidos ?? [])].filter(Boolean);
    const regiao = params.regiao || "";

    let idsLocaisRegiao: string[] | null = null;
    if (regiao === "brasil" || regiao === "europa" || regiao === "outros") {
      const { data: locais, error: erroLocais } = await supabase
        .from("locais_estoque")
        .select("id")
        .eq("tipo_regiao", regiao);
      if (erroLocais) throw erroLocais;
      idsLocaisRegiao = (locais ?? []).map((l) => l.id);
      if (idsLocaisRegiao.length === 0) return [];
    }

    let query = supabase
      .from("itens_estoque")
      .select(
        "id, sku, nome_produto, preco_venda, moeda_venda, numeracao_br, status_item, local:locais_estoque(id, tipo_regiao)",
      )
      .eq("status_item", "em_estoque")
      .order("atualizado_em", { ascending: false })
      .limit(limite);

    if (idsLocaisRegiao) {
      query = query.in("id_local_estoque", idsLocaisRegiao);
    }

    if (idsExcluidos.length > 0) {
      query = query.not("id", "in", `(${idsExcluidos.join(",")})`);
    }

    if (termo) {
      const padrao = padraoIlikePostgrest(termo);
      query = query.or(`sku.ilike.${padrao},nome_produto.ilike.${padrao}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []).map((row) => ({
      id: row.id,
      sku: row.sku,
      nome_produto: row.nome_produto,
      preco_venda: row.preco_venda,
      moeda_venda: row.moeda_venda,
      numeracao_br: row.numeracao_br,
      status_item: row.status_item,
    }));
  },
};
