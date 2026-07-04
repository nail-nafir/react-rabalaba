-- Asset auto-discovery — trending / high-volume crypto, US and ID stocks get
-- auto-added to the journal_assets universe by a new daily edge function
-- (asset-discovery), so the signal cron picks them up with NO admin action.
-- Provenance lives on journal_assets: every pre-existing row (seed + admin
-- adds) defaults to source='admin' and is NEVER auto-touched; only
-- source='auto' rows are refreshed / reactivated / pruned by discovery.
-- Config rides the SAME singleton journal_settings row (20260617000002) —
-- same data-driven spirit as daily_summary_* (20260629000001): changing caps,
-- prune window or pausing discovery is pure data, NO cron edit, NO redeploy.
-- RLS already covers both tables (admin `for all` policies); the discovery
-- cron writes with the service-role key.

alter table public.journal_assets
  add column if not exists source text not null default 'admin'
                              check (source in ('admin', 'auto')),
  -- Which feed surfaced it (e.g. 'coingecko-trending', 'binance-volume') —
  -- shown as a badge tooltip in the admin table.
  add column if not exists discovery_reason text,
  -- Refreshed every run the symbol is still trending; the prune rule
  -- deactivates auto rows whose stamp goes stale. Null on admin rows.
  add column if not exists last_discovered_at timestamptz;

alter table public.journal_settings
  add column if not exists discovery_enabled boolean not null default false,
  add column if not exists discovery_max_per_market int not null default 5
                              check (discovery_max_per_market between 1 and 20),
  add column if not exists discovery_prune_days int not null default 14
                              check (discovery_prune_days between 3 and 90),
  -- Dedup: stamped per run so the daily tick fires at most once per WIB day.
  add column if not exists discovery_last_run_at timestamptz;
