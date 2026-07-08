-- Remove preços em BRL (importados do Tiny). Itens permanecem; só limpa preço/moeda.

DELETE FROM public.itens_estoque_preco_historico
WHERE moeda_nova = 'BRL'
   OR moeda_anterior = 'BRL';

UPDATE public.itens_estoque
SET
  preco_venda = NULL,
  moeda_venda = NULL
WHERE moeda_venda = 'BRL';
