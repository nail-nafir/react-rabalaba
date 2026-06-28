-- Schedule the daily-summary Edge Function with pg_cron (end-of-day Discord recap).
-- Run this in the Supabase SQL Editor AFTER `supabase functions deploy daily-summary`.
-- (Not a migration: it depends on the deployed function + Vault, so it must run last.)
--
-- The function ticks at a fixed BASE cadence and self-gates: it sends ONCE per WIB
-- day, at/after journal_settings.daily_summary_hour. So the send time is pure data
-- (admin-editable, no cron edit) — mirrors schedule-auto-journal.sql.

-- 1. Extensions (or enable in Dashboard → Database → Extensions).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Stash the invoke URL in Vault (run once). Reuses the existing
--    'auto_journal_bearer' secret (the public publishable key) for the gateway.
select vault.create_secret(
  'https://nravncsodgcxwkdaeqcw.supabase.co/functions/v1/daily-summary',
  'daily_summary_url'
)
where not exists (select 1 from vault.secrets where name = 'daily_summary_url');

-- 3. Tick hourly (at :00); the function self-gates to send once, on the chosen
--    WIB hour. Hour 0 fires at 00:00 WIB and recaps the FULL previous day (true
--    end of day); hour 23 recaps today up to 23:00.
select cron.schedule(
  'daily-summary-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'daily_summary_url'),
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
--   select cron.unschedule('daily-summary-hourly');
