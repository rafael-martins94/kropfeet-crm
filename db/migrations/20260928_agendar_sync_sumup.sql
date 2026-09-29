-- Sincroniza SumUp Portugal e Brasil (últimos 45 dias) todo dia às 06:00 e 14:00 UTC
-- (03:00 e 11:00 em Brasília, 07:00 e 15:00 em Lisboa no horário de verão).
-- O token nasce no Vault e não aparece neste arquivo. A função publicada compara
-- o Bearer com a secret SUMUP_CRON_TOKEN, que precisa ser o mesmo valor.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net;

GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'sumup_cron_token') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'sumup_cron_token',
      'Bearer do agendamento da funcao sumup'
    );
  END IF;
END $$;

SELECT cron.unschedule('sincronizar-sumup')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sincronizar-sumup');

SELECT cron.schedule(
  'sincronizar-sumup',
  '0 6,14 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ladpawjpnaydgqremtnu.supabase.co/functions/v1/sumup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'sumup_cron_token'
      )
    ),
    body := '{"acao":"sincronizar"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
