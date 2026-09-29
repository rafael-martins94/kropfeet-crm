-- Espelho da SumUp (Portugal e Brasil): transações e recebíveis (eventos de repasse).
-- A conta a receber de cartão SumUp só fica recebida quando a SumUp informa PAID_OUT.

CREATE TABLE IF NOT EXISTS public.transacoes_sumup (
  id text PRIMARY KEY,
  conta text NOT NULL CHECK (conta IN ('pt', 'br')),
  codigo text,
  tipo text,
  valor numeric(12, 2) NOT NULL,
  moeda text NOT NULL,
  data timestamptz NOT NULL,
  status text,
  simple_status text,
  tipo_pagamento text,
  cartao text,
  parcelas integer,
  payout_plan text,
  payouts_total integer,
  payouts_received integer,
  valor_estornado numeric(12, 2),
  descricao text,
  id_venda uuid REFERENCES public.vendas (id) ON DELETE SET NULL,
  dados jsonb,
  detalhado_em timestamptz,
  sincronizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transacoes_sumup_codigo_idx ON public.transacoes_sumup (codigo);
CREATE INDEX IF NOT EXISTS transacoes_sumup_conta_data_idx ON public.transacoes_sumup (conta, data DESC);
CREATE INDEX IF NOT EXISTS transacoes_sumup_venda_idx ON public.transacoes_sumup (id_venda);

-- amount da SumUp é o líquido do repasse; a taxa vem separada.
CREATE TABLE IF NOT EXISTS public.recebiveis_sumup (
  id text PRIMARY KEY,
  id_transacao text NOT NULL REFERENCES public.transacoes_sumup (id) ON DELETE CASCADE,
  conta text NOT NULL CHECK (conta IN ('pt', 'br')),
  codigo_transacao text,
  tipo text NOT NULL,
  status text,
  parcela integer,
  valor_liquido numeric(12, 2),
  taxa numeric(12, 2),
  valor_bruto numeric(12, 2) GENERATED ALWAYS AS (coalesce(valor_liquido, 0) + coalesce(taxa, 0)) STORED,
  moeda text,
  data_prevista date,
  data_pagamento date,
  dados jsonb,
  sincronizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recebiveis_sumup_transacao_idx ON public.recebiveis_sumup (id_transacao);
CREATE INDEX IF NOT EXISTS recebiveis_sumup_codigo_idx ON public.recebiveis_sumup (codigo_transacao);
CREATE INDEX IF NOT EXISTS recebiveis_sumup_previsto_idx ON public.recebiveis_sumup (conta, data_prevista);

ALTER TABLE public.transacoes_sumup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recebiveis_sumup ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_leitura ON public.transacoes_sumup;
CREATE POLICY crm_leitura ON public.transacoes_sumup
  FOR SELECT TO authenticated USING (public.is_equipe_crm());
DROP POLICY IF EXISTS crm_leitura ON public.recebiveis_sumup;
CREATE POLICY crm_leitura ON public.recebiveis_sumup
  FOR SELECT TO authenticated USING (public.is_equipe_crm());

ALTER TABLE public.contas_receber
  ADD COLUMN IF NOT EXISTS valor_liquido numeric(12, 2),
  ADD COLUMN IF NOT EXISTS id_recebivel_sumup text REFERENCES public.recebiveis_sumup (id) ON DELETE SET NULL;

-- Aplica os recebíveis SumUp às contas das parcelas com o mesmo código de transação.
-- Mesmo número de repasses e parcelas: casa na ordem. Um repasse para várias parcelas
-- (antecipação): rateia a taxa. Outros casos: marca divergência.
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
        SET data_vencimento = e.data_prevista
        WHERE p.id = v_parcelas[i]
          AND p.data_vencimento IS DISTINCT FROM e.data_prevista
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

REVOKE ALL ON FUNCTION public.conciliar_recebiveis_sumup(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.conciliar_recebiveis_sumup(text[]) TO authenticated, service_role;

-- Transações SumUp sem pedido vinculado x pedidos com parcelas SumUp sem código:
-- mesma moeda, mesmo total e data do pedido até 1 dia de diferença.
CREATE OR REPLACE FUNCTION public.sugestoes_vinculo_sumup(p_conta text, p_de date, p_ate date)
RETURNS TABLE (
  id_transacao text,
  codigo text,
  valor numeric,
  moeda text,
  data timestamptz,
  parcelas_sumup integer,
  id_venda uuid,
  numero text,
  cliente text,
  data_pedido date,
  parcelas_pedido integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_equipe_crm() THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.codigo,
    t.valor,
    t.moeda,
    t.data,
    t.parcelas,
    v.id,
    v.numero,
    coalesce(cl.nome, v.nome_cliente),
    v.data_pedido::date,
    s.qtd::integer
  FROM public.transacoes_sumup t
  CROSS JOIN LATERAL (
    SELECT (t.data AT TIME ZONE CASE WHEN t.conta = 'br' THEN 'America/Sao_Paulo' ELSE 'Europe/Lisbon' END)::date AS dia
  ) d
  JOIN LATERAL (
    SELECT p.id_venda, count(*) AS qtd
    FROM public.parcelas_venda p
    JOIN public.vendas v2 ON v2.id = p.id_venda
    WHERE p.codigo_transacao IS NULL
      AND p.meio_pagamento ILIKE 'sumup%'
      AND v2.status_venda <> 'cancelado'
      AND v2.data_pedido::date BETWEEN d.dia - 1 AND d.dia + 1
      AND coalesce(
        nullif(upper(btrim(v2.moeda_venda)), ''),
        CASE WHEN v2.regiao_venda = 'europa' THEN 'EUR' ELSE 'BRL' END
      ) = t.moeda
    GROUP BY p.id_venda
    HAVING abs(sum(p.valor) - t.valor) < 0.01
  ) s ON true
  JOIN public.vendas v ON v.id = s.id_venda
  LEFT JOIN public.clientes cl ON cl.id = v.id_cliente
  WHERE t.conta = p_conta
    AND t.id_venda IS NULL
    AND t.codigo IS NOT NULL
    AND t.status = 'SUCCESSFUL'
    AND coalesce(t.tipo, 'PAYMENT') <> 'REFUND'
    AND d.dia BETWEEN p_de AND p_ate
    AND NOT EXISTS (
      SELECT 1 FROM public.parcelas_venda px WHERE upper(px.codigo_transacao) = t.codigo
    )
  ORDER BY t.data;
END;
$$;

REVOKE ALL ON FUNCTION public.sugestoes_vinculo_sumup(text, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sugestoes_vinculo_sumup(text, date, date) TO authenticated;

-- Grava o código da transação nas parcelas SumUp sem código do pedido e aplica os recebíveis.
CREATE OR REPLACE FUNCTION public.vincular_transacao_sumup(p_id_transacao text, p_id_venda uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_codigo text;
  v_linhas integer;
BEGIN
  IF NOT public.is_equipe_crm() THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  SELECT codigo INTO v_codigo FROM public.transacoes_sumup WHERE id = p_id_transacao;
  IF v_codigo IS NULL THEN
    RAISE EXCEPTION 'Transação SumUp não encontrada.';
  END IF;

  UPDATE public.parcelas_venda
  SET codigo_transacao = v_codigo
  WHERE id_venda = p_id_venda
    AND codigo_transacao IS NULL
    AND meio_pagamento ILIKE 'sumup%';
  GET DIAGNOSTICS v_linhas = ROW_COUNT;
  IF v_linhas = 0 THEN
    RAISE EXCEPTION 'O pedido não tem parcelas SumUp sem código.';
  END IF;

  UPDATE public.contas_receber c
  SET codigo_transacao = v_codigo
  FROM public.parcelas_venda p
  WHERE c.id_parcela_venda = p.id
    AND p.id_venda = p_id_venda
    AND upper(p.codigo_transacao) = v_codigo;

  UPDATE public.transacoes_sumup SET id_venda = p_id_venda WHERE id = p_id_transacao;

  RETURN public.conciliar_recebiveis_sumup(ARRAY[v_codigo]) || jsonb_build_object('parcelas', v_linhas);
END;
$$;

REVOKE ALL ON FUNCTION public.vincular_transacao_sumup(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vincular_transacao_sumup(text, uuid) TO authenticated;
