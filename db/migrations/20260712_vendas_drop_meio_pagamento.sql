-- Meio de pagamento passa a existir apenas em parcelas_venda.
-- Em multiplas o Tiny quase nunca grava meio no cabecalho; o detalhe e por parcela.

ALTER TABLE public.vendas
  DROP COLUMN IF EXISTS meio_pagamento;
