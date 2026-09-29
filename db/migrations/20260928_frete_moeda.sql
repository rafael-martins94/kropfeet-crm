-- O frete pode estar em outra moeda que a do pedido. Ex.: pedido em BRL e frete em EUR.

ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS moeda_frete text;

ALTER TABLE public.vendas
  DROP CONSTRAINT IF EXISTS vendas_moeda_frete_check;

ALTER TABLE public.vendas
  ADD CONSTRAINT vendas_moeda_frete_check
  CHECK (moeda_frete IS NULL OR moeda_frete IN ('EUR', 'BRL'));

COMMENT ON COLUMN public.vendas.moeda_frete IS
  'Moeda do frete, independente da moeda do pedido.';

UPDATE public.vendas AS v
SET moeda_frete = CASE
  WHEN EXISTS (
    SELECT 1
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v.marcadores) = 'array' THEN v.marcadores ELSE '[]'::jsonb END) AS m(elem)
    WHERE btrim(m.elem->>'descricao') ~ '€'
       OR btrim(m.elem->>'descricao') ~* '[[:space:]]eur([^[:alnum:]]|$)|frete eu'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v.marcadores) = 'array' THEN v.marcadores ELSE '[]'::jsonb END) AS m(elem)
    WHERE btrim(m.elem->>'descricao') ~* 'frete|sedex'
      AND btrim(m.elem->>'descricao') ~ 'R\$'
  ) THEN 'EUR'
  WHEN EXISTS (
    SELECT 1
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v.marcadores) = 'array' THEN v.marcadores ELSE '[]'::jsonb END) AS m(elem)
    WHERE btrim(m.elem->>'descricao') ~* 'frete|sedex'
      AND btrim(m.elem->>'descricao') ~ 'R\$'
  ) THEN 'BRL'
  ELSE v.moeda_venda
END
WHERE v.frete_status <> 'nao_aplicavel'
   OR coalesce(v.valor_frete, 0) > 0;
