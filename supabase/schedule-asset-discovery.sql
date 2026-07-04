-- Schedule the asset-discovery Edge Function with pg_cron (daily universe curation).
-- Run this in the Supabase SQL Editor AFTER `supabase functions deploy asset-discovery`.
-- (Not a migration: it depends on the deployed function + Vault, so it must run last.)
--
-- The function self-gates: it runs ONCE per WIB day and only while
-- journal_settings.discovery_enabled is true, so pausing / caps / prune window
-- are pure data (admin-editable, no cron edit) — mirrors the other schedules.

-- 1. Extensions (or enable in Dashboard → Database → Extensions).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Stash the invoke URL in Vault (run once). Reuses the existing
--    'auto_journal_bearer' secret (the public publishable key) for the gateway.
select vault.create_secret(
  'https://nravncsodgcxwkdaeqcw.supabase.co/functions/v1/asset-discovery',
  'asset_discovery_url'
)
where not exists (select 1 from vault.secrets where name = 'asset_discovery_url');

-- 3. Daily at 22:30 UTC = 05:30 WIB. Why this hour: the US session closed
--    ~1.5h earlier (04:00 WIB) so day_gainers/most_actives reflect a FINAL
--    fresh session; IDX volume is yesterday's close (fine at daily cadence);
--    crypto is 24/7 — and the run lands BEFORE the IDX (09:00 WIB) and US
--    opens, so new assets are in the universe for the whole day of scans.
select cron.schedule(
  'asset-discovery-daily',
  '30 22 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'asset_discovery_url'),
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
--   select cron.unschedule('asset-discovery-daily');
