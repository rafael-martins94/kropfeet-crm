-- id_tiny do contato no Tiny ERP, para upsert confiavel de clientes.

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS id_tiny text;

CREATE UNIQUE INDEX IF NOT EXISTS clientes_id_tiny_uidx
  ON public.clientes (id_tiny)
  WHERE id_tiny IS NOT NULL;

COMMENT ON COLUMN public.clientes.id_tiny IS
  'ID do contato no Tiny ERP (contato.obter.php).';
