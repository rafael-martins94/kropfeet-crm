import { supabase } from "../lib/supabase";
import type {
  ItemEstoque,
  ItemEstoqueInsert,
  ItemEstoqueUpdate,
  PaginationParams,
  StatusItem,
} from "../types/entities";
import { atualizar, deletar, inserir, obterPorId } from "./base";

export interface ItemEstoqueDetalhado extends ItemEstoque {
  modelo?: { id: string; nome_modelo: string; slug: string } | null;
  fornecedor?: { id: string; nome: string } | null;
  local?: { id: string; nome: string; codigo: string } | null;
}

export const itensEstoqueService = {
  obter: (id: string) => obterPorId("itens_estoque", id),
  criar: (registro: ItemEstoqueInsert) => inserir("itens_estoque", registro),
  atualizar: (id: string, patch: ItemEstoqueUpdate) =>
    atualizar("itens_estoque", id, patch),
  deletar: (id: string) => deletar("itens_estoque", id),

  listarComRelacoes: async (
    params?: PaginationParams & { status?: StatusItem | "" },
  ) => {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
    const termo = params?.search?.trim();

    let query = supabase
      .from("itens_estoque")
      .select(
        `*,
         modelo:modelos_produto(id, nome_modelo, slug),
         fornecedor:fornecedores(id, nome),
         local:locais_estoque(id, nome, codigo)`,
        { count: "exact" },
      );

    if (params?.status) {
      query = query.eq("status_item", params.status);
    }

    if (termo) {
      const padrao = `%${termo.replace(/%/g, "")}%`;
      query = query.or(
        `sku.ilike.${padrao},nome_completo.ilike.${padrao},codigo_fabricante.ilike.${padrao}`,
      );
    }

    query = query.order(params?.orderBy ?? "atualizado_em", {
      ascending: params?.ascending ?? false,
    });

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
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
      "reservado",
      "vendido",
      "devolvido",
      "inativo",
      "aguardando_chegada",
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
