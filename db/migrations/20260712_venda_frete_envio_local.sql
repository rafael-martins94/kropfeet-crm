-- Campos operacionais da ordem de venda: frete (status/data), codigo adquirente,
-- forma de envio cadastravel e local de venda.

CREATE TYPE public.frete_status_enum AS ENUM (
  'nao_aplicavel',
  'pendente',
  'pago'
);

CREATE TYPE public.local_venda_enum AS ENUM (
  'galeria',
  'online'
);

CREATE TABLE IF NOT EXISTS public.formas_envio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS formas_envio_nome_unico_idx
  ON public.formas_envio (lower(trim(nome)));

ALTER TABLE public.formas_envio ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'formas_envio'
      AND policyname = 'crm_authenticated_all'
  ) THEN
    CREATE POLICY crm_authenticated_all ON public.formas_envio
      FOR ALL TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

INSERT INTO public.formas_envio (nome)
SELECT n
FROM unnest(ARRAY[
  'CTT',
  'Bagagem pessoal',
  'Terceiros',
  'Retirada pessoalmente'
]) AS t(n)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.formas_envio f
  WHERE lower(trim(f.nome)) = lower(trim(n))
);

ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS frete_status public.frete_status_enum
    NOT NULL DEFAULT 'nao_aplicavel',
  ADD COLUMN IF NOT EXISTS data_pagamento_frete date,
  ADD COLUMN IF NOT EXISTS codigo_venda_adquirente text,
  ADD COLUMN IF NOT EXISTS id_forma_envio uuid
    REFERENCES public.formas_envio(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS local_venda public.local_venda_enum;

CREATE INDEX IF NOT EXISTS vendas_id_forma_envio_idx
  ON public.vendas (id_forma_envio);

CREATE INDEX IF NOT EXISTS vendas_local_venda_idx
  ON public.vendas (local_venda);

-- Pedidos com frete > 0 e sem status definido ficam pendentes.
UPDATE public.vendas
SET frete_status = 'pendente'
WHERE coalesce(valor_frete, 0) > 0
  AND frete_status = 'nao_aplicavel';
