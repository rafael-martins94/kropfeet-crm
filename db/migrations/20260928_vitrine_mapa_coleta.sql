-- Mapa de coleta: congela na publicação de onde vêm os pares que entram na
-- vitrine, para onde vão os que saem e quais mudam de caixa.

ALTER TABLE public.vitrines
  ADD COLUMN IF NOT EXISTS mapa_coleta jsonb;

-- p_com_local_atual = false é usado na reconstrução de vitrines antigas:
-- o local atual do par já não é o de origem, então fica sem registro.
CREATE OR REPLACE FUNCTION public.vitrine_montar_mapa_coleta(
  p_id_vitrine uuid,
  p_id_vitrine_anterior uuid,
  p_com_local_atual boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  WITH novos AS (
    SELECT vi.id_item_estoque, vi.numero_caixa, vi.nome_exibicao
    FROM public.vitrine_itens vi
    WHERE vi.id_vitrine = p_id_vitrine
  ),
  anteriores AS (
    SELECT vi.id_item_estoque, vi.numero_caixa, vi.nome_exibicao, vi.estado_caixa
    FROM public.vitrine_itens vi
    WHERE p_id_vitrine_anterior IS NOT NULL
      AND vi.id_vitrine = p_id_vitrine_anterior
  ),
  movimentos AS (
    SELECT
      'entrada'::text AS tipo,
      n.id_item_estoque,
      NULL::smallint AS caixa_origem,
      n.numero_caixa AS caixa_destino,
      n.nome_exibicao,
      CASE WHEN p_com_local_atual THEN ie.id_local_estoque END AS id_local
    FROM novos n
    JOIN public.itens_estoque ie ON ie.id = n.id_item_estoque
    WHERE NOT EXISTS (SELECT 1 FROM anteriores a WHERE a.id_item_estoque = n.id_item_estoque)

    UNION ALL

    SELECT
      'saida',
      a.id_item_estoque,
      a.numero_caixa,
      NULL::smallint,
      a.nome_exibicao,
      vds.id_local_destino
    FROM anteriores a
    LEFT JOIN public.vitrine_destinos_saida vds
      ON vds.id_vitrine = p_id_vitrine
     AND vds.id_item_estoque = a.id_item_estoque
    WHERE a.estado_caixa = 'ocupada'
      AND NOT EXISTS (SELECT 1 FROM novos n WHERE n.id_item_estoque = a.id_item_estoque)

    UNION ALL

    SELECT
      'troca_caixa',
      n.id_item_estoque,
      a.numero_caixa,
      n.numero_caixa,
      n.nome_exibicao,
      NULL::uuid
    FROM novos n
    JOIN anteriores a ON a.id_item_estoque = n.id_item_estoque
    WHERE a.numero_caixa IS DISTINCT FROM n.numero_caixa
  ),
  detalhe AS (
    SELECT
      m.tipo,
      m.caixa_origem,
      m.caixa_destino,
      jsonb_build_object(
        'id_item_estoque', m.id_item_estoque,
        'sku', ie.sku,
        'nome', COALESCE(NULLIF(trim(m.nome_exibicao), ''), ie.nome_produto),
        'nome_modelo', mp.nome_modelo,
        'marca', ma.nome,
        'numeracao_br', ie.numeracao_br,
        'numeracao_eu', ie.numeracao_eu,
        'numeracao_us', ie.numeracao_us,
        'sistema_numeracao', ie.sistema_numeracao,
        'foto_url', img.url,
        'caixa_origem', m.caixa_origem,
        'caixa_destino', m.caixa_destino,
        'id_local', m.id_local,
        'local_nome', le.nome
      ) AS item
    FROM movimentos m
    JOIN public.itens_estoque ie ON ie.id = m.id_item_estoque
    LEFT JOIN public.locais_estoque le ON le.id = m.id_local
    LEFT JOIN public.modelos_produto mp ON mp.id = ie.id_modelo_produto
    LEFT JOIN public.marcas ma ON ma.id = mp.id_marca
    LEFT JOIN LATERAL (
      SELECT COALESCE(imp.url_origem, imp.caminho_arquivo) AS url
      FROM public.imagens_modelo_produto imp
      WHERE imp.id_modelo_produto = ie.id_modelo_produto
      ORDER BY imp.imagem_principal DESC, imp.ordem_exibicao ASC, imp.criado_em ASC
      LIMIT 1
    ) img ON true
  )
  SELECT jsonb_build_object(
    'gerado_em', now(),
    'reconstruido', NOT p_com_local_atual,
    'id_vitrine_anterior', p_id_vitrine_anterior,
    'entradas', COALESCE(
      (SELECT jsonb_agg(item ORDER BY caixa_destino) FROM detalhe WHERE tipo = 'entrada'),
      '[]'::jsonb
    ),
    'saidas', COALESCE(
      (SELECT jsonb_agg(item ORDER BY caixa_origem) FROM detalhe WHERE tipo = 'saida'),
      '[]'::jsonb
    ),
    'trocas_caixa', COALESCE(
      (SELECT jsonb_agg(item ORDER BY caixa_destino) FROM detalhe WHERE tipo = 'troca_caixa'),
      '[]'::jsonb
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.vitrine_montar_mapa_coleta(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vitrine_montar_mapa_coleta(uuid, uuid, boolean) TO service_role;

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
  v_mapa_coleta jsonb;
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

  -- Precisa rodar antes de mover o estoque: depois disso o local de origem se perde.
  v_mapa_coleta := public.vitrine_montar_mapa_coleta(p_id_vitrine, v_vitrine_anterior.id, true);

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
      publicado_em = now(),
      mapa_coleta = v_mapa_coleta
  WHERE id = p_id_vitrine;

  RETURN jsonb_build_object('sucesso', true, 'id_vitrine', p_id_vitrine);
END;
$$;

-- Vitrines já publicadas: a anterior é a encerrada na mesma transação da publicação.
UPDATE public.vitrines v
SET mapa_coleta = public.vitrine_montar_mapa_coleta(
  v.id,
  (
    SELECT ant.id
    FROM public.vitrines ant
    WHERE ant.encerrado_em = v.publicado_em
      AND ant.id <> v.id
    LIMIT 1
  ),
  false
)
WHERE v.publicado_em IS NOT NULL
  AND v.mapa_coleta IS NULL;
