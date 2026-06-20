-- Premium users may READ the auto-journal universe, so the screener can use the
-- SAME admin-managed universe (journal_assets) as the cron — single source for
-- the crypto / US-stock / ID-stock universe. Until now reads were admin-only
-- (journal_assets_admin_all, 20260617000001) and the screener fell back to
-- bundled constants. The cron is unaffected (service-role bypasses RLS).
--
-- RLS policies are OR'd: admins keep full access via journal_assets_admin_all;
-- premium users get read-only here. Reuses is_premium() (20260614000002).
drop policy if exists journal_assets_premium_read on public.journal_assets;
create policy journal_assets_premium_read
  on public.journal_assets
  for select
  to authenticated
  using (public.is_premium());

-- OPTIONAL housekeeping — run AFTER `npm run deploy:edge` so the new cron is live
-- (it appends commodity/forex from constants + dedups first, avoiding any
-- coverage gap). Commodity & forex are now constant-driven everywhere, not the
-- DB universe, so their rows can be dropped from journal_assets:
--   delete from public.journal_assets where asset_type in ('commodity', 'forex');
