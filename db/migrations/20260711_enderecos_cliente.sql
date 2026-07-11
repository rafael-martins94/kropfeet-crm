-- Enderecos multiplos por cliente.
-- Migra enderecos atuais de clientes e de dados_tiny das vendas.

CREATE TYPE public.endereco_cliente_tipo_enum AS ENUM (
  'principal',
  'entrega',
  'cobranca'
);

CREATE TABLE public.enderecos_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_cliente uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  rotulo text,
  tipo public.endereco_cliente_tipo_enum NOT NULL DEFAULT 'entrega',
  principal boolean NOT NULL DEFAULT false,
  cep text,
  endereco text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  pais text DEFAULT 'Brasil',
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enderecos_cliente_id_cliente_idx
  ON public.enderecos_cliente (id_cliente);

CREATE UNIQUE INDEX IF NOT EXISTS enderecos_cliente_um_principal_por_cliente_idx
  ON public.enderecos_cliente (id_cliente)
  WHERE principal = true;

-- 1. Migra endereco atual de clientes como principal.
INSERT INTO public.enderecos_cliente (
  id_cliente, rotulo, tipo, principal,
  cep, endereco, numero, complemento, bairro, cidade, uf, pais
)
SELECT
  c.id,
  'Principal',
  'principal'::public.endereco_cliente_tipo_enum,
  true,
  NULLIF(TRIM(c.cep), ''),
  NULLIF(TRIM(c.endereco), ''),
  NULLIF(TRIM(c.numero), ''),
  NULLIF(TRIM(c.complemento), ''),
  NULLIF(TRIM(c.bairro), ''),
  NULLIF(TRIM(c.cidade), ''),
  NULLIF(TRIM(c.uf), ''),
  COALESCE(NULLIF(TRIM(c.pais), ''), 'Brasil')
FROM public.clientes c
WHERE NULLIF(TRIM(c.cep), '') IS NOT NULL
   OR NULLIF(TRIM(c.endereco), '') IS NOT NULL
   OR NULLIF(TRIM(c.cidade), '') IS NOT NULL;

-- 2. Importa enderecos distintos dos pedidos Tiny (quando diferem do principal).
WITH fonte AS (
  SELECT DISTINCT ON (
    v.id_cliente,
    lower(coalesce(nullif(trim(v.dados_tiny->'cliente'->>'cep'), ''), '')),
    lower(coalesce(nullif(trim(v.dados_tiny->'cliente'->>'endereco'), ''), '')),
    lower(coalesce(nullif(trim(v.dados_tiny->'cliente'->>'numero'), ''), ''))
  )
    v.id_cliente,
    v.dados_tiny->'cliente' AS d
  FROM public.vendas v
  WHERE v.id_cliente IS NOT NULL
    AND v.dados_tiny->'cliente' IS NOT NULL
    AND (
      NULLIF(TRIM(v.dados_tiny->'cliente'->>'cep'), '') IS NOT NULL
      OR NULLIF(TRIM(v.dados_tiny->'cliente'->>'endereco'), '') IS NOT NULL
      OR NULLIF(TRIM(v.dados_tiny->'cliente'->>'cidade'), '') IS NOT NULL
    )
  ORDER BY
    v.id_cliente,
    lower(coalesce(nullif(trim(v.dados_tiny->'cliente'->>'cep'), ''), '')),
    lower(coalesce(nullif(trim(v.dados_tiny->'cliente'->>'endereco'), ''), '')),
    lower(coalesce(nullif(trim(v.dados_tiny->'cliente'->>'numero'), ''), '')),
    v.data_pedido DESC NULLS LAST
)
INSERT INTO public.enderecos_cliente (
  id_cliente, rotulo, tipo, principal,
  cep, endereco, numero, complemento, bairro, cidade, uf, pais
)
SELECT
  f.id_cliente,
  'Entrega Tiny',
  'entrega'::public.endereco_cliente_tipo_enum,
  false,
  NULLIF(TRIM(f.d->>'cep'), ''),
  NULLIF(TRIM(f.d->>'endereco'), ''),
  NULLIF(TRIM(f.d->>'numero'), ''),
  NULLIF(TRIM(f.d->>'complemento'), ''),
  NULLIF(TRIM(f.d->>'bairro'), ''),
  NULLIF(TRIM(f.d->>'cidade'), ''),
  NULLIF(TRIM(f.d->>'uf'), ''),
  'Brasil'
FROM fonte f
WHERE NOT EXISTS (
  SELECT 1
  FROM public.enderecos_cliente e
  WHERE e.id_cliente = f.id_cliente
    AND lower(coalesce(e.cep, '')) = lower(coalesce(nullif(trim(f.d->>'cep'), ''), ''))
    AND lower(coalesce(e.endereco, '')) = lower(coalesce(nullif(trim(f.d->>'endereco'), ''), ''))
    AND lower(coalesce(e.numero, '')) = lower(coalesce(nullif(trim(f.d->>'numero'), ''), ''))
);

-- 3. Vincula endereco usado em cada venda (quando houver match).
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS id_endereco_cliente uuid
  REFERENCES public.enderecos_cliente(id) ON DELETE SET NULL;

UPDATE public.vendas v
SET id_endereco_cliente = e.id
FROM public.enderecos_cliente e
WHERE v.id_cliente = e.id_cliente
  AND v.dados_tiny->'cliente' IS NOT NULL
  AND lower(coalesce(e.cep, '')) = lower(coalesce(nullif(trim(v.dados_tiny->'cliente'->>'cep'), ''), ''))
  AND lower(coalesce(e.endereco, '')) = lower(coalesce(nullif(trim(v.dados_tiny->'cliente'->>'endereco'), ''), ''))
  AND lower(coalesce(e.numero, '')) = lower(coalesce(nullif(trim(v.dados_tiny->'cliente'->>'numero'), ''), ''));

CREATE INDEX IF NOT EXISTS vendas_id_endereco_cliente_idx
  ON public.vendas (id_endereco_cliente);

-- 4. Remove colunas de endereco da tabela clientes (agora em enderecos_cliente).
ALTER TABLE public.clientes
  DROP COLUMN IF EXISTS cep,
  DROP COLUMN IF EXISTS endereco,
  DROP COLUMN IF EXISTS numero,
  DROP COLUMN IF EXISTS complemento,
  DROP COLUMN IF EXISTS bairro,
  DROP COLUMN IF EXISTS cidade,
  DROP COLUMN IF EXISTS uf;

-- 5. RLS e trigger.
ALTER TABLE public.enderecos_cliente ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'enderecos_cliente'
      AND policyname = 'crm_authenticated_all'
  ) THEN
    CREATE POLICY crm_authenticated_all ON public.enderecos_cliente
      FOR ALL TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DROP TRIGGER IF EXISTS enderecos_cliente_atualizado_em ON public.enderecos_cliente;
CREATE TRIGGER enderecos_cliente_atualizado_em
BEFORE UPDATE ON public.enderecos_cliente
FOR EACH ROW
EXECUTE FUNCTION public.atualizar_atualizado_em();
