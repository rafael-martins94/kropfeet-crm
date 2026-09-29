-- Carrinho da galeria fica aberto até a venda existir.
-- O vendedor é o login do catálogo. O link de pagamento fica no carrinho
-- e só é trocado quando a conta (país) muda.

ALTER TABLE public.carrinhos_galeria
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'aberto',
  ADD COLUMN IF NOT EXISTS id_usuario uuid,
  ADD COLUMN IF NOT EXISTS id_checkout text,
  ADD COLUMN IF NOT EXISTS conta_pagamento text,
  ADD COLUMN IF NOT EXISTS url_pagamento text,
  ADD COLUMN IF NOT EXISTS valor_pagamento numeric(12, 2),
  ADD COLUMN IF NOT EXISTS moeda_pagamento text;

ALTER TABLE public.carrinhos_galeria
  DROP CONSTRAINT IF EXISTS carrinhos_galeria_status_check;
ALTER TABLE public.carrinhos_galeria
  ADD CONSTRAINT carrinhos_galeria_status_check
  CHECK (status IN ('aberto', 'finalizado'));

ALTER TABLE public.carrinhos_galeria
  DROP CONSTRAINT IF EXISTS carrinhos_galeria_conta_pagamento_check;
ALTER TABLE public.carrinhos_galeria
  ADD CONSTRAINT carrinhos_galeria_conta_pagamento_check
  CHECK (conta_pagamento IS NULL OR conta_pagamento IN ('pt', 'br'));

UPDATE public.carrinhos_galeria
SET status = CASE WHEN id_venda IS NULL THEN 'aberto' ELSE 'finalizado' END
WHERE status IS DISTINCT FROM CASE WHEN id_venda IS NULL THEN 'aberto' ELSE 'finalizado' END;

