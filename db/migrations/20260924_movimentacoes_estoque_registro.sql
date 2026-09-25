-- Registra na movimentacoes_estoque os eventos fisicos do par:
-- entrada / importado_tiny, transferencia, venda, cancelamento, devolucao,
-- reserva e saida. O historico de status continua em itens_estoque_status_historico.

CREATE OR REPLACE FUNCTION public.registrar_movimentacao_estoque()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_venda uuid;
  v_origem_ctx text;
  v_raw text;
  v_tipo public.tipo_movimentacao_enum;
BEGIN
  v_raw := nullif(current_setting('app.historico_id_venda', true), '');
  IF v_raw IS NOT NULL THEN
    v_venda := v_raw::uuid;
  END IF;
  v_origem_ctx := nullif(trim(current_setting('app.historico_origem', true)), '');

  IF TG_OP = 'INSERT' THEN
    IF NEW.id_local_estoque IS NOT NULL THEN
      v_tipo := CASE
        WHEN NEW.id_tiny IS NOT NULL AND btrim(NEW.id_tiny) <> '' THEN 'importado_tiny'::public.tipo_movimentacao_enum
        ELSE 'entrada'::public.tipo_movimentacao_enum
      END;
      INSERT INTO public.movimentacoes_estoque (
        id_item_estoque, tipo_movimentacao, id_local_destino, data_movimentacao
      ) VALUES (
        NEW.id, v_tipo, NEW.id_local_estoque, COALESCE(NEW.criado_em, now())
      );
    END IF;

    IF NEW.status_item = 'vendido' THEN
      INSERT INTO public.movimentacoes_estoque (
        id_item_estoque, tipo_movimentacao, id_local_origem, id_venda, data_movimentacao
      ) VALUES (
        NEW.id, 'venda', NEW.id_local_estoque, v_venda, COALESCE(NEW.criado_em, now())
      );
    ELSIF NEW.status_item = 'reservado' THEN
      INSERT INTO public.movimentacoes_estoque (
        id_item_estoque, tipo_movimentacao, id_local_origem, data_movimentacao
      ) VALUES (
        NEW.id, 'reserva', NEW.id_local_estoque, COALESCE(NEW.criado_em, now())
      );
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.id_local_estoque IS DISTINCT FROM OLD.id_local_estoque THEN
    IF OLD.id_local_estoque IS NULL AND NEW.id_local_estoque IS NOT NULL THEN
      INSERT INTO public.movimentacoes_estoque (
        id_item_estoque, tipo_movimentacao, id_local_destino, id_venda
      ) VALUES (
        NEW.id, 'entrada', NEW.id_local_estoque, v_venda
      );
    ELSIF OLD.id_local_estoque IS NOT NULL AND NEW.id_local_estoque IS NULL THEN
      INSERT INTO public.movimentacoes_estoque (
        id_item_estoque, tipo_movimentacao, id_local_origem, id_venda
      ) VALUES (
        NEW.id, 'saida', OLD.id_local_estoque, v_venda
      );
    ELSE
      INSERT INTO public.movimentacoes_estoque (
        id_item_estoque, tipo_movimentacao, id_local_origem, id_local_destino, id_venda
      ) VALUES (
        NEW.id, 'transferencia', OLD.id_local_estoque, NEW.id_local_estoque, v_venda
      );
    END IF;
  END IF;

  IF NEW.status_item IS DISTINCT FROM OLD.status_item THEN
    IF NEW.status_item = 'vendido' THEN
      INSERT INTO public.movimentacoes_estoque (
        id_item_estoque, tipo_movimentacao, id_local_origem, id_venda
      ) VALUES (
        NEW.id, 'venda', NEW.id_local_estoque, v_venda
      );
    ELSIF NEW.status_item = 'reservado' THEN
      INSERT INTO public.movimentacoes_estoque (
        id_item_estoque, tipo_movimentacao, id_local_origem
      ) VALUES (
        NEW.id, 'reserva', NEW.id_local_estoque
      );
    ELSIF NEW.status_item = 'devolvido' THEN
      INSERT INTO public.movimentacoes_estoque (
        id_item_estoque, tipo_movimentacao, id_local_destino, id_venda
      ) VALUES (
        NEW.id, 'devolucao', NEW.id_local_estoque, v_venda
      );
    ELSIF OLD.status_item = 'vendido' AND NEW.status_item = 'em_estoque' THEN
      v_tipo := CASE
        WHEN v_origem_ctx = 'venda' OR v_venda IS NOT NULL THEN 'cancelamento'::public.tipo_movimentacao_enum
        ELSE 'devolucao'::public.tipo_movimentacao_enum
      END;
      INSERT INTO public.movimentacoes_estoque (
        id_item_estoque, tipo_movimentacao, id_local_destino, id_venda
      ) VALUES (
        NEW.id, v_tipo, NEW.id_local_estoque, v_venda
      );
    ELSIF NEW.status_item IN ('fora_de_estoque', 'inativo')
      AND OLD.status_item IN ('em_estoque', 'reservado', 'transferencia') THEN
      INSERT INTO public.movimentacoes_estoque (
        id_item_estoque, tipo_movimentacao, id_local_origem
      ) VALUES (
        NEW.id, 'saida', COALESCE(NEW.id_local_estoque, OLD.id_local_estoque)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS registrar_movimentacao_estoque ON public.itens_estoque;
CREATE TRIGGER registrar_movimentacao_estoque
AFTER INSERT OR UPDATE OF id_local_estoque, status_item
ON public.itens_estoque
FOR EACH ROW
EXECUTE FUNCTION public.registrar_movimentacao_estoque();

-- Posicao atual: chegada no local em que o par esta hoje.
INSERT INTO public.movimentacoes_estoque (
  id_item_estoque,
  tipo_movimentacao,
  id_local_destino,
  data_movimentacao,
  observacoes
)
SELECT
  ie.id,
  CASE
    WHEN ie.id_tiny IS NOT NULL AND btrim(ie.id_tiny) <> '' THEN 'importado_tiny'::public.tipo_movimentacao_enum
    ELSE 'entrada'::public.tipo_movimentacao_enum
  END,
  ie.id_local_estoque,
  ie.criado_em,
  'Registro inicial do estoque existente'
FROM public.itens_estoque ie
WHERE ie.id_local_estoque IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.movimentacoes_estoque m
    WHERE m.id_item_estoque = ie.id
      AND m.tipo_movimentacao IN ('entrada', 'importado_tiny')
  );

