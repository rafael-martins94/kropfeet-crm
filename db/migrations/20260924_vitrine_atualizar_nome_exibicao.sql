-- Editar o nome de exibição de um par na vitrine publicada gera uma versão.

CREATE OR REPLACE FUNCTION public.vitrine_atualizar_nome_exibicao(
  p_id_vitrine_item uuid,
  p_nome text,
  p_id_usuario uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item public.vitrine_itens%ROWTYPE;
  v_status public.status_vitrine_enum;
  v_nome text;
  v_atual text;
BEGIN
  v_nome := NULLIF(btrim(COALESCE(p_nome, '')), '');

  SELECT * INTO v_item
  FROM public.vitrine_itens
  WHERE id = p_id_vitrine_item
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caixa da vitrine não encontrada';
  END IF;

  SELECT status INTO v_status
  FROM public.vitrines
  WHERE id = v_item.id_vitrine
  FOR UPDATE;

  IF v_status IS DISTINCT FROM 'publicada' THEN
    RAISE EXCEPTION 'Só é possível editar nomes na vitrine publicada';
  END IF;

  v_atual := NULLIF(btrim(COALESCE(v_item.nome_exibicao, '')), '');
  IF v_nome IS NOT DISTINCT FROM v_atual THEN
    RETURN jsonb_build_object('alterado', false, 'id_vitrine', v_item.id_vitrine);
  END IF;

  UPDATE public.vitrine_itens
  SET nome_exibicao = v_nome,
      snapshot = CASE
        WHEN snapshot IS NULL THEN NULL
        ELSE jsonb_set(
          snapshot,
          '{nome_exibicao}',
          to_jsonb(
            COALESCE(
              v_nome,
              NULLIF(snapshot->>'nome_modelo', ''),
              NULLIF(snapshot->>'nome_produto', ''),
              ''
            )
          ),
          true
        )
      END,
      atualizado_em = now()
  WHERE id = p_id_vitrine_item;

  PERFORM public.vitrine_registrar_versao(v_item.id_vitrine, 'edicao_nome', NULL, p_id_usuario);

  RETURN jsonb_build_object(
    'alterado', true,
    'id_vitrine', v_item.id_vitrine,
    'id_vitrine_item', p_id_vitrine_item,
    'versao_atual', (SELECT versao_atual FROM public.vitrines WHERE id = v_item.id_vitrine)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.vitrine_atualizar_nome_exibicao(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vitrine_atualizar_nome_exibicao(uuid, text, uuid) TO service_role;
