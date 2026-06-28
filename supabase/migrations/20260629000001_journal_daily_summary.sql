-- End-of-day Discord recap — make its on/off + send hour data-driven on the
-- SAME singleton journal_settings row (20260617000002). A separate edge function
-- (daily-summary) ticks at a fixed base cadence and reads these each tick to
-- decide whether to send today's recap, so changing the hour or pausing is pure
-- data: NO cron edit, NO redeploy. RLS already covers the whole row (admin
-- `for all` policy), so no new policy is needed.

alter table public.journal_settings
  add column if not exists daily_summary_enabled boolean not null default false,
  add column if not exists daily_summary_hour    int     not null default 23
                              check (daily_summary_hour between 0 and 23),
  -- Dedup: stamped after each send so the recap fires at most once per WIB day.
  add column if not exists daily_summary_last_sent_at timestamptz;
