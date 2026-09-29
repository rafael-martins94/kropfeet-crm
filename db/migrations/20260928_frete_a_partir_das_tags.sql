-- Copia o frete que estava só na tag para os campos da ordem.
-- "Sedex" sem valor continua sendo forma de envio, não cobrança.

CREATE OR REPLACE FUNCTION public._frete_lido_das_tags(p_tags jsonb, p_data date)
RETURNS TABLE (
  valor numeric,
  status public.frete_status_enum,
  data_pagamento date
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  elem jsonb;
  norm text;
  sem_data text;
  trecho text;
  n numeric;
  dt date;
  dia int;
  mes int;
  ano int;
  datas date[] := ARRAY[]::date[];
  datas_pago date[] := ARRAY[]::date[];
  valores_frete numeric[] := ARRAY[]::numeric[];
  valores_sedex numeric[] := ARRAY[]::numeric[];
  valores_pago numeric[] := ARRAY[]::numeric[];
  valor_cortesia numeric := 0;
  cortesia boolean := false;
  pago boolean := false;
  em_aberto boolean := false;
BEGIN
  IF p_tags IS NULL OR jsonb_typeof(p_tags) <> 'array' THEN
    RETURN;
  END IF;

  FOR elem IN SELECT value FROM jsonb_array_elements(p_tags)
  LOOP
    norm := lower(btrim(coalesce(elem->>'descricao', '')));
    IF norm = '' OR norm IN ('sedex', 'pac') THEN
      CONTINUE;
    END IF;
    IF norm !~ 'frete|sedex|cortersia' THEN
      CONTINUE;
    END IF;

    norm := regexp_replace(norm, '/+', '/', 'g');
    norm := regexp_replace(norm, '(\d{1,2})/(\d{2})(\d{2})(?![\d/])', '\1/\2/\3', 'g');
    datas := ARRAY[]::date[];

    FOR trecho IN
      SELECT m[1]
      FROM regexp_matches(norm, '((\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?)', 'g') AS m
    LOOP
      dia := split_part(trecho, '/', 1)::int;
      mes := split_part(trecho, '/', 2)::int;
      IF split_part(trecho, '/', 3) = '' THEN
        ano := EXTRACT(YEAR FROM p_data)::int;
      ELSE
        ano := split_part(trecho, '/', 3)::int;
        IF ano < 100 THEN
          ano := 2000 + ano;
        END IF;
      END IF;

      BEGIN
        dt := make_date(ano, mes, dia);
      EXCEPTION WHEN others THEN
        dt := NULL;
      END;

      IF dt IS NOT NULL AND split_part(trecho, '/', 3) = '' AND p_data IS NOT NULL THEN
        IF dt < p_data - 60 THEN
          BEGIN
            dt := make_date(ano + 1, mes, dia);
          EXCEPTION WHEN others THEN
            dt := NULL;
          END;
        ELSIF dt > p_data + 200 THEN
          BEGIN
            dt := make_date(ano - 1, mes, dia);
          EXCEPTION WHEN others THEN
            dt := NULL;
          END;
        END IF;
      END IF;

      IF dt IS NOT NULL THEN
        datas := datas || dt;
      END IF;
    END LOOP;

    sem_data := regexp_replace(norm, '\d{1,2}/\d{1,2}(?:/\d{2,4})?', ' ', 'g');
    sem_data := replace(sem_data, ',', '.');

    IF norm ~ 'cortesia|cortersia' THEN
      cortesia := true;
      FOR n IN
        SELECT (m[1])::numeric
        FROM regexp_matches(sem_data, '(\d+(?:\.\d{1,2})?)', 'g') AS m
      LOOP
        IF n > 0 AND n < 10000 THEN
          valor_cortesia := n;
        END IF;
      END LOOP;
    ELSIF norm ~ 'falta frete|calcular frete' THEN
      em_aberto := true;
    ELSIF norm ~ 'pago|pagou|\ypg\y' THEN
      pago := true;
      datas_pago := datas_pago || datas;
      FOR n IN
        SELECT (m[1])::numeric
        FROM regexp_matches(sem_data, '(\d+(?:\.\d{1,2})?)', 'g') AS m
      LOOP
        IF n > 0 AND n < 10000 THEN
          valores_pago := valores_pago || n;
        END IF;
      END LOOP;
    ELSIF norm ~ ' ou |sedex .+ pac|pac .+ sedex' THEN
      NULL;
    ELSIF norm ~ 'frete' THEN
      FOR n IN
        SELECT (m[1])::numeric
        FROM regexp_matches(sem_data, '(\d+(?:\.\d{1,2})?)', 'g') AS m
      LOOP
        IF n > 0 AND n < 10000 THEN
          valores_frete := valores_frete || n;
        END IF;
      END LOOP;
    ELSIF norm ~ '^sedex[[:space:]]+[0-9]' THEN
      FOR n IN
        SELECT (m[1])::numeric
        FROM regexp_matches(sem_data, '(\d+(?:\.\d{1,2})?)', 'g') AS m
      LOOP
        IF n > 0 AND n < 10000 THEN
          valores_sedex := valores_sedex || n;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  IF coalesce(array_length(valores_frete, 1), 0) > 0 THEN
    SELECT coalesce(sum(x), 0) INTO valor FROM unnest(valores_frete) AS x;
  ELSIF coalesce(array_length(valores_pago, 1), 0) > 0 THEN
    SELECT coalesce(sum(x), 0) INTO valor
    FROM (SELECT DISTINCT x FROM unnest(valores_pago) AS x) AS s;
  ELSIF coalesce(array_length(valores_sedex, 1), 0) > 0 THEN
    SELECT coalesce(sum(x), 0) INTO valor FROM unnest(valores_sedex) AS x;
  ELSIF cortesia THEN
    valor := valor_cortesia;
  ELSE
    valor := 0;
  END IF;

  valor := round(coalesce(valor, 0), 2);

  IF pago THEN
    status := 'pago';
    SELECT max(x) INTO data_pagamento FROM unnest(datas_pago) AS x;
  ELSIF cortesia THEN
    status := 'cortesia';
    data_pagamento := NULL;
  ELSIF em_aberto OR valor > 0 THEN
    status := 'pendente';
    data_pagamento := NULL;
  ELSE
    RETURN;
  END IF;

  RETURN NEXT;
END;
$$;

UPDATE public.vendas AS v
SET
  valor_frete = lido.valor,
  frete_status = lido.status,
  data_pagamento_frete = CASE
    WHEN lido.status = 'pago' THEN lido.data_pagamento
    ELSE NULL
  END
FROM (
  SELECT v2.id, f.valor, f.status, f.data_pagamento
  FROM public.vendas v2
  CROSS JOIN LATERAL public._frete_lido_das_tags(v2.marcadores, v2.data_pedido::date) AS f
  WHERE coalesce(v2.valor_frete, 0) = 0
    AND v2.frete_status = 'nao_aplicavel'
) AS lido
WHERE v.id = lido.id;

DROP FUNCTION public._frete_lido_das_tags(jsonb, date);
