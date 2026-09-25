-- Salva a seleção da galeria KropCafé como cliente, com a tag Galeria.
-- O catálogo é público: a função só insere esse cadastro, sem liberar a tabela.

CREATE OR REPLACE FUNCTION public.catalogo_kropcafe_salvar_selecao(
  p_nome text,
  p_telefone text,
  p_email text DEFAULT NULL,
  p_pais text DEFAULT NULL,
  p_observacao text DEFAULT NULL,
  p_itens jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nome text;
  v_telefone text;
  v_email text;
  v_pais text;
  v_observacao text;
  v_linhas text;
  v_obs text;
  v_id uuid;
  v_qtd integer;
BEGIN
  v_nome := nullif(btrim(coalesce(p_nome, '')), '');
  v_telefone := nullif(btrim(coalesce(p_telefone, '')), '');

  IF v_nome IS NULL OR char_length(v_nome) > 160 THEN
    RAISE EXCEPTION 'Informe o nome do cliente.';
  END IF;

  IF v_telefone IS NULL OR char_length(v_telefone) > 40 THEN
    RAISE EXCEPTION 'Informe o telefone do cliente.';
  END IF;

  v_email := nullif(btrim(coalesce(p_email, '')), '');
  IF v_email IS NOT NULL AND (
    char_length(v_email) > 160
    OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ) THEN
    RAISE EXCEPTION 'E-mail inválido.';
  END IF;

  v_pais := nullif(btrim(coalesce(p_pais, '')), '');
  IF v_pais IS NOT NULL AND char_length(v_pais) > 80 THEN
    RAISE EXCEPTION 'País inválido.';
  END IF;

  v_observacao := nullif(btrim(coalesce(p_observacao, '')), '');
  IF v_observacao IS NOT NULL AND char_length(v_observacao) > 2000 THEN
    RAISE EXCEPTION 'Observação muito longa.';
  END IF;

  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' THEN
    RAISE EXCEPTION 'Seleção inválida.';
  END IF;

  v_qtd := jsonb_array_length(p_itens);
  IF v_qtd < 1 OR v_qtd > 40 THEN
    RAISE EXCEPTION 'Selecione ao menos um par.';
  END IF;

  SELECT string_agg(s.linha, E'\n' ORDER BY s.ord)
  INTO v_linhas
  FROM (
    SELECT
      t.ord,
      format(
        '- %s · %s%s',
        left(btrim(coalesce(t.item->>'sku', '')), 40),
        left(btrim(coalesce(t.item->>'numeracao', '')), 40),
        CASE
          WHEN nullif(btrim(coalesce(t.item->>'preco', '')), '') IS NULL THEN ''
          ELSE ' · ' || left(btrim(t.item->>'preco'), 40)
        END
      ) AS linha
    FROM jsonb_array_elements(p_itens) WITH ORDINALITY AS t(item, ord)
    WHERE nullif(btrim(coalesce(t.item->>'sku', '')), '') IS NOT NULL
  ) AS s;

  IF v_linhas IS NULL THEN
    RAISE EXCEPTION 'Selecione ao menos um par.';
  END IF;

  v_obs := 'Seleção Galeria' || E'\n' || v_linhas;
  IF v_observacao IS NOT NULL THEN
    v_obs := v_obs || E'\n\n' || v_observacao;
  END IF;

  INSERT INTO public.clientes (
    nome,
    telefone,
    email,
    pais,
    observacoes,
    marcadores,
    tipo_pessoa
  )
  VALUES (
    v_nome,
    v_telefone,
    v_email,
    v_pais,
    v_obs,
    jsonb_build_array(jsonb_build_object('descricao', 'Galeria', 'cor', '#d7b56d')),
    'fisica'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.catalogo_kropcafe_salvar_selecao(text, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalogo_kropcafe_salvar_selecao(text, text, text, text, text, jsonb) TO anon, authenticated;
