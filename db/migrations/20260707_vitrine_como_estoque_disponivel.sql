-- Trata o local "Vitrine" como estoque europeu normal na seleção da próxima vitrine.

CREATE OR REPLACE FUNCTION public.validar_itens_vitrine(p_ids uuid[])
RETURNS TABLE(id_item uuid, valido boolean, motivo text)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  WITH ids AS (
    SELECT DISTINCT unnest(COALESCE(p_ids, ARRAY[]::uuid[])) AS id
  )
  SELECT
    ids.id AS id_item,
    CASE
      WHEN ie.id IS NULL THEN false
      WHEN ie.status_item <> 'em_estoque' THEN false
      WHEN le.id IS NULL THEN false
      WHEN le.ativo IS NOT TRUE OR le.tipo_regiao <> 'europa' THEN false
      ELSE true
    END AS valido,
    CASE
      WHEN ie.id IS NULL THEN 'Item não encontrado'
      WHEN ie.status_item <> 'em_estoque' THEN 'Item não está disponível em estoque'
      WHEN le.id IS NULL THEN 'Item sem local de estoque'
      WHEN le.ativo IS NOT TRUE OR le.tipo_regiao <> 'europa' THEN 'Item não está em local europeu ativo'
      ELSE null
    END AS motivo
  FROM ids
  LEFT JOIN public.itens_estoque ie ON ie.id = ids.id
  LEFT JOIN public.locais_estoque le ON le.id = ie.id_local_estoque
$$;

