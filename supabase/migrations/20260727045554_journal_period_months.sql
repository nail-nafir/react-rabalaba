-- Replace manual/weekly/monthly reporting modes with compact WIB calendar
-- blocks. Existing rows intentionally start at the 1-month default; reset
-- metadata and every journal trade remain untouched.

drop function if exists public.get_journal_period_config();

alter table public.journal_settings
  drop constraint if exists journal_settings_period_mode_check;

alter table public.journal_settings
  alter column journal_period_mode drop default,
  alter column journal_period_mode type smallint using 1::smallint;

alter table public.journal_settings
  rename column journal_period_mode to journal_period_months;

alter table public.journal_settings
  alter column journal_period_months set default 1;

alter table public.journal_settings
  add constraint journal_settings_period_months_check
  check (journal_period_months in (1, 3, 6, 12));

create function public.get_journal_period_config()
returns table (
  journal_period_months smallint,
  journal_period_reset_at timestamptz,
  server_now timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    js.journal_period_months,
    js.journal_period_reset_at,
    now() as server_now
  from public.journal_settings as js
  where js.id = true
    and (select auth.uid()) is not null;
$$;

revoke all on function public.get_journal_period_config() from public;
revoke all on function public.get_journal_period_config() from anon;
grant execute on function public.get_journal_period_config() to authenticated;
