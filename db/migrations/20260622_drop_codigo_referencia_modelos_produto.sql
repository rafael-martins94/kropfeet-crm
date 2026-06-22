-- Remove coluna legada codigo_referencia (0 registros preenchidos em 757 modelos).
-- O índice parcial modelos_produto_codigo_referencia_unico é removido junto com a coluna.

ALTER TABLE public.modelos_produto
  DROP COLUMN IF EXISTS codigo_referencia;
