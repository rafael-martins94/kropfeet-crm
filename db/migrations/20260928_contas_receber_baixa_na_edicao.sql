-- Conta em aberto cuja parcela foi editada volta a ter baixa automática quando a forma é de
-- recebimento imediato e o vencimento já passou. Sem mudança na parcela (ex.: só estornou e
-- salvou o pedido), a conta continua em aberto.

CREATE OR REPLACE FUNCTION public.sincronizar_contas_receber_venda(p_id_venda uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_venda public.vendas%ROWTYPE;
  v_moeda text;
  v_doc text;
  v_emissao date;
  v_criadas integer := 0;
  v_canceladas integer := 0;
BEGIN
  IF pg_trigger_depth() = 0
    AND NOT public.is_equipe_crm()
    AND coalesce(auth.role(), '') <> 'service_role'
    AND coalesce(current_setting('kropfeet.bypass_equipe', true), '') <> '1'
  THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  SELECT * INTO v_venda FROM public.vendas WHERE id = p_id_venda;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('id_venda', p_id_venda, 'criadas', 0, 'canceladas', 0);
  END IF;

  v_moeda := coalesce(
    nullif(upper(btrim(v_venda.moeda_venda)), ''),
    CASE WHEN v_venda.regiao_venda = 'europa' THEN 'EUR' ELSE 'BRL' END
  );
  v_doc := coalesce(nullif(btrim(v_venda.numero), ''), left(v_venda.id::text, 8));
  v_emissao := coalesce(v_venda.data_pedido::date, current_date);

  IF v_venda.status_venda = 'cancelado' THEN
    UPDATE public.contas_receber
    SET situacao = 'cancelado'
    WHERE id_venda = p_id_venda AND situacao = 'aberto';
    GET DIAGNOSTICS v_canceladas = ROW_COUNT;
    RETURN jsonb_build_object('id_venda', p_id_venda, 'criadas', 0, 'canceladas', v_canceladas);
  END IF;

  -- Parcelas que deixaram de gerar conta (cortesia ou valor zero).
  DELETE FROM public.contas_receber c
  USING public.parcelas_venda p
  WHERE c.id_parcela_venda = p.id
    AND p.id_venda = p_id_venda
    AND c.situacao <> 'recebido'
    AND NOT public.parcela_gera_conta(p.forma_pagamento, p.valor);

  -- Contas em aberto (ou canceladas por uma venda reaberta) seguem a parcela.
  UPDATE public.contas_receber c
  SET id_cliente = v_venda.id_cliente,
      documento = v_doc || '/' || s.numero,
      moeda = v_moeda,
      data_emissao = v_emissao,
      data_vencimento = s.vencimento,
      valor = s.valor,
      forma_pagamento = s.forma_pagamento,
      meio_pagamento = s.meio_pagamento,
      codigo_transacao = s.codigo_transacao,
      situacao = CASE WHEN s.baixar THEN 'recebido' ELSE 'aberto' END::public.situacao_conta_receber_enum,
      data_recebimento = CASE WHEN s.baixar THEN s.vencimento END,
      valor_recebido = CASE WHEN s.baixar THEN s.valor END,
      origem_baixa = CASE WHEN s.baixar THEN 'automatica' END,
      divergente = false,
      motivo_divergencia = NULL
  FROM (
    SELECT
      atual.id AS id_conta,
      p.numero,
      p.valor,
      p.forma_pagamento,
      p.meio_pagamento,
      p.codigo_transacao,
      coalesce(p.data_vencimento, v_emissao) AS vencimento,
      public.forma_pagamento_baixa_imediata(p.forma_pagamento)
        AND coalesce(p.data_vencimento, v_emissao) <= current_date
        AND (
          atual.data_vencimento IS DISTINCT FROM coalesce(p.data_vencimento, v_emissao)
          OR round(atual.valor, 2) <> round(p.valor, 2)
          OR atual.forma_pagamento IS DISTINCT FROM p.forma_pagamento
          OR atual.meio_pagamento IS DISTINCT FROM p.meio_pagamento
        ) AS baixar
    FROM public.contas_receber atual
    JOIN public.parcelas_venda p ON p.id = atual.id_parcela_venda
    WHERE p.id_venda = p_id_venda
      AND atual.situacao IN ('aberto', 'cancelado')
      AND public.parcela_gera_conta(p.forma_pagamento, p.valor)
  ) s
  WHERE c.id = s.id_conta;

  -- Contas já recebidas não mudam de valor; só avisam se a parcela divergiu.
  UPDATE public.contas_receber c
  SET id_cliente = v_venda.id_cliente,
      documento = v_doc || '/' || p.numero,
      moeda = v_moeda,
      codigo_transacao = coalesce(c.codigo_transacao, p.codigo_transacao),
      divergente = round(c.valor, 2) <> round(p.valor, 2),
      motivo_divergencia = CASE
        WHEN round(c.valor, 2) <> round(p.valor, 2)
          THEN 'O valor da parcela mudou depois do recebimento.'
        ELSE NULL
      END
  FROM public.parcelas_venda p
  WHERE c.id_parcela_venda = p.id
    AND p.id_venda = p_id_venda
    AND c.situacao = 'recebido';

  INSERT INTO public.contas_receber (
    id_venda, id_parcela_venda, id_cliente, documento, moeda, data_emissao,
    data_vencimento, valor, forma_pagamento, meio_pagamento, codigo_transacao,
    situacao, data_recebimento, valor_recebido, origem_baixa
  )
  SELECT
    p_id_venda,
    p.id,
    v_venda.id_cliente,
    v_doc || '/' || p.numero,
    v_moeda,
    v_emissao,
    coalesce(p.data_vencimento, v_emissao),
    p.valor,
    p.forma_pagamento,
    p.meio_pagamento,
    p.codigo_transacao,
    CASE WHEN x.imediata THEN 'recebido' ELSE 'aberto' END::public.situacao_conta_receber_enum,
    CASE WHEN x.imediata THEN coalesce(p.data_vencimento, v_emissao) END,
    CASE WHEN x.imediata THEN p.valor END,
    CASE WHEN x.imediata THEN 'automatica' END
  FROM public.parcelas_venda p
  CROSS JOIN LATERAL (
    SELECT public.forma_pagamento_baixa_imediata(p.forma_pagamento)
      AND coalesce(p.data_vencimento, v_emissao) <= current_date AS imediata
  ) x
  WHERE p.id_venda = p_id_venda
    AND public.parcela_gera_conta(p.forma_pagamento, p.valor)
    AND NOT EXISTS (SELECT 1 FROM public.contas_receber c WHERE c.id_parcela_venda = p.id);
  GET DIAGNOSTICS v_criadas = ROW_COUNT;

  RETURN jsonb_build_object('id_venda', p_id_venda, 'criadas', v_criadas, 'canceladas', 0);
END;
$$;
