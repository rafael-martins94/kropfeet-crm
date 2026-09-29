-- Troca os itens de uma venda já existente e devolve ao estoque
-- o par que saiu da ordem, na mesma transação.

CREATE OR REPLACE FUNCTION public.substituir_itens_venda(
  p_id_venda uuid,
  p_itens jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ids_anteriores uuid[];
  v_revertidos integer := 0;
  v_efeito jsonb;
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

  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' THEN
    RAISE EXCEPTION 'Itens da venda inválidos.';
  END IF;

  SELECT COALESCE(
    array_agg(DISTINCT id_item_estoque) FILTER (WHERE id_item_estoque IS NOT NULL),
    ARRAY[]::uuid[]
  )
  INTO v_ids_anteriores
  FROM public.itens_venda
  WHERE id_venda = p_id_venda;

  DELETE FROM public.itens_venda
  WHERE id_venda = p_id_venda;

  INSERT INTO public.itens_venda (
    id_venda,
    id_item_estoque,
    id_produto_tiny,
    codigo,
    descricao,
    quantidade,
    valor_unitario,
    dados_tiny
  )
  SELECT
    p_id_venda,
    CASE
      WHEN nullif(btrim(coalesce(t.item->>'id_item_estoque', '')), '') IS NULL THEN NULL
      ELSE (t.item->>'id_item_estoque')::uuid
    END,
    nullif(btrim(coalesce(t.item->>'id_produto_tiny', '')), ''),
    nullif(t.item->>'codigo', ''),
    nullif(t.item->>'descricao', ''),
    COALESCE((t.item->>'quantidade')::numeric, 1),
    COALESCE((t.item->>'valor_unitario')::numeric, 0),
    CASE
      WHEN t.item->'dados_tiny' IS NULL OR jsonb_typeof(t.item->'dados_tiny') = 'null' THEN NULL
      ELSE t.item->'dados_tiny'
    END
  FROM jsonb_array_elements(p_itens) AS t(item);

  IF COALESCE(array_length(v_ids_anteriores, 1), 0) > 0 THEN
    v_revertidos := public.reverter_itens_removidos_venda(p_id_venda, v_ids_anteriores);
  END IF;

  v_efeito := public.sincronizar_efeitos_venda(p_id_venda);

  RETURN v_efeito || jsonb_build_object('revertidos', v_revertidos);
END;
$$;

REVOKE ALL ON FUNCTION public.substituir_itens_venda(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.substituir_itens_venda(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.substituir_itens_venda(uuid, jsonb) TO service_role;
