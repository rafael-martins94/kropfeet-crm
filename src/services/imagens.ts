import { supabase } from "../lib/supabase";
import type { PaginationParams } from "../types/entities";

export interface ImagemDetalhada {
  id: string;
  id_modelo_produto: string;
  url_origem: string | null;
  caminho_arquivo: string | null;
  ordem_exibicao: number;
  imagem_principal: boolean;
  tipo_origem: string;
  criado_em: string;
  modelo: { id: string; nome_modelo: string; slug: string } | null;
}

export const imagensService = {
  listar: async (params?: PaginationParams & { apenasPrincipais?: boolean }) => {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 24;

    let query = supabase
      .from("imagens_modelo_produto")
      .select(
        `*, modelo:modelos_produto(id, nome_modelo, slug)`,
        { count: "exact" },
      );

    if (params?.apenasPrincipais) query = query.eq("imagem_principal", true);

    query = query
      .order("imagem_principal", { ascending: false })
      .order("criado_em", { ascending: false });

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;
    return {
      data: (data ?? []) as unknown as ImagemDetalhada[],
      total: count ?? 0,
      page,
      pageSize,
    };
  },
};
