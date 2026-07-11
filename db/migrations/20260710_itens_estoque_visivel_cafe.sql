-- Visibilidade no catálogo público KropCafé (independente de status_item).
ALTER TABLE public.itens_estoque
  ADD COLUMN IF NOT EXISTS visivel_cafe boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.itens_estoque.visivel_cafe IS
  'Se true, o item pode aparecer no catálogo público KropCafé (desde que em_estoque e demais filtros).';

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
  ORDER BY ie.sku ASC, ie.id ASC
  LIMIT 200;
$$;

REVOKE ALL ON FUNCTION public.catalogo_kropcafe_buscar(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalogo_kropcafe_buscar(text, text) TO anon, authenticated;
