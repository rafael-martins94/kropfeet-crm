import { supabase } from "../lib/supabase";
import type {
  Cliente,
  ClienteInsert,
  ClienteUpdate,
  EnderecoCliente,
  PaginationParams,
} from "../types/entities";
import { atualizar, deletar, inserir, obterPorId } from "./base";

export interface ClienteComEnderecos extends Cliente {
  enderecos?: Pick<
    EnderecoCliente,
    "id" | "cep" | "cidade" | "uf" | "pais" | "principal" | "rotulo"
  >[];
}

type ClienteComEnderecosResumo = {
  enderecos?: Pick<EnderecoCliente, "cep" | "cidade" | "uf" | "principal">[];
};

function resolverEnderecoPrincipal(cliente: ClienteComEnderecosResumo) {
  const enderecos = cliente.enderecos ?? [];
  return enderecos.find((e) => e.principal) ?? enderecos[0] ?? null;
}

export const clientesService = {
  listar: async (params?: PaginationParams & { pais?: string }) => {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
    const termo = params?.search?.trim();
    const pais = params?.pais?.trim();

    let query = supabase
      .from("clientes")
      .select(
        `*,
         enderecos:enderecos_cliente(id, cep, cidade, uf, pais, principal, rotulo)`,
        { count: "exact" },
      );

    if (pais) {
      query = query.eq("pais", pais);
    }

    if (termo) {
      const padrao = `%${termo.replace(/%/g, "")}%`;
      query = query.or(
        `nome.ilike.${padrao},email.ilike.${padrao},telefone.ilike.${padrao},instagram.ilike.${padrao},pais.ilike.${padrao},cpf_cnpj.ilike.${padrao}`,
      );
    }

    query = query.order(params?.orderBy ?? "criado_em", {
      ascending: params?.ascending ?? false,
    });

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      data: (data ?? []) as ClienteComEnderecos[],
      total: count ?? 0,
      page,
      pageSize,
    };
  },

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

  resolverEnderecoPrincipal,
};
