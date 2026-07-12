-- Histórico de mudanças de status_item + trigger + contexto OV/Tiny

CREATE TABLE IF NOT EXISTS public.itens_estoque_status_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_item_estoque uuid NOT NULL REFERENCES public.itens_estoque(id) ON DELETE CASCADE,
  status_anterior public.status_item_enum,
  status_novo public.status_item_enum NOT NULL,
  id_usuario uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  id_venda uuid REFERENCES public.vendas(id) ON DELETE SET NULL,
  origem text NOT NULL DEFAULT 'sistema',
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS itens_estoque_status_historico_item_idx
  ON public.itens_estoque_status_historico (id_item_estoque, criado_em DESC);

CREATE INDEX IF NOT EXISTS itens_estoque_status_historico_criado_idx
  ON public.itens_estoque_status_historico (criado_em DESC);

ALTER TABLE public.itens_estoque_status_historico ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'itens_estoque_status_historico'
      AND policyname = 'crm_authenticated_all'
  ) THEN
    CREATE POLICY crm_authenticated_all ON public.itens_estoque_status_historico
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Contexto de auditoria (transaction-local)
CREATE OR REPLACE FUNCTION public.definir_contexto_historico_item(
  p_origem text DEFAULT NULL,
  p_id_venda uuid DEFAULT NULL,
  p_id_usuario uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_origem IS NOT NULL AND length(trim(p_origem)) > 0 THEN
    PERFORM set_config('app.historico_origem', trim(p_origem), true);
  END IF;
  IF p_id_venda IS NOT NULL THEN
    PERFORM set_config('app.historico_id_venda', p_id_venda::text, true);
  END IF;
  IF p_id_usuario IS NOT NULL THEN
    PERFORM set_config('app.historico_id_usuario', p_id_usuario::text, true);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.definir_contexto_historico_item(text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.definir_contexto_historico_item(text, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.atualizar_status_item_estoque(
  p_id_item uuid,
  p_status_novo public.status_item_enum,
  p_origem text DEFAULT 'sistema',
  p_id_venda uuid DEFAULT NULL,
  p_id_usuario uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.definir_contexto_historico_item(p_origem, p_id_venda, p_id_usuario);

  UPDATE public.itens_estoque
  SET status_item = p_status_novo,
      atualizado_em = now()
  WHERE id = p_id_item
    AND status_item IS DISTINCT FROM p_status_novo;
END;
$$;

GRANT EXECUTE ON FUNCTION public.atualizar_status_item_estoque(uuid, public.status_item_enum, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_status_item_estoque(uuid, public.status_item_enum, text, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_itens_estoque_status_historico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_usuario uuid;
  v_venda uuid;
  v_origem text;
  v_raw text;
BEGIN
  IF OLD.status_item IS NOT DISTINCT FROM NEW.status_item THEN
    RETURN NEW;
  END IF;

  v_raw := nullif(current_setting('app.historico_id_usuario', true), '');
  IF v_raw IS NOT NULL THEN
    v_usuario := v_raw::uuid;
  ELSE
    v_usuario := auth.uid();
  END IF;

  v_raw := nullif(current_setting('app.historico_id_venda', true), '');
  IF v_raw IS NOT NULL THEN
    v_venda := v_raw::uuid;
  END IF;

  v_origem := nullif(trim(current_setting('app.historico_origem', true)), '');
  IF v_origem IS NULL THEN
    v_origem := CASE WHEN v_usuario IS NOT NULL THEN 'manual' ELSE 'sistema' END;
  END IF;

  INSERT INTO public.itens_estoque_status_historico (
    id_item_estoque,
    status_anterior,
    status_novo,
    id_usuario,
    id_venda,
    origem
  ) VALUES (
    NEW.id,
    OLD.status_item,
    NEW.status_item,
    v_usuario,
    v_venda,
    v_origem
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS itens_estoque_status_historico ON public.itens_estoque;
CREATE TRIGGER itens_estoque_status_historico
AFTER UPDATE OF status_item ON public.itens_estoque
FOR EACH ROW
EXECUTE FUNCTION public.trg_itens_estoque_status_historico();

-- Patch: sincronizar_efeitos_venda com contexto venda
CREATE OR REPLACE FUNCTION public.sincronizar_efeitos_venda(p_id_venda uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status public.status_venda_enum;
  v_ids uuid[];
  v_id uuid;
  v_buracos integer := 0;
  v_restaurados integer := 0;
  v_marcados integer := 0;
BEGIN
  SELECT status_venda INTO v_status
  FROM public.vendas
  WHERE id = p_id_venda
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada';
  END IF;

  PERFORM public.definir_contexto_historico_item('venda', p_id_venda, auth.uid());

  SELECT COALESCE(array_agg(DISTINCT id_item_estoque) FILTER (WHERE id_item_estoque IS NOT NULL), ARRAY[]::uuid[])
  INTO v_ids
  FROM public.itens_venda
  WHERE id_venda = p_id_venda;

  IF v_status = 'cancelado' THEN
    FOREACH v_id IN ARRAY v_ids
    LOOP
      IF NOT public.item_em_ov_ativa(v_id, p_id_venda) THEN
        UPDATE public.itens_estoque
        SET status_item = 'em_estoque', atualizado_em = now()
        WHERE id = v_id
          AND status_item IS DISTINCT FROM 'em_estoque';
        v_marcados := v_marcados + 1;
      END IF;
    END LOOP;
    v_restaurados := public.vitrine_restaurar_itens_venda(p_id_venda);
  ELSE
    IF array_length(v_ids, 1) IS NOT NULL THEN
      UPDATE public.itens_estoque
      SET status_item = 'vendido', atualizado_em = now()
      WHERE id = ANY (v_ids)
        AND status_item IS DISTINCT FROM 'vendido';
      GET DIAGNOSTICS v_marcados = ROW_COUNT;
      v_buracos := public.vitrine_marcar_itens_vendidos(v_ids, p_id_venda);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id_venda', p_id_venda,
    'status_venda', v_status,
    'itens', COALESCE(array_length(v_ids, 1), 0),
    'status_atualizados', v_marcados,
    'buracos', v_buracos,
    'restaurados', v_restaurados
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reverter_itens_removidos_venda(
  p_id_venda uuid,
  p_ids_anteriores uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_count integer := 0;
  v_restaurados_vitrine boolean := false;
  v_id_vitrine uuid;
BEGIN
  IF p_ids_anteriores IS NULL THEN
    RETURN 0;
  END IF;

  PERFORM public.definir_contexto_historico_item('venda', p_id_venda, auth.uid());

  SELECT id INTO v_id_vitrine
  FROM public.vitrines
  WHERE status = 'publicada'
  LIMIT 1;

  FOREACH v_id IN ARRAY p_ids_anteriores
  LOOP
    IF v_id IS NULL THEN
      CONTINUE;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.itens_venda
      WHERE id_venda = p_id_venda AND id_item_estoque = v_id
    ) THEN
      CONTINUE;
    END IF;
    IF public.item_em_ov_ativa(v_id, NULL) THEN
      CONTINUE;
    END IF;

    UPDATE public.itens_estoque
    SET status_item = 'em_estoque', atualizado_em = now()
    WHERE id = v_id
      AND status_item IS DISTINCT FROM 'em_estoque';

    IF v_id_vitrine IS NOT NULL THEN
      UPDATE public.vitrine_itens vi
      SET estado_caixa = 'ocupada',
          id_venda_saida = NULL,
          vendido_em = NULL,
          atualizado_em = now()
      WHERE vi.id_vitrine = v_id_vitrine
        AND vi.id_item_estoque = v_id
        AND vi.id_venda_saida = p_id_venda
        AND vi.estado_caixa = 'vendida';
      IF FOUND THEN
        v_restaurados_vitrine := true;
      END IF;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  IF v_restaurados_vitrine AND v_id_vitrine IS NOT NULL THEN
    PERFORM public.vitrine_registrar_versao(v_id_vitrine, 'cancelamento', p_id_venda, NULL);
  END IF;

  RETURN v_count;
END;
$$;
