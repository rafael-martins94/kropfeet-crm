import { supabase } from "../lib/supabase";
import type {
  Cliente,
  ClienteInsert,
  ClienteUpdate,
  PaginationParams,
} from "../types/entities";
import { atualizar, deletar, inserir, listar, obterPorId } from "./base";

export const clientesService = {
  listar: (params?: PaginationParams) =>
    listar("clientes", params, {
      searchColumns: ["nome", "email", "telefone", "instagram", "pais"],
      defaultOrderBy: "criado_em",
      defaultAscending: false,
    }),
  obter: (id: string) => obterPorId("clientes", id),
  criar: (registro: ClienteInsert) => inserir("clientes", registro),
  atualizar: (id: string, patch: ClienteUpdate) => atualizar("clientes", id, patch),
  deletar: (id: string) => deletar("clientes", id),
  listarTodos: async (): Promise<Cliente[]> => {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .order("nome", { ascending: true })
      .limit(500);
    if (error) throw error;
    return data ?? [];
  },
};
