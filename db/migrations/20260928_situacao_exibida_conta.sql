-- Classificação de exibição. Não altera as linhas de contas_receber.
-- Recebido no banco continua recebido. Aberto com vencimento passado aparece como vencida.

CREATE OR REPLACE FUNCTION public.situacao_exibida(c public.contas_receber)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN c.situacao = 'cancelado' THEN 'cancelado'
    WHEN c.situacao = 'recebido' THEN 'recebido'
    WHEN c.situacao = 'aberto'
      AND c.data_vencimento IS NOT NULL
      AND c.data_vencimento < current_date
    THEN 'vencida'
    WHEN c.situacao = 'aberto' THEN 'aberto'
    ELSE c.situacao::text
  END;
$$;

REVOKE ALL ON FUNCTION public.situacao_exibida(public.contas_receber) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.situacao_exibida(public.contas_receber) TO authenticated, service_role;

-- Baixa manual só em conta em aberto (na tela: em aberto ou vencida).
CREATE OR REPLACE FUNCTION public.baixar_contas_receber(p_ids uuid[], p_data_recebimento date DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total integer;
BEGIN
  IF NOT public.is_equipe_crm() THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  UPDATE public.contas_receber
  SET situacao = 'recebido',
      data_recebimento = coalesce(p_data_recebimento, data_vencimento, current_date),
      valor_recebido = valor,
      origem_baixa = 'manual'
  WHERE id = ANY (p_ids)
    AND public.situacao_exibida(contas_receber) IN ('aberto', 'vencida');
  GET DIAGNOSTICS v_total = ROW_COUNT;
  RETURN v_total;
END;
$$;

NOTIFY pgrst, 'reload schema';
