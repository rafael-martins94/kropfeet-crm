-- No catálogo da galeria, o mesmo modelo na numeração escolhida aparece uma vez.
-- Outros pares iguais continuam no estoque e entram se o exibido for vendido.

CREATE OR REPLACE FUNCTION public.catalogo_kropcafe_buscar(
  p_display_system text,
  p_numeracao text
)
RETURNS TABLE (
  id uuid,
  sku text,
  id_modelo_produto uuid,
  preco_venda numeric,
  moeda_venda text,
  tipo_regiao_local text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    dedup.id,
    dedup.sku,
    dedup.id_modelo_produto,
    dedup.preco_venda,
    dedup.moeda_venda,
    dedup.tipo_regiao_local
  FROM (
    SELECT DISTINCT ON (COALESCE(ie.id_modelo_produto, ie.id))
      ie.id,
      ie.sku,
      ie.id_modelo_produto,
      ie.preco_venda,
      ie.moeda_venda,
      le.tipo_regiao::text AS tipo_regiao_local
    FROM public.itens_estoque ie
    INNER JOIN public.locais_estoque le ON le.id = ie.id_local_estoque
    WHERE ie.status_item = 'em_estoque'
      AND ie.visivel_cafe IS TRUE
      AND le.ativo IS TRUE
      AND le.tipo_regiao = 'europa'
      AND EXISTS (
        SELECT 1
        FROM public.catalogo_filter_target_rows(p_display_system, p_numeracao) target
        WHERE public.catalogo_item_matches_row(ie.numeracao_br, ie.numeracao_eu, ie.numeracao_us, target)
      )
    ORDER BY COALESCE(ie.id_modelo_produto, ie.id), ie.sku ASC, ie.id ASC
  ) dedup
  ORDER BY dedup.sku ASC, dedup.id ASC
  LIMIT 200;
$$;

REVOKE ALL ON FUNCTION public.catalogo_kropcafe_buscar(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalogo_kropcafe_buscar(text, text) TO anon, authenticated;
