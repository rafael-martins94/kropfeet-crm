-- Links de pedido: seleção fechada de tênis, página pública e venda
-- somente depois da confirmação da SumUp. O preço do estoque não muda.

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS data_nascimento date;

CREATE TABLE IF NOT EXISTS public.configuracao_app (
  chave text PRIMARY KEY,
  valor text,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.links_pedido (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  instagram text NOT NULL,
  nome text,
  destino text NOT NULL,
  moeda text NOT NULL,
  conta_sumup text NOT NULL,
  mensagem_boas_vindas text,
  mensagem_compartilhar text,
  validade_horas smallint NOT NULL,
  aberto_em timestamptz,
  validade_em timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'ativo',
  id_usuario uuid,
  acessos integer NOT NULL DEFAULT 0,
  ultimo_acesso_em timestamptz,
  vendas_confirmadas integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT links_pedido_destino_check CHECK (
    (destino = 'brasil' AND moeda = 'BRL' AND conta_sumup = 'br')
    OR (destino = 'europa' AND moeda = 'EUR' AND conta_sumup = 'pt')
  ),
  CONSTRAINT links_pedido_status_check CHECK (status IN ('ativo', 'desativado')),
  CONSTRAINT links_pedido_validade_horas_check CHECK (validade_horas IN (24, 48, 72))
);

ALTER TABLE public.links_pedido
  ADD COLUMN IF NOT EXISTS validade_horas smallint,
  ADD COLUMN IF NOT EXISTS aberto_em timestamptz;

UPDATE public.links_pedido
SET
  aberto_em = CASE WHEN acessos > 0 THEN coalesce(ultimo_acesso_em, criado_em) ELSE NULL END,
  validade_em = CASE WHEN acessos = 0 THEN criado_em + interval '7 days' ELSE validade_em END,
  validade_horas = 48
WHERE validade_horas IS NULL;

ALTER TABLE public.links_pedido
  ALTER COLUMN validade_horas SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE public.links_pedido
    ADD CONSTRAINT links_pedido_validade_horas_check CHECK (validade_horas IN (24, 48, 72));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS links_pedido_criado_idx
  ON public.links_pedido (criado_em DESC);

CREATE INDEX IF NOT EXISTS links_pedido_pessoa_idx
  ON public.links_pedido (instagram, nome);

CREATE TABLE IF NOT EXISTS public.links_pedido_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_link uuid NOT NULL REFERENCES public.links_pedido (id) ON DELETE CASCADE,
  id_item_estoque uuid NOT NULL REFERENCES public.itens_estoque (id),
  id_modelo_produto uuid NOT NULL REFERENCES public.modelos_produto (id),
  preco numeric(12, 2) NOT NULL,
  moeda text NOT NULL,
  preco_original numeric(12, 2),
  moeda_original text,
  ordem integer NOT NULL DEFAULT 0,
  UNIQUE (id_link, id_item_estoque),
  CONSTRAINT links_pedido_itens_preco_check CHECK (preco > 0 AND preco <= 999999.99)
);

CREATE TABLE IF NOT EXISTS public.historico_preco_destino (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_modelo_produto uuid NOT NULL REFERENCES public.modelos_produto (id),
  moeda text NOT NULL,
  preco numeric(12, 2) NOT NULL,
  id_usuario uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT historico_preco_destino_moeda_check CHECK (moeda IN ('BRL', 'EUR')),
  CONSTRAINT historico_preco_destino_preco_check CHECK (preco > 0 AND preco <= 999999.99)
);

CREATE INDEX IF NOT EXISTS historico_preco_destino_busca_idx
  ON public.historico_preco_destino (id_modelo_produto, moeda, criado_em DESC);

CREATE TABLE IF NOT EXISTS public.links_pedido_reservas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_link uuid NOT NULL REFERENCES public.links_pedido (id),
  segredo text NOT NULL,
  id_cliente uuid REFERENCES public.clientes (id),
  id_endereco uuid REFERENCES public.enderecos_cliente (id),
  id_checkout text,
  valor numeric(12, 2) NOT NULL,
  moeda text NOT NULL,
  conta_sumup text NOT NULL,
  status text NOT NULL DEFAULT 'ativa',
  expira_em timestamptz NOT NULL,
  motivo text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT links_pedido_reservas_status_check CHECK (
    status IN ('ativa', 'confirmada', 'liberada', 'recusada')
  )
);

CREATE TABLE IF NOT EXISTS public.links_pedido_reserva_itens (
  id_reserva uuid NOT NULL REFERENCES public.links_pedido_reservas (id) ON DELETE CASCADE,
  id_item_estoque uuid NOT NULL REFERENCES public.itens_estoque (id),
  preco numeric(12, 2) NOT NULL,
  status text NOT NULL DEFAULT 'ativa',
  PRIMARY KEY (id_reserva, id_item_estoque),
  CONSTRAINT links_pedido_reserva_itens_status_check CHECK (
    status IN ('ativa', 'confirmada', 'liberada', 'recusada')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS links_pedido_reserva_item_ativa_idx
  ON public.links_pedido_reserva_itens (id_item_estoque)
  WHERE status = 'ativa';

CREATE TABLE IF NOT EXISTS public.links_pedido_vendas (
  id_link uuid NOT NULL REFERENCES public.links_pedido (id),
  id_venda uuid NOT NULL REFERENCES public.vendas (id),
  id_checkout text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id_link, id_venda)
);

CREATE UNIQUE INDEX IF NOT EXISTS links_pedido_vendas_checkout_idx
  ON public.links_pedido_vendas (id_checkout)
  WHERE id_checkout IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.avisos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  titulo text NOT NULL,
  corpo text,
  id_venda uuid,
  id_link uuid,
  lido boolean NOT NULL DEFAULT false,
  email_status text NOT NULL DEFAULT 'nao_configurado',
  email_detalhe text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT avisos_email_status_check CHECK (
    email_status IN ('nao_configurado', 'pendente', 'enviado', 'falha')
  )
);

CREATE INDEX IF NOT EXISTS avisos_nao_lidos_idx
  ON public.avisos (criado_em DESC)
  WHERE lido = false;

ALTER TABLE public.configuracao_app ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links_pedido_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_preco_destino ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links_pedido_reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links_pedido_reserva_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links_pedido_vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avisos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS config_equipe_select ON public.configuracao_app;
CREATE POLICY config_equipe_select ON public.configuracao_app
  FOR SELECT TO authenticated USING (public.is_equipe_crm());

DROP POLICY IF EXISTS config_admin_escrita ON public.configuracao_app;
CREATE POLICY config_admin_escrita ON public.configuracao_app
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS links_pedido_equipe ON public.links_pedido;
CREATE POLICY links_pedido_equipe ON public.links_pedido
  FOR ALL TO authenticated
  USING (public.is_equipe_crm())
  WITH CHECK (public.is_equipe_crm());

