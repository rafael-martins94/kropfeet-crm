-- Ordens de compra canônicas a partir do JSON bruto do Tiny.
-- Usa itens_estoque.dados_tiny como fonte para custo/moeda e preserva exceções para revisão manual.

CREATE OR REPLACE FUNCTION public.normalizar_nome_fornecedor(p_nome text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT lower(regexp_replace(btrim(coalesce(p_nome, '')), '\s+', ' ', 'g'));
$$;

CREATE TABLE IF NOT EXISTS public.fornecedor_tiny_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_fornecedor uuid NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  id_tiny text NOT NULL,
  dados_tiny jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS fornecedor_tiny_ids_id_tiny_unico
  ON public.fornecedor_tiny_ids (id_tiny);

CREATE INDEX IF NOT EXISTS fornecedor_tiny_ids_fornecedor_idx
  ON public.fornecedor_tiny_ids (id_fornecedor);

ALTER TABLE public.fornecedor_tiny_ids ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'fornecedor_tiny_ids'
      AND policyname = 'crm_authenticated_all'
  ) THEN
    CREATE POLICY crm_authenticated_all
      ON public.fornecedor_tiny_ids
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Registra todos os IDs Tiny atuais como aliases antes de fundir duplicados.
WITH fornecedor_canonico AS (
  SELECT
    f.id,
    first_value(f.id) OVER (
      PARTITION BY public.normalizar_nome_fornecedor(f.nome)
      ORDER BY
        (f.dados_tiny IS NOT NULL) DESC,
        (NULLIF(f.cpf_cnpj, '') IS NOT NULL) DESC,
        f.criado_em ASC,
        f.id ASC
    ) AS id_canonico
  FROM public.fornecedores f
  WHERE public.normalizar_nome_fornecedor(f.nome) <> ''
)
INSERT INTO public.fornecedor_tiny_ids (id_fornecedor, id_tiny, dados_tiny)
SELECT
  fc.id_canonico,
  f.id_tiny,
  f.dados_tiny
FROM public.fornecedores f
JOIN fornecedor_canonico fc ON fc.id = f.id
WHERE f.id_tiny IS NOT NULL
ON CONFLICT (id_tiny) DO UPDATE
SET
  id_fornecedor = EXCLUDED.id_fornecedor,
  dados_tiny = COALESCE(public.fornecedor_tiny_ids.dados_tiny, EXCLUDED.dados_tiny),
  atualizado_em = now();

-- Reaponta referências para o fornecedor canônico do mesmo nome normalizado.
WITH fornecedor_canonico AS (
  SELECT
    f.id,
    first_value(f.id) OVER (
      PARTITION BY public.normalizar_nome_fornecedor(f.nome)
      ORDER BY
        (f.dados_tiny IS NOT NULL) DESC,
        (NULLIF(f.cpf_cnpj, '') IS NOT NULL) DESC,
        f.criado_em ASC,
        f.id ASC
    ) AS id_canonico
  FROM public.fornecedores f
  WHERE public.normalizar_nome_fornecedor(f.nome) <> ''
)
UPDATE public.itens_estoque ie
SET id_fornecedor = fc.id_canonico
FROM fornecedor_canonico fc
WHERE ie.id_fornecedor = fc.id
  AND fc.id <> fc.id_canonico;

WITH fornecedor_canonico AS (
  SELECT
    f.id,
    first_value(f.id) OVER (
      PARTITION BY public.normalizar_nome_fornecedor(f.nome)
      ORDER BY
        (f.dados_tiny IS NOT NULL) DESC,
        (NULLIF(f.cpf_cnpj, '') IS NOT NULL) DESC,
        f.criado_em ASC,
        f.id ASC
    ) AS id_canonico
  FROM public.fornecedores f
  WHERE public.normalizar_nome_fornecedor(f.nome) <> ''
)
UPDATE public.ordens_compra oc
SET id_fornecedor = fc.id_canonico
FROM fornecedor_canonico fc
WHERE oc.id_fornecedor = fc.id
  AND fc.id <> fc.id_canonico;

