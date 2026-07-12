-- Vitrine: versões na mesma vitrine + estado de caixa (buraco) + sync status item com OV.

-- 1. Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_caixa_vitrine_enum') THEN
    CREATE TYPE public.estado_caixa_vitrine_enum AS ENUM ('ocupada', 'vendida');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'motivo_versao_vitrine_enum') THEN
    CREATE TYPE public.motivo_versao_vitrine_enum AS ENUM (
      'publicacao',
      'venda',
      'substituicao',
      'cancelamento'
    );
  END IF;
END $$;

-- 2. Colunas vitrines / vitrine_itens
ALTER TABLE public.vitrines
  ADD COLUMN IF NOT EXISTS versao_atual integer NOT NULL DEFAULT 1;

ALTER TABLE public.vitrine_itens
  ADD COLUMN IF NOT EXISTS estado_caixa public.estado_caixa_vitrine_enum NOT NULL DEFAULT 'ocupada',
  ADD COLUMN IF NOT EXISTS id_venda_saida uuid REFERENCES public.vendas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vendido_em timestamptz;

CREATE INDEX IF NOT EXISTS vitrine_itens_estado_caixa_idx
  ON public.vitrine_itens (id_vitrine, estado_caixa);

CREATE INDEX IF NOT EXISTS vitrine_itens_venda_saida_idx
  ON public.vitrine_itens (id_venda_saida)
  WHERE id_venda_saida IS NOT NULL;

-- 3. Histórico de versões (mesma vitrine)
CREATE TABLE IF NOT EXISTS public.vitrine_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_vitrine uuid NOT NULL REFERENCES public.vitrines(id) ON DELETE CASCADE,
  numero integer NOT NULL,
  motivo public.motivo_versao_vitrine_enum NOT NULL,
  id_venda uuid REFERENCES public.vendas(id) ON DELETE SET NULL,
  snapshot_caixas jsonb NOT NULL DEFAULT '[]'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT vitrine_versoes_vitrine_numero_unique UNIQUE (id_vitrine, numero)
);

CREATE INDEX IF NOT EXISTS vitrine_versoes_vitrine_idx
  ON public.vitrine_versoes (id_vitrine, numero DESC);

ALTER TABLE public.vitrine_versoes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'vitrine_versoes'
      AND policyname = 'crm_authenticated_all'
  ) THEN
    CREATE POLICY crm_authenticated_all ON public.vitrine_versoes
      FOR ALL TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 4. Snapshot das caixas atuais
CREATE OR REPLACE FUNCTION public.vitrine_montar_snapshot_caixas(p_id_vitrine uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'numero_caixa', vi.numero_caixa,
      'id_item_estoque', vi.id_item_estoque,
      'estado_caixa', vi.estado_caixa,
      'id_venda_saida', vi.id_venda_saida,
      'sku', ie.sku,
      'nome', COALESCE(NULLIF(trim(vi.nome_exibicao), ''), ie.nome_produto),
      'vendido_em', vi.vendido_em
    )
    ORDER BY vi.numero_caixa NULLS LAST
  ), '[]'::jsonb)
  FROM public.vitrine_itens vi
  LEFT JOIN public.itens_estoque ie ON ie.id = vi.id_item_estoque
  WHERE vi.id_vitrine = p_id_vitrine;
$$;

