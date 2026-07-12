-- Vendedores da equipe comercial + vínculo na ordem de venda.

CREATE TABLE IF NOT EXISTS public.vendedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS vendedores_nome_unico_idx
  ON public.vendedores (lower(trim(nome)));

ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS id_vendedor uuid
    REFERENCES public.vendedores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS vendas_id_vendedor_idx
  ON public.vendas (id_vendedor);

ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'vendedores'
      AND policyname = 'crm_authenticated_all'
  ) THEN
    CREATE POLICY crm_authenticated_all ON public.vendedores
      FOR ALL TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

INSERT INTO public.vendedores (nome)
SELECT n
FROM unnest(ARRAY['Karina', 'Gustavo', 'Gabriel', 'Priscila']) AS t(n)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.vendedores v
  WHERE lower(trim(v.nome)) = lower(trim(n))
);
