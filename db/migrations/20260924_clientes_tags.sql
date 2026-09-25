-- Tags do cliente, no mesmo formato das tags da ordem de venda.
-- marcadores_texto existe só para filtrar por nome da tag.

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS marcadores jsonb;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS marcadores_texto text
  GENERATED ALWAYS AS (marcadores::text) STORED;

COMMENT ON COLUMN public.clientes.marcadores IS
  'Tags do cliente: [{ descricao, cor }].';

COMMENT ON COLUMN public.clientes.marcadores_texto IS
  'Serialização textual de marcadores (jsonb) para busca por tag.';

CREATE INDEX IF NOT EXISTS clientes_marcadores_texto_idx
  ON public.clientes USING gin (marcadores_texto gin_trgm_ops);
