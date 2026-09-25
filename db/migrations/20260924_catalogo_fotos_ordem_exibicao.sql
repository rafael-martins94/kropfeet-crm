-- Galeria pública segue a ordem escolhida no modelo.
-- Empate de ordem mantém a foto principal na frente.

CREATE OR REPLACE FUNCTION public.catalogo_kropcafe_fotos(p_modelo_ids uuid[])
RETURNS TABLE (
  id_modelo_produto uuid,
  url_origem text,
  caminho_arquivo text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH ids AS (
    SELECT DISTINCT unnest(coalesce(p_modelo_ids, ARRAY[]::uuid[])) AS id
    LIMIT 80
  )
  SELECT
    img.id_modelo_produto,
    nullif(btrim(img.url_origem), '') AS url_origem,
    nullif(btrim(img.caminho_arquivo), '') AS caminho_arquivo
  FROM public.imagens_modelo_produto img
  INNER JOIN ids ON ids.id = img.id_modelo_produto
  ORDER BY
    img.id_modelo_produto,
    img.ordem_exibicao ASC,
    img.imagem_principal DESC,
    img.criado_em ASC;
$$;
