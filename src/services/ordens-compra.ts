import { supabase } from "../lib/supabase";
import type {
  OrdemCompra,
  PaginationParams,
  SistemaNumeracao,
  StatusItem,
} from "../types/entities";
import { obterPorId } from "./base";

export interface CriarOrdemCompraPayload {
  sku: string;
  nome_produto: string;
  id_modelo_produto: string;
  id_local_estoque?: string | null;
  codigo_fornecedor: string;
  numeracao_br?: number | null;
  numeracao_eu?: number | null;
  numeracao_us?: string | null;
  sistema_numeracao?: SistemaNumeracao;
  status_item?: StatusItem;
  observacoes_item?: string | null;
  id_fornecedor?: string | null;
  data_compra: string;
  moeda_compra: string;
  valor_pago_original: number;
  cambio_compra_para_real?: number | null;
  cambio_compra_para_euro?: number | null;
  valor_pago_real?: number | null;
  valor_pago_euro?: number | null;
  observacoes_ordem?: string | null;
}

export interface OrdemCompraDetalhada extends OrdemCompra {
  item?: {
    id: string;
    sku: string;
    nome_produto: string;
    status_item: StatusItem;
    numeracao_br: number | null;
    numeracao_eu: number | null;
    numeracao_us: string | null;
  } | null;
  fornecedor?: { id: string; nome: string } | null;
}

export interface CriarOrdemCompraResultado {
  id_ordem: string;
  id_item: string;
}

export const ordensCompraService = {
  listar: async (params?: PaginationParams) => {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("ordens_compra")
      .select(
        `*,
         item:itens_estoque!ordens_compra_id_item_estoque_fkey(id, sku, nome_produto, status_item),
         fornecedor:fornecedores(id, nome)`,
        { count: "exact" },
      )
      .order("data_compra", { ascending: false })
      .order("criado_em", { ascending: false });

    const termo = params?.search?.trim();
    if (termo) {
      const padrao = `%${termo.replace(/%/g, "")}%`;
      query = query.or(
        `moeda_compra.ilike.${padrao},observacoes.ilike.${padrao}`,
      );
    }

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;

    return {
      data: (data ?? []) as unknown as OrdemCompraDetalhada[],
      total: count ?? 0,
      page,
      pageSize,
    };
  },

  obter: async (id: string): Promise<OrdemCompraDetalhada | null> => {
    const { data, error } = await supabase
      .from("ordens_compra")
      .select(
        `*,
         item:itens_estoque!ordens_compra_id_item_estoque_fkey(id, sku, nome_produto, status_item, numeracao_br, numeracao_eu, numeracao_us, id_modelo_produto, id_local_estoque, codigo_fornecedor),
         fornecedor:fornecedores(id, nome)`,
      )
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return (data as unknown as OrdemCompraDetalhada) ?? null;
  },

  obterPorItem: async (idItem: string): Promise<OrdemCompraDetalhada | null> => {
    const { data, error } = await supabase
      .from("ordens_compra")
      .select(
        `*,
         item:itens_estoque!ordens_compra_id_item_estoque_fkey(id, sku, nome_produto, status_item, numeracao_br, numeracao_eu, numeracao_us),
         fornecedor:fornecedores(id, nome)`,
      )
      .eq("id_item_estoque", idItem)
      .maybeSingle();

    if (error) throw error;
    return (data as unknown as OrdemCompraDetalhada) ?? null;
  },

  obterBasica: (id: string) => obterPorId("ordens_compra", id),

  criarComItem: async (payload: CriarOrdemCompraPayload): Promise<CriarOrdemCompraResultado> => {
    const { data, error } = await supabase.rpc("criar_ordem_compra_com_item", {
      p_sku: payload.sku,
      p_nome_produto: payload.nome_produto,
      p_id_modelo_produto: payload.id_modelo_produto,
      p_id_local_estoque: payload.id_local_estoque ?? undefined,
      p_codigo_fornecedor: payload.codigo_fornecedor,
      p_numeracao_br: payload.numeracao_br ?? undefined,
      p_numeracao_eu: payload.numeracao_eu ?? undefined,
      p_numeracao_us: payload.numeracao_us ?? undefined,
      p_sistema_numeracao: payload.sistema_numeracao ?? "br",
      p_status_item: payload.status_item ?? "em_processo_de_compra",
      p_observacoes_item: payload.observacoes_item ?? undefined,
      p_id_fornecedor: payload.id_fornecedor ?? undefined,
      p_data_compra: payload.data_compra,
      p_moeda_compra: payload.moeda_compra,
      p_valor_pago_original: payload.valor_pago_original,
      p_cambio_compra_para_real: payload.cambio_compra_para_real ?? undefined,
      p_cambio_compra_para_euro: payload.cambio_compra_para_euro ?? undefined,
      p_valor_pago_real: payload.valor_pago_real ?? undefined,
      p_valor_pago_euro: payload.valor_pago_euro ?? undefined,
      p_observacoes_ordem: payload.observacoes_ordem ?? undefined,
    });

    if (error) throw error;

    const resultado = data as { id_ordem: string; id_item: string };
    return {
      id_ordem: resultado.id_ordem,
      id_item: resultado.id_item,
    };
  },
};
