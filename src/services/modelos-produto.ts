import { supabase } from "../lib/supabase";
import type {
  ImagemModeloProduto,
  ModeloProduto,
  ModeloProdutoInsert,
  ModeloProdutoUpdate,
  PaginationParams,
} from "../types/entities";
import { atualizar, deletar, inserir, listar, obterPorId } from "./base";

export interface ModeloProdutoDetalhado extends ModeloProduto {
  marca?: { id: string; nome: string } | null;
  categoria?: { id: string; nome: string } | null;
  imagem_principal_url?: string | null;
}

export const modelosProdutoService = {
  listar: (params?: PaginationParams) =>
    listar("modelos_produto", params, {
      searchColumns: [
        "nome_modelo",
        "slug",
        "codigo_referencia",
        "codigo_fabricante",
        "cor",
      ],
      defaultOrderBy: "atualizado_em",
      defaultAscending: false,
    }),
  obter: (id: string) => obterPorId("modelos_produto", id),
  criar: (registro: ModeloProdutoInsert) => inserir("modelos_produto", registro),
  atualizar: (id: string, patch: ModeloProdutoUpdate) =>
    atualizar("modelos_produto", id, patch),
  deletar: (id: string) => deletar("modelos_produto", id),

  listarComRelacoes: async (
    params?: PaginationParams & { idCategoria?: string; idMarca?: string },
  ) => {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
    const termo = params?.search?.trim();

    let query = supabase
      .from("modelos_produto")
      .select(
        `*,
         marca:marcas(id, nome),
         categoria:categorias(id, nome)`,
        { count: "exact" },
      );

    if (params?.idCategoria) {
      query = query.eq("id_categoria", params.idCategoria);
    }
    if (params?.idMarca) {
      query = query.eq("id_marca", params.idMarca);
    }

    if (termo) {
      const padrao = `%${termo.replace(/%/g, "")}%`;
      query = query.or(
        `nome_modelo.ilike.${padrao},slug.ilike.${padrao},codigo_referencia.ilike.${padrao},codigo_fabricante.ilike.${padrao},cor.ilike.${padrao}`,
      );
    }

    query = query.order(params?.orderBy ?? "atualizado_em", {
      ascending: params?.ascending ?? false,
    });

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;
    return {
      data: (data ?? []) as unknown as ModeloProdutoDetalhado[],
      total: count ?? 0,
      page,
      pageSize,
    };
  },

  obterImagens: async (idModelo: string): Promise<ImagemModeloProduto[]> => {
    const { data, error } = await supabase
      .from("imagens_modelo_produto")
      .select("*")
      .eq("id_modelo_produto", idModelo)
      .order("imagem_principal", { ascending: false })
      .order("ordem_exibicao", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
};
