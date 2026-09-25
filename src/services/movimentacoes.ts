import { supabase } from "../lib/supabase";
import type { PaginationParams } from "../types/entities";

/** Início do dia civil local, em ISO, para filtrar `timestamptz`. */
function inicioDoDiaLocal(isoDate: string): string {
  const [ano, mes, dia] = isoDate.split("-").map(Number);
  return new Date(ano, (mes ?? 1) - 1, dia ?? 1, 0, 0, 0, 0).toISOString();
}

function fimDoDiaLocal(isoDate: string): string {
  const [ano, mes, dia] = isoDate.split("-").map(Number);
  return new Date(ano, (mes ?? 1) - 1, dia ?? 1, 23, 59, 59, 999).toISOString();
}

export interface MovimentacaoDetalhada {
  id: string;
  tipo_movimentacao: string;
  data_movimentacao: string;
  observacoes: string | null;
  criado_em: string;
  item_estoque: { id: string; sku: string; nome_produto: string } | null;
  origem: { id: string; nome: string; codigo: string } | null;
  destino: { id: string; nome: string; codigo: string } | null;
  venda: { id: string; numero: string | null } | null;
}

export const movimentacoesService = {
  listarComRelacoes: async (
    params?: PaginationParams & { dataDe?: string | null; dataAte?: string | null },
  ) => {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
    const dataDe = params?.dataDe?.trim() || null;
    const dataAte = params?.dataAte?.trim() || null;

    let query = supabase
      .from("movimentacoes_estoque")
      .select(
        `id, tipo_movimentacao, data_movimentacao, observacoes, criado_em,
         item_estoque:itens_estoque(id, sku, nome_produto),
         origem:locais_estoque!movimentacoes_estoque_id_local_origem_fkey(id, nome, codigo),
         destino:locais_estoque!movimentacoes_estoque_id_local_destino_fkey(id, nome, codigo),
         venda:vendas(id, numero)`,
        { count: "exact" },
      );

    if (dataDe) query = query.gte("data_movimentacao", inicioDoDiaLocal(dataDe));
    if (dataAte) query = query.lte("data_movimentacao", fimDoDiaLocal(dataAte));

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
