-- Ordens de venda (pedidos importados do Tiny).
-- As tabelas vendas/itens_venda estavam vazias e foram recriadas com os campos
-- pertinentes do pedido do Tiny. Novo enum de status com 6 valores.

-- 1. Remove estruturas antigas (tabelas vazias).
ALTER TABLE IF EXISTS public.movimentacoes_estoque
  DROP CONSTRAINT IF EXISTS movimentacoes_estoque_id_venda_fkey;

DROP TABLE IF EXISTS public.itens_venda CASCADE;
DROP TABLE IF EXISTS public.vendas CASCADE;
DROP TYPE IF EXISTS public.status_venda_enum;

-- 2. Enum de status da ordem de venda.
CREATE TYPE public.status_venda_enum AS ENUM (
  'em_aberto',
  'pago',
  'preparando_envio',
  'enviado',
  'finalizado',
  'cancelado'
);

-- 3. Tabela de ordens de venda (cabecalho do pedido Tiny).
CREATE TABLE public.vendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_tiny text UNIQUE,
  numero text,
  numero_ecommerce text,
  id_cliente uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  nome_cliente text,
  uf text,
  data_pedido timestamptz,
  data_prevista date,
  data_faturamento date,
  data_envio date,
  data_entrega date,
  status_venda public.status_venda_enum NOT NULL DEFAULT 'em_aberto',
  situacao_tiny text,
  total_produtos numeric NOT NULL DEFAULT 0,
  valor_frete numeric NOT NULL DEFAULT 0,
  valor_desconto numeric NOT NULL DEFAULT 0,
  outras_despesas numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  forma_pagamento text,
  meio_pagamento text,
  deposito text,
  codigo_rastreamento text,
  url_rastreamento text,
  obs text,
  obs_interna text,
  marcadores jsonb,
  dados_tiny jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- 4. Itens da ordem de venda.
CREATE TABLE public.itens_venda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_venda uuid NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  id_item_estoque uuid REFERENCES public.itens_estoque(id) ON DELETE SET NULL,
  id_produto_tiny text,
  codigo text,
  descricao text,
  quantidade numeric NOT NULL DEFAULT 1,
  valor_unitario numeric NOT NULL DEFAULT 0,
  dados_tiny jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- 5. Recria a FK de movimentacoes_estoque apontando para a nova tabela.
ALTER TABLE public.movimentacoes_estoque
  ADD CONSTRAINT movimentacoes_estoque_id_venda_fkey
  FOREIGN KEY (id_venda) REFERENCES public.vendas(id) ON DELETE SET NULL;

-- 6. Indices.
CREATE INDEX IF NOT EXISTS vendas_id_cliente_idx ON public.vendas (id_cliente);
CREATE INDEX IF NOT EXISTS vendas_status_venda_idx ON public.vendas (status_venda);
CREATE INDEX IF NOT EXISTS vendas_data_pedido_idx ON public.vendas (data_pedido DESC);
CREATE INDEX IF NOT EXISTS itens_venda_id_venda_idx ON public.itens_venda (id_venda);
CREATE INDEX IF NOT EXISTS itens_venda_id_item_estoque_idx ON public.itens_venda (id_item_estoque);

-- 7. RLS.
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_venda ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'vendas' AND policyname = 'crm_authenticated_all'
  ) THEN
    CREATE POLICY crm_authenticated_all ON public.vendas
      FOR ALL TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'itens_venda' AND policyname = 'crm_authenticated_all'
  ) THEN
    CREATE POLICY crm_authenticated_all ON public.itens_venda
      FOR ALL TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 8. Trigger de atualizado_em (funcao ja existe no schema).
DROP TRIGGER IF EXISTS vendas_atualizado_em ON public.vendas;
CREATE TRIGGER vendas_atualizado_em
BEFORE UPDATE ON public.vendas
FOR EACH ROW
EXECUTE FUNCTION public.atualizar_atualizado_em();
