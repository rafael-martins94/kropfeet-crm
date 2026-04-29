-- Rode no SQL Editor do Supabase (ou psql) antes de usar o script sync:tiny:status-estoque.
-- Acrescenta o status "fora de estoque" ao enum de itens.

ALTER TYPE public.status_item_enum ADD VALUE IF NOT EXISTS 'fora_de_estoque';
