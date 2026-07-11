-- Completa cadastro de clientes com dados do Tiny (dados_tiny->cliente nas vendas).
-- Remove UF da ordem de venda e adiciona regiao_venda (brasil/europa/outros).

-- 1. Novas colunas em clientes (espelhando fornecedores).
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS codigo_tiny text,
  ADD COLUMN IF NOT EXISTS fantasia text,
  ADD COLUMN IF NOT EXISTS tipo_pessoa public.tipo_pessoa_enum,
  ADD COLUMN IF NOT EXISTS cpf_cnpj text,
  ADD COLUMN IF NOT EXISTS inscricao_estadual text,
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS uf text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS dados_tiny jsonb;

CREATE INDEX IF NOT EXISTS clientes_cpf_cnpj_idx ON public.clientes (cpf_cnpj);
CREATE INDEX IF NOT EXISTS clientes_nome_idx ON public.clientes (nome);

-- 2. Regiao da venda (substitui UF na ordem).
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS regiao_venda public.tipo_regiao_enum NOT NULL DEFAULT 'brasil';

-- 3. Migra UF da venda para o cliente (antes de remover a coluna).
UPDATE public.clientes c
SET uf = COALESCE(NULLIF(TRIM(c.uf), ''), NULLIF(TRIM(v.uf), ''))
FROM public.vendas v
WHERE v.id_cliente = c.id
  AND v.uf IS NOT NULL
  AND NULLIF(TRIM(v.uf), '') IS NOT NULL
  AND (c.uf IS NULL OR TRIM(c.uf) = '');

-- 4. Preenche clientes a partir de dados_tiny->cliente (pedido mais recente por cliente).
WITH fonte AS (
  SELECT DISTINCT ON (v.id_cliente)
    v.id_cliente,
    v.dados_tiny->'cliente' AS d
  FROM public.vendas v
  WHERE v.id_cliente IS NOT NULL
    AND v.dados_tiny->'cliente' IS NOT NULL
  ORDER BY v.id_cliente, v.data_pedido DESC NULLS LAST, v.criado_em DESC
)
UPDATE public.clientes c
SET
  codigo_tiny = NULLIF(TRIM(fonte.d->>'codigo'), ''),
  fantasia = NULLIF(TRIM(fonte.d->>'nome_fantasia'), ''),
  tipo_pessoa = CASE UPPER(TRIM(fonte.d->>'tipo_pessoa'))
    WHEN 'F' THEN 'fisica'::public.tipo_pessoa_enum
    WHEN 'J' THEN 'juridica'::public.tipo_pessoa_enum
    ELSE c.tipo_pessoa
  END,
  cpf_cnpj = NULLIF(TRIM(fonte.d->>'cpf_cnpj'), ''),
  inscricao_estadual = NULLIF(TRIM(fonte.d->>'ie'), ''),
  rg = NULLIF(TRIM(fonte.d->>'rg'), ''),
  endereco = NULLIF(TRIM(fonte.d->>'endereco'), ''),
  numero = NULLIF(TRIM(fonte.d->>'numero'), ''),
  complemento = NULLIF(TRIM(fonte.d->>'complemento'), ''),
  bairro = NULLIF(TRIM(fonte.d->>'bairro'), ''),
  cidade = NULLIF(TRIM(fonte.d->>'cidade'), ''),
  uf = COALESCE(NULLIF(TRIM(fonte.d->>'uf'), ''), NULLIF(TRIM(c.uf), '')),
  cep = NULLIF(TRIM(fonte.d->>'cep'), ''),
  email = COALESCE(NULLIF(TRIM(fonte.d->>'email'), ''), NULLIF(TRIM(c.email), '')),
  telefone = COALESCE(NULLIF(TRIM(fonte.d->>'fone'), ''), NULLIF(TRIM(c.telefone), '')),
  pais = COALESCE(NULLIF(TRIM(c.pais), ''), 'Brasil'),
  dados_tiny = fonte.d,
  atualizado_em = now()
FROM fonte
WHERE c.id = fonte.id_cliente;

-- 5. Todas as vendas atuais sao Brasil.
UPDATE public.vendas SET regiao_venda = 'brasil' WHERE regiao_venda IS DISTINCT FROM 'brasil';

-- 6. Remove UF da ordem de venda.
ALTER TABLE public.vendas DROP COLUMN IF EXISTS uf;

CREATE INDEX IF NOT EXISTS vendas_regiao_venda_idx ON public.vendas (regiao_venda);
