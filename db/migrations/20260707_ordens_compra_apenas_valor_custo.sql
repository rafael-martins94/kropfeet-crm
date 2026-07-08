-- Remove colunas derivadas de câmbio; custo fica apenas em valor_custo + moeda_compra.

DROP FUNCTION IF EXISTS public.criar_ordem_compra_com_item(
  text,
  text,
  uuid,
  uuid,
  text,
  numeric,
  numeric,
  text,
  sistema_numeracao_enum,
  status_item_enum,
  text,
  uuid,
  date,
  text,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  text,
  text
);

ALTER TABLE public.ordens_compra
  DROP COLUMN IF EXISTS cambio_compra_para_real,
  DROP COLUMN IF EXISTS cambio_compra_para_euro,
  DROP COLUMN IF EXISTS valor_pago_real,
  DROP COLUMN IF EXISTS valor_pago_euro;

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
  p_codigo_pelo_fornecedor text DEFAULT NULL::text,
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

  IF v_moeda NOT IN ('EUR', 'BRL') THEN
    RAISE EXCEPTION 'Moeda de compra inválida: %.', p_moeda_compra;
  END IF;

  IF p_valor_custo IS NULL OR p_valor_custo < 0 THEN
    RAISE EXCEPTION 'Informe um valor de custo válido.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.itens_estoque WHERE sku = v_sku) THEN
    RAISE EXCEPTION 'SKU % já está em uso.', v_sku;
  END IF;

  INSERT INTO public.itens_estoque (
    sku,
    nome_produto,
    id_modelo_produto,
    id_local_estoque,
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
    codigo_pelo_fornecedor,
    observacoes
  ) VALUES (
    v_item_id,
    p_id_fornecedor,
    coalesce(p_data_compra, CURRENT_DATE),
    v_moeda,
    p_valor_custo,
    COALESCE(nullif(btrim(p_codigo_pelo_fornecedor), ''), v_codigo_fornecedor),
    nullif(btrim(p_observacoes_ordem), '')
  )
  RETURNING id INTO v_ordem_id;

  UPDATE public.itens_estoque
  SET id_ordem_compra = v_ordem_id
  WHERE id = v_item_id;

  RETURN jsonb_build_object('id_ordem', v_ordem_id, 'id_item', v_item_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_ordem_compra_com_item(
  text,
  text,
  uuid,
  uuid,
  text,
  numeric,
  numeric,
  text,
  sistema_numeracao_enum,
  status_item_enum,
  text,
  uuid,
  date,
  text,
  numeric,
  text,
  text
) TO authenticated;