-- Remove fornecedores duplicados depois que aliases e referências foram preservados.
WITH fornecedor_canonico AS (
  SELECT
    f.id,
    first_value(f.id) OVER (
      PARTITION BY public.normalizar_nome_fornecedor(f.nome)
      ORDER BY
        (f.dados_tiny IS NOT NULL) DESC,
        (NULLIF(f.cpf_cnpj, '') IS NOT NULL) DESC,
        f.criado_em ASC,
        f.id ASC
    ) AS id_canonico
  FROM public.fornecedores f
  WHERE public.normalizar_nome_fornecedor(f.nome) <> ''
)
DELETE FROM public.fornecedores f
USING fornecedor_canonico fc
WHERE f.id = fc.id
  AND fc.id <> fc.id_canonico;

CREATE UNIQUE INDEX IF NOT EXISTS fornecedores_nome_normalizado_unico
  ON public.fornecedores (public.normalizar_nome_fornecedor(nome))
  WHERE public.normalizar_nome_fornecedor(nome) <> '';

ALTER TABLE public.ordens_compra
  ADD COLUMN IF NOT EXISTS codigo_pelo_fornecedor text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ordens_compra'
      AND column_name = 'valor_pago_original'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ordens_compra'
      AND column_name = 'valor_custo'
  ) THEN
    ALTER TABLE public.ordens_compra
      RENAME COLUMN valor_pago_original TO valor_custo;
  END IF;
END $$;

ALTER TABLE public.ordens_compra
  DROP CONSTRAINT IF EXISTS ordens_compra_moeda_compra_check;

ALTER TABLE public.ordens_compra
  ADD CONSTRAINT ordens_compra_moeda_compra_check
  CHECK (moeda_compra IN ('EUR', 'BRL'));

ALTER TABLE public.ordens_compra
  DROP CONSTRAINT IF EXISTS ordens_compra_valor_custo_positivo;

ALTER TABLE public.ordens_compra
  ADD CONSTRAINT ordens_compra_valor_custo_positivo
  CHECK (valor_custo >= 0);

CREATE TABLE IF NOT EXISTS public.itens_estoque_ordem_compra_excecoes (
  id_item_estoque uuid PRIMARY KEY REFERENCES public.itens_estoque(id) ON DELETE CASCADE,
  sku text NOT NULL,
  nome_produto text NOT NULL,
  id_tiny text,
  descricao_complementar text,
  motivo text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.itens_estoque_ordem_compra_excecoes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'itens_estoque_ordem_compra_excecoes'
      AND policyname = 'crm_authenticated_all'
  ) THEN
    CREATE POLICY crm_authenticated_all
      ON public.itens_estoque_ordem_compra_excecoes
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

WITH candidatos AS (
  SELECT
    ie.id,
    ie.id_fornecedor,
    ie.codigo_fornecedor,
    NULLIF(trim(ie.dados_tiny->>'descricao_complementar'), '') AS descricao_complementar,
    NULLIF(trim(ie.dados_tiny->>'codigo_pelo_fornecedor'), '') AS codigo_pelo_fornecedor,
    regexp_match(
      ie.dados_tiny->>'descricao_complementar',
      '(^|[^A-Za-z0-9])([ERer])[[:space:]]*([0-9]+(?:[.,][0-9]+)?)($|[^A-Za-z0-9])'
    ) AS match_custo
  FROM public.itens_estoque ie
  WHERE ie.id_tiny IS NOT NULL
    AND ie.id_ordem_compra IS NULL
    AND ie.dados_tiny IS NOT NULL
), parsed AS (
  SELECT
    id,
    id_fornecedor,
    COALESCE(codigo_pelo_fornecedor, NULLIF(trim(codigo_fornecedor), '')) AS codigo_pelo_fornecedor,
    CASE upper(match_custo[2])
      WHEN 'E' THEN 'EUR'
      WHEN 'R' THEN 'BRL'
      ELSE NULL
    END AS moeda_compra,
    replace(match_custo[3], ',', '.')::numeric AS valor_custo
  FROM candidatos
  WHERE match_custo IS NOT NULL
)
INSERT INTO public.ordens_compra (
  id_item_estoque,
  id_fornecedor,
  data_compra,
  moeda_compra,
  valor_custo,
  valor_pago_real,
  valor_pago_euro,
  codigo_pelo_fornecedor,
  observacoes
)
SELECT
  p.id,
  p.id_fornecedor,
  CURRENT_DATE,
  p.moeda_compra,
  p.valor_custo,
  CASE WHEN p.moeda_compra = 'BRL' THEN p.valor_custo ELSE NULL END,
  CASE WHEN p.moeda_compra = 'EUR' THEN p.valor_custo ELSE NULL END,
  p.codigo_pelo_fornecedor,
  'Criada automaticamente a partir de itens_estoque.dados_tiny'
