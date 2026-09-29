-- O vendedor vê somente pares em estoque, sem custo, fornecedor ou dados do Tiny.

CREATE OR REPLACE FUNCTION public.catalogo_kropcafe_listar_estoque()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.perfis_usuario
    WHERE id = auth.uid()
      AND ativo = true
  ) THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  RETURN jsonb_build_object(
    'locais', (
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          'nome', l.nome,
          'pais', l.pais,
          'tipo_regiao', l.tipo_regiao
        )
        ORDER BY l.nome
      ), '[]'::jsonb)
      FROM public.locais_estoque l
    ),
    'categorias', (
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'nome', c.nome
        )
        ORDER BY c.nome
      ), '[]'::jsonb)
      FROM public.categorias c
    ),
    'itens', (
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'id', ie.id,
          'sku', ie.sku,
          'id_modelo_produto', ie.id_modelo_produto,
          'nome_produto', ie.nome_produto,
          'preco_venda', ie.preco_venda,
          'moeda_venda', ie.moeda_venda,
          'numeracao_br', ie.numeracao_br,
          'numeracao_eu', ie.numeracao_eu,
          'numeracao_us', ie.numeracao_us,
          'id_local_estoque', ie.id_local_estoque,
          'local_nome', l.nome,
          'local_pais', l.pais,
          'local_tipo_regiao', l.tipo_regiao,
          'id_categoria', m.id_categoria,
          'categoria_nome', c.nome
        )
        ORDER BY ie.sku, ie.id
      ), '[]'::jsonb)
      FROM public.itens_estoque ie
      LEFT JOIN public.locais_estoque l ON l.id = ie.id_local_estoque
      LEFT JOIN public.modelos_produto m ON m.id = ie.id_modelo_produto
      LEFT JOIN public.categorias c ON c.id = m.id_categoria
      WHERE ie.status_item = 'em_estoque'
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.catalogo_kropcafe_listar_estoque() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalogo_kropcafe_listar_estoque() TO authenticated;
