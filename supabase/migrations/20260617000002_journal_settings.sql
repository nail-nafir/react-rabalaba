-- Fase 7 — make the auto-journal SCHEDULE data-driven (interval / pause /
-- market-hours), admin-editable WITHOUT touching pg_cron. The cron keeps ticking
-- at a fixed BASE cadence (*/15 — see the one-time reschedule note at the
-- bottom); the Edge Function reads this row each tick and decides whether it's
-- enabled + due, and (optionally) skips assets whose market is currently closed.
-- Same data-driven spirit as journal_assets (20260617000001).

create table if not exists public.journal_settings (
  id                boolean     primary key default true,
  enabled           boolean     not null default true,
  interval_minutes  int         not null default 30
                      check (interval_minutes between 5 and 1440),
  market_hours_only boolean     not null default false,
  last_run_at       timestamptz,
  updated_at        timestamptz not null default now(),
  updated_by        uuid        references auth.users (id) on delete set null,
  -- Singleton: there is exactly one config row (id is always true).
  constraint journal_settings_singleton check (id = true)
);

-- Seed the single config row (defaults: enabled, every 30 min, all hours).
insert into public.journal_settings (id) values (true) on conflict (id) do nothing;

-- RLS — admins read + write from the browser; the cron uses the service-role key
-- (bypasses RLS) to read the config and stamp last_run_at. Reuses is_admin()
-- from 20260617000001_journal_assets.sql.
alter table public.journal_settings enable row level security;
drop policy if exists journal_settings_admin_all on public.journal_settings;
create policy journal_settings_admin_all
  on public.journal_settings
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── One-time: tighten the cron's BASE cadence so finer intervals are possible.
-- interval_minutes can only be as fine as the cron tick (was */30). Run ONCE in
-- the SQL Editor to make it tick every 15 min:
--   select cron.alter_job(
--     (select jobid from cron.job where jobname = 'auto-journal-30m'),
--     schedule := '*/15 * * * *'
--   );
-- (The job keeps its historical name; only the cadence changes. The edge
--  function's gate then honors interval_minutes on top of this base tick.)
