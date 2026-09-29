-- A ordem da galeria só nasce quando a SumUp confirma o pagamento.
-- Gerar o link guarda o cliente e a seleção, sem tirar o par do estoque.

ALTER TABLE public.checkouts_sumup
  ADD COLUMN IF NOT EXISTS pedido jsonb,
  ADD COLUMN IF NOT EXISTS motivo text;

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
  v_conta text;
  v_valor numeric;
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

  IF v_id_vendedor IS NULL THEN
    RAISE EXCEPTION 'Seu usuário não está na lista de vendedores.';
  END IF;

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

  RETURN jsonb_build_object(
    'id_cliente', v_salvo->>'id_cliente',
    'id_vendedor', v_id_vendedor
  );
END;
$$;

DROP FUNCTION IF EXISTS public.registrar_checkout_sumup(text, text, uuid, numeric, text, text);

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
  IF coalesce(p_pedido->>'id_vendedor', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'Vendedor do pagamento inválido.';
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

      UPDATE public.carrinhos_galeria
      SET id_venda = v_id_venda
      WHERE id = (
        SELECT c.id
        FROM public.carrinhos_galeria c
        WHERE c.id_cliente = (v_salvo->>'id_cliente')::uuid
          AND c.id_venda IS NULL
        ORDER BY c.criado_em DESC
        LIMIT 1
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
