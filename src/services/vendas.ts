import { supabase } from "../lib/supabase";
import type {
  PaginationParams,
  StatusVenda,
  Venda,
  VendaInsert,
  VendaUpdate,
} from "../types/entities";
import { calcularLucroVenda, obterCustoPrincipal, resolverCustoItem, type CustoItemEstoque } from "../utils/custoItem";
import { atualizar, deletar, inserir, obterPorId } from "./base";

export interface ItemVendaDetalhado {
  id: string;
  id_venda: string;
  id_item_estoque: string;
  moeda_venda: string;
  valor_venda_original: number;
  valor_venda_real: number | null;
  valor_venda_euro: number | null;
  cambio_utilizado: number | null;
  lucro_real: number | null;
  lucro_euro: number | null;
  criado_em: string;
  item_estoque?: {
    id: string;
    sku: string;
    nome_produto: string;
    numeracao_br: number | null;
    id_ordem_compra: string | null;
    local?: { tipo_regiao: string | null } | null;
    ordem_compra?: {
      valor_custo: number;
      moeda_compra: string;
    } | null;
  } | null;
  custo?: CustoItemEstoque | null;
  lucroCalculado?: { lucroReal: number | null; lucroEuro: number | null };
}

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

  obterItens: async (idVenda: string): Promise<ItemVendaDetalhado[]> => {
    const { data, error } = await supabase
      .from("itens_venda")
      .select(
        `*,
         item_estoque:itens_estoque(
           id, sku, nome_produto, numeracao_br, id_ordem_compra,
           local:locais_estoque!itens_estoque_id_local_estoque_fkey(tipo_regiao),
           ordem_compra:ordens_compra!itens_estoque_id_ordem_compra_fkey(
             valor_custo, moeda_compra
           )
         )`,
      )
      .eq("id_venda", idVenda)
      .order("criado_em", { ascending: true });
    if (error) throw error;

    return (data ?? []).map((iv) => {
      const row = iv as unknown as ItemVendaDetalhado;
      const custo = resolverCustoItem(row.item_estoque ?? null);
      const lucroCalculado = calcularLucroVenda(
        row.valor_venda_real,
        row.valor_venda_euro,
        custo,
      );
      return { ...row, custo, lucroCalculado };
    });
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
