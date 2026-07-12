-- Parcelas normalizadas das ordens de venda (origem Tiny + CRM manual).
-- Regra de pago: forma_pagamento = 'contareceber' => nao pago; demais => pago.

CREATE TABLE IF NOT EXISTS public.parcelas_venda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_venda uuid NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  numero integer NOT NULL,
  data_vencimento date,
  valor numeric NOT NULL DEFAULT 0,
  forma_pagamento text,
  meio_pagamento text,
  dias integer,
  obs text,
  pago boolean NOT NULL DEFAULT false,
  dados_tiny jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parcelas_venda_numero_positivo CHECK (numero > 0),
  CONSTRAINT parcelas_venda_venda_numero_unique UNIQUE (id_venda, numero)
);

CREATE INDEX IF NOT EXISTS parcelas_venda_id_venda_idx
  ON public.parcelas_venda (id_venda);

CREATE INDEX IF NOT EXISTS parcelas_venda_pago_idx
  ON public.parcelas_venda (pago);

ALTER TABLE public.parcelas_venda ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'parcelas_venda'
      AND policyname = 'crm_authenticated_all'
  ) THEN
    CREATE POLICY crm_authenticated_all ON public.parcelas_venda
      FOR ALL TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DROP TRIGGER IF EXISTS parcelas_venda_atualizado_em ON public.parcelas_venda;
CREATE TRIGGER parcelas_venda_atualizado_em
BEFORE UPDATE ON public.parcelas_venda
FOR EACH ROW
EXECUTE FUNCTION public.atualizar_atualizado_em();

-- Backfill a partir de dados_tiny.parcelas (estrutura Tiny: [{ parcela: {...} }]).
INSERT INTO public.parcelas_venda (
  id_venda,
  numero,
  data_vencimento,
  valor,
  forma_pagamento,
  meio_pagamento,
  dias,
  obs,
  pago,
  dados_tiny
)
SELECT
  v.id AS id_venda,
  ord.ordinality::integer AS numero,
  CASE
    WHEN NULLIF(trim(p.parcela->>'data'), '') ~ '^\d{2}/\d{2}/\d{4}$'
      THEN to_date(trim(p.parcela->>'data'), 'DD/MM/YYYY')
    WHEN NULLIF(trim(p.parcela->>'data'), '') ~ '^\d{4}-\d{2}-\d{2}'
      THEN (trim(p.parcela->>'data'))::date
    ELSE NULL
  END AS data_vencimento,
  COALESCE(
    NULLIF(regexp_replace(trim(COALESCE(p.parcela->>'valor', '')), ',', '.', 'g'), '')::numeric,
    0
  ) AS valor,
  NULLIF(trim(p.parcela->>'forma_pagamento'), '') AS forma_pagamento,
  NULLIF(trim(p.parcela->>'meio_pagamento'), '') AS meio_pagamento,
  CASE
    WHEN NULLIF(trim(p.parcela->>'dias'), '') ~ '^-?\d+(\.\d+)?$'
      THEN trunc(NULLIF(trim(p.parcela->>'dias'), '')::numeric)::integer
    ELSE NULL
  END AS dias,
  NULLIF(trim(p.parcela->>'obs'), '') AS obs,
  lower(COALESCE(NULLIF(trim(p.parcela->>'forma_pagamento'), ''), '')) <> 'contareceber' AS pago,
  p.parcela AS dados_tiny
FROM public.vendas v
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(v.dados_tiny->'parcelas', '[]'::jsonb))
  WITH ORDINALITY AS ord(elem, ordinality)
CROSS JOIN LATERAL (
  SELECT
    CASE
      WHEN jsonb_typeof(ord.elem->'parcela') = 'object' THEN ord.elem->'parcela'
      WHEN jsonb_typeof(ord.elem) = 'object' THEN ord.elem
      ELSE '{}'::jsonb
    END AS parcela
) p
WHERE v.dados_tiny IS NOT NULL
  AND jsonb_typeof(v.dados_tiny->'parcelas') = 'array'
  AND jsonb_array_length(v.dados_tiny->'parcelas') > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.parcelas_venda pv WHERE pv.id_venda = v.id
  );
