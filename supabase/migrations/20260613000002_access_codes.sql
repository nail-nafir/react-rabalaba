-- Server-side access codes — replaces the leaked VITE_ACCESS_CODE /
-- VITE_TRIAL_CODE (which shipped in the client bundle). Codes live ONLY here;
-- the client checks them via verify_access_code() and never sees the list.

create table if not exists public.access_codes (
  code       text primary key,
  kind       text not null check (kind in ('full', 'trial')),
  note       text,
  created_at timestamptz not null default now()
);

-- RLS with NO policies → the anon/publishable key cannot read or write the
-- table at all. Only the SECURITY DEFINER function below can look codes up.
alter table public.access_codes enable row level security;

-- Returns 'full' | 'trial' for a valid code, or NULL. SECURITY DEFINER so it
-- bypasses RLS to read the table, but only ever leaks the kind — never the list.
create or replace function public.verify_access_code(p_code text)
returns text
language sql
security definer
set search_path = public
as $$
  select kind from public.access_codes where code = p_code limit 1;
$$;

revoke all on function public.verify_access_code(text) from public;
grant execute on function public.verify_access_code(text) to anon, authenticated;

-- Seed the codes via the SQL Editor (kept out of git):
--   insert into public.access_codes (code, kind) values
--     ('<your full code>',  'full'),
--     ('<your trial code>', 'trial')
--   on conflict (code) do nothing;