CREATE OR REPLACE FUNCTION public.vitrine_registrar_versao(
  p_id_vitrine uuid,
  p_motivo public.motivo_versao_vitrine_enum,
  p_id_venda uuid DEFAULT NULL,
  p_criado_por uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_numero integer;
BEGIN
  UPDATE public.vitrines
  SET versao_atual = versao_atual + 1,
      atualizado_em = now()
  WHERE id = p_id_vitrine
  RETURNING versao_atual INTO v_numero;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vitrine não encontrada';
  END IF;

  -- Versão 1 na publicação: não incrementar duas vezes se já for 1 e vazia.
  -- Chamadores controlam: na 1ª publicação usamos upsert com numero=1 sem bump prévio.
  INSERT INTO public.vitrine_versoes (id_vitrine, numero, motivo, id_venda, snapshot_caixas, criado_por)
  VALUES (
    p_id_vitrine,
    v_numero,
    p_motivo,
    p_id_venda,
    public.vitrine_montar_snapshot_caixas(p_id_vitrine),
    p_criado_por
  );

  RETURN v_numero;
END;
$$;

-- Publicação: grava versão 1 sem bump (versao_atual já 1)
CREATE OR REPLACE FUNCTION public.vitrine_registrar_versao_inicial(p_id_vitrine uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.vitrines
  SET versao_atual = 1, atualizado_em = now()
  WHERE id = p_id_vitrine;

  INSERT INTO public.vitrine_versoes (id_vitrine, numero, motivo, snapshot_caixas)
  VALUES (
    p_id_vitrine,
    1,
    'publicacao',
    public.vitrine_montar_snapshot_caixas(p_id_vitrine)
  )
  ON CONFLICT (id_vitrine, numero) DO UPDATE
  SET snapshot_caixas = EXCLUDED.snapshot_caixas,
      motivo = EXCLUDED.motivo,
      criado_em = now();
END;
$$;

-- Item em outra OV ativa?
CREATE OR REPLACE FUNCTION public.item_em_ov_ativa(
  p_id_item uuid,
  p_exceto_venda uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.itens_venda iv
    JOIN public.vendas v ON v.id = iv.id_venda
    WHERE iv.id_item_estoque = p_id_item
      AND v.status_venda IS DISTINCT FROM 'cancelado'
      AND (p_exceto_venda IS NULL OR v.id <> p_exceto_venda)
  );
$$;

-- Abre buracos na vitrine publicada para itens vendidos (uma versão por chamada)
CREATE OR REPLACE FUNCTION public.vitrine_marcar_itens_vendidos(
  p_ids_item uuid[],
  p_id_venda uuid
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id_vitrine uuid;
  v_afetados integer := 0;
BEGIN
  IF p_ids_item IS NULL OR array_length(p_ids_item, 1) IS NULL THEN
    RETURN 0;
  END IF;

  SELECT id INTO v_id_vitrine
  FROM public.vitrines
  WHERE status = 'publicada'
  ORDER BY publicado_em DESC NULLS LAST, criado_em DESC
  LIMIT 1
  FOR UPDATE;

  IF v_id_vitrine IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.vitrine_itens vi
  SET estado_caixa = 'vendida',
      id_venda_saida = p_id_venda,
      vendido_em = now(),
      atualizado_em = now()
  WHERE vi.id_vitrine = v_id_vitrine
    AND vi.id_item_estoque = ANY (p_ids_item)
    AND vi.estado_caixa = 'ocupada';

  GET DIAGNOSTICS v_afetados = ROW_COUNT;

  IF v_afetados > 0 THEN
    PERFORM public.vitrine_registrar_versao(v_id_vitrine, 'venda', p_id_venda, NULL);
  END IF;

  RETURN v_afetados;
END;
$$;

-- Restaura caixas vendidas desta OV (cancelamento)
CREATE OR REPLACE FUNCTION public.vitrine_restaurar_itens_venda(p_id_venda uuid)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id_vitrine uuid;
  v_afetados integer := 0;
BEGIN
  SELECT id INTO v_id_vitrine
  FROM public.vitrines
  WHERE status = 'publicada'
  ORDER BY publicado_em DESC NULLS LAST, criado_em DESC
  LIMIT 1
  FOR UPDATE;

  IF v_id_vitrine IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.vitrine_itens vi
  SET estado_caixa = 'ocupada',
      id_venda_saida = NULL,
      vendido_em = NULL,
      atualizado_em = now()
  WHERE vi.id_vitrine = v_id_vitrine
    AND vi.id_venda_saida = p_id_venda
    AND vi.estado_caixa = 'vendida';

  GET DIAGNOSTICS v_afetados = ROW_COUNT;

  IF v_afetados > 0 THEN
    PERFORM public.vitrine_registrar_versao(v_id_vitrine, 'cancelamento', p_id_venda, NULL);
  END IF;

  RETURN v_afetados;
END;
$$;

-- Sincroniza status dos itens da venda + efeitos na vitrine
CREATE OR REPLACE FUNCTION public.sincronizar_efeitos_venda(p_id_venda uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status public.status_venda_enum;
  v_ids uuid[];
  v_id uuid;
  v_buracos integer := 0;
  v_restaurados integer := 0;
  v_marcados integer := 0;
BEGIN
  SELECT status_venda INTO v_status
  FROM public.vendas
  WHERE id = p_id_venda
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT id_item_estoque) FILTER (WHERE id_item_estoque IS NOT NULL), ARRAY[]::uuid[])
  INTO v_ids
  FROM public.itens_venda
  WHERE id_venda = p_id_venda;

  IF v_status = 'cancelado' THEN
    FOREACH v_id IN ARRAY v_ids
    LOOP
      IF NOT public.item_em_ov_ativa(v_id, p_id_venda) THEN
        UPDATE public.itens_estoque
        SET status_item = 'em_estoque', atualizado_em = now()
        WHERE id = v_id
          AND status_item IS DISTINCT FROM 'em_estoque';
        v_marcados := v_marcados + 1;
      END IF;
    END LOOP;
    v_restaurados := public.vitrine_restaurar_itens_venda(p_id_venda);
  ELSE
    IF array_length(v_ids, 1) IS NOT NULL THEN
      UPDATE public.itens_estoque
      SET status_item = 'vendido', atualizado_em = now()
      WHERE id = ANY (v_ids)
        AND status_item IS DISTINCT FROM 'vendido';
      GET DIAGNOSTICS v_marcados = ROW_COUNT;
      v_buracos := public.vitrine_marcar_itens_vendidos(v_ids, p_id_venda);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id_venda', p_id_venda,
    'status_venda', v_status,
    'itens', COALESCE(array_length(v_ids, 1), 0),
    'status_atualizados', v_marcados,
    'buracos', v_buracos,
    'restaurados', v_restaurados
  );
END;
$$;

-- Reverte itens removidos da OV (não estão mais em itens_venda desta venda)
CREATE OR REPLACE FUNCTION public.reverter_itens_removidos_venda(
  p_id_venda uuid,
  p_ids_anteriores uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_count integer := 0;
  v_restaurados_vitrine boolean := false;
  v_id_vitrine uuid;
BEGIN
  IF p_ids_anteriores IS NULL THEN
    RETURN 0;
  END IF;

  SELECT id INTO v_id_vitrine
  FROM public.vitrines
  WHERE status = 'publicada'
  LIMIT 1;

  FOREACH v_id IN ARRAY p_ids_anteriores
  LOOP
    IF v_id IS NULL THEN
      CONTINUE;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.itens_venda
      WHERE id_venda = p_id_venda AND id_item_estoque = v_id
    ) THEN
      CONTINUE;
    END IF;
    IF public.item_em_ov_ativa(v_id, NULL) THEN
      CONTINUE;
    END IF;

    UPDATE public.itens_estoque
    SET status_item = 'em_estoque', atualizado_em = now()
    WHERE id = v_id
      AND status_item IS DISTINCT FROM 'em_estoque';

    IF v_id_vitrine IS NOT NULL THEN
      UPDATE public.vitrine_itens vi
      SET estado_caixa = 'ocupada',
          id_venda_saida = NULL,
          vendido_em = NULL,
          atualizado_em = now()
      WHERE vi.id_vitrine = v_id_vitrine
        AND vi.id_item_estoque = v_id
        AND vi.id_venda_saida = p_id_venda
        AND vi.estado_caixa = 'vendida';
      IF FOUND THEN
        v_restaurados_vitrine := true;
      END IF;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  IF v_restaurados_vitrine AND v_id_vitrine IS NOT NULL THEN
    PERFORM public.vitrine_registrar_versao(v_id_vitrine, 'cancelamento', p_id_venda, NULL);
  END IF;

  RETURN v_count;
END;
$$;

-- Atualiza snapshot de uma caixa (ex.: após substituição)
CREATE OR REPLACE FUNCTION public.vitrine_atualizar_snapshot_item(p_id_vitrine_item uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id_vitrine uuid;
  v_id_item uuid;
  v_id_modelo uuid;
  v_ids_vitrine uuid[];
  v_snapshot jsonb;
BEGIN
  SELECT vi.id_vitrine, vi.id_item_estoque, ie.id_modelo_produto
  INTO v_id_vitrine, v_id_item, v_id_modelo
  FROM public.vitrine_itens vi
  JOIN public.itens_estoque ie ON ie.id = vi.id_item_estoque
  WHERE vi.id = p_id_vitrine_item;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COALESCE(array_agg(id_item_estoque), ARRAY[]::uuid[])
  INTO v_ids_vitrine
  FROM public.vitrine_itens
  WHERE id_vitrine = v_id_vitrine
    AND estado_caixa = 'ocupada';

  SELECT jsonb_build_object(
    'id_item_estoque', ie.id,
    'sku', ie.sku,
    'nome_produto', ie.nome_produto,
    'nome_exibicao', COALESCE(NULLIF(trim(vi.nome_exibicao), ''), mp.nome_modelo, ie.nome_produto),
    'foto_url', img.url,
    'id_modelo_produto', ie.id_modelo_produto,
    'nome_modelo', mp.nome_modelo,
    'marca', m.nome,
    'categoria', c.nome,
    'numeracao_br', ie.numeracao_br,
    'numeracao_eu', ie.numeracao_eu,
    'numeracao_us', ie.numeracao_us,
    'sistema_numeracao', ie.sistema_numeracao,
    'preco', ie.preco_venda,
    'moeda', public.moeda_venda_item_estoque(ie.moeda_venda, le.tipo_regiao),
    'correspondencias', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id_item_estoque', corr.id,
          'sku', corr.sku,
          'numeracao_br', corr.numeracao_br,
          'numeracao_eu', corr.numeracao_eu,
          'numeracao_us', corr.numeracao_us,
          'sistema_numeracao', corr.sistema_numeracao,
          'preco', corr.preco_venda,
          'moeda', public.moeda_venda_item_estoque(corr.moeda_venda, corr.tipo_regiao_local),
          'estoque', corr.local_nome,
          'local_nome', corr.local_nome,
          'status_item', corr.status_item
        )
        ORDER BY corr.numeracao_br NULLS LAST, corr.sku
      )
      FROM (
        SELECT
          ie2.id,
          ie2.sku,
          ie2.numeracao_br,
          ie2.numeracao_eu,
          ie2.numeracao_us,
          ie2.sistema_numeracao,
          ie2.preco_venda,
          ie2.moeda_venda,
          ie2.status_item,
          le2.nome AS local_nome,
          le2.tipo_regiao AS tipo_regiao_local
        FROM public.itens_estoque ie2
        JOIN public.locais_estoque le2 ON le2.id = ie2.id_local_estoque
        WHERE ie2.id_modelo_produto = v_id_modelo
          AND ie2.status_item = 'em_estoque'
          AND ie2.id <> v_id_item
          AND NOT (ie2.id = ANY (v_ids_vitrine))
          AND le2.ativo = true
          AND le2.tipo_regiao = 'europa'
      ) corr
    ), '[]'::jsonb)
  )
  INTO v_snapshot
  FROM public.vitrine_itens vi
  JOIN public.itens_estoque ie ON ie.id = vi.id_item_estoque
  LEFT JOIN public.locais_estoque le ON le.id = ie.id_local_estoque
  LEFT JOIN public.modelos_produto mp ON mp.id = ie.id_modelo_produto
  LEFT JOIN public.marcas m ON m.id = mp.id_marca
  LEFT JOIN public.categorias c ON c.id = mp.id_categoria
  LEFT JOIN LATERAL (
    SELECT COALESCE(imp.url_origem, imp.caminho_arquivo) AS url
    FROM public.imagens_modelo_produto imp
    WHERE imp.id_modelo_produto = ie.id_modelo_produto
    ORDER BY imp.imagem_principal DESC, imp.ordem_exibicao ASC, imp.criado_em ASC
    LIMIT 1
  ) img ON true
  WHERE vi.id = p_id_vitrine_item;

  v_snapshot := v_snapshot || jsonb_build_object(
    'item_unico',
    jsonb_array_length(v_snapshot->'correspondencias') = 0
  );

  UPDATE public.vitrine_itens
  SET snapshot = v_snapshot,
      nome_exibicao = COALESCE(nome_exibicao, v_snapshot->>'nome_exibicao'),
      atualizado_em = now()
  WHERE id = p_id_vitrine_item;
