-- Reaproveita o cliente pelo e-mail ou telefone.
-- Se ele já tem um carrinho aberto com os mesmos pares, atualiza esse carrinho.

CREATE OR REPLACE FUNCTION public.catalogo_kropcafe_salvar_selecao(
  p_nome text,
  p_telefone text,
  p_email text DEFAULT NULL,
  p_pais text DEFAULT NULL,
  p_observacao text DEFAULT NULL,
  p_itens jsonb DEFAULT '[]'::jsonb,
  p_gerar_ordem boolean DEFAULT false,
  p_vendedor text DEFAULT NULL
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
  v_id_carrinho uuid;
  v_id_vendedor uuid;
  v_vendedor_id uuid;
  v_numero text;
  v_busca text;
  v_qtd integer;
  v_achados integer;
  v_total numeric;
  v_digitos text;
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

  IF coalesce(p_gerar_ordem, false) THEN
    BEGIN
      v_vendedor_id := nullif(btrim(coalesce(p_vendedor, '')), '')::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        v_vendedor_id := NULL;
    END;
    IF v_vendedor_id IS NULL THEN
      RAISE EXCEPTION 'Selecione o vendedor.';
    END IF;
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

    SELECT left(btrim(ie.sku), 40)
    INTO v_numero
    FROM jsonb_array_elements(p_itens) WITH ORDINALITY AS t(item, ord)
    JOIN public.itens_estoque ie ON ie.id = (t.item->>'id')::uuid
    ORDER BY t.ord
    LIMIT 1;

    IF v_numero IS NULL THEN
      RAISE EXCEPTION 'Seleção inválida.';
    END IF;

    SELECT id INTO v_id_vendedor
    FROM public.vendedores
    WHERE id = v_vendedor_id
      AND ativo = true;

    IF v_id_vendedor IS NULL THEN
      RAISE EXCEPTION 'Vendedor inválido.';
    END IF;
  END IF;

  v_digitos := nullif(regexp_replace(coalesce(v_telefone, ''), '\D', '', 'g'), '');

  IF v_email IS NOT NULL THEN
    SELECT c.id
    INTO v_id
    FROM public.clientes c
    WHERE lower(c.email) = lower(v_email)
    LIMIT 1;
  END IF;

  IF v_id IS NULL AND v_digitos IS NOT NULL AND char_length(v_digitos) >= 8 THEN
    SELECT c.id
    INTO v_id
    FROM public.clientes c
    WHERE c.telefone IS NOT NULL
      AND char_length(regexp_replace(c.telefone, '\D', '', 'g')) >= 8
      AND (
        regexp_replace(c.telefone, '\D', '', 'g') = v_digitos
        OR regexp_replace(c.telefone, '\D', '', 'g') LIKE '%' || v_digitos
        OR v_digitos LIKE '%' || regexp_replace(c.telefone, '\D', '', 'g')
      )
    ORDER BY
      CASE WHEN regexp_replace(c.telefone, '\D', '', 'g') = v_digitos THEN 0 ELSE 1 END,
      c.atualizado_em DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_id IS NULL THEN
    BEGIN
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
    EXCEPTION
      WHEN unique_violation THEN
        SELECT c.id
        INTO v_id
        FROM public.clientes c
        WHERE v_email IS NOT NULL
          AND lower(c.email) = lower(v_email)
        LIMIT 1;
        IF v_id IS NULL THEN
          RAISE;
        END IF;
    END;
  END IF;

  UPDATE public.clientes
  SET
    nome = v_nome,
    telefone = v_telefone,
    pais = coalesce(v_pais, pais),
    email = CASE
      WHEN v_email IS NULL THEN email
      WHEN EXISTS (
        SELECT 1
        FROM public.clientes outro
        WHERE outro.id <> v_id
          AND outro.email IS NOT NULL
          AND lower(outro.email) = lower(v_email)
      ) THEN email
      ELSE v_email
    END,
    atualizado_em = now()
  WHERE id = v_id;

  IF coalesce(p_gerar_ordem, false) THEN
    INSERT INTO public.vendas (
      id_cliente,
      nome_cliente,
      id_vendedor,
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
      v_id_vendedor,
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

  IF NOT coalesce(p_gerar_ordem, false) THEN
    SELECT c.id
    INTO v_id_carrinho
    FROM public.carrinhos_galeria c
    WHERE c.id_cliente = v_id
      AND c.id_venda IS NULL
      AND jsonb_typeof(c.itens) = 'array'
      AND (
        SELECT coalesce(jsonb_agg(s.id ORDER BY s.id), '[]'::jsonb)
        FROM (
          SELECT DISTINCT lower(btrim(elem->>'id')) AS id
          FROM jsonb_array_elements(c.itens) AS elem
          WHERE nullif(btrim(elem->>'id'), '') IS NOT NULL
        ) AS s
      ) = (
        SELECT coalesce(jsonb_agg(s.id ORDER BY s.id), '[]'::jsonb)
        FROM (
          SELECT DISTINCT lower(btrim(elem->>'id')) AS id
          FROM jsonb_array_elements(p_itens) AS elem
          WHERE nullif(btrim(elem->>'id'), '') IS NOT NULL
        ) AS s
      )
    ORDER BY c.criado_em DESC
    LIMIT 1;
  END IF;

  IF v_id_carrinho IS NOT NULL THEN
    UPDATE public.carrinhos_galeria
    SET
      itens = p_itens,
      observacao = v_observacao,
      busca = v_busca
    WHERE id = v_id_carrinho;
  ELSE
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
  END IF;

  RETURN jsonb_build_object(
    'id_cliente', v_id,
    'id_venda', v_id_venda,
    'numero', v_numero
  );
END;
$$;

REVOKE ALL ON FUNCTION public.catalogo_kropcafe_salvar_selecao(text, text, text, text, text, jsonb, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalogo_kropcafe_salvar_selecao(text, text, text, text, text, jsonb, boolean, text) TO authenticated;
