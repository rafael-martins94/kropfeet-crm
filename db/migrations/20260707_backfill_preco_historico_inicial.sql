-- Primeiro registro de histórico para itens que já tinham preço de venda
-- antes do módulo de histórico existir (importação/cadastro inicial de hoje).
-- preco_anterior e moeda_anterior ficam NULL — foi o primeiro valor.

INSERT INTO public.itens_estoque_preco_historico (
  id_item_estoque,
  preco_anterior,
  moeda_anterior,
  preco_novo,
  moeda_nova,
  id_usuario,
  origem,
  criado_em
)
SELECT
  ie.id,
  NULL,
  NULL,
  ie.preco_venda,
  public.moeda_venda_item_estoque(ie.moeda_venda, le.tipo_regiao),
  NULL,
  'cadastro_inicial',
  ie.atualizado_em
FROM public.itens_estoque ie
LEFT JOIN public.locais_estoque le ON le.id = ie.id_local_estoque
WHERE ie.preco_venda IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.itens_estoque_preco_historico h
    WHERE h.id_item_estoque = ie.id
  );
