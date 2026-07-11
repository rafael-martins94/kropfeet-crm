import { supabase } from "../lib/supabase";
import type {
  EnderecoCliente,
  PaginationParams,
  StatusVenda,
  TipoRegiao,
  Venda,
  VendaInsert,
  VendaUpdate,
} from "../types/entities";
import { calcularLucroVenda, resolverCustoItem, type CustoItemEstoque } from "../utils/custoItem";
import { atualizar, contar, deletar, inserir, obterPorId } from "./base";

export interface ItemVendaDetalhado {
  id: string;
  id_venda: string;
  id_item_estoque: string | null;
  id_produto_tiny: string | null;
  codigo: string | null;
  descricao: string | null;
  quantidade: number;
  valor_unitario: number;
  criado_em: string;
  item_estoque?: {
    id: string;
    sku: string;
    nome_produto: string;
    numeracao_br: number | null;
    id_modelo_produto: string | null;
    id_ordem_compra: string | null;
    local?: { tipo_regiao: string | null } | null;
    ordem_compra?: {
      valor_custo: number;
      moeda_compra: string;
    } | null;
  } | null;
  custo?: CustoItemEstoque | null;
  lucroCalculado?: { lucroReal: number | null; lucroEuro: number | null };
}

export interface VendaDetalhada extends Venda {
  cliente?: {
    id: string;
    nome: string;
    email: string | null;
    telefone: string | null;
    cpf_cnpj: string | null;
    pais: string | null;
    enderecos?: Pick<EnderecoCliente, "cep" | "cidade" | "uf" | "principal">[];
  } | null;
  endereco_entrega?: EnderecoCliente | null;
}

export const vendasService = {
  obter: (id: string) => obterPorId("vendas", id),

  obterDetalhada: async (id: string): Promise<VendaDetalhada | null> => {
    const { data, error } = await supabase
      .from("vendas")
      .select(
        `*,
         cliente:clientes(
           id, nome, email, telefone, cpf_cnpj, pais,
           enderecos:enderecos_cliente(cep, cidade, uf, principal)
         ),
         endereco_entrega:enderecos_cliente(*)`,
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data as VendaDetalhada | null;
  },
  criar: (dados: VendaInsert) => inserir("vendas", dados),
  atualizar: (id: string, patch: VendaUpdate) => atualizar("vendas", id, patch),
  deletar: (id: string) => deletar("vendas", id),

  contarPorRegiao: async (): Promise<Record<"brasil" | "europa", number>> => {
    const [brasil, europa] = await Promise.all([
      contar("vendas", { regiao_venda: "brasil" }),
      contar("vendas", { regiao_venda: "europa" }),
    ]);
    return { brasil, europa };
  },

  listarComRelacoes: async (
    params?: PaginationParams & {
      status?: StatusVenda | "";
      regiao?: TipoRegiao | "";
    },
  ) => {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
    const termo = params?.search?.trim();

    let query = supabase
      .from("vendas")
      .select(
        `*,
         cliente:clientes(
           id, nome, email, telefone, cpf_cnpj, pais,
           enderecos:enderecos_cliente(cep, cidade, uf, principal)
         )`,
        { count: "exact" },
      );

    if (params?.status) {
      query = query.eq("status_venda", params.status);
    }

    if (params?.regiao) {
      query = query.eq("regiao_venda", params.regiao);
    }

    if (termo) {
      const padrao = `%${termo.replace(/%/g, "")}%`;
      query = query.or(
        `numero.ilike.${padrao},nome_cliente.ilike.${padrao},codigo_rastreamento.ilike.${padrao}`,
      );
    }

    query = query.order(params?.orderBy ?? "data_pedido", {
      ascending: params?.ascending ?? false,
      nullsFirst: false,
    });

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;
    return {
      data: (data ?? []) as unknown as VendaDetalhada[],
      total: count ?? 0,
      page,
      pageSize,
    };
  },

  obterItens: async (idVenda: string): Promise<ItemVendaDetalhado[]> => {
    const { data, error } = await supabase
      .from("itens_venda")
      .select(
        `*,
         item_estoque:itens_estoque(
           id, sku, nome_produto, numeracao_br, id_modelo_produto, id_ordem_compra,
           local:locais_estoque!itens_estoque_id_local_estoque_fkey(tipo_regiao),
           ordem_compra:ordens_compra!itens_estoque_id_ordem_compra_fkey(
             valor_custo, moeda_compra
           )
         )`,
      )
      .eq("id_venda", idVenda)
      .order("criado_em", { ascending: true });
    if (error) throw error;

    return (data ?? []).map((iv) => {
      const row = iv as unknown as ItemVendaDetalhado;
      const custo = resolverCustoItem(row.item_estoque ?? null);
      // Pedidos do Tiny sao em BRL: usa valor_unitario como valor de venda em real.
      const lucroCalculado = calcularLucroVenda(row.valor_unitario, null, custo);
      return { ...row, custo, lucroCalculado };
    });
  },

  totalPorStatus: async (): Promise<Record<StatusVenda, number>> => {
    const statuses: StatusVenda[] = [
      "em_aberto",
      "pago",
      "preparando_envio",
      "enviado",
      "finalizado",
      "cancelado",
    ];
    const entradas = await Promise.all(
      statuses.map(async (s) => {
        const { count, error } = await supabase
          .from("vendas")
          .select("id", { count: "exact", head: true })
          .eq("status_venda", s);
        if (error) throw error;
        return [s, count ?? 0] as const;
      }),
    );
    return Object.fromEntries(entradas) as Record<StatusVenda, number>;
  },
};
