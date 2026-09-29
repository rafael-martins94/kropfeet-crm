-- O vencimento da parcela SumUp já seguia a data do repasse.
-- O campo dias ficava com o número gerado antes (30, 61, 91) e não batia com essa data.

CREATE OR REPLACE FUNCTION public.conciliar_recebiveis_sumup(p_codigos text[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  t record;
  e record;
  v_parcelas uuid[];
  v_valores numeric[];
  v_eventos text[];
  n_p integer;
  n_e integer;
  i integer;
  v_linhas integer;
  v_total numeric;
  v_evento_id text;
  v_fator numeric;
  v_taxa numeric;
  v_liquido numeric;
  v_bruto numeric;
  v_baixadas integer := 0;
  v_atualizadas integer := 0;
  v_divergentes integer := 0;
  v_transacoes integer := 0;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND NOT public.is_equipe_crm() THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  FOR t IN
    SELECT ts.*
    FROM public.transacoes_sumup ts
    WHERE ts.codigo IS NOT NULL
      AND (p_codigos IS NULL OR ts.codigo = ANY (p_codigos))
      AND coalesce(ts.tipo, 'PAYMENT') <> 'REFUND'
  LOOP
    SELECT array_agg(p.id ORDER BY p.id_venda, p.numero), array_agg(p.valor ORDER BY p.id_venda, p.numero)
    INTO v_parcelas, v_valores
    FROM public.parcelas_venda p
    JOIN public.vendas v ON v.id = p.id_venda
    WHERE upper(p.codigo_transacao) = t.codigo
      AND v.status_venda <> 'cancelado';
    n_p := coalesce(array_length(v_parcelas, 1), 0);
    IF n_p = 0 THEN
      CONTINUE;
    END IF;
    v_transacoes := v_transacoes + 1;

    UPDATE public.transacoes_sumup
    SET id_venda = (SELECT p.id_venda FROM public.parcelas_venda p WHERE p.id = v_parcelas[1])
    WHERE id = t.id AND id_venda IS NULL;

    IF coalesce(t.simple_status, '') IN ('REFUNDED', 'CHARGEBACK', 'CANCELLED')
      OR coalesce(t.status, '') IN ('REFUNDED', 'CHARGE_BACK', 'CANCELLED')
    THEN
      UPDATE public.contas_receber
      SET divergente = true,
          motivo_divergencia = 'A transação SumUp ' || t.codigo || ' consta como estornada ou cancelada.'
      WHERE id_parcela_venda = ANY (v_parcelas)
        AND situacao <> 'cancelado'
        AND motivo_divergencia IS DISTINCT FROM
          'A transação SumUp ' || t.codigo || ' consta como estornada ou cancelada.';
      GET DIAGNOSTICS v_linhas = ROW_COUNT;
      v_divergentes := v_divergentes + v_linhas;
      CONTINUE;
    END IF;

    SELECT array_agg(r.id ORDER BY r.parcela NULLS LAST, r.data_prevista NULLS LAST, r.id)
    INTO v_eventos
    FROM public.recebiveis_sumup r
    WHERE r.id_transacao = t.id
      AND r.tipo = 'PAYOUT'
      AND coalesce(r.status, '') <> 'FAILED';
    n_e := coalesce(array_length(v_eventos, 1), 0);
    IF n_e = 0 THEN
      CONTINUE;
    END IF;

    IF n_e <> n_p AND n_e <> 1 THEN
      UPDATE public.contas_receber
      SET divergente = true,
          motivo_divergencia = format(
            'A SumUp tem %s repasses para %s e o pedido tem %s parcelas com esse código.',
            n_e, t.codigo, n_p
          )
      WHERE id_parcela_venda = ANY (v_parcelas)
        AND situacao = 'aberto';
      GET DIAGNOSTICS v_linhas = ROW_COUNT;
      v_divergentes := v_divergentes + v_linhas;
      CONTINUE;
    END IF;

    SELECT sum(x) INTO v_total FROM unnest(v_valores) AS x;

    FOR i IN 1..n_p LOOP
      v_evento_id := CASE WHEN n_e = n_p THEN v_eventos[i] ELSE v_eventos[1] END;
      SELECT * INTO e FROM public.recebiveis_sumup WHERE id = v_evento_id;

      IF n_e = n_p THEN
        v_taxa := e.taxa;
        v_liquido := e.valor_liquido;
        v_bruto := e.valor_bruto;
      ELSE
        v_fator := CASE WHEN coalesce(v_total, 0) > 0 THEN v_valores[i] / v_total ELSE 1.0 / n_p END;
        v_taxa := round(coalesce(e.taxa, 0) * v_fator, 2);
        v_liquido := v_valores[i] - v_taxa;
        v_bruto := CASE WHEN abs(coalesce(v_total, 0) - e.valor_bruto) < 0.01 THEN v_valores[i] ELSE NULL END;
      END IF;

      IF e.data_prevista IS NOT NULL THEN
        UPDATE public.parcelas_venda p
        SET data_vencimento = e.data_prevista,
            dias = (e.data_prevista - (v.data_pedido AT TIME ZONE 'UTC')::date)
        FROM public.vendas v
        WHERE p.id = v_parcelas[i]
          AND v.id = p.id_venda
          AND (
            p.data_vencimento IS DISTINCT FROM e.data_prevista
            OR p.dias IS DISTINCT FROM (e.data_prevista - (v.data_pedido AT TIME ZONE 'UTC')::date)
          )
          AND NOT EXISTS (
            SELECT 1 FROM public.contas_receber c
            WHERE c.id_parcela_venda = p.id AND c.situacao = 'recebido'
          );
      END IF;

      UPDATE public.contas_receber c
      SET data_vencimento = coalesce(e.data_prevista, c.data_vencimento),
          taxa = v_taxa,
          valor_liquido = v_liquido,
          id_recebivel_sumup = e.id,
          id_transacao_sumup = t.id,
          divergente = v_bruto IS NULL OR abs(c.valor - v_bruto) >= 0.01,
          motivo_divergencia = CASE
            WHEN v_bruto IS NULL OR abs(c.valor - v_bruto) >= 0.01
              THEN 'O valor da parcela não bate com o recebível da SumUp ('
                || to_char(coalesce(v_bruto, e.valor_bruto), 'FM999G999G990D00') || ').'
            ELSE NULL
          END
      WHERE c.id_parcela_venda = v_parcelas[i]
        AND c.situacao = 'aberto'
        AND (
          c.data_vencimento IS DISTINCT FROM coalesce(e.data_prevista, c.data_vencimento)
          OR c.taxa IS DISTINCT FROM v_taxa
          OR c.valor_liquido IS DISTINCT FROM v_liquido
          OR c.id_recebivel_sumup IS DISTINCT FROM e.id
          OR c.divergente IS DISTINCT FROM (v_bruto IS NULL OR abs(c.valor - v_bruto) >= 0.01)
        );
      GET DIAGNOSTICS v_linhas = ROW_COUNT;
      v_atualizadas := v_atualizadas + v_linhas;

      IF e.status = 'PAID_OUT' AND coalesce(e.data_pagamento, e.data_prevista) IS NOT NULL THEN
        UPDATE public.contas_receber c
        SET situacao = 'recebido',
            data_recebimento = coalesce(e.data_pagamento, e.data_prevista),
            valor_recebido = v_liquido,
            origem_baixa = 'sumup'
        WHERE c.id_parcela_venda = v_parcelas[i]
          AND c.situacao = 'aberto';
        GET DIAGNOSTICS v_linhas = ROW_COUNT;
        v_baixadas := v_baixadas + v_linhas;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'transacoes', v_transacoes,
    'atualizadas', v_atualizadas,
    'baixadas', v_baixadas,
    'divergentes', v_divergentes
  );
END;
$$;

-- Parcelas que já receberam a data do repasse e ainda guardam o dia antigo.
UPDATE public.parcelas_venda p
SET dias = (p.data_vencimento - (v.data_pedido AT TIME ZONE 'UTC')::date)
FROM public.vendas v
WHERE v.id = p.id_venda
  AND p.data_vencimento IS NOT NULL
  AND v.data_pedido IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.recebiveis_sumup r
    WHERE upper(r.codigo_transacao) = upper(p.codigo_transacao)
      AND r.tipo = 'PAYOUT'
      AND r.data_prevista = p.data_vencimento
  )
  AND p.dias IS DISTINCT FROM (p.data_vencimento - (v.data_pedido AT TIME ZONE 'UTC')::date)
  AND NOT EXISTS (
    SELECT 1
    FROM public.contas_receber c
    WHERE c.id_parcela_venda = p.id
      AND c.situacao = 'recebido'
  );
