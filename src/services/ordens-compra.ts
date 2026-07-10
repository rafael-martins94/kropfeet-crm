import { supabase } from "../lib/supabase";
import type {
  OrdemCompra,
  OrdemCompraUpdate,
  PaginationParams,
  SistemaNumeracao,
  StatusItem,
} from "../types/entities";
import { atualizar, obterPorId } from "./base";

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
  valor_custo: number;
  observacoes_ordem?: string | null;
}

export interface OrdemCompraDetalhada extends OrdemCompra {
  item?: {
    id: string;
    sku: string;
    nome_produto: string;
    status_item: StatusItem;
    id_modelo_produto?: string | null;
    codigo_fornecedor?: string | null;
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

export interface ListarOrdensCompraParams extends PaginationParams {
  sku?: string;
  produto?: string;
  idFornecedor?: string[];
}

function normalizarFiltroFornecedores(ids?: string[]): string[] {
  if (!ids || ids.length === 0) return [];
  return ids.map((id) => id.trim()).filter(Boolean);
}

export const ordensCompraService = {
  listar: async (params?: ListarOrdensCompraParams) => {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const sku = params?.sku?.trim();
    const produto = params?.produto?.trim();
    const idsFornecedor = normalizarFiltroFornecedores(params?.idFornecedor);
    const filtroItem = Boolean(sku || produto);

    const itemEmbed = filtroItem
      ? "item:itens_estoque!ordens_compra_id_item_estoque_fkey!inner(id, sku, nome_produto, status_item, id_modelo_produto, codigo_fornecedor)"
      : "item:itens_estoque!ordens_compra_id_item_estoque_fkey(id, sku, nome_produto, status_item, id_modelo_produto, codigo_fornecedor)";

    let query = supabase
      .from("ordens_compra")
      .select(
        `*,
         ${itemEmbed},
         fornecedor:fornecedores(id, nome)`,
        { count: "exact" },
      )
      .order("data_compra", { ascending: false })
      .order("criado_em", { ascending: false });

    if (sku) {
      const padrao = `%${sku.replace(/%/g, "")}%`;
      query = query.ilike("itens_estoque.sku", padrao);
    }

    if (produto) {
      const padrao = `%${produto.replace(/%/g, "")}%`;
      query = query.ilike("itens_estoque.nome_produto", padrao);
    }

    if (idsFornecedor.length === 1) {
      query = query.eq("id_fornecedor", idsFornecedor[0]);
    } else if (idsFornecedor.length > 1) {
      query = query.in("id_fornecedor", idsFornecedor);
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

  /** Atualiza campos da ordem; se o fornecedor mudar, sincroniza também no item vinculado. */
  atualizar: async (id: string, patch: OrdemCompraUpdate): Promise<OrdemCompra> => {
    const ordem = await atualizar("ordens_compra", id, patch);
    if (patch.id_fornecedor !== undefined && ordem.id_item_estoque) {
      await atualizar("itens_estoque", ordem.id_item_estoque, {
        id_fornecedor: patch.id_fornecedor,
      });
    }
    return ordem;
  },

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
      p_valor_custo: payload.valor_custo,
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
