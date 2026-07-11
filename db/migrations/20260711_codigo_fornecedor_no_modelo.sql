-- Código do fornecedor passa a pertencer ao modelo de produto.
-- Mantém cópia em itens_estoque por compatibilidade com telas/RPC existentes.

ALTER TABLE public.modelos_produto
  ADD COLUMN IF NOT EXISTS codigo_fornecedor text;

COMMENT ON COLUMN public.modelos_produto.codigo_fornecedor IS
  'Referência do modelo no catálogo do fornecedor.';

-- Backfill: pega o código mais recente não vazio entre os itens do modelo.
UPDATE public.modelos_produto mp
SET codigo_fornecedor = src.codigo_fornecedor
FROM (
  SELECT DISTINCT ON (ie.id_modelo_produto)
    ie.id_modelo_produto,
    ie.codigo_fornecedor
  FROM public.itens_estoque ie
  WHERE NULLIF(trim(ie.codigo_fornecedor), '') IS NOT NULL
  ORDER BY ie.id_modelo_produto, ie.atualizado_em DESC NULLS LAST, ie.criado_em DESC NULLS LAST
) src
WHERE mp.id = src.id_modelo_produto
  AND NULLIF(trim(mp.codigo_fornecedor), '') IS NULL;

CREATE OR REPLACE FUNCTION public.criar_ordem_compra_com_item(
  p_sku text,
  p_nome_produto text,
  p_id_modelo_produto uuid,
  p_id_local_estoque uuid DEFAULT NULL::uuid,
  p_codigo_fornecedor text DEFAULT NULL::text,
  p_numeracao_br numeric DEFAULT NULL::numeric,
  p_numeracao_eu numeric DEFAULT NULL::numeric,
  p_numeracao_us text DEFAULT NULL::text,
  p_sistema_numeracao sistema_numeracao_enum DEFAULT 'br'::sistema_numeracao_enum,
  p_status_item status_item_enum DEFAULT 'em_processo_de_compra'::status_item_enum,
  p_observacoes_item text DEFAULT NULL::text,
  p_id_fornecedor uuid DEFAULT NULL::uuid,
  p_data_compra date DEFAULT CURRENT_DATE,
  p_moeda_compra text DEFAULT 'BRL'::text,
  p_valor_custo numeric DEFAULT 0,
  p_observacoes_ordem text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item_id uuid;
  v_ordem_id uuid;
  v_sku text := btrim(p_sku);
  v_codigo_fornecedor text := nullif(btrim(p_codigo_fornecedor), '');
  v_moeda text := upper(btrim(p_moeda_compra));
BEGIN
  IF v_sku = '' THEN
    RAISE EXCEPTION 'Informe o SKU.';
  END IF;

  IF p_id_modelo_produto IS NULL THEN
    RAISE EXCEPTION 'Informe o modelo de produto.';
  END IF;

  IF v_codigo_fornecedor IS NULL THEN
    RAISE EXCEPTION 'Informe o código do fornecedor.';
  END IF;

  IF btrim(p_nome_produto) = '' THEN
    RAISE EXCEPTION 'Informe o nome do produto.';
  END IF;

  IF p_id_fornecedor IS NULL THEN
    RAISE EXCEPTION 'Informe o fornecedor da compra.';
  END IF;

  IF v_moeda NOT IN ('EUR', 'BRL') THEN
    RAISE EXCEPTION 'Moeda de compra inválida: %.', p_moeda_compra;
  END IF;

  IF p_valor_custo IS NULL OR p_valor_custo < 0 THEN
    RAISE EXCEPTION 'Informe um valor de custo válido.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.itens_estoque WHERE sku = v_sku) THEN
    RAISE EXCEPTION 'SKU % já está em uso.', v_sku;
  END IF;

  -- Fonte da verdade: modelo
  UPDATE public.modelos_produto
  SET codigo_fornecedor = v_codigo_fornecedor,
      atualizado_em = now()
  WHERE id = p_id_modelo_produto;

  INSERT INTO public.itens_estoque (
    sku,
    nome_produto,
    id_modelo_produto,
    id_local_estoque,
    id_fornecedor,
    codigo_fornecedor,
    numeracao_br,
    numeracao_eu,
    numeracao_us,
    sistema_numeracao,
    status_item,
    observacoes
  ) VALUES (
    v_sku,
    btrim(p_nome_produto),
    p_id_modelo_produto,
    p_id_local_estoque,
    p_id_fornecedor,
    v_codigo_fornecedor,
    p_numeracao_br,
    p_numeracao_eu,
    nullif(btrim(p_numeracao_us), ''),
    coalesce(p_sistema_numeracao, 'br'),
    coalesce(p_status_item, 'em_processo_de_compra'),
    nullif(btrim(p_observacoes_item), '')
  )
  RETURNING id INTO v_item_id;

  INSERT INTO public.ordens_compra (
    id_item_estoque,
    id_fornecedor,
    data_compra,
    moeda_compra,
    valor_custo,
    observacoes
  ) VALUES (
    v_item_id,
    p_id_fornecedor,
    coalesce(p_data_compra, CURRENT_DATE),
    v_moeda,
    p_valor_custo,
    nullif(btrim(p_observacoes_ordem), '')
  )
  RETURNING id INTO v_ordem_id;

  UPDATE public.itens_estoque
  SET id_ordem_compra = v_ordem_id
  WHERE id = v_item_id;

  RETURN jsonb_build_object('id_ordem', v_ordem_id, 'id_item', v_item_id);
END;
$$;