DROP POLICY IF EXISTS links_pedido_itens_equipe ON public.links_pedido_itens;
CREATE POLICY links_pedido_itens_equipe ON public.links_pedido_itens
  FOR ALL TO authenticated
  USING (public.is_equipe_crm())
  WITH CHECK (public.is_equipe_crm());

DROP POLICY IF EXISTS historico_preco_destino_equipe ON public.historico_preco_destino;
CREATE POLICY historico_preco_destino_equipe ON public.historico_preco_destino
  FOR SELECT TO authenticated USING (public.is_equipe_crm());

DROP POLICY IF EXISTS links_pedido_reservas_equipe ON public.links_pedido_reservas;
CREATE POLICY links_pedido_reservas_equipe ON public.links_pedido_reservas
  FOR SELECT TO authenticated USING (public.is_equipe_crm());

DROP POLICY IF EXISTS links_pedido_reserva_itens_equipe ON public.links_pedido_reserva_itens;
CREATE POLICY links_pedido_reserva_itens_equipe ON public.links_pedido_reserva_itens
  FOR SELECT TO authenticated USING (public.is_equipe_crm());

DROP POLICY IF EXISTS links_pedido_vendas_equipe ON public.links_pedido_vendas;
CREATE POLICY links_pedido_vendas_equipe ON public.links_pedido_vendas
  FOR SELECT TO authenticated USING (public.is_equipe_crm());

DROP POLICY IF EXISTS avisos_equipe_select ON public.avisos;
CREATE POLICY avisos_equipe_select ON public.avisos
  FOR SELECT TO authenticated USING (public.is_equipe_crm());

DROP POLICY IF EXISTS avisos_equipe_update ON public.avisos;
CREATE POLICY avisos_equipe_update ON public.avisos
  FOR UPDATE TO authenticated
  USING (public.is_equipe_crm())
  WITH CHECK (public.is_equipe_crm());

REVOKE ALL ON public.configuracao_app FROM anon;
REVOKE ALL ON public.links_pedido FROM anon;
REVOKE ALL ON public.links_pedido_itens FROM anon;
REVOKE ALL ON public.historico_preco_destino FROM anon;
REVOKE ALL ON public.links_pedido_reservas FROM anon;
REVOKE ALL ON public.links_pedido_reserva_itens FROM anon;
REVOKE ALL ON public.links_pedido_vendas FROM anon;
REVOKE ALL ON public.avisos FROM anon;

