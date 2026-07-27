-- Non-destructive active reporting periods for the premium journal.
--
-- `journal_trades` remains the immutable track record. A "reset" only moves a
-- display/reporting cutoff on the singleton settings row; no trade is deleted
-- or moved. Weekly/monthly calendar boundaries are resolved in the app using
-- the same tested WIB window math as the Discord periodic summaries.

alter table public.journal_settings
  add column if not exists journal_period_mode text not null default 'manual',
  add column if not exists journal_period_reset_at timestamptz,
  add column if not exists journal_period_reset_by uuid
    references auth.users (id) on delete set null;

alter table public.journal_settings
  drop constraint if exists journal_settings_period_mode_check;

alter table public.journal_settings
  add constraint journal_settings_period_mode_check
  check (journal_period_mode in ('manual', 'weekly', 'monthly'));

-- Safe projection for authenticated clients. The settings table itself stays
-- admin-only; this function exposes only the three values needed to resolve the
-- journal window. SECURITY DEFINER is intentional for that narrow projection:
-- empty search_path, fully-qualified relations, no inputs, explicit auth check,
-- and execute revoked from PUBLIC/anon.
create or replace function public.get_journal_period_config()
returns table (
  journal_period_mode text,
  journal_period_reset_at timestamptz,
  server_now timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    js.journal_period_mode,
    js.journal_period_reset_at,
    now() as server_now
  from public.journal_settings as js
  where js.id = true
    and (select auth.uid()) is not null;
$$;

revoke all on function public.get_journal_period_config() from public;
revoke all on function public.get_journal_period_config() from anon;
grant execute on function public.get_journal_period_config() to authenticated;

-- Admin-only server-time reset. SECURITY INVOKER keeps the journal_settings RLS
-- policy authoritative; the explicit is_admin() guard provides a clear error
-- instead of silently returning zero updated rows.
create or replace function public.admin_start_new_journal_period()
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  reset_at timestamptz;
begin
  if caller_id is null or not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  update public.journal_settings
  set
    journal_period_reset_at = now(),
    journal_period_reset_by = caller_id,
    updated_at = now(),
    updated_by = caller_id
  where id = true
  returning journal_period_reset_at into reset_at;

  if reset_at is null then
    raise exception 'journal settings row is missing';
  end if;

  return reset_at;
end;
$$;

revoke all on function public.admin_start_new_journal_period() from public;
revoke all on function public.admin_start_new_journal_period() from anon;
grant execute on function public.admin_start_new_journal_period()
  to authenticated;
