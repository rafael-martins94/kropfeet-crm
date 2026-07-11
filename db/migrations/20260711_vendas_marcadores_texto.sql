-- Texto indexável das tags para busca parcial (ilike) via PostgREST.
-- jsonb não aceita ~~*/ilike diretamente.

ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS marcadores_texto text
  GENERATED ALWAYS AS (marcadores::text) STORED;

COMMENT ON COLUMN public.vendas.marcadores_texto IS
  'Serialização textual de marcadores (jsonb) para busca por tag.';

CREATE INDEX IF NOT EXISTS vendas_marcadores_texto_idx
  ON public.vendas USING gin (marcadores_texto gin_trgm_ops);
