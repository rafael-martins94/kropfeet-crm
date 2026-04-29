-- Remove condição do item (sempre novo na operação); enum só era usado nesta coluna.

ALTER TABLE public.itens_estoque DROP COLUMN IF EXISTS condicao_item;

DROP TYPE IF EXISTS public.condicao_item_enum;
