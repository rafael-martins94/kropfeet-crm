-- Catálogo KropCafe: acesso público somente via RPCs com colunas limitadas.

CREATE TABLE IF NOT EXISTS public.shoe_size_equivalence (
  id serial PRIMARY KEY,
  br numeric,
  eu numeric,
  us_m numeric,
  us_w numeric,
  us_y numeric,
  us_y_suffix text
);

TRUNCATE public.shoe_size_equivalence RESTART IDENTITY;

INSERT INTO public.shoe_size_equivalence (br, eu, us_m, us_w, us_y, us_y_suffix) VALUES
  (24.5, 25.5, NULL, NULL, 8.5, 'C'),
  (25, 26, NULL, NULL, 9, 'C'),
  (25.5, 26.5, NULL, NULL, 9.5, 'C'),
  (26, 27, NULL, NULL, 10, 'C'),
  (26.5, 27.5, NULL, NULL, 10.5, 'C'),
  (27, 28, NULL, NULL, 11, 'C'),
  (28, 28.5, NULL, NULL, 11.5, 'C'),
  (28.5, 29.5, NULL, NULL, 12, 'C'),
  (29, 30, NULL, NULL, 12.5, 'C'),
  (30, 31, NULL, NULL, 13, 'C'),
  (30.5, 31.5, NULL, NULL, 13.5, 'C'),
  (31, 32, 1, NULL, 1, 'Y'),
  (32, 33, 1.5, NULL, 1.5, 'Y'),
  (32.5, 33.5, 2, NULL, 2, 'Y'),
  (33, 34, 2.5, NULL, 2.5, 'Y'),
  (33.5, 35, 3, NULL, 3, 'Y'),
  (34, 35.5, 3.5, 5.5, 3.5, 'Y'),
  (34.5, 36, 4, 5.5, 4, 'Y'),
  (35, 36.5, 4.5, 6, 4.5, 'Y'),
  (35.5, 37.5, 5, 6.5, 5, 'Y'),
  (36, 38, 5.5, 7, 5.5, 'Y'),
  (37, 38.5, 6, 7.5, 6, 'Y'),
  (37.5, 39, 6.5, 8, 6.5, 'Y'),
  (38, 40, 7, 8.5, 7, 'Y'),
  (39, 40.5, 7.5, 9, NULL, NULL),
  (39.5, 41, 8, 9.5, NULL, NULL),
  (40, 42, 8.5, 10, NULL, NULL),
  (40.5, 42.5, 9, 10.5, NULL, NULL),
  (41, 43, 9.5, 11, NULL, NULL),
  (42, 44, 10, 11.5, NULL, NULL),
  (42.5, 44.5, 10.5, 12, NULL, NULL),
  (43, 45, 11, 12.5, NULL, NULL),
  (43.5, 45.5, 11.5, 13, NULL, NULL),
  (44, 46, 12, 13.5, NULL, NULL),
  (45, 47, 12.5, 14, NULL, NULL),
  (45.5, 47.5, 13, 14.5, NULL, NULL),
  (46.5, 48.5, 14, NULL, NULL, NULL),
  (47.5, 49.5, 15, NULL, NULL, NULL),
  (48.5, 50.5, 16, NULL, NULL, NULL),
  (49.5, 51.5, 17, NULL, NULL, NULL),
  (50.5, 52.5, 18, NULL, NULL, NULL);

ALTER TABLE public.shoe_size_equivalence ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.catalogo_same_size(a numeric, b numeric)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT a IS NOT NULL AND b IS NOT NULL AND abs(a - b) < 0.0001;
$$;

CREATE OR REPLACE FUNCTION public.catalogo_parse_us_column(raw text)
RETURNS TABLE(val numeric, variant text)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text;
  m text[];
  n numeric;
  suf text;