CREATE INDEX IF NOT EXISTS carrinhos_galeria_abertos_idx
  ON public.carrinhos_galeria (id_usuario, criado_em DESC)
  WHERE status = 'aberto';

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

    BEGIN
      v_vendedor_id := nullif(btrim(coalesce(p_vendedor, '')), '')::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        v_vendedor_id := NULL;
    END;

    IF v_vendedor_id IS NOT NULL THEN
      SELECT id INTO v_id_vendedor
      FROM public.vendedores
      WHERE id = v_vendedor_id
        AND ativo = true;
    END IF;

    IF v_id_vendedor IS NULL AND auth.uid() IS NOT NULL THEN
      SELECT v.id
      INTO v_id_vendedor
      FROM public.vendedores v
      JOIN public.perfis_usuario p ON p.id = auth.uid()
      WHERE v.ativo
        AND (
          lower(btrim(v.nome)) = lower(btrim(p.nome))
          OR lower(btrim(p.nome)) LIKE '%' || lower(btrim(v.nome)) || '%'
        )
      ORDER BY
        CASE WHEN lower(btrim(v.nome)) = lower(btrim(p.nome)) THEN 0 ELSE 1 END,
        char_length(v.nome) DESC
      LIMIT 1;
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

  IF nullif(current_setting('kropfeet.id_carrinho', true), '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT c.id
    INTO v_id_carrinho
    FROM public.carrinhos_galeria c
    WHERE c.id = current_setting('kropfeet.id_carrinho', true)::uuid
      AND c.id_cliente = v_id
      AND c.status = 'aberto'
      AND c.id_venda IS NULL;
  END IF;

  IF v_id_carrinho IS NULL THEN
    SELECT c.id
    INTO v_id_carrinho
    FROM public.carrinhos_galeria c
    WHERE c.id_cliente = v_id
      AND c.status = 'aberto'
      AND c.id_venda IS NULL
      AND (
        auth.uid() IS NULL
        OR c.id_usuario IS NULL
        OR c.id_usuario = auth.uid()
      )
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
      busca = v_busca,
      id_usuario = coalesce(id_usuario, auth.uid()),
      id_venda = CASE WHEN coalesce(p_gerar_ordem, false) THEN v_id_venda ELSE id_venda END,
      status = CASE WHEN coalesce(p_gerar_ordem, false) THEN 'finalizado' ELSE 'aberto' END
    WHERE id = v_id_carrinho;
  ELSE
    INSERT INTO public.carrinhos_galeria (
      id_cliente,
      id_venda,
      id_usuario,
      status,
      itens,
      observacao,
      busca
    )
    VALUES (
      v_id,
      v_id_venda,
      auth.uid(),
      CASE WHEN coalesce(p_gerar_ordem, false) THEN 'finalizado' ELSE 'aberto' END,
      p_itens,
      v_observacao,
      v_busca
    )
    RETURNING id INTO v_id_carrinho;
  END IF;

  RETURN jsonb_build_object(
    'id_cliente', v_id,
    'id_venda', v_id_venda,
    'id_carrinho', v_id_carrinho,
    'numero', v_numero
  );
END;
$$;

REVOKE ALL ON FUNCTION public.catalogo_kropcafe_salvar_selecao(text, text, text, text, text, jsonb, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalogo_kropcafe_salvar_selecao(text, text, text, text, text, jsonb, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.catalogo_kropcafe_pagamento_presencial(
  p_nome text,
  p_telefone text,
  p_email text DEFAULT NULL,
  p_pais text DEFAULT NULL,
  p_observacao text DEFAULT NULL,
  p_itens jsonb DEFAULT '[]'::jsonb,
  p_conta text DEFAULT NULL,
  p_valor numeric DEFAULT NULL,
  p_codigo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_salvo jsonb;
  v_id_venda uuid;
  v_id_vendedor uuid;
  v_conta text;
  v_valor numeric;
  v_codigo text;
  v_moeda text;
  v_regiao public.tipo_regiao_enum;
  v_forma text;
  v_meio text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.perfis_usuario
    WHERE id = auth.uid()
      AND ativo = true
      AND papel IN ('admin', 'operador', 'vendedor')
  ) THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  v_codigo := (regexp_match(upper(btrim(coalesce(p_codigo, ''))), '(T[A-Z0-9]{6,24})'))[1];
  IF v_codigo IS NULL THEN
    RAISE EXCEPTION 'Cole o código SumUp da filipeta.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.parcelas_venda
    WHERE upper(btrim(codigo_transacao)) = v_codigo
  ) OR EXISTS (
    SELECT 1
    FROM public.vendas
    WHERE upper(btrim(codigo_venda_adquirente)) = v_codigo
      AND status_venda <> 'cancelado'
  ) THEN
    RAISE EXCEPTION 'Este código SumUp já está em uma ordem.';
  END IF;

  PERFORM set_config('kropfeet.bypass_equipe', '1', true);

  v_conta := lower(btrim(coalesce(p_conta, '')));
  IF v_conta NOT IN ('pt', 'br') THEN
    RAISE EXCEPTION 'Informe a conta SumUp.';
  END IF;

  v_valor := round(coalesce(p_valor, 0), 2);
  IF v_valor <= 0 OR v_valor > 999999.99 THEN
    RAISE EXCEPTION 'Informe um valor válido.';
  END IF;

  IF v_conta = 'br' THEN
    v_moeda := 'BRL';
    v_regiao := 'brasil';
    v_forma := 'credito';
    v_meio := 'SumUp';
  ELSE
    v_moeda := 'EUR';
    v_regiao := 'europa';
    v_forma := 'cartao';
    v_meio := 'SumUp Máquina';
  END IF;

  SELECT v.id
  INTO v_id_vendedor
  FROM public.vendedores v
  JOIN public.perfis_usuario p ON p.id = auth.uid()
  WHERE v.ativo
    AND (
      lower(btrim(v.nome)) = lower(btrim(p.nome))
      OR lower(btrim(p.nome)) LIKE '%' || lower(btrim(v.nome)) || '%'
    )
  ORDER BY
    CASE WHEN lower(btrim(v.nome)) = lower(btrim(p.nome)) THEN 0 ELSE 1 END,
    char_length(v.nome) DESC
  LIMIT 1;

  v_salvo := public.catalogo_kropcafe_salvar_selecao(
    p_nome,
    p_telefone,
    p_email,
    p_pais,
    p_observacao,
    p_itens,
    true,
    v_id_vendedor::text
  );
  v_id_venda := (v_salvo->>'id_venda')::uuid;
  IF v_id_venda IS NULL THEN
    RAISE EXCEPTION 'Não foi possível abrir a ordem de venda.';
  END IF;

  UPDATE public.vendas
  SET
    moeda_venda = v_moeda,
    regiao_venda = v_regiao,
    valor_total = v_valor,
    forma_pagamento = v_forma,
    condicao_pagamento = '1x',
    local_venda = 'galeria',
    codigo_venda_adquirente = v_codigo
  WHERE id = v_id_venda;

  INSERT INTO public.parcelas_venda (
    id_venda,
    numero,
    data_vencimento,
    valor,
    forma_pagamento,
    meio_pagamento,
    dias,
    pago,
    codigo_transacao
  )
  VALUES (
    v_id_venda,
    1,
    current_date,
    v_valor,
    v_forma,
    v_meio,
    0,
    false,
    v_codigo
  );

  PERFORM public.sincronizar_contas_receber_venda(v_id_venda);

  RETURN jsonb_build_object(
    'id_cliente', v_salvo->>'id_cliente',
    'id_venda', v_id_venda,
    'numero', v_salvo->>'numero',
    'codigo', v_codigo
  );
END;
$$;

REVOKE ALL ON FUNCTION public.catalogo_kropcafe_pagamento_presencial(text, text, text, text, text, jsonb, text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalogo_kropcafe_pagamento_presencial(text, text, text, text, text, jsonb, text, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.aplicar_retorno_checkout_sumup(
  p_id_checkout text,
  p_status text,
  p_codigo text DEFAULT NULL,
  p_id_venda uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r public.checkouts_sumup%ROWTYPE;
  v_id_venda uuid;
  v_codigo text;
  v_status text;
  v_linhas integer;
  v_salvo jsonb;
  v_pedido jsonb;
  v_moeda text;
  v_regiao public.tipo_regiao_enum;
  v_forma text;
  v_meio text;
  v_erro text;
  v_id_carrinho_pago uuid;
  v_id_checkout text;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  PERFORM set_config('kropfeet.bypass_equipe', '1', true);

  SELECT *
  INTO r
  FROM public.checkouts_sumup
  WHERE id_checkout = p_id_checkout
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('aplicado', false);
  END IF;

  v_status := upper(btrim(coalesce(p_status, '')));
  v_codigo := nullif(upper(btrim(coalesce(p_codigo, ''))), '');
  v_id_venda := coalesce(r.id_venda, p_id_venda);

  UPDATE public.checkouts_sumup
  SET
    status = coalesce(nullif(v_status, ''), status),
    codigo_transacao = coalesce(v_codigo, codigo_transacao),
    atualizado_em = now()
  WHERE id_checkout = p_id_checkout;

  IF v_status <> 'PAID' OR v_codigo IS NULL THEN
    RETURN jsonb_build_object('aplicado', false, 'id_venda', v_id_venda, 'status', v_status);
  END IF;

  IF v_id_venda IS NULL THEN
    v_pedido := r.pedido;
    IF v_pedido IS NULL OR jsonb_typeof(v_pedido->'itens') <> 'array' THEN
      UPDATE public.checkouts_sumup
      SET motivo = 'Pagamento confirmado sem a seleção da galeria.'
      WHERE id_checkout = p_id_checkout;
      RETURN jsonb_build_object('aplicado', false, 'motivo', 'sem_selecao');
    END IF;

    IF r.conta = 'br' THEN
      v_moeda := 'BRL';
      v_regiao := 'brasil';
      v_forma := 'credito';
      v_meio := 'SumUp';
    ELSE
      v_moeda := 'EUR';
      v_regiao := 'europa';
      v_forma := 'cartao';
      v_meio := 'SumUp Link';
    END IF;

    BEGIN
      v_id_checkout := btrim(coalesce(p_id_checkout, ''));
      BEGIN
        v_id_carrinho_pago := nullif(btrim(coalesce(v_pedido->>'id_carrinho', '')), '')::uuid;
      EXCEPTION
        WHEN invalid_text_representation THEN
          v_id_carrinho_pago := NULL;
      END;
      PERFORM set_config('kropfeet.id_carrinho', coalesce(v_id_carrinho_pago::text, ''), true);

      v_salvo := public.catalogo_kropcafe_salvar_selecao(
        v_pedido->>'nome',
        v_pedido->>'telefone',
        v_pedido->>'email',
        v_pedido->>'pais',
        v_pedido->>'observacao',
        v_pedido->'itens',
        true,
        v_pedido->>'id_vendedor'
      );
      v_id_venda := (v_salvo->>'id_venda')::uuid;
      IF v_id_venda IS NULL THEN
        RAISE EXCEPTION 'Não foi possível abrir a ordem de venda.';
      END IF;

      UPDATE public.vendas
      SET
        moeda_venda = v_moeda,
        regiao_venda = v_regiao,
        valor_total = r.valor,
        forma_pagamento = v_forma,
        condicao_pagamento = '1x',
        local_venda = 'galeria',
        codigo_venda_adquirente = v_codigo
      WHERE id = v_id_venda;

      INSERT INTO public.parcelas_venda (
        id_venda,
        numero,
        data_vencimento,
        valor,
        forma_pagamento,
        meio_pagamento,
        dias,
        pago,
        codigo_transacao
      )
      VALUES (
        v_id_venda,
        1,
        current_date,
        r.valor,
        v_forma,
        v_meio,
        0,
        false,
        v_codigo
      );

      UPDATE public.checkouts_sumup
      SET id_venda = v_id_venda, motivo = NULL, atualizado_em = now()
      WHERE id_checkout = p_id_checkout;

      PERFORM set_config('kropfeet.id_carrinho', '', true);

      UPDATE public.carrinhos_galeria
      SET id_venda = v_id_venda,
          status = 'finalizado'
      WHERE status = 'aberto'
        AND (
          id = v_id_carrinho_pago
          OR (v_id_checkout <> '' AND id_checkout = v_id_checkout)
        );
    EXCEPTION
      WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_erro = MESSAGE_TEXT;
        UPDATE public.checkouts_sumup
        SET motivo = left(v_erro, 300), atualizado_em = now()
        WHERE id_checkout = p_id_checkout;
        RETURN jsonb_build_object('aplicado', false, 'motivo', left(v_erro, 300));
    END;
  END IF;

  UPDATE public.parcelas_venda
  SET codigo_transacao = v_codigo
  WHERE id_venda = v_id_venda
    AND (
      meio_pagamento ILIKE 'sumup%'
      OR lower(btrim(coalesce(forma_pagamento, ''))) IN ('credito', 'debito', 'cartao')
    )
    AND (
      codigo_transacao IS NULL
      OR btrim(codigo_transacao) = ''
      OR upper(codigo_transacao) = v_codigo
    );
  GET DIAGNOSTICS v_linhas = ROW_COUNT;

  UPDATE public.vendas
  SET codigo_venda_adquirente = v_codigo
  WHERE id = v_id_venda
    AND (
      codigo_venda_adquirente IS NULL
      OR btrim(codigo_venda_adquirente) = ''
      OR upper(btrim(codigo_venda_adquirente)) = v_codigo
    );

  PERFORM public.sincronizar_contas_receber_venda(v_id_venda);

  RETURN public.conciliar_recebiveis_sumup(ARRAY[v_codigo])
    || jsonb_build_object('aplicado', true, 'id_venda', v_id_venda, 'parcelas', v_linhas, 'codigo', v_codigo);
END;
$$;

CREATE OR REPLACE FUNCTION public.catalogo_kropcafe_abrir_pagamento(
  p_nome text,
  p_telefone text,
  p_email text DEFAULT NULL,
  p_pais text DEFAULT NULL,
  p_observacao text DEFAULT NULL,
  p_itens jsonb DEFAULT '[]'::jsonb,
  p_conta text DEFAULT NULL,
  p_valor numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_salvo jsonb;
  v_id_vendedor uuid;
  v_id_carrinho uuid;
  v_conta text;
  v_valor numeric;
  v_url text;
  v_conta_salva text;
  v_valor_salvo numeric;
  v_moeda text;
  v_checkout text;
  v_status_checkout text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.perfis_usuario
    WHERE id = auth.uid()
      AND ativo = true
      AND papel IN ('admin', 'operador', 'vendedor')
  ) THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  PERFORM set_config('kropfeet.bypass_equipe', '1', true);

  v_conta := lower(btrim(coalesce(p_conta, '')));
  IF v_conta NOT IN ('pt', 'br') THEN
    RAISE EXCEPTION 'Informe a conta SumUp.';
  END IF;

  v_valor := round(coalesce(p_valor, 0), 2);
  IF v_valor <= 0 OR v_valor > 999999.99 THEN
    RAISE EXCEPTION 'Informe um valor válido.';
  END IF;

  SELECT v.id
  INTO v_id_vendedor
  FROM public.vendedores v
  JOIN public.perfis_usuario p ON p.id = auth.uid()
  WHERE v.ativo
    AND (
      lower(btrim(v.nome)) = lower(btrim(p.nome))
      OR lower(btrim(p.nome)) LIKE '%' || lower(btrim(v.nome)) || '%'
    )
  ORDER BY
    CASE WHEN lower(btrim(v.nome)) = lower(btrim(p.nome)) THEN 0 ELSE 1 END,
    char_length(v.nome) DESC
  LIMIT 1;

  v_salvo := public.catalogo_kropcafe_salvar_selecao(
    p_nome,
    p_telefone,
    p_email,
    p_pais,
    p_observacao,
    p_itens,
    false,
    NULL
  );
  v_id_carrinho := (v_salvo->>'id_carrinho')::uuid;

  SELECT c.url_pagamento, c.conta_pagamento, c.valor_pagamento, c.moeda_pagamento, c.id_checkout
  INTO v_url, v_conta_salva, v_valor_salvo, v_moeda, v_checkout
  FROM public.carrinhos_galeria c
  WHERE c.id = v_id_carrinho;

  v_status_checkout := NULL;
  IF v_checkout IS NOT NULL THEN
    SELECT upper(status)
    INTO v_status_checkout
    FROM public.checkouts_sumup
    WHERE id_checkout = v_checkout;
  END IF;

  RETURN jsonb_build_object(
    'id_cliente', v_salvo->>'id_cliente',
    'id_vendedor', v_id_vendedor,
    'id_carrinho', v_id_carrinho,
    'link', CASE
      WHEN v_url IS NOT NULL
        AND v_conta_salva = v_conta
        AND v_valor_salvo = v_valor
        AND coalesce(v_status_checkout, 'PENDING') NOT IN ('PAID', 'FAILED', 'EXPIRED')
      THEN jsonb_build_object(
        'id', v_checkout,
        'url', v_url,
        'valor', v_valor_salvo,
        'moeda', v_moeda,
        'conta', v_conta_salva
      )
      ELSE NULL
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.catalogo_kropcafe_abrir_pagamento(text, text, text, text, text, jsonb, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalogo_kropcafe_abrir_pagamento(text, text, text, text, text, jsonb, text, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.registrar_checkout_sumup(
  p_id_checkout text,
  p_conta text,
  p_valor numeric,
  p_moeda text,
  p_url text DEFAULT NULL,
  p_pedido jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id text;
  v_conta text;
  v_moeda text;
  v_valor numeric;
  v_id_carrinho uuid;
  v_checkout_anterior text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.perfis_usuario
    WHERE id = auth.uid()
      AND ativo = true
      AND papel IN ('admin', 'operador', 'vendedor')
  ) THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  v_id := nullif(btrim(coalesce(p_id_checkout, '')), '');
  v_conta := lower(btrim(coalesce(p_conta, '')));
  v_moeda := upper(btrim(coalesce(p_moeda, '')));
  v_valor := round(coalesce(p_valor, 0), 2);

  IF v_id IS NULL OR char_length(v_id) > 80 THEN
    RAISE EXCEPTION 'Pagamento SumUp inválido.';
  END IF;
  IF v_conta NOT IN ('pt', 'br') OR v_moeda NOT IN ('EUR', 'BRL') OR v_valor <= 0 THEN
    RAISE EXCEPTION 'Pagamento SumUp inválido.';
  END IF;
  IF p_pedido IS NULL OR jsonb_typeof(p_pedido) <> 'object' OR jsonb_typeof(p_pedido->'itens') <> 'array' THEN
    RAISE EXCEPTION 'Seleção do pagamento inválida.';
  END IF;

  BEGIN
    v_id_carrinho := nullif(btrim(coalesce(p_pedido->>'id_carrinho', '')), '')::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      v_id_carrinho := NULL;
  END;

  IF v_id_carrinho IS NOT NULL THEN
    SELECT id_checkout
    INTO v_checkout_anterior
    FROM public.carrinhos_galeria
    WHERE id = v_id_carrinho
      AND status = 'aberto';

    IF v_checkout_anterior IS NOT NULL AND v_checkout_anterior IS DISTINCT FROM v_id THEN
      UPDATE public.checkouts_sumup
      SET
        pedido = NULL,
        motivo = 'Substituído por outro link de pagamento.',
        atualizado_em = now()
      WHERE id_checkout = v_checkout_anterior
        AND id_venda IS NULL;
    END IF;

    UPDATE public.carrinhos_galeria
    SET
      id_checkout = v_id,
      conta_pagamento = v_conta,
      url_pagamento = nullif(btrim(coalesce(p_url, '')), ''),
      valor_pagamento = v_valor,
      moeda_pagamento = v_moeda
    WHERE id = v_id_carrinho
      AND status = 'aberto';
  END IF;

  INSERT INTO public.checkouts_sumup (
    id_checkout,
    conta,
    valor,
    moeda,
    url,
    pedido
  )
  VALUES (
    v_id,
    v_conta,
    v_valor,
    v_moeda,
    nullif(btrim(coalesce(p_url, '')), ''),
    p_pedido
  )
  ON CONFLICT (id_checkout) DO UPDATE
  SET
    pedido = coalesce(EXCLUDED.pedido, public.checkouts_sumup.pedido),
    url = coalesce(EXCLUDED.url, public.checkouts_sumup.url),
    atualizado_em = now()
  WHERE public.checkouts_sumup.id_venda IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_checkout_sumup(text, text, numeric, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_checkout_sumup(text, text, numeric, text, text, jsonb) TO authenticated;

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
        (c.url_pagamento IS NOT NULL) AS tem_link,
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
      WHERE c.status = 'aberto'
        AND c.id_venda IS NULL
        AND (c.id_usuario IS NULL OR c.id_usuario = auth.uid())
      ORDER BY c.criado_em DESC
      LIMIT 40
    ) t
  );
END;
$$;

REVOKE ALL ON FUNCTION public.catalogo_kropcafe_listar_carrinhos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalogo_kropcafe_listar_carrinhos() TO authenticated;
