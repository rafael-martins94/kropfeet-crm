-- Pagamento na máquina SumUp: a ordem só nasce se o código da filipeta for informado.

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
