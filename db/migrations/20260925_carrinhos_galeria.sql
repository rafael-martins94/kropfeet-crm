-- Carrinhos salvos na galeria KropCafé, com ou sem ordem de venda.

CREATE TABLE public.carrinhos_galeria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_cliente uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  id_venda uuid REFERENCES public.vendas(id) ON DELETE SET NULL,
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  observacao text,
  busca text NOT NULL DEFAULT '',
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX carrinhos_galeria_criado_em_idx
  ON public.carrinhos_galeria (criado_em DESC);

CREATE INDEX carrinhos_galeria_id_cliente_idx
  ON public.carrinhos_galeria (id_cliente);

CREATE INDEX carrinhos_galeria_id_venda_idx
  ON public.carrinhos_galeria (id_venda);

ALTER TABLE public.carrinhos_galeria ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_authenticated_select ON public.carrinhos_galeria
  FOR SELECT TO authenticated
  USING (true);

REVOKE ALL ON TABLE public.carrinhos_galeria FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.carrinhos_galeria TO authenticated;

-- Recupera seleções já gravadas só no cadastro do cliente.
INSERT INTO public.carrinhos_galeria (
  id_cliente,
  id_venda,
  itens,
  observacao,
  busca,
  criado_em
)
SELECT
  c.id,
  v.id,
  coalesce(itens.lista, '[]'::jsonb),
  nullif(
    btrim(regexp_replace(c.observacoes, '^Seleção Galeria\s*(?:- .*(?:\n|$))*', '', 'n')),
    ''
  ),
  lower(
    coalesce(c.nome, '') || ' ' || coalesce(c.telefone, '') || ' ' ||
    coalesce(c.email, '') || ' ' || coalesce(c.pais, '') || ' ' ||
    coalesce(c.observacoes, '')
  ),
  c.criado_em
FROM public.clientes c
LEFT JOIN LATERAL (
  SELECT v.id
  FROM public.vendas v
  WHERE v.id_cliente = c.id
    AND v.local_venda = 'galeria'
  ORDER BY v.criado_em
  LIMIT 1
) v ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'sku', nullif(split_part(linha, ' · ', 1), ''),
      'numeracao', nullif(split_part(linha, ' · ', 2), ''),
      'preco', nullif(split_part(linha, ' · ', 3), '')
    )
  ) AS lista
  FROM (
    SELECT btrim(substr(l, 3)) AS linha
    FROM regexp_split_to_table(coalesce(c.observacoes, ''), E'\n') AS l
    WHERE l LIKE '- %'
  ) linhas
) itens ON true
WHERE c.observacoes LIKE 'Seleção Galeria%';

CREATE OR REPLACE FUNCTION public.catalogo_kropcafe_salvar_selecao(
  p_nome text,
  p_telefone text,
  p_email text DEFAULT NULL,
  p_pais text DEFAULT NULL,
  p_observacao text DEFAULT NULL,
  p_itens jsonb DEFAULT '[]'::jsonb,
  p_gerar_ordem boolean DEFAULT false
)
RETURNS jsonb
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
  v_id_venda uuid;
  v_numero text;
  v_busca text;
  v_qtd integer;
  v_achados integer;
  v_total numeric;
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

  IF coalesce(p_gerar_ordem, false) THEN
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_itens) AS t(item)
      WHERE coalesce(t.item->>'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ) THEN
      RAISE EXCEPTION 'Seleção inválida.';
    END IF;

    IF (
      SELECT count(*)
      FROM (
        SELECT lower(t.item->>'id')
        FROM jsonb_array_elements(p_itens) AS t(item)
        GROUP BY 1
        HAVING count(*) > 1
      ) AS duplicados
    ) > 0 THEN
      RAISE EXCEPTION 'Seleção inválida.';
    END IF;

    PERFORM 1
    FROM public.itens_estoque ie
    WHERE ie.id IN (
      SELECT (t.item->>'id')::uuid
      FROM jsonb_array_elements(p_itens) AS t(item)
    )
    FOR UPDATE;

    SELECT count(*), coalesce(sum(coalesce(ie.preco_venda, 0)), 0)
    INTO v_achados, v_total
    FROM jsonb_array_elements(p_itens) AS t(item)
    JOIN public.itens_estoque ie
      ON ie.id = (t.item->>'id')::uuid
     AND ie.status_item = 'em_estoque';

    IF v_achados IS DISTINCT FROM v_qtd THEN
      RAISE EXCEPTION 'Um dos pares não está mais disponível.';
    END IF;
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

  IF coalesce(p_gerar_ordem, false) THEN
    v_numero := 'GAL-' || to_char(clock_timestamp(), 'YYMMDD-HH24MISS');

    INSERT INTO public.vendas (
      id_cliente,
      nome_cliente,
      numero,
      data_pedido,
      status_venda,
      regiao_venda,
      local_venda,
      total_produtos,
      valor_total,
      obs,
      marcadores
    )
    VALUES (
      v_id,
      v_nome,
      v_numero,
      now(),
      'em_aberto',
      'europa',
      'galeria',
      v_total,
      v_total,
      v_obs,
      jsonb_build_array(jsonb_build_object('descricao', 'Galeria', 'cor', '#d7b56d'))
    )
    RETURNING id INTO v_id_venda;

    INSERT INTO public.itens_venda (
      id_venda,
      id_item_estoque,
      codigo,
      descricao,
      quantidade,
      valor_unitario
    )
    SELECT
      v_id_venda,
      ie.id,
      left(ie.sku, 80),
      left(
        btrim(ie.sku) || ' · ' || left(btrim(coalesce(t.item->>'numeracao', '')), 40),
        180
      ),
      1,
      coalesce(ie.preco_venda, 0)
    FROM jsonb_array_elements(p_itens) WITH ORDINALITY AS t(item, ord)
    JOIN public.itens_estoque ie ON ie.id = (t.item->>'id')::uuid
    ORDER BY t.ord;

    PERFORM public.sincronizar_efeitos_venda(v_id_venda);
  END IF;

  v_busca := lower(
    v_nome || ' ' || v_telefone || ' ' ||
    coalesce(v_email, '') || ' ' || coalesce(v_pais, '') || ' ' ||
    replace(coalesce(v_linhas, ''), E'\n', ' ')
  );

  INSERT INTO public.carrinhos_galeria (
    id_cliente,
    id_venda,
    itens,
    observacao,
    busca
  )
  VALUES (
    v_id,
    v_id_venda,
    p_itens,
    v_observacao,
    v_busca
  );

  RETURN jsonb_build_object(
    'id_cliente', v_id,
    'id_venda', v_id_venda,
    'numero', v_numero
  );
END;
$$;

REVOKE ALL ON FUNCTION public.catalogo_kropcafe_salvar_selecao(text, text, text, text, text, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalogo_kropcafe_salvar_selecao(text, text, text, text, text, jsonb, boolean) TO anon, authenticated;
