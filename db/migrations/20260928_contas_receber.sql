-- Modelo Tiny: o pedido tem condição de pagamento e parcelas soltas; cada parcela
-- vira um lançamento em contas_receber, onde o recebimento é controlado.

-- 1. Estrutura -------------------------------------------------------------

ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS condicao_pagamento text;

ALTER TABLE public.parcelas_venda
  ADD COLUMN IF NOT EXISTS codigo_transacao text;

-- Renumerar parcelas dentro da mesma transação exige checagem adiada.
ALTER TABLE public.parcelas_venda
  DROP CONSTRAINT IF EXISTS parcelas_venda_venda_numero_unique;
ALTER TABLE public.parcelas_venda
  ADD CONSTRAINT parcelas_venda_venda_numero_unique
  UNIQUE (id_venda, numero) DEFERRABLE INITIALLY IMMEDIATE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'situacao_conta_receber_enum') THEN
    CREATE TYPE public.situacao_conta_receber_enum AS ENUM ('aberto', 'recebido', 'cancelado');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.contas_receber (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_venda uuid NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  id_parcela_venda uuid UNIQUE REFERENCES public.parcelas_venda(id) ON DELETE SET NULL,
  id_cliente uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  documento text,
  moeda text NOT NULL DEFAULT 'BRL',
  data_emissao date,
  data_vencimento date,
  valor numeric NOT NULL DEFAULT 0,
  forma_pagamento text,
  meio_pagamento text,
  codigo_transacao text,
  situacao public.situacao_conta_receber_enum NOT NULL DEFAULT 'aberto',
  data_recebimento date,
  valor_recebido numeric,
  taxa numeric,
  origem_baixa text,
  id_transacao_sumup text,
  dados_sumup jsonb,
  divergente boolean NOT NULL DEFAULT false,
  motivo_divergencia text,
  obs text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contas_receber_origem_baixa_valida
    CHECK (origem_baixa IS NULL OR origem_baixa IN ('manual', 'automatica', 'sumup')),
  CONSTRAINT contas_receber_baixa_consistente
    CHECK (situacao <> 'recebido' OR data_recebimento IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS contas_receber_id_venda_idx ON public.contas_receber (id_venda);
CREATE INDEX IF NOT EXISTS contas_receber_situacao_venc_idx
  ON public.contas_receber (situacao, data_vencimento);
CREATE INDEX IF NOT EXISTS contas_receber_codigo_transacao_idx
  ON public.contas_receber (upper(codigo_transacao))
  WHERE codigo_transacao IS NOT NULL;

ALTER TABLE public.contas_receber ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'contas_receber' AND policyname = 'crm_authenticated_all'
  ) THEN
    CREATE POLICY crm_authenticated_all ON public.contas_receber
      FOR ALL TO authenticated
      USING (public.is_equipe_crm())
      WITH CHECK (public.is_equipe_crm());
  END IF;
END $$;

DROP TRIGGER IF EXISTS contas_receber_atualizado_em ON public.contas_receber;
CREATE TRIGGER contas_receber_atualizado_em
BEFORE UPDATE ON public.contas_receber
FOR EACH ROW
EXECUTE FUNCTION public.atualizar_atualizado_em();

-- 2. Regras ----------------------------------------------------------------

-- Formas cujo dinheiro cai na hora: a conta já nasce recebida se venceu.
CREATE OR REPLACE FUNCTION public.forma_pagamento_baixa_imediata(p_forma text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(btrim(coalesce(p_forma, ''))) IN ('pix', 'dinheiro', 'vale', 'mbway', 'transferencia');
$$;

CREATE OR REPLACE FUNCTION public.parcela_gera_conta(p_forma text, p_valor numeric)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(p_valor, 0) > 0 AND lower(btrim(coalesce(p_forma, ''))) <> 'cortesia';
$$;

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
      documento = v_doc || '/' || p.numero,
      moeda = v_moeda,
      data_emissao = v_emissao,
      data_vencimento = coalesce(p.data_vencimento, v_emissao),
      valor = p.valor,
      forma_pagamento = p.forma_pagamento,
      meio_pagamento = p.meio_pagamento,
      codigo_transacao = p.codigo_transacao,
      situacao = 'aberto',
      divergente = false,
      motivo_divergencia = NULL
  FROM public.parcelas_venda p
  WHERE c.id_parcela_venda = p.id
    AND p.id_venda = p_id_venda
    AND c.situacao IN ('aberto', 'cancelado')
    AND public.parcela_gera_conta(p.forma_pagamento, p.valor);

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

REVOKE ALL ON FUNCTION public.sincronizar_contas_receber_venda(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sincronizar_contas_receber_venda(uuid) TO authenticated, service_role;

-- Mantém as contas alinhadas quando muda status, cliente, número ou moeda da venda.
CREATE OR REPLACE FUNCTION public.trg_vendas_sincronizar_contas_receber()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.sincronizar_contas_receber_venda(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendas_sincronizar_contas_receber ON public.vendas;
CREATE TRIGGER vendas_sincronizar_contas_receber
AFTER UPDATE OF status_venda, id_cliente, numero, moeda_venda, regiao_venda, data_pedido
ON public.vendas
FOR EACH ROW
WHEN (
  OLD.status_venda IS DISTINCT FROM NEW.status_venda
  OR OLD.id_cliente IS DISTINCT FROM NEW.id_cliente
  OR OLD.numero IS DISTINCT FROM NEW.numero
  OR OLD.moeda_venda IS DISTINCT FROM NEW.moeda_venda
  OR OLD.regiao_venda IS DISTINCT FROM NEW.regiao_venda
  OR OLD.data_pedido IS DISTINCT FROM NEW.data_pedido
)
EXECUTE FUNCTION public.trg_vendas_sincronizar_contas_receber();

-- Salva as parcelas do pedido (preservando ids) e sincroniza as contas.
-- Com `id` nas parcelas, casa por id; sem nenhum id (tiny-sync), casa por número.
CREATE OR REPLACE FUNCTION public.salvar_parcelas_venda(
  p_id_venda uuid,
  p_parcelas jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_usa_ids boolean;
  v_resolvidos uuid[] := ARRAY[]::uuid[];
  v_mantidos uuid[];
  v_id uuid;
  r record;
  v_formas text[];
  v_divergentes integer := 0;
  v_sync jsonb;
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    PERFORM set_config('kropfeet.bypass_equipe', '1', true);
  END IF;

  IF pg_trigger_depth() = 0
    AND NOT public.is_equipe_crm()
    AND coalesce(current_setting('kropfeet.bypass_equipe', true), '') <> '1'
  THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.vendas WHERE id = p_id_venda FOR UPDATE) THEN
    RAISE EXCEPTION 'Venda não encontrada';
  END IF;

  IF p_parcelas IS NULL OR jsonb_typeof(p_parcelas) <> 'array' THEN
    RAISE EXCEPTION 'Parcelas da venda inválidas.';
  END IF;

  SET CONSTRAINTS public.parcelas_venda_venda_numero_unique DEFERRED;

  SELECT coalesce(bool_or(nullif(e->>'id', '') IS NOT NULL), false)
  INTO v_usa_ids
  FROM jsonb_array_elements(p_parcelas) AS e;

  FOR r IN
    SELECT t.elem, t.ord::integer AS ord
    FROM jsonb_array_elements(p_parcelas) WITH ORDINALITY AS t(elem, ord)
    ORDER BY t.ord
  LOOP
    v_id := NULL;
    IF v_usa_ids THEN
      IF nullif(r.elem->>'id', '') IS NOT NULL THEN
        SELECT id INTO v_id
        FROM public.parcelas_venda
        WHERE id = (r.elem->>'id')::uuid AND id_venda = p_id_venda;
      END IF;
    ELSE
      SELECT id INTO v_id
      FROM public.parcelas_venda
      WHERE id_venda = p_id_venda AND numero = r.ord;
    END IF;
    IF v_id IS NOT NULL AND v_id = ANY (v_resolvidos) THEN
      v_id := NULL;
    END IF;
    v_resolvidos := array_append(v_resolvidos, v_id);
  END LOOP;

  v_mantidos := coalesce(array_remove(v_resolvidos, NULL), ARRAY[]::uuid[]);

  -- Parcelas removidas: conta recebida fica, desvinculada e com aviso; as demais saem.
  UPDATE public.contas_receber c
  SET id_parcela_venda = NULL,
      divergente = true,
      motivo_divergencia = 'A parcela foi removida do pedido depois do recebimento.'
  FROM public.parcelas_venda p
  WHERE c.id_parcela_venda = p.id
    AND p.id_venda = p_id_venda
    AND NOT (p.id = ANY (v_mantidos))
    AND c.situacao = 'recebido';
  GET DIAGNOSTICS v_divergentes = ROW_COUNT;

  DELETE FROM public.contas_receber c
  USING public.parcelas_venda p
  WHERE c.id_parcela_venda = p.id
    AND p.id_venda = p_id_venda
    AND NOT (p.id = ANY (v_mantidos));

  DELETE FROM public.parcelas_venda
  WHERE id_venda = p_id_venda AND NOT (id = ANY (v_mantidos));

  FOR r IN
    SELECT t.elem, t.ord::integer AS ord
    FROM jsonb_array_elements(p_parcelas) WITH ORDINALITY AS t(elem, ord)
    ORDER BY t.ord
  LOOP
    v_id := v_resolvidos[r.ord];
    IF v_id IS NULL THEN
      INSERT INTO public.parcelas_venda (
        id_venda, numero, data_vencimento, valor, forma_pagamento, meio_pagamento,
        dias, obs, codigo_transacao, dados_tiny
      ) VALUES (
        p_id_venda,
        r.ord,
        nullif(r.elem->>'data_vencimento', '')::date,
        coalesce(nullif(r.elem->>'valor', '')::numeric, 0),
        nullif(btrim(coalesce(r.elem->>'forma_pagamento', '')), ''),
        nullif(btrim(coalesce(r.elem->>'meio_pagamento', '')), ''),
        nullif(r.elem->>'dias', '')::numeric::integer,
        nullif(btrim(coalesce(r.elem->>'obs', '')), ''),
        nullif(upper(btrim(coalesce(r.elem->>'codigo_transacao', ''))), ''),
        CASE
          WHEN r.elem->'dados_tiny' IS NULL OR jsonb_typeof(r.elem->'dados_tiny') = 'null' THEN NULL
          ELSE r.elem->'dados_tiny'
        END
      );
    ELSE
      UPDATE public.parcelas_venda
      SET numero = r.ord,
          data_vencimento = nullif(r.elem->>'data_vencimento', '')::date,
          valor = coalesce(nullif(r.elem->>'valor', '')::numeric, 0),
          forma_pagamento = nullif(btrim(coalesce(r.elem->>'forma_pagamento', '')), ''),
          meio_pagamento = nullif(btrim(coalesce(r.elem->>'meio_pagamento', '')), ''),
          dias = nullif(r.elem->>'dias', '')::numeric::integer,
          obs = nullif(btrim(coalesce(r.elem->>'obs', '')), ''),
          codigo_transacao = nullif(upper(btrim(coalesce(r.elem->>'codigo_transacao', ''))), ''),
          dados_tiny = CASE
            WHEN r.elem ? 'dados_tiny' AND jsonb_typeof(r.elem->'dados_tiny') <> 'null'
              THEN r.elem->'dados_tiny'
            ELSE dados_tiny
          END
      WHERE id = v_id;
    END IF;
  END LOOP;

  SET CONSTRAINTS public.parcelas_venda_venda_numero_unique IMMEDIATE;

  -- Forma do pedido derivada das parcelas: uma só forma, ou "multiplas".
  SELECT coalesce(array_agg(DISTINCT lower(forma_pagamento)), ARRAY[]::text[])
  INTO v_formas
  FROM public.parcelas_venda
  WHERE id_venda = p_id_venda AND forma_pagamento IS NOT NULL;

  IF array_length(v_formas, 1) = 1 THEN
    UPDATE public.vendas v
    SET forma_pagamento = (
      SELECT p.forma_pagamento FROM public.parcelas_venda p
      WHERE p.id_venda = p_id_venda AND p.forma_pagamento IS NOT NULL
      ORDER BY p.numero LIMIT 1
    )
    WHERE v.id = p_id_venda;
  ELSIF array_length(v_formas, 1) > 1 THEN
    UPDATE public.vendas SET forma_pagamento = 'multiplas' WHERE id = p_id_venda;
  END IF;

  v_sync := public.sincronizar_contas_receber_venda(p_id_venda);

  RETURN v_sync || jsonb_build_object('divergentes', v_divergentes);
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_parcelas_venda(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salvar_parcelas_venda(uuid, jsonb) TO authenticated, service_role;

-- Baixa em lote. Sem data informada, usa o vencimento de cada conta.
CREATE OR REPLACE FUNCTION public.baixar_contas_receber(
  p_ids uuid[],
  p_data_recebimento date DEFAULT NULL
)
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
  WHERE id = ANY (p_ids) AND situacao = 'aberto';
  GET DIAGNOSTICS v_total = ROW_COUNT;
  RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.estornar_baixa_contas_receber(p_ids uuid[])
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
  SET situacao = 'aberto',
      data_recebimento = NULL,
      valor_recebido = NULL,
      taxa = NULL,
      origem_baixa = NULL,
      id_transacao_sumup = NULL,
      dados_sumup = NULL
  WHERE id = ANY (p_ids) AND situacao = 'recebido' AND id_parcela_venda IS NOT NULL;
  GET DIAGNOSTICS v_total = ROW_COUNT;
  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.baixar_contas_receber(uuid[], date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.estornar_baixa_contas_receber(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.baixar_contas_receber(uuid[], date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.estornar_baixa_contas_receber(uuid[]) TO authenticated;

-- 3. Normalização do histórico --------------------------------------------

-- Europa: o meio estava gravado como forma.
UPDATE public.parcelas_venda p
SET meio_pagamento = coalesce(p.meio_pagamento, p.forma_pagamento),
    forma_pagamento = 'transferencia'
FROM public.vendas v
WHERE v.id = p.id_venda AND v.regiao_venda = 'europa'
  AND p.forma_pagamento IN ('Revolut', 'Wise');

UPDATE public.parcelas_venda p
SET meio_pagamento = CASE
      WHEN p.forma_pagamento IN ('SumUp Máquina', 'SumUp Link', 'Stripe') THEN p.forma_pagamento
      ELSE p.meio_pagamento
    END,
    forma_pagamento = 'cartao'
FROM public.vendas v
WHERE v.id = p.id_venda AND v.regiao_venda = 'europa'
  AND p.forma_pagamento IN ('SumUp Máquina', 'SumUp Link', 'Stripe', 'credito');

UPDATE public.parcelas_venda SET forma_pagamento = 'mbway' WHERE forma_pagamento = 'MBWay';
UPDATE public.parcelas_venda SET forma_pagamento = 'cortesia'
WHERE forma_pagamento = 'Presente / Amostra grátis';

UPDATE public.vendas SET forma_pagamento = 'transferencia'
WHERE regiao_venda = 'europa' AND forma_pagamento IN ('Revolut', 'Wise');
UPDATE public.vendas SET forma_pagamento = 'cartao'
WHERE regiao_venda = 'europa' AND forma_pagamento IN ('SumUp Máquina', 'SumUp Link', 'Stripe', 'credito');
UPDATE public.vendas SET forma_pagamento = 'mbway' WHERE forma_pagamento = 'MBWay';
UPDATE public.vendas SET forma_pagamento = 'cortesia' WHERE forma_pagamento = 'Presente / Amostra grátis';

-- Código SumUp da venda vai para as parcelas SumUp quando há um único código.
UPDATE public.parcelas_venda p
SET codigo_transacao = c.codigo
FROM (
  SELECT v.id, (array_agg(m[1]))[1] AS codigo
  FROM public.vendas v
  CROSS JOIN LATERAL regexp_matches(upper(v.codigo_venda_adquirente), '(T[A-Z0-9]{6,})', 'g') AS m
  WHERE v.codigo_venda_adquirente IS NOT NULL
  GROUP BY v.id
  HAVING count(DISTINCT m[1]) = 1
) c
WHERE p.id_venda = c.id
  AND p.codigo_transacao IS NULL
  AND (p.meio_pagamento ILIKE 'sumup%');

-- Vendas sem parcela, com forma simples: uma parcela com o total do pedido.
INSERT INTO public.parcelas_venda (
  id_venda, numero, data_vencimento, valor, forma_pagamento, codigo_transacao, pago
)
SELECT
  v.id,
  1,
  v.data_pedido::date,
  v.valor_total,
  v.forma_pagamento,
  CASE WHEN v.forma_pagamento = 'cartao' THEN
    (SELECT (regexp_match(upper(v.codigo_venda_adquirente), '(T[A-Z0-9]{6,})'))[1])
  END,
  true
FROM public.vendas v
WHERE v.status_venda <> 'cancelado'
  AND coalesce(v.valor_total, 0) > 0
  AND v.forma_pagamento IS NOT NULL
  AND v.forma_pagamento NOT IN ('multiplas', 'cortesia')
  AND NOT EXISTS (SELECT 1 FROM public.parcelas_venda p WHERE p.id_venda = v.id);

-- Contas a receber do histórico (antes de limpar a forma "contareceber").
INSERT INTO public.contas_receber (
  id_venda, id_parcela_venda, id_cliente, documento, moeda, data_emissao,
  data_vencimento, valor, forma_pagamento, meio_pagamento, codigo_transacao,
  situacao, data_recebimento, valor_recebido, origem_baixa
)
SELECT
  v.id,
  p.id,
  v.id_cliente,
  coalesce(nullif(btrim(v.numero), ''), left(v.id::text, 8)) || '/' || p.numero,
  coalesce(nullif(upper(btrim(v.moeda_venda)), ''), CASE WHEN v.regiao_venda = 'europa' THEN 'EUR' ELSE 'BRL' END),
  coalesce(v.data_pedido::date, p.data_vencimento),
  coalesce(p.data_vencimento, v.data_pedido::date),
  p.valor,
  CASE WHEN lower(coalesce(p.forma_pagamento, '')) = 'contareceber' THEN NULL ELSE p.forma_pagamento END,
  p.meio_pagamento,
  p.codigo_transacao,
  CASE WHEN s.recebido THEN 'recebido' ELSE 'aberto' END::public.situacao_conta_receber_enum,
  CASE WHEN s.recebido THEN coalesce(p.data_vencimento, v.data_pedido::date, current_date) END,
  CASE WHEN s.recebido THEN p.valor END,
  CASE WHEN s.recebido THEN 'manual' END
FROM public.parcelas_venda p
JOIN public.vendas v ON v.id = p.id_venda
CROSS JOIN LATERAL (
  SELECT
    p.pago
    AND lower(coalesce(p.forma_pagamento, '')) <> 'contareceber'
    AND NOT (
      (lower(coalesce(p.forma_pagamento, '')) IN ('credito', 'crediario', 'cartao')
        OR coalesce(p.meio_pagamento, '') ILIKE 'sumup%')
      AND coalesce(p.data_vencimento, v.data_pedido::date) > current_date
    ) AS recebido
) s
WHERE v.status_venda <> 'cancelado'
  AND public.parcela_gera_conta(p.forma_pagamento, p.valor)
  AND NOT EXISTS (SELECT 1 FROM public.contas_receber c WHERE c.id_parcela_venda = p.id);

UPDATE public.parcelas_venda SET forma_pagamento = NULL
WHERE lower(coalesce(forma_pagamento, '')) = 'contareceber';

-- Forma do pedido passa a refletir as parcelas.
UPDATE public.vendas v
SET forma_pagamento = CASE WHEN f.qtd = 1 THEN f.primeira ELSE 'multiplas' END
FROM (
  SELECT id_venda,
         count(DISTINCT lower(forma_pagamento)) AS qtd,
         (array_agg(forma_pagamento ORDER BY numero))[1] AS primeira
  FROM public.parcelas_venda
  WHERE forma_pagamento IS NOT NULL
  GROUP BY id_venda
) f
WHERE v.id = f.id_venda
  AND v.forma_pagamento IS DISTINCT FROM CASE WHEN f.qtd = 1 THEN f.primeira ELSE 'multiplas' END;
