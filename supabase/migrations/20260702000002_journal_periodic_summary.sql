-- Weekly + monthly Discord recaps, riding the SAME hourly daily-summary tick
-- (20260629000001) and the SAME send hour (daily_summary_hour): the weekly
-- recap fires on the week's last WIB day (Sunday ref → with hour 0 that is
-- Monday 00:00, covering the full Mon-Sun week) and the monthly recap on the
-- month's last WIB day (hour 0 → the 1st at 00:00, covering the full month).
-- Independent enable flags + send stamps per kind — pausing or enabling any of
-- them is pure data: NO cron edit, NO redeploy.

alter table public.journal_settings
  add column if not exists weekly_summary_enabled boolean not null default false,
  add column if not exists monthly_summary_enabled boolean not null default false,
  -- Dedup stamps: one send per period (claimed at the send-day boundary,
  -- same atomic-claim pattern the daily recap uses).
  add column if not exists weekly_summary_last_sent_at timestamptz,
  add column if not exists monthly_summary_last_sent_at timestamptz;