CREATE OR REPLACE FUNCTION public.vitrines_contagem_modelo(
  p_modelo_ids uuid[],
  p_local_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(id_modelo_produto uuid, total integer)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    ie.id_modelo_produto,
    count(*)::integer AS total
  FROM public.itens_estoque ie
  JOIN public.locais_estoque le ON le.id = ie.id_local_estoque
  WHERE ie.id_modelo_produto = ANY(COALESCE(p_modelo_ids, ARRAY[]::uuid[]))
    AND ie.status_item = 'em_estoque'
    AND le.ativo = true
    AND le.tipo_regiao = 'europa'
    AND (p_local_ids IS NULL OR ie.id_local_estoque = ANY(p_local_ids))
  GROUP BY ie.id_modelo_produto
$$;

CREATE OR REPLACE FUNCTION public.publicar_vitrine(
  p_id_vitrine uuid,
  p_id_usuario uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_vitrine public.vitrines%ROWTYPE;
  v_vitrine_anterior public.vitrines%ROWTYPE;
  v_id_local_vitrine uuid;
  v_total integer;
  v_total_invalidos integer;
  v_total_destinos integer;
  v_item record;
  v_snapshot jsonb;
  v_destino record;
  v_ids_novos uuid[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('publicar_vitrine'));

  SELECT * INTO v_vitrine
  FROM public.vitrines
  WHERE id = p_id_vitrine
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vitrine não encontrada';
  END IF;

  IF v_vitrine.status <> 'rascunho' THEN
    RAISE EXCEPTION 'Somente vitrines em rascunho podem ser publicadas';
  END IF;

  SELECT public.vitrines_id_local_vitrine() INTO v_id_local_vitrine;
  IF v_id_local_vitrine IS NULL THEN
    RAISE EXCEPTION 'Local de estoque Vitrine não encontrado ou inativo';
  END IF;

  SELECT count(*) INTO v_total
  FROM public.vitrine_itens
  WHERE id_vitrine = p_id_vitrine;

  IF v_total <> 22 THEN
    RAISE EXCEPTION 'A vitrine precisa ter exatamente 22 itens selecionados';
  END IF;

  SELECT count(*) INTO v_total
  FROM public.vitrine_itens
  WHERE id_vitrine = p_id_vitrine
    AND numero_caixa BETWEEN 1 AND 22;

  IF v_total <> 22 THEN
    RAISE EXCEPTION 'Todas as 22 caixas precisam estar preenchidas';
  END IF;

  SELECT array_agg(id_item_estoque) INTO v_ids_novos
  FROM public.vitrine_itens
  WHERE id_vitrine = p_id_vitrine;

  SELECT count(*) INTO v_total_invalidos
  FROM public.validar_itens_vitrine(v_ids_novos)
  WHERE valido IS NOT TRUE;

  IF v_total_invalidos > 0 THEN
    RAISE EXCEPTION 'Há itens selecionados que não estão mais disponíveis para vitrine';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.vitrine_itens vi
    JOIN public.vitrines v ON v.id = vi.id_vitrine
    WHERE vi.id_item_estoque = ANY(v_ids_novos)
      AND v.status = 'rascunho'
      AND v.id <> p_id_vitrine
  ) THEN
    RAISE EXCEPTION 'Há itens selecionados em outro rascunho de vitrine';
  END IF;

  SELECT * INTO v_vitrine_anterior
  FROM public.vitrines
  WHERE status = 'publicada'
  ORDER BY publicado_em DESC NULLS LAST, criado_em DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    SELECT count(*) INTO v_total
    FROM public.vitrine_itens
    WHERE id_vitrine = v_vitrine_anterior.id
      AND NOT (id_item_estoque = ANY(v_ids_novos));

    SELECT count(*) INTO v_total_destinos
    FROM public.vitrine_destinos_saida vds
    JOIN public.vitrine_itens vi
      ON vi.id_item_estoque = vds.id_item_estoque
     AND vi.id_vitrine = v_vitrine_anterior.id
    JOIN public.locais_estoque le ON le.id = vds.id_local_destino
    WHERE vds.id_vitrine = p_id_vitrine
      AND NOT (vi.id_item_estoque = ANY(v_ids_novos))
      AND le.ativo = true
      AND vds.id_local_destino <> v_id_local_vitrine;

    IF v_total_destinos <> v_total THEN
      RAISE EXCEPTION 'Todos os itens da vitrine anterior precisam ter destino válido';
    END IF;
  END IF;

  FOR v_item IN
    SELECT
      vi.id AS id_vitrine_item,
      vi.id_item_estoque,
      vi.numero_caixa,
      COALESCE(NULLIF(trim(vi.nome_exibicao), ''), ie.nome_produto) AS nome_exibicao,
      ie.sku,
      ie.nome_produto,
      ie.id_modelo_produto,
      ie.numeracao_br,
      ie.numeracao_eu,
      ie.numeracao_us,
      ie.sistema_numeracao,
      ie.preco_venda,
      ie.moeda_venda,
      le.tipo_regiao AS tipo_regiao_local,
      mp.nome_modelo,
      m.nome AS marca_nome,
      c.nome AS categoria_nome,
      img.url AS foto_url
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
    WHERE vi.id_vitrine = p_id_vitrine
    ORDER BY vi.numero_caixa
  LOOP
    SELECT jsonb_build_object(
      'id_item_estoque', v_item.id_item_estoque,
      'sku', v_item.sku,
      'nome_produto', v_item.nome_produto,
      'nome_exibicao', v_item.nome_exibicao,
      'foto_url', v_item.foto_url,
      'id_modelo_produto', v_item.id_modelo_produto,
      'nome_modelo', v_item.nome_modelo,
      'marca', v_item.marca_nome,
      'categoria', v_item.categoria_nome,
      'numeracao_br', v_item.numeracao_br,
      'numeracao_eu', v_item.numeracao_eu,
      'numeracao_us', v_item.numeracao_us,
      'sistema_numeracao', v_item.sistema_numeracao,
      'preco', v_item.preco_venda,
      'moeda', public.moeda_venda_item_estoque(v_item.moeda_venda, v_item.tipo_regiao_local),
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
          WHERE ie2.id_modelo_produto = v_item.id_modelo_produto
            AND ie2.status_item = 'em_estoque'
            AND ie2.id <> v_item.id_item_estoque
            AND NOT (ie2.id = ANY(v_ids_novos))
            AND le2.ativo = true
            AND le2.tipo_regiao = 'europa'
        ) corr
      ), '[]'::jsonb)
    ) INTO v_snapshot;

    v_snapshot := v_snapshot || jsonb_build_object(
      'item_unico',
      jsonb_array_length(v_snapshot->'correspondencias') = 0
    );

    UPDATE public.vitrine_itens
    SET snapshot = v_snapshot,
        nome_exibicao = v_item.nome_exibicao
    WHERE id = v_item.id_vitrine_item;
  END LOOP;

  IF v_vitrine_anterior.id IS NOT NULL THEN
    FOR v_destino IN
      SELECT vds.id_item_estoque, vds.id_local_destino
      FROM public.vitrine_destinos_saida vds
      JOIN public.vitrine_itens vi
        ON vi.id_item_estoque = vds.id_item_estoque
       AND vi.id_vitrine = v_vitrine_anterior.id
      WHERE vds.id_vitrine = p_id_vitrine
        AND NOT (vds.id_item_estoque = ANY(v_ids_novos))
    LOOP
      UPDATE public.itens_estoque
      SET id_local_estoque = v_destino.id_local_destino
      WHERE id = v_destino.id_item_estoque;
    END LOOP;

    UPDATE public.vitrines
    SET status = 'encerrada',
        encerrado_em = now()
    WHERE id = v_vitrine_anterior.id;
  END IF;

  UPDATE public.itens_estoque
  SET id_local_estoque = v_id_local_vitrine
  WHERE id = ANY(v_ids_novos);

  UPDATE public.vitrines
  SET status = 'publicada',
      etapa = 'revisao',
      id_usuario = COALESCE(p_id_usuario, id_usuario),
      publicado_em = now()
  WHERE id = p_id_vitrine;

  RETURN jsonb_build_object('sucesso', true, 'id_vitrine', p_id_vitrine);
END;
$$;