END;
$$;

-- Substituir caixa vazia sem rascunho
CREATE OR REPLACE FUNCTION public.substituir_caixa_vitrine(
  p_id_vitrine_item uuid,
  p_id_item_novo uuid,
  p_id_usuario uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item public.vitrine_itens%ROWTYPE;
  v_vitrine public.vitrines%ROWTYPE;
  v_id_local_vitrine uuid;
  v_novo public.itens_estoque%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('substituir_caixa_vitrine'));

  SELECT * INTO v_item
  FROM public.vitrine_itens
  WHERE id = p_id_vitrine_item
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caixa da vitrine não encontrada';
  END IF;

  SELECT * INTO v_vitrine
  FROM public.vitrines
  WHERE id = v_item.id_vitrine
  FOR UPDATE;

  IF v_vitrine.status <> 'publicada' THEN
    RAISE EXCEPTION 'Só é possível substituir caixas na vitrine publicada';
  END IF;

  IF v_item.estado_caixa <> 'vendida' THEN
    RAISE EXCEPTION 'Só caixas vazias (vendidas) podem ser substituídas';
  END IF;

  SELECT * INTO v_novo
  FROM public.itens_estoque
  WHERE id = p_id_item_novo
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de estoque não encontrado';
  END IF;

  IF v_novo.status_item <> 'em_estoque' THEN
    RAISE EXCEPTION 'O novo item precisa estar em estoque';
  END IF;

  SELECT public.vitrines_id_local_vitrine() INTO v_id_local_vitrine;
  IF v_id_local_vitrine IS NULL THEN
    RAISE EXCEPTION 'Local de estoque Vitrine não encontrado';
  END IF;

  -- Não pode já estar em outra caixa ocupada desta vitrine
  IF EXISTS (
    SELECT 1 FROM public.vitrine_itens
    WHERE id_vitrine = v_item.id_vitrine
      AND id_item_estoque = p_id_item_novo
      AND id <> p_id_vitrine_item
  ) THEN
    RAISE EXCEPTION 'Item já está nesta vitrine';
  END IF;

  UPDATE public.itens_estoque
  SET id_local_estoque = v_id_local_vitrine,
      atualizado_em = now()
  WHERE id = p_id_item_novo;

  UPDATE public.vitrine_itens
  SET id_item_estoque = p_id_item_novo,
      estado_caixa = 'ocupada',
      id_venda_saida = NULL,
      vendido_em = NULL,
      nome_exibicao = NULL,
      snapshot = NULL,
      atualizado_em = now()
  WHERE id = p_id_vitrine_item;

  PERFORM public.vitrine_atualizar_snapshot_item(p_id_vitrine_item);
  PERFORM public.vitrine_registrar_versao(v_item.id_vitrine, 'substituicao', NULL, p_id_usuario);

  RETURN jsonb_build_object(
    'id_vitrine', v_item.id_vitrine,
    'id_vitrine_item', p_id_vitrine_item,
    'id_item_novo', p_id_item_novo,
    'versao_atual', (SELECT versao_atual FROM public.vitrines WHERE id = v_item.id_vitrine)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sincronizar_efeitos_venda(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverter_itens_removidos_venda(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.substituir_caixa_vitrine(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vitrine_montar_snapshot_caixas(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sincronizar_efeitos_venda(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reverter_itens_removidos_venda(uuid, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.substituir_caixa_vitrine(uuid, uuid, uuid) TO service_role;

-- Contagem de alertas (buracos na publicada)
CREATE OR REPLACE FUNCTION public.vitrine_contar_alertas_atual()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(COUNT(*)::integer, 0)
  FROM public.vitrine_itens vi
  JOIN public.vitrines v ON v.id = vi.id_vitrine
  WHERE v.status = 'publicada'
    AND vi.estado_caixa = 'vendida';
$$;

GRANT EXECUTE ON FUNCTION public.vitrine_contar_alertas_atual() TO authenticated;
GRANT EXECUTE ON FUNCTION public.vitrine_contar_alertas_atual() TO service_role;

-- 5. Patch publicar_vitrine: estado_caixa ocupada + versão inicial
-- Recriamos o final da função adicionando calls após publicar.
-- Mais seguro: wrapper trigger AFTER/AFTER não; alteramos via CREATE OR REPLACE
-- lendo o restante do arquivo original e acrescentando ao fim.

-- Em vez de reescrever toda publicar_vitrine, usamos trigger AFTER UPDATE status→publicada:
CREATE OR REPLACE FUNCTION public.trg_vitrine_apos_publicar()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'publicada' AND (OLD.status IS DISTINCT FROM 'publicada') THEN
    UPDATE public.vitrine_itens
    SET estado_caixa = 'ocupada',
        id_venda_saida = NULL,
        vendido_em = NULL,
        atualizado_em = now()
    WHERE id_vitrine = NEW.id;

    PERFORM public.vitrine_registrar_versao_inicial(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vitrines_apos_publicar ON public.vitrines;
CREATE TRIGGER vitrines_apos_publicar
AFTER UPDATE OF status ON public.vitrines
FOR EACH ROW
EXECUTE FUNCTION public.trg_vitrine_apos_publicar();

-- 6. Backfill: itens em OV ativa → vendido
UPDATE public.itens_estoque ie
SET status_item = 'vendido',
    atualizado_em = now()
WHERE ie.status_item = 'em_estoque'
  AND EXISTS (
    SELECT 1
    FROM public.itens_venda iv
    JOIN public.vendas v ON v.id = iv.id_venda
    WHERE iv.id_item_estoque = ie.id
      AND v.status_venda IS DISTINCT FROM 'cancelado'
  );

-- Buracos na vitrine atual para itens já vendidos (sem versão em massa; uma versão consolidada)
DO $$
DECLARE
  v_id_vitrine uuid;
  v_afetados integer;
BEGIN
  SELECT id INTO v_id_vitrine
  FROM public.vitrines
  WHERE status = 'publicada'
  ORDER BY publicado_em DESC NULLS LAST
  LIMIT 1;

  IF v_id_vitrine IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.vitrine_itens vi
  SET estado_caixa = 'vendida',
      id_venda_saida = sub.id_venda,
      vendido_em = COALESCE(sub.data_pedido, now()),
      atualizado_em = now()
  FROM (
    SELECT DISTINCT ON (iv.id_item_estoque)
      iv.id_item_estoque,
      v.id AS id_venda,
      v.data_pedido
    FROM public.itens_venda iv
    JOIN public.vendas v ON v.id = iv.id_venda
    WHERE v.status_venda IS DISTINCT FROM 'cancelado'
      AND iv.id_item_estoque IS NOT NULL
    ORDER BY iv.id_item_estoque, v.data_pedido DESC NULLS LAST
  ) sub
  WHERE vi.id_vitrine = v_id_vitrine
    AND vi.id_item_estoque = sub.id_item_estoque
    AND vi.estado_caixa = 'ocupada'
    AND EXISTS (
      SELECT 1 FROM public.itens_estoque ie
      WHERE ie.id = vi.id_item_estoque AND ie.status_item = 'vendido'
    );

  GET DIAGNOSTICS v_afetados = ROW_COUNT;

  IF v_afetados > 0 THEN
    -- Garante versão inicial se não existir
    IF NOT EXISTS (SELECT 1 FROM public.vitrine_versoes WHERE id_vitrine = v_id_vitrine) THEN
      PERFORM public.vitrine_registrar_versao_inicial(v_id_vitrine);
    END IF;
    PERFORM public.vitrine_registrar_versao(v_id_vitrine, 'venda', NULL, NULL);
  ELSIF NOT EXISTS (SELECT 1 FROM public.vitrine_versoes WHERE id_vitrine = v_id_vitrine) THEN
    PERFORM public.vitrine_registrar_versao_inicial(v_id_vitrine);
  END IF;
END $$;
