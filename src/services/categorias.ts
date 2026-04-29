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

  contarRelacionados: async (
    categoriaIds: string[],
  ): Promise<Record<string, { modelos: number; itens: number }>> => {
    const resultado: Record<string, { modelos: number; itens: number }> = {};
    for (const id of categoriaIds) {
      resultado[id] = { modelos: 0, itens: 0 };
    }
    if (categoriaIds.length === 0) return resultado;

    const { data, error } = await supabase.rpc("categorias_contadores", {
      categoria_ids: categoriaIds,
    });
    if (error) throw error;

    for (const linha of (data ?? []) as Array<{
      id: string;
      modelos: number | string;
      itens: number | string;
    }>) {
      resultado[linha.id] = {
        modelos: Number(linha.modelos) || 0,
        itens: Number(linha.itens) || 0,
      };
    }

    return resultado;
  },
};
