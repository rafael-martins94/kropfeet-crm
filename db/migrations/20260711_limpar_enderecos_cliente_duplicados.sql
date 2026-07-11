-- Remove endereços duplicados do mesmo cliente (CEP normalizado só dígitos + rua + número).
-- Mantém o principal / rótulo Principal / mais antigo.
-- Reaponta vendas que referenciem o endereço removido.

WITH enderecos_norm AS (
  SELECT
    e.id,
    e.id_cliente,
    regexp_replace(coalesce(e.cep, ''), '[^0-9]', '', 'g') AS n_cep,
    lower(trim(coalesce(e.endereco, ''))) AS n_endereco,
    lower(trim(coalesce(e.numero, ''))) AS n_numero,
    row_number() OVER (
      PARTITION BY e.id_cliente,
        regexp_replace(coalesce(e.cep, ''), '[^0-9]', '', 'g'),
        lower(trim(coalesce(e.endereco, ''))),
        lower(trim(coalesce(e.numero, '')))
      ORDER BY e.principal DESC,
        CASE WHEN e.rotulo ILIKE 'Principal' THEN 0 ELSE 1 END,
        e.criado_em ASC NULLS LAST,
        e.id
    ) AS rn
  FROM public.enderecos_cliente e
),
mapa AS (
  SELECT r.id AS id_remover, m.id AS id_manter
  FROM enderecos_norm r
  JOIN enderecos_norm m
    ON m.id_cliente = r.id_cliente
   AND m.n_cep = r.n_cep
   AND m.n_endereco = r.n_endereco
   AND m.n_numero = r.n_numero
   AND m.rn = 1
  WHERE r.rn > 1
),
vendas_atualizadas AS (
  UPDATE public.vendas v
  SET id_endereco_cliente = m.id_manter
  FROM mapa m
  WHERE v.id_endereco_cliente = m.id_remover
  RETURNING v.id
)
DELETE FROM public.enderecos_cliente e
USING mapa m
WHERE e.id = m.id_remover;
