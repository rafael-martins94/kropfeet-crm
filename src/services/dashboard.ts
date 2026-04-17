import { supabase } from "../lib/supabase";

export interface DashboardMetricas {
  totalModelos: number;
  totalItensEstoque: number;
  itensEmEstoque: number;
  itensVendidos: number;
  totalMarcas: number;
  totalCategorias: number;
  totalFornecedores: number;
  fornecedoresAtivos: number;
  totalLocais: number;
  totalClientes: number;
  totalVendas: number;
  totalImagens: number;
}

async function contar(tabela: string, filtros: Record<string, string> = {}): Promise<number> {
  let q = (supabase as any).from(tabela).select("id", { count: "exact", head: true });
  for (const [k, v] of Object.entries(filtros)) {
    q = q.eq(k, v);
  }
  const { count, error } = await q;
  if (error) throw error;
  return (count as number | null) ?? 0;
}

export const dashboardService = {
  async carregarMetricas(): Promise<DashboardMetricas> {
    const [
      totalModelos,
      totalItensEstoque,
      itensEmEstoque,
      itensVendidos,
      totalMarcas,
      totalCategorias,
      totalFornecedores,
      fornecedoresAtivos,
      totalLocais,
      totalClientes,
      totalVendas,
      totalImagens,
    ] = await Promise.all([
      contar("modelos_produto"),
      contar("itens_estoque"),
      contar("itens_estoque", { status_item: "em_estoque" }),
      contar("itens_estoque", { status_item: "vendido" }),
      contar("marcas"),
      contar("categorias"),
      contar("fornecedores"),
      contar("fornecedores", { situacao: "ativo" }),
      contar("locais_estoque"),
      contar("clientes"),
      contar("vendas"),
      contar("imagens_modelo_produto"),
    ]);

    return {
      totalModelos,
      totalItensEstoque,
      itensEmEstoque,
      itensVendidos,
      totalMarcas,
      totalCategorias,
      totalFornecedores,
      fornecedoresAtivos,
      totalLocais,
      totalClientes,
      totalVendas,
      totalImagens,
    };
  },

  async ultimosModelos(limite = 5) {
    const { data, error } = await supabase
      .from("modelos_produto")
      .select("id, nome_modelo, slug, cor, atualizado_em, ativo")
      .order("atualizado_em", { ascending: false })
      .limit(limite);
    if (error) throw error;
    return data ?? [];
  },

  async ultimosItens(limite = 5) {
    const { data, error } = await supabase
      .from("itens_estoque")
      .select("id, sku, nome_completo, status_item, atualizado_em")
      .order("atualizado_em", { ascending: false })
      .limit(limite);
    if (error) throw error;
    return data ?? [];
  },
};
