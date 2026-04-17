import { supabase } from "../lib/supabase";
import type {
  LocalEstoque,
  LocalEstoqueInsert,
  LocalEstoqueUpdate,
  PaginationParams,
} from "../types/entities";
import { atualizar, deletar, inserir, listar, obterPorId } from "./base";

export const locaisEstoqueService = {
  listar: (params?: PaginationParams) =>
    listar("locais_estoque", params, {
      searchColumns: ["nome", "codigo", "pais"],
      defaultOrderBy: "nome",
      defaultAscending: true,
    }),
  obter: (id: string) => obterPorId("locais_estoque", id),
  criar: (registro: LocalEstoqueInsert) => inserir("locais_estoque", registro),
  atualizar: (id: string, patch: LocalEstoqueUpdate) =>
    atualizar("locais_estoque", id, patch),
  deletar: (id: string) => deletar("locais_estoque", id),
  listarTodos: async (): Promise<LocalEstoque[]> => {
    const { data, error } = await supabase
      .from("locais_estoque")
      .select("*")
      .order("nome", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
};
