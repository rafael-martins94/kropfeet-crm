-- Permite trocar um par ainda ocupado na vitrine publicada.
-- O par que sai vai para um local de estoque; a troca gera uma versão.

DROP FUNCTION IF EXISTS public.substituir_caixa_vitrine(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.substituir_caixa_vitrine(
  p_id_vitrine_item uuid,
  p_id_item_novo uuid,
  p_id_usuario uuid DEFAULT auth.uid(),
  p_id_local_destino uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item public.vitrine_itens%ROWTYPE;
  v_vitrine public.vitrines%ROWTYPE;
  v_id_local_vitrine uuid;
  v_novo public.itens_estoque%ROWTYPE;
  v_antigo public.itens_estoque%ROWTYPE;
  v_local public.locais_estoque%ROWTYPE;
  v_id_modelo_antigo uuid;
  v_id_modelo_novo uuid;
  v_refresh uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('substituir_caixa_vitrine'));

  SELECT * INTO v_item
  FROM public.vitrine_itens
  WHERE id = p_id_vitrine_item
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caixa da vitrine não encontrada';
  END IF;

  SELECT * INTO v_vitrine
  FROM public.vitrines
  WHERE id = v_item.id_vitrine
  FOR UPDATE;

  IF v_vitrine.status <> 'publicada' THEN
    RAISE EXCEPTION 'Só é possível substituir caixas na vitrine publicada';
  END IF;

  IF v_item.estado_caixa NOT IN ('ocupada', 'vendida') THEN
    RAISE EXCEPTION 'Estado da caixa não permite substituição';
  END IF;

  IF p_id_item_novo = v_item.id_item_estoque THEN
    RAISE EXCEPTION 'Escolha um par diferente do que já está na caixa';
  END IF;

  SELECT * INTO v_novo
  FROM public.itens_estoque
  WHERE id = p_id_item_novo
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de estoque não encontrado';
  END IF;

  IF v_novo.status_item <> 'em_estoque' THEN
    RAISE EXCEPTION 'O novo item precisa estar em estoque';
  END IF;

  SELECT public.vitrines_id_local_vitrine() INTO v_id_local_vitrine;
  IF v_id_local_vitrine IS NULL THEN
    RAISE EXCEPTION 'Local de estoque Vitrine não encontrado';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.vitrine_itens
    WHERE id_vitrine = v_item.id_vitrine
      AND id_item_estoque = p_id_item_novo
      AND id <> p_id_vitrine_item
  ) THEN
    RAISE EXCEPTION 'Item já está nesta vitrine';
  END IF;

  SELECT id_modelo_produto INTO v_id_modelo_antigo
  FROM public.itens_estoque
  WHERE id = v_item.id_item_estoque;

  v_id_modelo_novo := v_novo.id_modelo_produto;

  IF v_item.estado_caixa = 'ocupada' THEN
    IF p_id_local_destino IS NULL THEN
      RAISE EXCEPTION 'Informe o local de destino do par que sai da vitrine';
    END IF;

    SELECT * INTO v_local
    FROM public.locais_estoque
    WHERE id = p_id_local_destino;

    IF NOT FOUND OR v_local.ativo IS NOT TRUE THEN
      RAISE EXCEPTION 'O destino precisa ser um local de estoque ativo';
    END IF;

    IF v_local.id = v_id_local_vitrine
       OR lower(v_local.codigo) = 'vitrine'
       OR lower(v_local.nome) = 'vitrine' THEN
      RAISE EXCEPTION 'O par que sai não pode permanecer no local Vitrine';
    END IF;

    SELECT * INTO v_antigo
    FROM public.itens_estoque
    WHERE id = v_item.id_item_estoque
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Par atual da caixa não encontrado';
    END IF;

    IF v_antigo.status_item <> 'em_estoque' THEN
      RAISE EXCEPTION 'O par atual precisa estar em estoque para sair da vitrine';
    END IF;

    UPDATE public.itens_estoque
    SET id_local_estoque = p_id_local_destino,
        atualizado_em = now()
    WHERE id = v_antigo.id;
  END IF;

  UPDATE public.itens_estoque
  SET id_local_estoque = v_id_local_vitrine,
      atualizado_em = now()
  WHERE id = p_id_item_novo;

  UPDATE public.vitrine_itens
  SET id_item_estoque = p_id_item_novo,
      estado_caixa = 'ocupada',
      id_venda_saida = NULL,
      vendido_em = NULL,
      nome_exibicao = NULL,
      snapshot = NULL,
      atualizado_em = now()
  WHERE id = p_id_vitrine_item;

  FOR v_refresh IN
    SELECT vi.id
    FROM public.vitrine_itens vi
    JOIN public.itens_estoque ie ON ie.id = vi.id_item_estoque
    WHERE vi.id_vitrine = v_item.id_vitrine
      AND vi.estado_caixa = 'ocupada'
      AND (
        ie.id_modelo_produto IS NOT DISTINCT FROM v_id_modelo_antigo
        OR ie.id_modelo_produto IS NOT DISTINCT FROM v_id_modelo_novo
      )
  LOOP
    PERFORM public.vitrine_atualizar_snapshot_item(v_refresh);
  END LOOP;

  PERFORM public.vitrine_registrar_versao(v_item.id_vitrine, 'substituicao', NULL, p_id_usuario);

  RETURN jsonb_build_object(
    'id_vitrine', v_item.id_vitrine,
    'id_vitrine_item', p_id_vitrine_item,
    'id_item_novo', p_id_item_novo,
    'versao_atual', (SELECT versao_atual FROM public.vitrines WHERE id = v_item.id_vitrine)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.substituir_caixa_vitrine(uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.substituir_caixa_vitrine(uuid, uuid, uuid, uuid) TO service_role;
