-- Quando o nome do modelo muda, o nome completo do item de estoque
-- troca só a parte do modelo e mantém a numeração depois do "#".

CREATE OR REPLACE FUNCTION public.propagar_nome_modelo_para_itens()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_antigo text := btrim(regexp_replace(OLD.nome_modelo, '[[:space:]]+', ' ', 'g'));
  v_novo text := btrim(NEW.nome_modelo);
BEGIN
  IF v_novo = '' OR v_novo IS NOT DISTINCT FROM v_antigo THEN
    RETURN NEW;
  END IF;

  UPDATE public.itens_estoque ie
  SET
    nome_produto = CASE
      WHEN position('#' in ie.nome_produto) > 0 THEN
        v_novo || ' ' || substring(ie.nome_produto from position('#' in ie.nome_produto))
      WHEN btrim(regexp_replace(ie.nome_produto, '[[:space:]]+', ' ', 'g')) = v_antigo THEN
        v_novo
      WHEN btrim(ie.nome_produto) LIKE v_antigo || '%' THEN
        v_novo || substring(btrim(ie.nome_produto) from char_length(v_antigo) + 1)
      ELSE
        ie.nome_produto
    END,
    atualizado_em = now()
  WHERE ie.id_modelo_produto = NEW.id
    AND (
      position('#' in ie.nome_produto) > 0
      OR btrim(regexp_replace(ie.nome_produto, '[[:space:]]+', ' ', 'g')) = v_antigo
      OR btrim(ie.nome_produto) LIKE v_antigo || '%'
    )
    AND ie.nome_produto IS DISTINCT FROM CASE
      WHEN position('#' in ie.nome_produto) > 0 THEN
        v_novo || ' ' || substring(ie.nome_produto from position('#' in ie.nome_produto))
      WHEN btrim(regexp_replace(ie.nome_produto, '[[:space:]]+', ' ', 'g')) = v_antigo THEN
        v_novo
      WHEN btrim(ie.nome_produto) LIKE v_antigo || '%' THEN
        v_novo || substring(btrim(ie.nome_produto) from char_length(v_antigo) + 1)
      ELSE
        ie.nome_produto
    END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS modelos_produto_propagar_nome_item ON public.modelos_produto;
CREATE TRIGGER modelos_produto_propagar_nome_item
AFTER UPDATE OF nome_modelo ON public.modelos_produto
FOR EACH ROW
EXECUTE FUNCTION public.propagar_nome_modelo_para_itens();

-- Pares cujo modelo já tinha sido renomeado e o nome completo ficou para trás.
UPDATE public.itens_estoque ie
SET
  nome_produto = btrim(mp.nome_modelo) || ' ' || substring(ie.nome_produto from position('#' in ie.nome_produto)),
  atualizado_em = now()
FROM public.modelos_produto mp
WHERE ie.id_modelo_produto = mp.id
  AND position('#' in ie.nome_produto) > 0
  AND btrim(regexp_replace(split_part(ie.nome_produto, '#', 1), '[[:space:]]+', ' ', 'g'))
      IS DISTINCT FROM btrim(regexp_replace(mp.nome_modelo, '[[:space:]]+', ' ', 'g'));
