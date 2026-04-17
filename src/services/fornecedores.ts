import { supabase } from "../lib/supabase";
import type {
  Fornecedor,
  FornecedorInsert,
  FornecedorUpdate,
  PaginationParams,
} from "../types/entities";
import { atualizar, deletar, inserir, listar, obterPorId } from "./base";

export const fornecedoresService = {
  listar: (params?: PaginationParams) =>
    listar("fornecedores", params, {
      searchColumns: [
        "nome",
        "fantasia",
        "codigo_fornecedor",
        "cpf_cnpj",
        "email",
        "cidade",
      ],
      defaultOrderBy: "nome",
      defaultAscending: true,
    }),
  obter: (id: string) => obterPorId("fornecedores", id),
  criar: (registro: FornecedorInsert) => inserir("fornecedores", registro),
  atualizar: (id: string, patch: FornecedorUpdate) =>
    atualizar("fornecedores", id, patch),
  deletar: (id: string) => deletar("fornecedores", id),
  listarAtivos: async (): Promise<Fornecedor[]> => {
    const { data, error } = await supabase
      .from("fornecedores")
      .select("*")
      .eq("situacao", "ativo")
      .order("nome", { ascending: true })
      .limit(500);
    if (error) throw error;
    return data ?? [];
  },
};