BEGIN
  IF raw IS NULL OR btrim(raw) = '' THEN
    RETURN;
  END IF;

  v := upper(replace(btrim(raw), ',', '.'));
  m := regexp_match(v, '^(\d+(?:\.\d+)?)\s*([CYW])?\s*$');
  IF m IS NULL THEN
    RETURN;
  END IF;

  n := m[1]::numeric;
  suf := coalesce(m[2], '');

  IF suf IN ('C', 'Y') THEN
    RETURN QUERY SELECT n, 'y'::text;
  ELSIF suf = 'W' THEN
    RETURN QUERY SELECT n, 'w'::text;
  ELSE
    RETURN QUERY SELECT n, 'mens'::text;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalogo_item_matches_row(
  p_br numeric,
  p_eu numeric,
  p_us text,
  p_row public.shoe_size_equivalence
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  us_val numeric;
  us_variant text;
BEGIN
  IF catalogo_same_size(p_br, p_row.br) THEN
    RETURN true;
  END IF;

  IF catalogo_same_size(p_eu, p_row.eu) THEN
    RETURN true;
  END IF;

  SELECT val, variant INTO us_val, us_variant
  FROM public.catalogo_parse_us_column(p_us)
  LIMIT 1;

  IF us_val IS NULL THEN
    RETURN false;
  END IF;

  IF us_variant = 'mens' AND catalogo_same_size(us_val, p_row.us_m) THEN
    RETURN true;
  END IF;

  IF us_variant = 'w' AND catalogo_same_size(us_val, p_row.us_w) THEN
    RETURN true;
  END IF;

  IF us_variant = 'y' AND catalogo_same_size(us_val, p_row.us_y) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalogo_filter_target_rows(
  p_display_system text,
  p_numeracao text
)
RETURNS SETOF public.shoe_size_equivalence
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_system text := lower(btrim(coalesce(p_display_system, '')));
  v_raw text := upper(replace(btrim(coalesce(p_numeracao, '')), ',', '.'));
  v_compact text;
  v_value numeric;
  v_match text[];
BEGIN
  IF v_system NOT IN ('br', 'eu', 'us') OR v_raw = '' OR length(v_raw) > 16 THEN
    RETURN;
  END IF;

  v_compact := regexp_replace(v_raw, '\s+', '', 'g');

  v_match := regexp_match(v_compact, '^BR(\d+(?:\.\d+)?)$');
  IF v_match IS NOT NULL THEN
    RETURN QUERY SELECT * FROM public.shoe_size_equivalence e WHERE catalogo_same_size(e.br, v_match[1]::numeric);
    RETURN;
  END IF;

  v_match := regexp_match(v_compact, '^EU(\d+(?:\.\d+)?)$');
  IF v_match IS NOT NULL THEN
    RETURN QUERY SELECT * FROM public.shoe_size_equivalence e WHERE catalogo_same_size(e.eu, v_match[1]::numeric);
    RETURN;
  END IF;

  v_match := regexp_match(v_compact, '^USM(\d+(?:\.\d+)?)$');
  IF v_match IS NOT NULL THEN
    RETURN QUERY SELECT * FROM public.shoe_size_equivalence e WHERE catalogo_same_size(e.us_m, v_match[1]::numeric);
    RETURN;
  END IF;

  v_match := regexp_match(v_compact, '^US(\d+(?:\.\d+)?)C$');
  IF v_match IS NOT NULL THEN
    RETURN QUERY SELECT * FROM public.shoe_size_equivalence e WHERE catalogo_same_size(e.us_y, v_match[1]::numeric);
    RETURN;
  END IF;

  v_match := regexp_match(v_compact, '^US(\d+(?:\.\d+)?)Y$');
  IF v_match IS NOT NULL THEN
    RETURN QUERY SELECT * FROM public.shoe_size_equivalence e WHERE catalogo_same_size(e.us_y, v_match[1]::numeric);
    RETURN;
  END IF;

  v_match := regexp_match(v_compact, '^US(\d+(?:\.\d+)?)W$');
  IF v_match IS NOT NULL THEN
    RETURN QUERY SELECT * FROM public.shoe_size_equivalence e WHERE catalogo_same_size(e.us_w, v_match[1]::numeric);
    RETURN;
  END IF;

  v_match := regexp_match(v_compact, '^(\d+(?:\.\d+)?)C$');
  IF v_match IS NOT NULL THEN
    RETURN QUERY SELECT * FROM public.shoe_size_equivalence e WHERE catalogo_same_size(e.us_y, v_match[1]::numeric);
    RETURN;
  END IF;

  v_match := regexp_match(v_compact, '^(\d+(?:\.\d+)?)Y$');
  IF v_match IS NOT NULL THEN
    RETURN QUERY SELECT * FROM public.shoe_size_equivalence e WHERE catalogo_same_size(e.us_y, v_match[1]::numeric);
    RETURN;
  END IF;

  v_match := regexp_match(v_compact, '^(\d+(?:\.\d+)?)W$');
  IF v_match IS NOT NULL THEN
    RETURN QUERY SELECT * FROM public.shoe_size_equivalence e WHERE catalogo_same_size(e.us_w, v_match[1]::numeric);
    RETURN;
  END IF;

  v_match := regexp_match(v_compact, '^M(\d+(?:\.\d+)?)$');
  IF v_match IS NOT NULL THEN
    RETURN QUERY SELECT * FROM public.shoe_size_equivalence e WHERE catalogo_same_size(e.us_m, v_match[1]::numeric);
    RETURN;
  END IF;

  v_match := regexp_match(v_compact, '^USW(\d+(?:\.\d+)?)$');
  IF v_match IS NOT NULL THEN
    RETURN QUERY SELECT * FROM public.shoe_size_equivalence e WHERE catalogo_same_size(e.us_w, v_match[1]::numeric);
    RETURN;
  END IF;

  v_match := regexp_match(v_compact, '^W(\d+(?:\.\d+)?)$');
  IF v_match IS NOT NULL THEN
    RETURN QUERY SELECT * FROM public.shoe_size_equivalence e WHERE catalogo_same_size(e.us_w, v_match[1]::numeric);
    RETURN;
  END IF;

  v_match := regexp_match(v_compact, '^US(\d+(?:\.\d+)?)$');
  IF v_match IS NOT NULL THEN
    RETURN QUERY
    SELECT DISTINCT ON (e.br) e.*
    FROM public.shoe_size_equivalence e
    WHERE catalogo_same_size(e.us_m, v_match[1]::numeric)
    ORDER BY e.br;
    RETURN;
  END IF;

  v_match := regexp_match(v_compact, '^(\d+(?:\.\d+)?)$');
  IF v_match IS NULL THEN
    RETURN;
  END IF;

  v_value := v_match[1]::numeric;

  IF v_system = 'us' THEN
    RETURN QUERY
    SELECT DISTINCT ON (e.br) e.*
    FROM public.shoe_size_equivalence e
    WHERE catalogo_same_size(e.us_m, v_value)
    ORDER BY e.br;
    RETURN;
  END IF;

  IF v_system = 'eu' THEN
    RETURN QUERY SELECT * FROM public.shoe_size_equivalence e WHERE catalogo_same_size(e.eu, v_value);
    RETURN;
  END IF;

  RETURN QUERY SELECT * FROM public.shoe_size_equivalence e WHERE catalogo_same_size(e.br, v_value);
END;
$$;

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
  ORDER BY img.id_modelo_produto, img.imagem_principal DESC, img.ordem_exibicao ASC;
$$;

REVOKE ALL ON FUNCTION public.catalogo_kropcafe_buscar(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.catalogo_kropcafe_fotos(uuid[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.catalogo_kropcafe_buscar(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.catalogo_kropcafe_fotos(uuid[]) TO anon, authenticated;
