-- Substitui aguardando_chegada por em_processo_de_compra e adiciona transferencia.
-- PostgreSQL não tem ALTER TYPE ... DROP VALUE para enums.
-- Os valores antigos são migrados renomeando o rótulo do enum (mantém OIDs nas linhas).

ALTER TYPE public.status_item_enum ADD VALUE IF NOT EXISTS 'transferencia';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'status_item_enum'
      AND e.enumlabel = 'aguardando_chegada'
  ) THEN
    EXECUTE $ddl$ALTER TYPE public.status_item_enum RENAME VALUE 'aguardando_chegada' TO 'em_processo_de_compra'$ddl$;
  END IF;
END $$;
