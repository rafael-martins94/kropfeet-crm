-- O link da SumUp avisa esta função quando o checkout muda de status.
-- Com o pagamento confirmado, o código da transação entra na ordem e nas contas a receber.

CREATE TABLE IF NOT EXISTS public.checkouts_sumup (
  id_checkout text PRIMARY KEY,
  conta text NOT NULL CHECK (conta IN ('pt', 'br')),
  checkout_reference text,
  id_venda uuid REFERENCES public.vendas (id) ON DELETE SET NULL,
  valor numeric(14, 2) NOT NULL,
  moeda text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  codigo_transacao text,
  url text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS checkouts_sumup_venda_idx
  ON public.checkouts_sumup (id_venda);

ALTER TABLE public.checkouts_sumup ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_leitura ON public.checkouts_sumup;
CREATE POLICY crm_leitura ON public.checkouts_sumup
  FOR SELECT TO authenticated
  USING (public.is_equipe_crm());

-- Abre (ou reaproveita) a ordem da galeria antes do link, com uma parcela SumUp.
-- O código da transação chega depois, no retorno do checkout.
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
  v_id uuid;
  v_id_venda uuid;
  v_numero text;
  v_id_vendedor uuid;
  v_conta text;
  v_moeda text;
  v_regiao public.tipo_regiao_enum;
  v_forma text;
  v_meio text;
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

  IF v_conta = 'br' THEN
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
  v_id := (v_salvo->>'id_cliente')::uuid;

  SELECT v.id, v.numero
  INTO v_id_venda, v_numero
  FROM public.vendas v
  WHERE v.id_cliente = v_id
    AND v.local_venda = 'galeria'
    AND v.status_venda = 'em_aberto'
    AND NOT EXISTS (
      SELECT 1
      FROM public.parcelas_venda p
      WHERE p.id_venda = v.id
        AND nullif(btrim(p.codigo_transacao), '') IS NOT NULL
    )
    AND (
      SELECT coalesce(jsonb_agg(x.id ORDER BY x.id), '[]'::jsonb)
      FROM (
        SELECT iv.id_item_estoque AS id
        FROM public.itens_venda iv
        WHERE iv.id_venda = v.id
          AND iv.id_item_estoque IS NOT NULL
      ) AS x
    ) = (
      SELECT coalesce(jsonb_agg(x.id ORDER BY x.id), '[]'::jsonb)
      FROM (
        SELECT DISTINCT (elem->>'id')::uuid AS id
        FROM jsonb_array_elements(p_itens) AS elem
        WHERE coalesce(elem->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      ) AS x
    )
  ORDER BY v.data_pedido DESC NULLS LAST
  LIMIT 1;

  IF v_id_venda IS NULL THEN
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
    v_numero := v_salvo->>'numero';
  END IF;

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
    local_venda = 'galeria'
  WHERE id = v_id_venda;

  IF EXISTS (
    SELECT 1 FROM public.parcelas_venda WHERE id_venda = v_id_venda AND numero = 1
  ) THEN
    UPDATE public.parcelas_venda
    SET
      data_vencimento = current_date,
      valor = v_valor,
      forma_pagamento = v_forma,
      meio_pagamento = v_meio,
      dias = 0
    WHERE id_venda = v_id_venda
      AND numero = 1
      AND codigo_transacao IS NULL;
  ELSE
    INSERT INTO public.parcelas_venda (
      id_venda,
      numero,
      data_vencimento,
      valor,
      forma_pagamento,
      meio_pagamento,
      dias,
      pago
    )
    VALUES (
      v_id_venda,
      1,
      current_date,
      v_valor,
      v_forma,
      v_meio,
      0,
      false
    );
  END IF;

  PERFORM public.sincronizar_contas_receber_venda(v_id_venda);

  UPDATE public.carrinhos_galeria
  SET id_venda = v_id_venda
  WHERE id = (
    SELECT c.id
    FROM public.carrinhos_galeria c
    WHERE c.id_cliente = v_id
      AND c.id_venda IS NULL
    ORDER BY c.criado_em DESC
    LIMIT 1
  );

  RETURN jsonb_build_object(
    'id_cliente', v_id,
    'id_venda', v_id_venda,
    'numero', v_numero
  );
END;
$$;

REVOKE ALL ON FUNCTION public.catalogo_kropcafe_abrir_pagamento(text, text, text, text, text, jsonb, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalogo_kropcafe_abrir_pagamento(text, text, text, text, text, jsonb, text, numeric) TO authenticated;

-- O navegador registra o checkout depois que a SumUp devolve o id.
CREATE OR REPLACE FUNCTION public.registrar_checkout_sumup(
  p_id_checkout text,
  p_conta text,
  p_id_venda uuid,
  p_valor numeric,
  p_moeda text,
  p_url text DEFAULT NULL
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
  IF NOT EXISTS (
    SELECT 1 FROM public.vendas WHERE id = p_id_venda AND status_venda <> 'cancelado'
  ) THEN
    RAISE EXCEPTION 'Ordem de venda não encontrada.';
  END IF;

  INSERT INTO public.checkouts_sumup (
    id_checkout,
    conta,
    checkout_reference,
    id_venda,
    valor,
    moeda,
    url
  )
  VALUES (
    v_id,
    v_conta,
    p_id_venda::text,
    p_id_venda,
    v_valor,
    v_moeda,
    nullif(btrim(coalesce(p_url, '')), '')
  )
  ON CONFLICT (id_checkout) DO UPDATE
  SET
    id_venda = coalesce(public.checkouts_sumup.id_venda, EXCLUDED.id_venda),
    checkout_reference = coalesce(public.checkouts_sumup.checkout_reference, EXCLUDED.checkout_reference),
    url = coalesce(EXCLUDED.url, public.checkouts_sumup.url),
    atualizado_em = now();
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_checkout_sumup(text, text, uuid, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_checkout_sumup(text, text, uuid, numeric, text, text) TO authenticated;

-- Chamada pela função SumUp, depois de confirmar o checkout na API.
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
  v_id_venda uuid;
  v_codigo text;
  v_status text;
  v_linhas integer;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  v_status := upper(btrim(coalesce(p_status, '')));
  v_codigo := nullif(upper(btrim(coalesce(p_codigo, ''))), '');

  UPDATE public.checkouts_sumup
  SET
    status = coalesce(nullif(v_status, ''), status),
    codigo_transacao = coalesce(v_codigo, codigo_transacao),
    id_venda = coalesce(id_venda, p_id_venda),
    checkout_reference = coalesce(checkout_reference, p_id_venda::text),
    atualizado_em = now()
  WHERE id_checkout = p_id_checkout
  RETURNING id_venda INTO v_id_venda;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('aplicado', false);
  END IF;

  IF v_status <> 'PAID' OR v_codigo IS NULL OR v_id_venda IS NULL THEN
    RETURN jsonb_build_object('aplicado', false, 'id_venda', v_id_venda, 'status', v_status);
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

REVOKE ALL ON FUNCTION public.aplicar_retorno_checkout_sumup(text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aplicar_retorno_checkout_sumup(text, text, text, uuid) TO service_role;
