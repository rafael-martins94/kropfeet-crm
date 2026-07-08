-- Histórico de alterações de preço de venda + RPC atômica.

CREATE TABLE IF NOT EXISTS public.itens_estoque_preco_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_item_estoque uuid NOT NULL REFERENCES public.itens_estoque(id) ON DELETE CASCADE,
  preco_anterior numeric,
  moeda_anterior text,
  preco_novo numeric,
  moeda_nova text,
  id_usuario uuid,
  origem text NOT NULL DEFAULT 'manual',
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_itens_estoque_preco_historico_item
  ON public.itens_estoque_preco_historico (id_item_estoque, criado_em DESC);

CREATE OR REPLACE FUNCTION public.atualizar_preco_venda_item(
  p_id_item uuid,
  p_preco_novo numeric,
  p_moeda_nova text DEFAULT NULL,
  p_origem text DEFAULT 'manual',
  p_id_usuario uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item public.itens_estoque%ROWTYPE;
  v_moeda_nova text;
BEGIN
  IF p_preco_novo IS NULL OR p_preco_novo < 0 THEN
    RAISE EXCEPTION 'Preço inválido';
  END IF;

  SELECT * INTO v_item
  FROM public.itens_estoque
  WHERE id = p_id_item
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de estoque não encontrado';
  END IF;

  v_moeda_nova := COALESCE(
    NULLIF(trim(p_moeda_nova), ''),
    v_item.moeda_venda,
    public.moeda_venda_item_estoque(v_item.moeda_venda, (
      SELECT le.tipo_regiao FROM public.locais_estoque le WHERE le.id = v_item.id_local_estoque
    ))
  );

  INSERT INTO public.itens_estoque_preco_historico (
    id_item_estoque,
    preco_anterior,
    moeda_anterior,
    preco_novo,
    moeda_nova,
    id_usuario,
    origem
  ) VALUES (
    v_item.id,
    v_item.preco_venda,
    v_item.moeda_venda,
    p_preco_novo,
    v_moeda_nova,
    p_id_usuario,
    COALESCE(NULLIF(trim(p_origem), ''), 'manual')
  );

  UPDATE public.itens_estoque
  SET
    preco_venda = p_preco_novo,
    moeda_venda = v_moeda_nova,
    atualizado_em = now()
  WHERE id = p_id_item;

  RETURN jsonb_build_object(
    'id_item_estoque', v_item.id,
    'preco_venda', p_preco_novo,
    'moeda_venda', v_moeda_nova
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.atualizar_preco_venda_item(uuid, numeric, text, text, uuid) TO authenticated;
