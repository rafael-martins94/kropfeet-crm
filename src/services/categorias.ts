import { supabase } from "../lib/supabase";
import type {
  Categoria,
  CategoriaInsert,
  CategoriaUpdate,
  PaginationParams,
} from "../types/entities";
import { atualizar, deletar, inserir, listar, obterPorId } from "./base";

export const categoriasService = {
  listar: (params?: PaginationParams) =>
    listar("categorias", params, {
      searchColumns: ["nome"],
      defaultOrderBy: "nome",
      defaultAscending: true,
    }),
  obter: (id: string) => obterPorId("categorias", id),
  criar: (registro: CategoriaInsert) => inserir("categorias", registro),
  atualizar: (id: string, patch: CategoriaUpdate) => atualizar("categorias", id, patch),
  deletar: (id: string) => deletar("categorias", id),
  listarTodas: async (): Promise<Categoria[]> => {
    const { data, error } = await supabase
      .from("categorias")
      .select("*")
      .order("nome", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
};
