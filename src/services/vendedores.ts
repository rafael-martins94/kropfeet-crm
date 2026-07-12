import { supabase } from "../lib/supabase";
import type { Vendedor, VendedorInsert } from "../types/entities";
import { inserir } from "./base";

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

  criar: async (nome: string): Promise<Vendedor> => {
    const registro: VendedorInsert = { nome: nome.trim(), ativo: true };
    return inserir("vendedores", registro);
  },
};
