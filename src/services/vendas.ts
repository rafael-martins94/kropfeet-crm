import { supabase } from "../lib/supabase";
import type {
  PaginationParams,
  StatusVenda,
  Venda,
  VendaInsert,
  VendaUpdate,
} from "../types/entities";
import { atualizar, deletar, inserir, obterPorId } from "./base";

export interface VendaDetalhada extends Venda {
  cliente?: { id: string; nome: string; email: string | null } | null;
}

export const vendasService = {
  obter: (id: string) => obterPorId("vendas", id),
  criar: (registro: VendaInsert) => inserir("vendas", registro),
  atualizar: (id: string, patch: VendaUpdate) => atualizar("vendas", id, patch),
  deletar: (id: string) => deletar("vendas", id),

  listarComRelacoes: async (
    params?: PaginationParams & { status?: StatusVenda | "" },
  ) => {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
    const termo = params?.search?.trim();

    let query = supabase
      .from("vendas")
      .select(
        `*,
         cliente:clientes(id, nome, email)`,
        { count: "exact" },
      );

    if (params?.status) {
      query = query.eq("status_venda", params.status);
    }

    if (termo) {
      const padrao = `%${termo.replace(/%/g, "")}%`;
      query = query.or(
        `observacoes.ilike.${padrao},provedor_link_pagamento.ilike.${padrao}`,
      );
    }

    query = query.order(params?.orderBy ?? "data_venda", {
      ascending: params?.ascending ?? false,
    });

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;
    return {
      data: (data ?? []) as unknown as VendaDetalhada[],
      total: count ?? 0,
      page,
      pageSize,
    };
  },

  obterItens: async (idVenda: string) => {
    const { data, error } = await supabase
      .from("itens_venda")
      .select(
        `*,
         item_estoque:itens_estoque(id, sku, nome_completo, numeracao_br)`,
      )
      .eq("id_venda", idVenda)
      .order("criado_em", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  totalPorStatus: async (): Promise<Record<StatusVenda, number>> => {
    const statuses: StatusVenda[] = ["pendente", "paga", "cancelada", "devolvida"];
    const entradas = await Promise.all(
      statuses.map(async (s) => {
        const { count, error } = await supabase
          .from("vendas")
          .select("id", { count: "exact", head: true })
          .eq("status_venda", s);
        if (error) throw error;
        return [s, count ?? 0] as const;
      }),
    );
    return Object.fromEntries(entradas) as Record<StatusVenda, number>;
  },
};
