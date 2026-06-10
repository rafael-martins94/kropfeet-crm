import { supabase } from "../lib/supabase";
import { FILTRO_CATEGORIA_SEM } from "./itens-estoque";
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
  modelo: {
    id: string;
    nome_modelo: string;
    slug: string;
    id_categoria?: string | null;
    categoria?: { id: string; nome: string } | null;
  } | null;
}

export const imagensService = {
  listar: async (
    params?: PaginationParams & {
      apenasPrincipais?: boolean;
      categoriaIds?: string[];
    },
  ) => {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 24;
    const termo = params?.search?.trim();
    const categoriaIds = params?.categoriaIds ?? [];
    const filtroCat = categoriaIds.length > 0;
    const precisaInnerModelo = filtroCat || Boolean(termo);

    const modeloEmbed = precisaInnerModelo
      ? "modelo:modelos_produto!inner(id, nome_modelo, slug, id_categoria, categoria:categorias(id, nome))"
      : "modelo:modelos_produto(id, nome_modelo, slug, id_categoria, categoria:categorias(id, nome))";

    let query = supabase
      .from("imagens_modelo_produto")
      .select(`*, ${modeloEmbed}`, { count: "exact" });

    if (params?.apenasPrincipais) query = query.eq("imagem_principal", true);

    if (filtroCat) {
      const semCategoria = categoriaIds.includes(FILTRO_CATEGORIA_SEM);
      const idsCategoria = categoriaIds.filter((v) => v !== FILTRO_CATEGORIA_SEM);

      if (semCategoria && idsCategoria.length === 0) {
        query = query.is("modelo.id_categoria", null);
      } else if (semCategoria && idsCategoria.length > 0) {
        query = query.or(
          `modelo.id_categoria.is.null,modelo.id_categoria.in.(${idsCategoria.join(",")})`,
        );
      } else if (idsCategoria.length === 1) {
        query = query.eq("modelo.id_categoria", idsCategoria[0]);
      } else if (idsCategoria.length > 1) {
        query = query.in("modelo.id_categoria", idsCategoria);
      }
    }

    if (termo) {
      const padrao = `%${termo.replace(/%/g, "")}%`;
      query = query.ilike("modelo.nome_modelo", padrao);
    }

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
