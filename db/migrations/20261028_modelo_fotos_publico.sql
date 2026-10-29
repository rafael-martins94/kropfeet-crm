-- Link público e estável com as fotos de um modelo.
-- A página só devolve o nome e as imagens. Preço, estoque e códigos ficam de fora.

ALTER TABLE public.modelos_produto
  ADD COLUMN IF NOT EXISTS token_fotos text;

CREATE UNIQUE INDEX IF NOT EXISTS modelos_produto_token_fotos_unico
  ON public.modelos_produto (token_fotos)
  WHERE token_fotos IS NOT NULL;

COMMENT ON COLUMN public.modelos_produto.token_fotos IS
  'Token do link público das fotos. Nulo até alguém da equipe gerar o link.';

CREATE OR REPLACE FUNCTION public.modelo_fotos_garantir_link(p_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_token text;
  v_bytes bytea;
  v_i integer;
  v_tentativa integer;
BEGIN
  IF NOT public.is_equipe_crm() THEN
    RAISE EXCEPTION 'Sem permissão.';
  END IF;

  SELECT token_fotos
  INTO v_token
  FROM public.modelos_produto
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Modelo não encontrado.';
  END IF;

  IF v_token IS NOT NULL THEN
    RETURN v_token;
  END IF;

  FOR v_tentativa IN 1..8 LOOP
    v_bytes := gen_random_bytes(8);
    v_token := '';
    FOR v_i IN 0..7 LOOP
      v_token := v_token || substr(
        'abcdefghjkmnpqrstuvwxyz23456789',
        1 + (get_byte(v_bytes, v_i) % 32),
        1
      );
    END LOOP;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.modelos_produto WHERE token_fotos = v_token
    );
  END LOOP;

  IF EXISTS (SELECT 1 FROM public.modelos_produto WHERE token_fotos = v_token) THEN
    RAISE EXCEPTION 'Não foi possível gerar o link. Tente de novo.';
  END IF;

  UPDATE public.modelos_produto
  SET token_fotos = v_token
  WHERE id = p_id
    AND token_fotos IS NULL
  RETURNING token_fotos INTO v_token;

  IF v_token IS NULL THEN
    SELECT token_fotos INTO v_token FROM public.modelos_produto WHERE id = p_id;
  END IF;

  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.modelo_fotos_publico(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce((
    SELECT jsonb_build_object(
      'encontrado', true,
      'fotos', coalesce((
        SELECT jsonb_agg(
          coalesce(nullif(btrim(im.caminho_arquivo), ''), nullif(btrim(im.url_origem), ''))
          ORDER BY im.imagem_principal DESC, im.ordem_exibicao, im.criado_em
        )
        FROM public.imagens_modelo_produto im
        WHERE im.id_modelo_produto = m.id
          AND coalesce(nullif(btrim(im.caminho_arquivo), ''), nullif(btrim(im.url_origem), '')) IS NOT NULL
      ), '[]'::jsonb)
    )
    FROM public.modelos_produto m
    WHERE m.token_fotos = nullif(btrim(p_token), '')
  ), jsonb_build_object('encontrado', false));
$$;

REVOKE ALL ON FUNCTION public.modelo_fotos_garantir_link(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.modelo_fotos_publico(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.modelo_fotos_garantir_link(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.modelo_fotos_publico(text) TO anon, authenticated;
