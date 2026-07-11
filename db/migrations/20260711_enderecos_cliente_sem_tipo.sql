-- Remove coluna tipo de enderecos_cliente; rotulo ja cobre essa informacao.

ALTER TABLE public.enderecos_cliente
  DROP COLUMN IF EXISTS tipo;

DROP TYPE IF EXISTS public.endereco_cliente_tipo_enum;