CREATE OR REPLACE FUNCTION public.link_pedido_cpf_valido(p_cpf text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  d text;
  i integer;
  soma integer;
  digito integer;
BEGIN
  d := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  IF char_length(d) <> 11 OR d ~ '^(\d)\1{10}$' THEN
    RETURN false;
  END IF;
  soma := 0;
  FOR i IN 1..9 LOOP
    soma := soma + substring(d, i, 1)::integer * (11 - i);
  END LOOP;
  digito := (soma * 10) % 11;
  IF digito = 10 THEN
    digito := 0;
  END IF;
  IF digito <> substring(d, 10, 1)::integer THEN
    RETURN false;
  END IF;
  soma := 0;
  FOR i IN 1..10 LOOP
    soma := soma + substring(d, i, 1)::integer * (12 - i);
  END LOOP;
  digito := (soma * 10) % 11;
  IF digito = 10 THEN
    digito := 0;
  END IF;
  RETURN digito = substring(d, 11, 1)::integer;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_pedido_item_ocupado(p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.itens_venda iv
    JOIN public.vendas v ON v.id = iv.id_venda
    WHERE iv.id_item_estoque = p_id
      AND v.status_venda <> 'cancelado'
  );
$$;

CREATE OR REPLACE FUNCTION public.link_pedido_liberar_expiradas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.links_pedido_reserva_itens ri
  SET status = 'liberada'
  FROM public.links_pedido_reservas r
  WHERE ri.id_reserva = r.id
    AND r.status = 'ativa'
    AND r.expira_em < now()
    AND ri.status = 'ativa';

  UPDATE public.links_pedido_reservas
  SET status = 'liberada', motivo = 'Reserva expirada.'
  WHERE status = 'ativa'
    AND expira_em < now();
END;
$$;

CREATE OR REPLACE FUNCTION public.link_pedido_iniciar_prazo(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.links_pedido
  SET
    aberto_em = now(),
    validade_em = now() + make_interval(hours => validade_horas),
    atualizado_em = now()
  WHERE id = p_id
    AND status = 'ativo'
    AND aberto_em IS NULL
    AND validade_em > now();
END;
$$;

DROP FUNCTION IF EXISTS public.link_pedido_criar(text, text, text, timestamptz, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.link_pedido_criar(
  p_instagram text,
  p_nome text,
  p_destino text,
  p_validade_horas integer,
  p_mensagem text,
  p_mensagem_compartilhar text,
  p_itens jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_instagram text;
  v_nome text;
  v_destino text;
  v_moeda text;
  v_conta text;
  v_mensagem text;
  v_compartilhar text;
  v_qtd integer;
  v_achados integer;
  v_id uuid;
  v_token text;
  v_bytes bytea;
  v_i integer;
  v_tentativa integer;
  v_usuario uuid;
BEGIN
  IF NOT public.is_equipe_crm() THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  v_instagram := lower(regexp_replace(btrim(coalesce(p_instagram, '')), '^@+', ''));
  IF v_instagram IS NULL OR v_instagram !~ '^[a-z0-9._]{2,40}$' THEN
    RAISE EXCEPTION 'Informe o @ do Instagram, só com letras, números, ponto ou _.';
  END IF;

  v_nome := nullif(btrim(coalesce(p_nome, '')), '');
  IF v_nome IS NOT NULL AND char_length(v_nome) > 160 THEN
    RAISE EXCEPTION 'O nome está longo demais.';
  END IF;

  v_destino := lower(btrim(coalesce(p_destino, '')));
  IF v_destino = 'brasil' THEN
    v_moeda := 'BRL';
    v_conta := 'br';
  ELSIF v_destino = 'europa' THEN
    v_moeda := 'EUR';
    v_conta := 'pt';
  ELSE
    RAISE EXCEPTION 'Escolha o destino Brasil ou Europa.';
  END IF;

  IF p_validade_horas NOT IN (24, 48, 72) THEN
    RAISE EXCEPTION 'Escolha a validade de 24, 48 ou 72 horas.';
  END IF;

  v_mensagem := nullif(btrim(coalesce(p_mensagem, '')), '');
  IF v_mensagem IS NOT NULL AND char_length(v_mensagem) > 500 THEN
    RAISE EXCEPTION 'A mensagem de boas-vindas está longa demais.';
  END IF;

  v_compartilhar := nullif(btrim(coalesce(p_mensagem_compartilhar, '')), '');
  IF v_compartilhar IS NOT NULL AND char_length(v_compartilhar) > 1000 THEN
    RAISE EXCEPTION 'A mensagem para copiar está longa demais.';
  END IF;

  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' THEN
    RAISE EXCEPTION 'Selecione ao menos um tênis.';
  END IF;
  v_qtd := jsonb_array_length(p_itens);
  IF v_qtd < 1 OR v_qtd > 40 THEN
    RAISE EXCEPTION 'Selecione de 1 a 40 tênis.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_itens) AS t(item)
    WHERE coalesce(t.item->>'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) THEN
    RAISE EXCEPTION 'Há um tênis inválido na seleção.';
  END IF;

  IF (
    SELECT count(*)
    FROM (
      SELECT lower(t.item->>'id')
      FROM jsonb_array_elements(p_itens) AS t(item)
      GROUP BY 1
      HAVING count(*) > 1
    ) AS duplicados
  ) > 0 THEN
    RAISE EXCEPTION 'O mesmo tênis foi selecionado mais de uma vez.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_itens) AS t(item)
    WHERE coalesce(t.item->>'preco', '') !~ '^[0-9]+(\.[0-9]+)?$'
       OR round((t.item->>'preco')::numeric, 2) <= 0
       OR round((t.item->>'preco')::numeric, 2) > 999999.99
  ) THEN
    RAISE EXCEPTION 'Todo tênis precisa de um preço maior que zero na moeda do destino.';
  END IF;

  PERFORM public.link_pedido_liberar_expiradas();

  PERFORM 1
  FROM public.itens_estoque ie
  WHERE ie.id IN (
    SELECT (t.item->>'id')::uuid
    FROM jsonb_array_elements(p_itens) AS t(item)
  )
  ORDER BY ie.id
  FOR UPDATE;

  SELECT count(*)
  INTO v_achados
  FROM jsonb_array_elements(p_itens) AS t(item)
  JOIN public.itens_estoque ie ON ie.id = (t.item->>'id')::uuid
  WHERE ie.status_item = 'em_estoque'
    AND NOT public.link_pedido_item_ocupado(ie.id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.links_pedido_reserva_itens ri
      JOIN public.links_pedido_reservas r ON r.id = ri.id_reserva
      WHERE ri.id_item_estoque = ie.id
        AND ri.status = 'ativa'
        AND r.status = 'ativa'
        AND r.expira_em > now()
    );

  IF v_achados IS DISTINCT FROM v_qtd THEN
    RAISE EXCEPTION 'Só é possível incluir tênis e numerações que estão em estoque.';
  END IF;

  v_usuario := auth.uid();
  FOR v_tentativa IN 1..8 LOOP
    v_bytes := gen_random_bytes(8);
    v_token := '';
    FOR v_i IN 0..7 LOOP
      v_token := v_token || substr(
        'abcdefghjkmnpqrstuvwxyz23456789',
        1 + (get_byte(v_bytes, v_i) % 32),
        1
      );
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.links_pedido WHERE token = v_token);
  END LOOP;

  IF EXISTS (SELECT 1 FROM public.links_pedido WHERE token = v_token) THEN
    RAISE EXCEPTION 'Não foi possível gerar o link. Tente de novo.';
  END IF;

  INSERT INTO public.links_pedido (
    token, instagram, nome, destino, moeda, conta_sumup,
    mensagem_boas_vindas, mensagem_compartilhar, validade_horas, aberto_em, validade_em, id_usuario
  )
  VALUES (
    v_token, v_instagram, v_nome, v_destino, v_moeda, v_conta,
    v_mensagem, v_compartilhar, p_validade_horas, NULL, now() + interval '7 days', v_usuario
  )
  RETURNING id INTO v_id;

  INSERT INTO public.links_pedido_itens (
    id_link, id_item_estoque, id_modelo_produto, preco, moeda,
    preco_original, moeda_original, ordem
  )
  SELECT
    v_id,
    ie.id,
    ie.id_modelo_produto,
    round((t.item->>'preco')::numeric, 2),
    v_moeda,
    ie.preco_venda,
    nullif(upper(btrim(coalesce(ie.moeda_venda, ''))), ''),
    t.ord::integer
  FROM jsonb_array_elements(p_itens) WITH ORDINALITY AS t(item, ord)
  JOIN public.itens_estoque ie ON ie.id = (t.item->>'id')::uuid
  ORDER BY t.ord;

  INSERT INTO public.historico_preco_destino (id_modelo_produto, moeda, preco, id_usuario)
  SELECT DISTINCT ON (ie.id_modelo_produto)
    ie.id_modelo_produto,
    v_moeda,
    round((t.item->>'preco')::numeric, 2),
    v_usuario
  FROM jsonb_array_elements(p_itens) WITH ORDINALITY AS t(item, ord)
  JOIN public.itens_estoque ie ON ie.id = (t.item->>'id')::uuid
  ORDER BY ie.id_modelo_produto, t.ord DESC;

  RETURN jsonb_build_object(
    'id', v_id,
    'token', v_token,
    'moeda', v_moeda,
    'conta_sumup', v_conta,
    'destino', v_destino
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.link_pedido_desativar(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_equipe_crm() THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  UPDATE public.links_pedido
  SET status = 'desativado', atualizado_em = now()
  WHERE id = p_id
    AND status = 'ativo';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Este link já está desativado ou não existe.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_pedido_reativar(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_equipe_crm() THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  UPDATE public.links_pedido
  SET
    aberto_em = NULL,
    validade_em = now() + interval '7 days',
    atualizado_em = now()
  WHERE id = p_id
    AND status = 'ativo'
    AND validade_em <= now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Só é possível reativar um link expirado.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_pedido_publico(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r public.links_pedido%ROWTYPE;
  v_situacao text;
  v_itens jsonb;
BEGIN
  SELECT *
  INTO r
  FROM public.links_pedido
  WHERE token = nullif(btrim(coalesce(p_token, '')), '');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('encontrado', false);
  END IF;

  PERFORM public.link_pedido_iniciar_prazo(r.id);

  UPDATE public.links_pedido
  SET acessos = acessos + 1, ultimo_acesso_em = now()
  WHERE id = r.id
  RETURNING acessos, ultimo_acesso_em, aberto_em, validade_em
  INTO r.acessos, r.ultimo_acesso_em, r.aberto_em, r.validade_em;

  IF r.status = 'desativado' THEN
    v_situacao := 'desativado';
  ELSIF r.validade_em <= now() THEN
    v_situacao := 'expirado';
  ELSE
    v_situacao := 'ativo';
  END IF;

  SELECT coalesce(jsonb_agg(linha ORDER BY (linha->>'ordem')::integer), '[]'::jsonb)
  INTO v_itens
  FROM (
    SELECT jsonb_build_object(
      'id', ie.id,
      'sku', ie.sku,
      'numeracao_br', ie.numeracao_br,
      'numeracao_eu', ie.numeracao_eu,
      'numeracao_us', ie.numeracao_us,
      'preco', li.preco,
      'moeda', li.moeda,
      'foto', img.fotos->>0,
      'fotos', coalesce(img.fotos, '[]'::jsonb),
      'origem', CASE le.tipo_regiao
        WHEN 'brasil' THEN 'Brasil'
        WHEN 'europa' THEN 'Europa'
        ELSE coalesce(le.nome, 'Estoque')
      END,
      'disponivel', ie.status_item = 'em_estoque'
        AND NOT public.link_pedido_item_ocupado(ie.id)
        AND NOT EXISTS (
          SELECT 1
          FROM public.links_pedido_reserva_itens ri
          JOIN public.links_pedido_reservas rv ON rv.id = ri.id_reserva
          WHERE ri.id_item_estoque = ie.id
            AND ri.status = 'ativa'
            AND rv.status = 'ativa'
            AND rv.expira_em > now()
        ),
      'ordem', li.ordem
    ) AS linha
    FROM public.links_pedido_itens li
    JOIN public.itens_estoque ie ON ie.id = li.id_item_estoque
    LEFT JOIN public.locais_estoque le ON le.id = ie.id_local_estoque
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(im.caminho_arquivo ORDER BY im.imagem_principal DESC, im.ordem_exibicao, im.criado_em) AS fotos
      FROM public.imagens_modelo_produto im
      WHERE im.id_modelo_produto = ie.id_modelo_produto
        AND im.caminho_arquivo IS NOT NULL
    ) img ON true
    WHERE li.id_link = r.id
  ) AS lista;

  RETURN jsonb_build_object(
    'encontrado', true,
    'situacao', v_situacao,
    'destino', r.destino,
    'moeda', r.moeda,
    'validade_em', r.validade_em,
    'mensagem', r.mensagem_boas_vindas,
    'tratamento', coalesce(r.nome, '@' || r.instagram),
    'itens', v_itens
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.link_pedido_preparar_pagamento(
  p_token text,
  p_itens jsonb,
  p_nome text,
  p_email text,
  p_telefone text,
  p_cpf text,
  p_nascimento date,
  p_endereco jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  r public.links_pedido%ROWTYPE;
  v_nome text;
  v_email text;
  v_telefone text;
  v_digitos text;
  v_cpf text;
  v_pais text;
  v_id_cliente uuid;
  v_id_endereco uuid;
  v_qtd integer;
  v_achados integer;
  v_total numeric;
  v_id_reserva uuid;
  v_segredo text;
  v_cep text;
  v_logradouro text;
  v_numero text;
  v_bairro text;
  v_cidade text;
  v_uf text;
  v_complemento text;
BEGIN
  PERFORM public.link_pedido_liberar_expiradas();

  SELECT *
  INTO r
  FROM public.links_pedido
  WHERE token = nullif(btrim(coalesce(p_token, '')), '')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link não encontrado.';
  END IF;
  IF r.status <> 'ativo' THEN
    RAISE EXCEPTION 'Este link foi desativado.';
  END IF;

  PERFORM public.link_pedido_iniciar_prazo(r.id);

  SELECT * INTO r FROM public.links_pedido WHERE id = r.id;
  IF r.validade_em <= now() THEN
    RAISE EXCEPTION 'Este link expirou.';
  END IF;

  IF (
    SELECT count(*)
    FROM public.links_pedido_reservas rv
    WHERE rv.id_link = r.id
      AND rv.status = 'ativa'
      AND rv.expira_em > now()
  ) >= 5 THEN
    RAISE EXCEPTION 'Há pagamentos em andamento neste link. Tente de novo em alguns minutos.';
  END IF;

  v_nome := nullif(btrim(coalesce(p_nome, '')), '');
  v_email := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_telefone := nullif(btrim(coalesce(p_telefone, '')), '');
  IF v_nome IS NULL OR char_length(v_nome) > 160 THEN
    RAISE EXCEPTION 'Informe o nome.';
  END IF;
  IF v_email IS NULL OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR char_length(v_email) > 160 THEN
    RAISE EXCEPTION 'Informe um e-mail válido.';
  END IF;
  IF v_telefone IS NULL OR char_length(v_telefone) > 40 THEN
    RAISE EXCEPTION 'Informe o telefone.';
  END IF;

  IF r.destino = 'brasil' THEN
    v_cpf := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
    IF NOT public.link_pedido_cpf_valido(v_cpf) THEN
      RAISE EXCEPTION 'Informe um CPF válido.';
    END IF;
    IF p_nascimento IS NULL OR p_nascimento > current_date OR p_nascimento < date '1900-01-01' THEN
      RAISE EXCEPTION 'Informe a data de nascimento.';
    END IF;
  END IF;

  IF p_endereco IS NULL OR jsonb_typeof(p_endereco) <> 'object' THEN
    RAISE EXCEPTION 'Informe o endereço.';
  END IF;
  v_logradouro := nullif(btrim(coalesce(p_endereco->>'endereco', '')), '');
  v_numero := nullif(btrim(coalesce(p_endereco->>'numero', '')), '');
  v_cidade := nullif(btrim(coalesce(p_endereco->>'cidade', '')), '');
  v_pais := nullif(btrim(coalesce(p_endereco->>'pais', '')), '');
  v_cep := nullif(btrim(coalesce(p_endereco->>'cep', '')), '');
  v_bairro := nullif(btrim(coalesce(p_endereco->>'bairro', '')), '');
  v_uf := nullif(btrim(coalesce(p_endereco->>'uf', '')), '');
  v_complemento := nullif(btrim(coalesce(p_endereco->>'complemento', '')), '');
  IF v_logradouro IS NULL OR v_numero IS NULL OR v_cidade IS NULL OR v_pais IS NULL THEN
    RAISE EXCEPTION 'Informe logradouro, número, cidade e país.';
  END IF;
  IF r.destino = 'brasil' AND (v_cep IS NULL OR v_bairro IS NULL OR v_uf IS NULL) THEN
    RAISE EXCEPTION 'No Brasil, informe CEP, bairro e UF.';
  END IF;

  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' THEN
    RAISE EXCEPTION 'Escolha ao menos um tênis.';
  END IF;
  v_qtd := jsonb_array_length(p_itens);
  IF v_qtd < 1 OR v_qtd > 40 THEN
    RAISE EXCEPTION 'Escolha ao menos um tênis.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(p_itens) AS t(id)
    WHERE t.id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) THEN
    RAISE EXCEPTION 'Seleção inválida.';
  END IF;
  IF (
    SELECT count(*) FROM (
      SELECT lower(t.id) FROM jsonb_array_elements_text(p_itens) AS t(id) GROUP BY 1 HAVING count(*) > 1
    ) d
  ) > 0 THEN
    RAISE EXCEPTION 'Seleção inválida.';
  END IF;

  PERFORM 1
  FROM public.itens_estoque ie
  WHERE ie.id IN (SELECT t.id::uuid FROM jsonb_array_elements_text(p_itens) AS t(id))
  ORDER BY ie.id
  FOR UPDATE;

  SELECT count(*), coalesce(sum(li.preco), 0)
  INTO v_achados, v_total
  FROM jsonb_array_elements_text(p_itens) AS t(id)
  JOIN public.links_pedido_itens li
    ON li.id_link = r.id
   AND li.id_item_estoque = t.id::uuid
   AND li.moeda = r.moeda
   AND li.preco > 0
  JOIN public.itens_estoque ie ON ie.id = li.id_item_estoque
  WHERE ie.status_item = 'em_estoque'
    AND NOT public.link_pedido_item_ocupado(ie.id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.links_pedido_reserva_itens ri
      JOIN public.links_pedido_reservas rv ON rv.id = ri.id_reserva
      WHERE ri.id_item_estoque = ie.id
        AND ri.status = 'ativa'
        AND rv.status = 'ativa'
        AND rv.expira_em > now()
    );

  IF v_achados IS DISTINCT FROM v_qtd OR v_total <= 0 THEN
    RAISE EXCEPTION 'Um dos tênis não está mais disponível.';
  END IF;

  v_digitos := nullif(regexp_replace(v_telefone, '\D', '', 'g'), '');
  SELECT c.id INTO v_id_cliente
  FROM public.clientes c
  WHERE lower(c.email) = v_email
  LIMIT 1;

  IF v_id_cliente IS NULL AND v_digitos IS NOT NULL AND char_length(v_digitos) >= 8 THEN
    SELECT c.id INTO v_id_cliente
    FROM public.clientes c
    WHERE c.telefone IS NOT NULL
      AND char_length(regexp_replace(c.telefone, '\D', '', 'g')) >= 8
      AND (
        regexp_replace(c.telefone, '\D', '', 'g') = v_digitos
        OR regexp_replace(c.telefone, '\D', '', 'g') LIKE '%' || v_digitos
        OR v_digitos LIKE '%' || regexp_replace(c.telefone, '\D', '', 'g')
      )
    ORDER BY CASE WHEN regexp_replace(c.telefone, '\D', '', 'g') = v_digitos THEN 0 ELSE 1 END,
      c.atualizado_em DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_id_cliente IS NULL THEN
    SELECT c.id INTO v_id_cliente
    FROM public.clientes c
    WHERE c.instagram IS NOT NULL
      AND lower(regexp_replace(btrim(c.instagram), '^@+', '')) = r.instagram
    ORDER BY c.atualizado_em DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_id_cliente IS NULL THEN
    BEGIN
      INSERT INTO public.clientes (
        nome, telefone, email, instagram, pais, tipo_pessoa, cpf_cnpj, data_nascimento,
        marcadores
      )
      VALUES (
        v_nome, v_telefone, v_email, r.instagram, v_pais, 'fisica',
        CASE WHEN r.destino = 'brasil' THEN v_cpf ELSE NULL END,
        CASE WHEN r.destino = 'brasil' THEN p_nascimento ELSE NULL END,
        jsonb_build_array(jsonb_build_object('descricao', 'Link de pedido', 'cor', '#1f6b4a'))
      )
      RETURNING id INTO v_id_cliente;
    EXCEPTION
      WHEN unique_violation THEN
        SELECT c.id INTO v_id_cliente FROM public.clientes c WHERE lower(c.email) = v_email LIMIT 1;
        IF v_id_cliente IS NULL THEN
          RAISE;
        END IF;
    END;
  END IF;

  UPDATE public.clientes
  SET
    nome = v_nome,
    telefone = v_telefone,
    pais = v_pais,
    instagram = coalesce(instagram, r.instagram),
    email = CASE
      WHEN EXISTS (
        SELECT 1 FROM public.clientes outro
        WHERE outro.id <> v_id_cliente AND outro.email IS NOT NULL AND lower(outro.email) = v_email
      ) THEN email
      ELSE v_email
    END,
    tipo_pessoa = CASE WHEN r.destino = 'brasil' THEN 'fisica' ELSE tipo_pessoa END,
    cpf_cnpj = CASE WHEN r.destino = 'brasil' THEN v_cpf ELSE cpf_cnpj END,
    data_nascimento = CASE WHEN r.destino = 'brasil' THEN p_nascimento ELSE data_nascimento END,
    atualizado_em = now()
  WHERE id = v_id_cliente;

  UPDATE public.enderecos_cliente
  SET principal = false, atualizado_em = now()
  WHERE id_cliente = v_id_cliente
    AND principal = true;

  INSERT INTO public.enderecos_cliente (
    id_cliente, rotulo, principal, cep, endereco, numero, complemento, bairro, cidade, uf, pais
  )
  VALUES (
    v_id_cliente, 'Entrega', true, v_cep, v_logradouro, v_numero, v_complemento, v_bairro, v_cidade, v_uf, v_pais
  )
  RETURNING id INTO v_id_endereco;

  v_segredo := encode(gen_random_bytes(24), 'hex');
  INSERT INTO public.links_pedido_reservas (
    id_link, segredo, id_cliente, id_endereco, valor, moeda, conta_sumup, expira_em
  )
  VALUES (
    r.id, v_segredo, v_id_cliente, v_id_endereco, round(v_total, 2), r.moeda, r.conta_sumup, now() + interval '45 minutes'
  )
  RETURNING id INTO v_id_reserva;

  INSERT INTO public.links_pedido_reserva_itens (id_reserva, id_item_estoque, preco)
  SELECT v_id_reserva, li.id_item_estoque, li.preco
  FROM jsonb_array_elements_text(p_itens) AS t(id)
  JOIN public.links_pedido_itens li
    ON li.id_link = r.id
   AND li.id_item_estoque = t.id::uuid;

  RETURN jsonb_build_object(
    'id_reserva', v_id_reserva,
    'segredo', v_segredo,
    'valor', round(v_total, 2),
    'moeda', r.moeda,
    'conta', r.conta_sumup,
    'token', r.token,
    'descricao', left('KropFeet @' || r.instagram, 140)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.link_pedido_vincular_checkout(
  p_id_reserva uuid,
  p_segredo text,
  p_id_checkout text,
  p_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r public.links_pedido_reservas%ROWTYPE;
  v_id text;
BEGIN
  v_id := nullif(btrim(coalesce(p_id_checkout, '')), '');
  IF v_id IS NULL OR char_length(v_id) > 80 THEN
    RAISE EXCEPTION 'Pagamento SumUp inválido.';
  END IF;

  SELECT *
  INTO r
  FROM public.links_pedido_reservas
  WHERE id = p_id_reserva
    AND segredo = nullif(btrim(coalesce(p_segredo, '')), '')
  FOR UPDATE;

  IF NOT FOUND OR r.status <> 'ativa' OR r.expira_em <= now() THEN
    RAISE EXCEPTION 'A reserva do pagamento não está mais válida.';
  END IF;

  UPDATE public.links_pedido_reservas
  SET id_checkout = v_id
  WHERE id = r.id;

  INSERT INTO public.checkouts_sumup (id_checkout, conta, valor, moeda, status, url, pedido)
  VALUES (
    v_id,
    r.conta_sumup,
    r.valor,
    r.moeda,
    'PENDING',
    nullif(btrim(coalesce(p_url, '')), ''),
    jsonb_build_object('origem', 'link_pedido', 'id_reserva', r.id, 'id_link', r.id_link, 'token', (
      SELECT token FROM public.links_pedido WHERE id = r.id_link
    ))
  )
  ON CONFLICT (id_checkout) DO UPDATE
  SET
    url = coalesce(EXCLUDED.url, public.checkouts_sumup.url),
    pedido = coalesce(EXCLUDED.pedido, public.checkouts_sumup.pedido),
    atualizado_em = now()
  WHERE public.checkouts_sumup.id_venda IS NULL
    AND public.checkouts_sumup.valor = r.valor
    AND public.checkouts_sumup.moeda = r.moeda
    AND public.checkouts_sumup.conta = r.conta_sumup;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_pedido_liberar_reserva(p_id_reserva uuid, p_segredo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.links_pedido_reserva_itens
  SET status = 'liberada'
  WHERE id_reserva = p_id_reserva
    AND status = 'ativa'
    AND EXISTS (
      SELECT 1 FROM public.links_pedido_reservas r
      WHERE r.id = p_id_reserva
        AND r.segredo = nullif(btrim(coalesce(p_segredo, '')), '')
        AND r.status = 'ativa'
    );

  UPDATE public.links_pedido_reservas
  SET status = 'liberada', motivo = 'Pagamento não iniciado.'
  WHERE id = p_id_reserva
    AND segredo = nullif(btrim(coalesce(p_segredo, '')), '')
    AND status = 'ativa';
END;
$$;

CREATE OR REPLACE FUNCTION public.link_pedido_liberar_por_checkout(p_id_checkout text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id
  FROM public.links_pedido_reservas
  WHERE id_checkout = p_id_checkout
    AND status = 'ativa'
  FOR UPDATE;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.links_pedido_reserva_itens
  SET status = 'liberada'
  WHERE id_reserva = v_id
    AND status = 'ativa';

  UPDATE public.links_pedido_reservas
  SET status = 'recusada', motivo = 'Pagamento não confirmado.'
  WHERE id = v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_pedido_materializar_venda(
  p_id_checkout text,
  p_codigo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c public.checkouts_sumup%ROWTYPE;
  rv public.links_pedido_reservas%ROWTYPE;
  lk public.links_pedido%ROWTYPE;
  v_codigo text;
  v_id_venda uuid;
  v_id_aviso uuid;
  v_numero text;
  v_qtd integer;
  v_achados integer;
  v_regiao public.tipo_regiao_enum;
  v_forma text;
  v_meio text;
  v_email text;
  v_assunto text;
  v_corpo text;
  v_nome text;
BEGIN
  PERFORM set_config('kropfeet.bypass_equipe', '1', true);

  v_codigo := nullif(upper(btrim(coalesce(p_codigo, ''))), '');
  IF v_codigo IS NULL OR v_codigo !~ '^T[A-Z0-9]{6,24}$' THEN
    RAISE EXCEPTION 'Pagamento sem código de transação.';
  END IF;

  SELECT * INTO c
  FROM public.checkouts_sumup
  WHERE id_checkout = p_id_checkout
  FOR UPDATE;

  IF NOT FOUND OR coalesce(c.pedido->>'origem', '') <> 'link_pedido' THEN
    RAISE EXCEPTION 'Checkout de link não encontrado.';
  END IF;

  IF c.id_venda IS NOT NULL THEN
    RETURN jsonb_build_object('aplicado', true, 'id_venda', c.id_venda, 'origem', 'link_pedido', 'repetido', true);
  END IF;

  SELECT * INTO rv
  FROM public.links_pedido_reservas
  WHERE id = (c.pedido->>'id_reserva')::uuid
  FOR UPDATE;

  IF NOT FOUND THEN
    UPDATE public.checkouts_sumup SET motivo = 'Reserva do link não encontrada.', atualizado_em = now()
    WHERE id_checkout = c.id_checkout;
    RETURN jsonb_build_object('aplicado', false, 'motivo', 'sem_reserva', 'origem', 'link_pedido');
  END IF;

  SELECT * INTO lk FROM public.links_pedido WHERE id = rv.id_link;

  IF c.valor IS DISTINCT FROM rv.valor OR c.moeda IS DISTINCT FROM rv.moeda OR c.conta IS DISTINCT FROM rv.conta_sumup THEN
    UPDATE public.checkouts_sumup
    SET motivo = 'O valor confirmado não confere com o link.', atualizado_em = now()
    WHERE id_checkout = c.id_checkout;
    RETURN jsonb_build_object('aplicado', false, 'motivo', 'valor_divergente', 'origem', 'link_pedido');
  END IF;

  SELECT count(*) INTO v_qtd
  FROM public.links_pedido_reserva_itens
  WHERE id_reserva = rv.id;

  PERFORM 1
  FROM public.itens_estoque ie
  WHERE ie.id IN (
    SELECT id_item_estoque FROM public.links_pedido_reserva_itens WHERE id_reserva = rv.id
  )
  ORDER BY ie.id
  FOR UPDATE;

  SELECT count(*) INTO v_achados
  FROM public.links_pedido_reserva_itens ri
  JOIN public.itens_estoque ie ON ie.id = ri.id_item_estoque
  WHERE ri.id_reserva = rv.id
    AND ie.status_item = 'em_estoque'
    AND NOT public.link_pedido_item_ocupado(ie.id);

  IF v_achados IS DISTINCT FROM v_qtd THEN
    UPDATE public.links_pedido_reserva_itens SET status = 'recusada' WHERE id_reserva = rv.id AND status = 'ativa';
    UPDATE public.links_pedido_reservas
    SET status = 'recusada', motivo = 'O par não estava mais disponível quando o pagamento confirmou.'
    WHERE id = rv.id;
    UPDATE public.checkouts_sumup
    SET motivo = 'Pagamento confirmado, mas o tênis já não estava disponível.', atualizado_em = now()
    WHERE id_checkout = c.id_checkout;
    INSERT INTO public.avisos (tipo, titulo, corpo, id_link, email_status)
    VALUES (
      'link_sem_estoque',
      'Pagamento de link sem estoque',
      'O pagamento ' || v_codigo || ' do @' || lk.instagram || ' foi confirmado, mas o tênis já não estava disponível. A ordem não foi criada.',
      lk.id,
      'nao_configurado'
    );
    RETURN jsonb_build_object('aplicado', false, 'motivo', 'sem_estoque', 'origem', 'link_pedido');
  END IF;

  IF lk.destino = 'brasil' THEN
    v_regiao := 'brasil';
    v_forma := 'credito';
    v_meio := 'SumUp';
  ELSE
    v_regiao := 'europa';
    v_forma := 'cartao';
    v_meio := 'SumUp Link';
  END IF;

  SELECT nome INTO v_nome FROM public.clientes WHERE id = rv.id_cliente;
  v_numero := 'LP-' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYMMDDHH24MI') || '-' || upper(substr(lk.token, 1, 4));

  INSERT INTO public.vendas (
    id_cliente, nome_cliente, id_endereco_cliente, numero, data_pedido, status_venda,
    regiao_venda, local_venda, total_produtos, valor_total,
    valor_frete, moeda_frete, frete_status, forma_pagamento, condicao_pagamento,
    codigo_venda_adquirente, obs, marcadores
  )
  VALUES (
    rv.id_cliente, v_nome, rv.id_endereco, v_numero, now(), 'em_aberto',
    v_regiao, 'online', rv.valor, rv.valor,
    0, rv.moeda, 'nao_aplicavel', v_forma, '1x',
    v_codigo,
    'Link de pedido @' || lk.instagram,
    jsonb_build_array(jsonb_build_object('descricao', 'Link de pedido', 'cor', '#1f6b4a'))
  )
  RETURNING id INTO v_id_venda;

  INSERT INTO public.itens_venda (id_venda, id_item_estoque, codigo, descricao, quantidade, valor_unitario)
  SELECT
    v_id_venda,
    ie.id,
    left(ie.sku, 80),
    left(btrim(ie.nome_produto), 180),
    1,
    ri.preco
  FROM public.links_pedido_reserva_itens ri
  JOIN public.itens_estoque ie ON ie.id = ri.id_item_estoque
  WHERE ri.id_reserva = rv.id;

  PERFORM public.sincronizar_efeitos_venda(v_id_venda);

  INSERT INTO public.parcelas_venda (
    id_venda, numero, data_vencimento, valor, forma_pagamento, meio_pagamento, dias, pago, codigo_transacao
  )
  VALUES (
    v_id_venda, 1, current_date, rv.valor, v_forma, v_meio, 0, false, v_codigo
  );

  UPDATE public.checkouts_sumup
  SET id_venda = v_id_venda, codigo_transacao = v_codigo, motivo = NULL, atualizado_em = now()
  WHERE id_checkout = c.id_checkout;

  INSERT INTO public.links_pedido_vendas (id_link, id_venda, id_checkout)
  VALUES (lk.id, v_id_venda, c.id_checkout);

  UPDATE public.links_pedido
  SET vendas_confirmadas = vendas_confirmadas + 1, atualizado_em = now()
  WHERE id = lk.id;

  UPDATE public.links_pedido_reserva_itens SET status = 'confirmada' WHERE id_reserva = rv.id;
  UPDATE public.links_pedido_reservas SET status = 'confirmada', motivo = NULL WHERE id = rv.id;

  PERFORM public.sincronizar_contas_receber_venda(v_id_venda);
  BEGIN
    PERFORM public.conciliar_recebiveis_sumup(ARRAY[v_codigo]);
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  v_email := NULL;
  v_assunto := 'Nova venda pelo link @' || lk.instagram;
  v_corpo := 'A ordem ' || v_numero || ' foi criada depois do pagamento ' || v_codigo || '.';

  INSERT INTO public.avisos (tipo, titulo, corpo, id_venda, id_link, email_status)
  VALUES (
    'venda_link',
    v_assunto,
    v_corpo,
    v_id_venda,
    lk.id,
    'nao_configurado'
  )
  RETURNING id INTO v_id_aviso;

  RETURN jsonb_build_object(
    'aplicado', true,
    'origem', 'link_pedido',
    'id_venda', v_id_venda,
    'id_aviso', v_id_aviso,
    'email_destinatario', v_email,
    'email_assunto', v_assunto,
    'email_corpo', v_corpo
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.link_pedido_status_checkout(p_token text, p_id_checkout text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c public.checkouts_sumup%ROWTYPE;
  v_token text;
  v_publico text;
BEGIN
  v_token := nullif(btrim(coalesce(p_token, '')), '');
  SELECT * INTO c
  FROM public.checkouts_sumup
  WHERE id_checkout = nullif(btrim(coalesce(p_id_checkout, '')), '');

  IF NOT FOUND OR coalesce(c.pedido->>'origem', '') <> 'link_pedido' OR coalesce(c.pedido->>'token', '') <> v_token THEN
    RETURN jsonb_build_object('encontrado', false);
  END IF;

  v_publico := CASE upper(c.status)
    WHEN 'PAID' THEN CASE WHEN c.id_venda IS NULL THEN 'processando' ELSE 'confirmado' END
    WHEN 'FAILED' THEN 'recusado'
    WHEN 'EXPIRED' THEN 'expirado'
    WHEN 'CANCELLED' THEN 'cancelado'
    ELSE 'pendente'
  END;

  RETURN jsonb_build_object(
    'encontrado', true,
    'situacao', v_publico,
    'id_venda', c.id_venda
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.aplicar_retorno_checkout_sumup(
  p_id_checkout text,
  p_status text,
  p_codigo text DEFAULT NULL,
  p_id_venda uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r public.checkouts_sumup%ROWTYPE;
  v_id_venda uuid;
  v_codigo text;
  v_status text;
  v_linhas integer;
  v_salvo jsonb;
  v_pedido jsonb;
  v_regiao public.tipo_regiao_enum;
  v_forma text;
  v_meio text;
  v_erro text;
  v_link jsonb;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  PERFORM set_config('kropfeet.bypass_equipe', '1', true);

  SELECT *
  INTO r
  FROM public.checkouts_sumup
  WHERE id_checkout = p_id_checkout
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('aplicado', false);
  END IF;

  v_status := upper(btrim(coalesce(p_status, '')));
  v_codigo := nullif(upper(btrim(coalesce(p_codigo, ''))), '');
  v_id_venda := coalesce(r.id_venda, p_id_venda);

  UPDATE public.checkouts_sumup
  SET
    status = coalesce(nullif(v_status, ''), status),
    codigo_transacao = coalesce(v_codigo, codigo_transacao),
    atualizado_em = now()
  WHERE id_checkout = p_id_checkout;

  IF coalesce(r.pedido->>'origem', '') = 'link_pedido' THEN
    IF v_status IN ('FAILED', 'EXPIRED', 'CANCELLED') THEN
      PERFORM public.link_pedido_liberar_por_checkout(p_id_checkout);
      RETURN jsonb_build_object('aplicado', false, 'status', v_status, 'origem', 'link_pedido');
    END IF;
    IF v_status = 'PAID' AND v_codigo IS NOT NULL THEN
      v_link := public.link_pedido_materializar_venda(p_id_checkout, v_codigo);
      RETURN v_link;
    END IF;
    RETURN jsonb_build_object('aplicado', false, 'status', v_status, 'origem', 'link_pedido');
  END IF;

  IF v_status <> 'PAID' OR v_codigo IS NULL THEN
    RETURN jsonb_build_object('aplicado', false, 'id_venda', v_id_venda, 'status', v_status);
  END IF;

  IF v_id_venda IS NULL THEN
    v_pedido := r.pedido;
    IF v_pedido IS NULL OR jsonb_typeof(v_pedido->'itens') <> 'array' THEN
      UPDATE public.checkouts_sumup
      SET motivo = 'Pagamento confirmado sem a seleção da galeria.'
      WHERE id_checkout = p_id_checkout;
      RETURN jsonb_build_object('aplicado', false, 'motivo', 'sem_selecao');
    END IF;

    IF r.conta = 'br' THEN
      v_regiao := 'brasil';
      v_forma := 'credito';
      v_meio := 'SumUp';
    ELSE
      v_regiao := 'europa';
      v_forma := 'cartao';
      v_meio := 'SumUp Link';
    END IF;

    BEGIN
      v_salvo := public.catalogo_kropcafe_salvar_selecao(
        v_pedido->>'nome',
        v_pedido->>'telefone',
        v_pedido->>'email',
        v_pedido->>'pais',
        v_pedido->>'observacao',
        v_pedido->'itens',
        true,
        v_pedido->>'id_vendedor'
      );
      v_id_venda := (v_salvo->>'id_venda')::uuid;
      IF v_id_venda IS NULL THEN
        RAISE EXCEPTION 'Não foi possível abrir a ordem de venda.';
      END IF;

      UPDATE public.vendas
      SET
        regiao_venda = v_regiao,
        valor_total = r.valor,
        forma_pagamento = v_forma,
        condicao_pagamento = '1x',
        local_venda = 'galeria',
        codigo_venda_adquirente = v_codigo
      WHERE id = v_id_venda;

      INSERT INTO public.parcelas_venda (
        id_venda, numero, data_vencimento, valor, forma_pagamento, meio_pagamento, dias, pago, codigo_transacao
      )
      VALUES (
        v_id_venda, 1, current_date, r.valor, v_forma, v_meio, 0, false, v_codigo
      );

      UPDATE public.checkouts_sumup
      SET id_venda = v_id_venda, motivo = NULL, atualizado_em = now()
      WHERE id_checkout = p_id_checkout;

      UPDATE public.carrinhos_galeria
      SET id_venda = v_id_venda
      WHERE id = (
        SELECT cg.id
        FROM public.carrinhos_galeria cg
        WHERE cg.id_cliente = (v_salvo->>'id_cliente')::uuid
          AND cg.id_venda IS NULL
        ORDER BY cg.criado_em DESC
        LIMIT 1
      );
    EXCEPTION
      WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_erro = MESSAGE_TEXT;
        UPDATE public.checkouts_sumup
        SET motivo = left(v_erro, 300), atualizado_em = now()
        WHERE id_checkout = p_id_checkout;
        RETURN jsonb_build_object('aplicado', false, 'motivo', left(v_erro, 300));
    END;
  END IF;

  UPDATE public.parcelas_venda
  SET codigo_transacao = v_codigo
  WHERE id_venda = v_id_venda
    AND (
      meio_pagamento ILIKE 'sumup%'
      OR lower(btrim(coalesce(forma_pagamento, ''))) IN ('credito', 'debito', 'cartao')
    )
    AND (
      codigo_transacao IS NULL
      OR btrim(codigo_transacao) = ''
      OR upper(codigo_transacao) = v_codigo
    );
  GET DIAGNOSTICS v_linhas = ROW_COUNT;

  UPDATE public.vendas
  SET codigo_venda_adquirente = v_codigo
  WHERE id = v_id_venda
    AND (
      codigo_venda_adquirente IS NULL
      OR btrim(codigo_venda_adquirente) = ''
      OR upper(btrim(codigo_venda_adquirente)) = v_codigo
    );

  PERFORM public.sincronizar_contas_receber_venda(v_id_venda);

  RETURN public.conciliar_recebiveis_sumup(ARRAY[v_codigo])
    || jsonb_build_object('aplicado', true, 'id_venda', v_id_venda, 'parcelas', v_linhas, 'codigo', v_codigo);
END;
$$;

REVOKE ALL ON FUNCTION public.link_pedido_cpf_valido(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_pedido_item_ocupado(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_pedido_liberar_expiradas() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_pedido_iniciar_prazo(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_pedido_criar(text, text, text, integer, text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.link_pedido_desativar(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.link_pedido_reativar(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.link_pedido_publico(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.link_pedido_preparar_pagamento(text, jsonb, text, text, text, text, date, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.link_pedido_vincular_checkout(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.link_pedido_liberar_reserva(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.link_pedido_liberar_por_checkout(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_pedido_materializar_venda(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_pedido_status_checkout(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.link_pedido_criar(text, text, text, integer, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_pedido_desativar(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_pedido_reativar(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_pedido_publico(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_pedido_preparar_pagamento(text, jsonb, text, text, text, text, date, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.link_pedido_vincular_checkout(uuid, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.link_pedido_liberar_reserva(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.link_pedido_liberar_por_checkout(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.link_pedido_materializar_venda(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.link_pedido_status_checkout(text, text) TO anon, authenticated;
