-- Phase 3 — user-bound entitlements via Supabase Auth (email + password).
-- Replaces the forgeable localStorage premium grant with server-side truth.
-- Free tier stays ANONYMOUS (no auth); login is required only to redeem a code.

-- 1. profiles — one row per authenticated user, holds the entitlement.
create table if not exists public.profiles (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  tier             text not null default 'free'
                     check (tier in ('free', 'trial', 'premium')),
  trial_expires_at timestamptz,
  updated_at       timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users may read ONLY their own entitlement. There are deliberately NO
-- insert/update/delete policies → the client can never write its own tier;
-- only the SECURITY DEFINER RPC below can.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = user_id);

-- Auto-provision a free profile the instant a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, tier)
  values (new.id, 'free')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. access_codes — add reuse controls. kind stays ('full' | 'trial').
alter table public.access_codes
  add column if not exists max_redemptions int,  -- null = unlimited (e.g. a shared trial code)
  add column if not exists trial_days       int; -- trial length for kind = 'trial'

-- 3. code_redemptions — who redeemed what. Enforces single-use (via max_redemptions)
--    and one-redeem-per-account (via the composite PK); doubles as an audit trail.
create table if not exists public.code_redemptions (
  code        text        not null references public.access_codes (code) on delete cascade,
  user_id     uuid        not null references auth.users (id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (code, user_id)
);

alter table public.code_redemptions enable row level security;
drop policy if exists redemptions_select_own on public.code_redemptions;
create policy redemptions_select_own on public.code_redemptions
  for select using (auth.uid() = user_id);

-- 4. redeem_access_code — the ONLY path to premium/trial. Runs as the caller
--    (auth.uid()): validates + consumes the code, then writes the entitlement.
--    Returns: 'premium' | 'trial' | 'invalid' | 'exhausted' | 'already' | 'unauthenticated'.
create or replace function public.redeem_access_code(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_kind       text;
  v_max        int;
  v_trial_days int;
  v_used       int;
begin
  if v_uid is null then
    return 'unauthenticated';
  end if;

  -- Lock the code row so concurrent redeems of the same code serialize — makes
  -- the max_redemptions check below race-free (no over-redeeming a 1-use code).
  select kind, max_redemptions, trial_days
    into v_kind, v_max, v_trial_days
    from public.access_codes
   where code = p_code
     for update;

  if v_kind is null then
    return 'invalid';
  end if;

  -- Already redeemed by this user → idempotent no-op.
  if exists (
    select 1 from public.code_redemptions
     where code = p_code and user_id = v_uid
  ) then
    return 'already';
  end if;

  -- Enforce the global cap (null = unlimited).
  if v_max is not null then
    select count(*) into v_used
      from public.code_redemptions where code = p_code;
    if v_used >= v_max then
      return 'exhausted';
    end if;
  end if;

  -- Defensive: guarantee a profile row exists (trigger normally creates it).
  insert into public.profiles (user_id, tier)
  values (v_uid, 'free')
  on conflict (user_id) do nothing;

  insert into public.code_redemptions (code, user_id) values (p_code, v_uid);

  if v_kind = 'full' then
    update public.profiles
       set tier = 'premium', trial_expires_at = null, updated_at = now()
     where user_id = v_uid;
    return 'premium';
  end if;

  -- trial: set expiry from now, but never downgrade an existing premium.
  update public.profiles
     set tier = case when tier = 'premium' then 'premium' else 'trial' end,
         trial_expires_at = case
           when tier = 'premium' then trial_expires_at
           else now() + make_interval(days => coalesce(v_trial_days, 7))
         end,
         updated_at = now()
   where user_id = v_uid;

  return (select tier from public.profiles where user_id = v_uid);
end;
$$;

revoke all on function public.redeem_access_code(text) from public;
grant execute on function public.redeem_access_code(text) to authenticated;

-- verify_access_code (anon, returns kind only) is now superseded by
-- redeem_access_code; left in place as it grants nothing on its own.

-- Seed examples (run in the SQL Editor, kept out of git):
--   -- single-use premium code:
--   insert into public.access_codes (code, kind, max_redemptions)
--     values ('<premium code>', 'full', 1) on conflict (code) do nothing;
--   -- shared trial code (anyone, once each, 7-day trial):
--   insert into public.access_codes (code, kind, trial_days)
--     values ('<trial code>', 'trial', 7) on conflict (code) do nothing;
