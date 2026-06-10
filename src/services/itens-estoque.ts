import { supabase } from "../lib/supabase";
import type {
  ItemEstoque,
  ItemEstoqueInsert,
  ItemEstoqueUpdate,
  PaginationParams,
  StatusItem,
} from "../types/entities";
import {
  matchesSizeFilter,
  type DisplaySizeSystem,
} from "../utils/sizeConversion";
import { compareNatural } from "../utils/naturalSort";
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

/** Colunas ordenáveis na lista com relacionamentos (alinhado ao PostgREST / FK `locais_estoque`). */
export const COLUNAS_ORDEM_ITEM_ESTOQUE = [
  "sku",
  "nome_produto",
  "numeracao_br",
  "status_item",
  "local_nome",
  "atualizado_em",
] as const;

export type ColunaOrdemItemEstoque = (typeof COLUNAS_ORDEM_ITEM_ESTOQUE)[number];

/** Valor especial para filtrar itens cujo modelo não tem categoria. */
export const FILTRO_CATEGORIA_SEM = "__sem_categoria__" as const;

/** Valor especial para filtrar itens sem local definido. */
export const FILTRO_LOCAL_SEM = "__sem_local__" as const;

export type FiltroLocalItem = "" | typeof FILTRO_LOCAL_SEM | string;

export type FiltroCategoriaItem = "" | typeof FILTRO_CATEGORIA_SEM | string;

function normalizarFiltroLista<T extends string>(
  valor: T | T[] | "" | undefined,
): T[] {
  if (valor === undefined || valor === "" || (Array.isArray(valor) && valor.length === 0)) {
    return [];
  }
  return Array.isArray(valor) ? valor : [valor];
}

export const itensEstoqueService = {
  obter: (id: string) => obterPorId("itens_estoque", id),
  criar: (registro: ItemEstoqueInsert) => inserir("itens_estoque", registro),
  atualizar: (id: string, patch: ItemEstoqueUpdate) =>
    atualizar("itens_estoque", id, patch),
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
    const processarEmMemoria = Boolean(filtroNumeracao) || ordenarSkuEmMemoria;

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
        const padrao = `%${termo.replace(/%/g, "")}%`;
        query = query.or(
          `sku.ilike.${padrao},nome_produto.ilike.${padrao},codigo_fornecedor.ilike.${padrao}`,
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
              foreignTable: "locais_estoque",
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
};
