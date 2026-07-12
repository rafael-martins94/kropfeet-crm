import { supabase } from "../lib/supabase";
import type { FormaEnvio, FormaEnvioInsert } from "../types/entities";
import { inserir } from "./base";

export const formasEnvioService = {
  listarAtivas: async (): Promise<FormaEnvio[]> => {
    const { data, error } = await supabase
      .from("formas_envio")
      .select("*")
      .eq("ativo", true)
      .order("nome", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  criar: async (nome: string): Promise<FormaEnvio> => {
    const registro: FormaEnvioInsert = { nome: nome.trim(), ativo: true };
    return inserir("formas_envio", registro);
  },
};
