import { supabase } from "../lib/supabase";
import type { PaginationParams, Vendedor, VendedorInsert, VendedorUpdate } from "../types/entities";
import { atualizar, inserir, listar } from "./base";

export const vendedoresService = {
  listarAtivos: async (): Promise<Vendedor[]> => {
    const { data, error } = await supabase
      .from("vendedores")
      .select("*")
      .eq("ativo", true)
      .order("nome", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  listar: (params: PaginationParams & { ativo?: boolean } = {}) =>
    listar("vendedores", params, {
      searchColumns: ["nome"],
      defaultOrderBy: "nome",
      defaultAscending: true,
      filters: { ativo: params.ativo },
    }),

  criar: async (nome: string): Promise<Vendedor> => {
    const registro: VendedorInsert = { nome: nome.trim(), ativo: true };
    return inserir("vendedores", registro);
  },

  atualizar: (id: string, patch: VendedorUpdate) => atualizar("vendedores", id, patch),
};