FROM parsed p
WHERE p.moeda_compra IS NOT NULL
  AND p.valor_custo IS NOT NULL
ON CONFLICT (id_item_estoque) DO UPDATE
SET
  id_fornecedor = EXCLUDED.id_fornecedor,
  moeda_compra = EXCLUDED.moeda_compra,
  valor_custo = EXCLUDED.valor_custo,
  valor_pago_real = EXCLUDED.valor_pago_real,
  valor_pago_euro = EXCLUDED.valor_pago_euro,
  codigo_pelo_fornecedor = EXCLUDED.codigo_pelo_fornecedor,
  atualizado_em = now();

UPDATE public.itens_estoque ie
SET id_ordem_compra = oc.id
FROM public.ordens_compra oc
WHERE oc.id_item_estoque = ie.id
  AND ie.id_ordem_compra IS NULL;

INSERT INTO public.itens_estoque_ordem_compra_excecoes (
  id_item_estoque,
  sku,
  nome_produto,
  id_tiny,
  descricao_complementar,
  motivo
)
SELECT
  ie.id,
  ie.sku,
  ie.nome_produto,
  ie.id_tiny,
  NULLIF(trim(ie.dados_tiny->>'descricao_complementar'), ''),
  CASE
    WHEN ie.dados_tiny IS NULL THEN 'Item sem dados_tiny.'
    WHEN NULLIF(trim(ie.dados_tiny->>'descricao_complementar'), '') IS NULL THEN 'descricao_complementar vazia.'
    ELSE 'descricao_complementar sem padrão E/R + valor.'
  END
FROM public.itens_estoque ie
WHERE ie.id_tiny IS NOT NULL
  AND ie.id_ordem_compra IS NULL
ON CONFLICT (id_item_estoque) DO UPDATE
SET
  sku = EXCLUDED.sku,
  nome_produto = EXCLUDED.nome_produto,
  id_tiny = EXCLUDED.id_tiny,
  descricao_complementar = EXCLUDED.descricao_complementar,
  motivo = EXCLUDED.motivo;

ALTER TABLE public.itens_estoque
  DROP COLUMN IF EXISTS valor_pago_original;

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
  text
);

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
  p_cambio_compra_para_real numeric DEFAULT NULL::numeric,
  p_cambio_compra_para_euro numeric DEFAULT NULL::numeric,
  p_valor_pago_real numeric DEFAULT NULL::numeric,
  p_valor_pago_euro numeric DEFAULT NULL::numeric,
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
    cambio_compra_para_real,
    cambio_compra_para_euro,
    valor_pago_real,
    valor_pago_euro,
    codigo_pelo_fornecedor,
    observacoes
  ) VALUES (
    v_item_id,
    p_id_fornecedor,
    coalesce(p_data_compra, CURRENT_DATE),
    v_moeda,
    p_valor_custo,
    p_cambio_compra_para_real,
    p_cambio_compra_para_euro,
    p_valor_pago_real,
    p_valor_pago_euro,
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
  numeric,
  numeric,
  numeric,
  numeric,
  text,
  text
) TO authenticated;
