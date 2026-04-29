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
import { atualizar, deletar, inserir, obterPorId } from "./base";

export interface ItemEstoqueDetalhado extends ItemEstoque {
  modelo?: { id: string; nome_modelo: string; slug: string; id_categoria?: string | null } | null;
  fornecedor?: { id: string; nome: string } | null;
  local?: { id: string; nome: string; codigo: string } | null;
}

/** Colunas ordenáveis na lista com relacionamentos (alinhado ao PostgREST / FK `locais_estoque`). */
export const COLUNAS_ORDEM_ITEM_ESTOQUE = [
  "sku",
  "nome_completo",
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
      status?: StatusItem | "";
      /** UUID da categoria ou `FILTRO_CATEGORIA_SEM` / vazio (sem filtro). */
      idCategoria?: FiltroCategoriaItem;
      /** UUID do local ou `FILTRO_LOCAL_SEM` / vazio (sem filtro). */
      idLocalEstoque?: FiltroLocalItem;
      ordenacao?: { coluna: ColunaOrdemItemEstoque; ascendente: boolean };
      displaySizeSystem?: DisplaySizeSystem;
      numeracao?: string;
    },
  ) => {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
    const termo = params?.search?.trim();

    const coluna = params?.ordenacao?.coluna ?? "atualizado_em";
    const ascendente = params?.ordenacao?.ascendente ?? false;

    const filtroCat = params?.idCategoria?.trim();
    const filtroLocal = params?.idLocalEstoque?.trim();
    const filtroNumeracao = params?.numeracao?.trim();
    const displaySizeSystem = params?.displaySizeSystem ?? "br";

    const modeloEmbed =
      filtroCat && filtroCat !== ""
        ? "modelo:modelos_produto!inner(id, nome_modelo, slug, id_categoria)"
        : "modelo:modelos_produto(id, nome_modelo, slug, id_categoria)";

    const buildQuery = () => {
      let query = supabase
        .from("itens_estoque")
        .select(
          `*,
           ${modeloEmbed},
           fornecedor:fornecedores(id, nome),
           local:locais_estoque(id, nome, codigo)`,
          { count: "exact" },
        );

      if (params?.status) {
        query = query.eq("status_item", params.status);
      }

      if (filtroCat === FILTRO_CATEGORIA_SEM) {
        query = query.is("modelo.id_categoria", null);
      } else if (filtroCat) {
        query = query.eq("modelo.id_categoria", filtroCat);
      }

      if (filtroLocal === FILTRO_LOCAL_SEM) {
        query = query.is("id_local_estoque", null);
      } else if (filtroLocal) {
        query = query.eq("id_local_estoque", filtroLocal);
      }

      if (termo) {
        const padrao = `%${termo.replace(/%/g, "")}%`;
        query = query.or(
          `sku.ilike.${padrao},nome_completo.ilike.${padrao},codigo_fabricante.ilike.${padrao}`,
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
        default:
          query = comDesempate(query.order(coluna, { ascending: ascendente }));
      }

      return query;
    };

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    if (filtroNumeracao) {
      const chunkSize = 1000;
      const todos: ItemEstoqueDetalhado[] = [];

      for (let offset = 0; ; offset += chunkSize) {
        const { data, error } = await buildQuery().range(offset, offset + chunkSize - 1);
        if (error) throw error;

        const lote = (data ?? []) as unknown as ItemEstoqueDetalhado[];
        todos.push(...lote);
        if (lote.length < chunkSize) break;
      }

      const filtrados = todos.filter((item) =>
        matchesSizeFilter(item, displaySizeSystem, filtroNumeracao),
      );

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
};
