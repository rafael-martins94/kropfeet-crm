-- Data em que a SumUp pagou o repasse desta conta.
-- Casa pelo recebível já vinculado, pelo número da parcela ou, na antecipação,
-- pelo único repasse do código.

CREATE OR REPLACE FUNCTION public.data_pagamento_sumup(c public.contas_receber)
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    (
      SELECT r.data_pagamento
      FROM public.recebiveis_sumup r
      WHERE r.id = c.id_recebivel_sumup
        AND r.tipo = 'PAYOUT'
    ),
    (
      SELECT r.data_pagamento
      FROM public.parcelas_venda p
      JOIN public.recebiveis_sumup r
        ON upper(r.codigo_transacao) = upper(p.codigo_transacao)
       AND r.tipo = 'PAYOUT'
       AND coalesce(r.status, '') <> 'FAILED'
       AND r.parcela IS NOT DISTINCT FROM p.numero
      WHERE p.id = c.id_parcela_venda
      ORDER BY r.data_pagamento NULLS LAST, r.id
      LIMIT 1
    ),
    (
      SELECT r.data_pagamento
      FROM public.recebiveis_sumup r
      WHERE c.codigo_transacao IS NOT NULL
        AND upper(r.codigo_transacao) = upper(c.codigo_transacao)
        AND r.tipo = 'PAYOUT'
        AND coalesce(r.status, '') <> 'FAILED'
        AND (
          SELECT count(*)
          FROM public.recebiveis_sumup r2
          WHERE upper(r2.codigo_transacao) = upper(c.codigo_transacao)
            AND r2.tipo = 'PAYOUT'
            AND coalesce(r2.status, '') <> 'FAILED'
        ) = 1
      LIMIT 1
    )
  );
$$;

REVOKE ALL ON FUNCTION public.data_pagamento_sumup(public.contas_receber) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.data_pagamento_sumup(public.contas_receber) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
