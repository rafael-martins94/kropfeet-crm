import { supabase } from "../lib/supabase";
import type { Marca, MarcaInsert, MarcaUpdate, PaginationParams } from "../types/entities";
import { atualizar, deletar, inserir, listar, obterPorId } from "./base";

export const marcasService = {
  listar: (params?: PaginationParams) =>
    listar("marcas", params, {
      searchColumns: ["nome"],
      defaultOrderBy: "nome",
      defaultAscending: true,
    }),
  obter: (id: string) => obterPorId("marcas", id),
  criar: (registro: MarcaInsert) => inserir("marcas", registro),
  atualizar: (id: string, patch: MarcaUpdate) => atualizar("marcas", id, patch),
  deletar: (id: string) => deletar("marcas", id),
  listarTodas: async (): Promise<Marca[]> => {
    const { data, error } = await supabase
      .from("marcas")
      .select("*")
      .order("nome", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
};
