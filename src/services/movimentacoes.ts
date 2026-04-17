import { supabase } from "../lib/supabase";
import type { PaginationParams } from "../types/entities";

export interface MovimentacaoDetalhada {
  id: string;
  tipo_movimentacao: string;
  data_movimentacao: string;
  observacoes: string | null;
  criado_em: string;
  item_estoque: { id: string; sku: string; nome_completo: string } | null;
  origem: { id: string; nome: string; codigo: string } | null;
  destino: { id: string; nome: string; codigo: string } | null;
  venda: { id: string } | null;
}

export const movimentacoesService = {
  listarComRelacoes: async (params?: PaginationParams) => {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;

    let query = supabase
      .from("movimentacoes_estoque")
      .select(
        `id, tipo_movimentacao, data_movimentacao, observacoes, criado_em,
         item_estoque:itens_estoque(id, sku, nome_completo),
         origem:locais_estoque!movimentacoes_estoque_id_local_origem_fkey(id, nome, codigo),
         destino:locais_estoque!movimentacoes_estoque_id_local_destino_fkey(id, nome, codigo),
         venda:vendas(id)`,
        { count: "exact" },
      );

    query = query.order(params?.orderBy ?? "data_movimentacao", {
      ascending: params?.ascending ?? false,
    });

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;
    return {
      data: (data ?? []) as unknown as MovimentacaoDetalhada[],
      total: count ?? 0,
      page,
      pageSize,
    };
  },
};
