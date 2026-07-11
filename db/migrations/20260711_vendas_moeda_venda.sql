-- Moeda da ordem de venda derivada da região (fonte da verdade).
-- brasil/outros → BRL | europa → EUR

ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS moeda_venda text
  GENERATED ALWAYS AS (
    CASE regiao_venda
      WHEN 'europa'::public.tipo_regiao_enum THEN 'EUR'
      ELSE 'BRL'
    END
  ) STORED;

COMMENT ON COLUMN public.vendas.moeda_venda IS
  'Moeda dos valores da ordem, derivada de regiao_venda (europa=EUR, demais=BRL).';

CREATE INDEX IF NOT EXISTS vendas_moeda_venda_idx ON public.vendas (moeda_venda);