-- Itens vendidos agora: saida ligada a ordem ativa mais recente, quando houver.
INSERT INTO public.movimentacoes_estoque (
  id_item_estoque,
  tipo_movimentacao,
  id_local_origem,
  id_venda,
  data_movimentacao,
  observacoes
)
SELECT
  ie.id,
  'venda'::public.tipo_movimentacao_enum,
  ie.id_local_estoque,
  venda.id,
  GREATEST(COALESCE(venda.data_pedido, ie.atualizado_em), ie.criado_em),
  CASE
    WHEN venda.id IS NULL THEN 'Item vendido sem ordem de venda ativa vinculada'
    ELSE NULL
  END
FROM public.itens_estoque ie
LEFT JOIN LATERAL (
  SELECT v.id, v.data_pedido
  FROM public.itens_venda iv
  JOIN public.vendas v ON v.id = iv.id_venda
  WHERE iv.id_item_estoque = ie.id
    AND v.status_venda IS DISTINCT FROM 'cancelado'
  ORDER BY v.data_pedido DESC NULLS LAST, v.criado_em DESC
  LIMIT 1
) venda ON true
WHERE ie.status_item = 'vendido'
  AND NOT EXISTS (
    SELECT 1
    FROM public.movimentacoes_estoque m
    WHERE m.id_item_estoque = ie.id
      AND m.tipo_movimentacao = 'venda'
  );

INSERT INTO public.movimentacoes_estoque (
  id_item_estoque,
  tipo_movimentacao,
  id_local_origem,
  data_movimentacao,
  observacoes
)
SELECT
  ie.id,
  'reserva'::public.tipo_movimentacao_enum,
  ie.id_local_estoque,
  ie.atualizado_em,
  'Registro inicial do estoque existente'
FROM public.itens_estoque ie
WHERE ie.status_item = 'reservado'
  AND NOT EXISTS (
    SELECT 1
    FROM public.movimentacoes_estoque m
    WHERE m.id_item_estoque = ie.id
      AND m.tipo_movimentacao = 'reserva'
  );
