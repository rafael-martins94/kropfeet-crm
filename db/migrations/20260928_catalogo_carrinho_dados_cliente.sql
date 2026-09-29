-- O carrinho recuperado no catálogo traz de volta o cliente já cadastrado.

CREATE OR REPLACE FUNCTION public.catalogo_kropcafe_listar_carrinhos()
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

  RETURN (
    SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.criado_em DESC), '[]'::jsonb)
    FROM (
      SELECT
        c.id,
        c.criado_em,
        cl.nome,
        cl.telefone,
        cl.email,
        cl.pais,
        c.observacao,
        (
          SELECT coalesce(jsonb_agg(
            jsonb_build_object(
              'id', ie.id,
              'sku', ie.sku,
              'id_modelo_produto', ie.id_modelo_produto,
              'preco_venda', ie.preco_venda,
              'moeda_venda', ie.moeda_venda,
              'numeracao', coalesce(e.item->>'numeracao', '')
            )
            ORDER BY e.ord
          ), '[]'::jsonb)
          FROM jsonb_array_elements(coalesce(c.itens, '[]'::jsonb)) WITH ORDINALITY AS e(item, ord)
          JOIN public.itens_estoque ie
            ON ie.id = CASE
              WHEN e.item->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN (e.item->>'id')::uuid
              ELSE NULL
            END
        ) AS itens
      FROM public.carrinhos_galeria c
      JOIN public.clientes cl ON cl.id = c.id_cliente
      WHERE c.id_venda IS NULL
      ORDER BY c.criado_em DESC
      LIMIT 40
    ) t
  );
END;
$$;

REVOKE ALL ON FUNCTION public.catalogo_kropcafe_listar_carrinhos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalogo_kropcafe_listar_carrinhos() TO authenticated;
