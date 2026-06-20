-- Schedule the auto-journal Edge Function with pg_cron.
-- Run this in the Supabase SQL Editor AFTER `supabase functions deploy auto-journal`.
-- (Not a migration: it depends on the deployed function + Vault, so it must run last.)

-- 1. Enable the scheduler + HTTP extensions (or do it in Dashboard → Database → Extensions).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Stash the invoke URL + a bearer key in Vault (run once).
--    The bearer just needs to pass the Functions gateway → use the PUBLISHABLE key
--    (it is public anyway). The function itself writes with the auto-injected
--    service-role key, so the secret key never appears here.
-- Idempotent: skip if the secret already exists (safe to re-run the whole file).
select vault.create_secret(
  'https://nravncsodgcxwkdaeqcw.supabase.co/functions/v1/auto-journal',
  'auto_journal_url'
)
where not exists (select 1 from vault.secrets where name = 'auto_journal_url');

select vault.create_secret(
  '<PASTE VITE_SUPABASE_PUBLISHABLE_KEY HERE: sb_publishable_...>',
  'auto_journal_bearer'
)
where not exists (select 1 from vault.secrets where name = 'auto_journal_bearer');

-- 3. Schedule every 30 minutes (frequent enough to catch intraday TP/SL wicks).
select cron.schedule(
  'auto-journal-30m',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'auto_journal_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'auto_journal_bearer')
    ),
    body := jsonb_build_object('trigger', 'cron')
  );
  $$
);

-- Manage:
--   select jobid, schedule, jobname from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 10;
--   select cron.unschedule('auto-journal-30m');
