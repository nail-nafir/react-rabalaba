-- "Last Access" tracking: surface WHEN a user last actually used the web app,
-- not just when they last logged in. auth.users.last_sign_in_at only moves on
-- login, so a still-active user who logged in last week (never logged out) reads
-- as stale. We stamp public.profiles.last_active_at whenever the app hits the
-- backend (throttled client-side ~5 min; see src/hooks/use-activity-ping.ts).

alter table public.profiles
  add column if not exists last_active_at timestamptz;

-- Seed from the last login so the column isn't all-null on day one; it then
-- self-heals to real activity as users return.
update public.profiles p
   set last_active_at = u.last_sign_in_at
  from auth.users u
 where u.id = p.user_id
   and p.last_active_at is null;

-- Let an authenticated user stamp ONLY their own row's last_active_at. profiles
-- is read-only to users under RLS, so this SECURITY DEFINER fn is the write path
-- (mirrors the auth.uid()-scoped pattern of redeem_access_code / is_premium).
-- Anonymous callers → auth.uid() is null → 0 rows touched (no-op).
create or replace function public.touch_last_active()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set last_active_at = now()
   where user_id = auth.uid();
$$;

revoke all on function public.touch_last_active() from public, anon;
grant execute on function public.touch_last_active() to authenticated;

-- Add last_active_at to admin_list_users(). Body mirrors the prior definition
-- (20260625000004) + one new trailing column. Changing a RETURNS TABLE shape
-- needs a DROP + recreate (can't CREATE OR REPLACE a new return type).
drop function if exists public.admin_list_users();
create or replace function public.admin_list_users()
returns table (
  user_id             uuid,
  email               text,
  tier                text,
  is_admin            boolean,
  is_owner            boolean,
  is_blocked          boolean,
  trial_expires_at    timestamptz,
  access_code         text,
  access_code_kind    text,
  redeemed_at         timestamptz,
  email_confirmed_at  timestamptz,
  last_sign_in_at     timestamptz,
  last_active_at      timestamptz,
  created_at          timestamptz,
  disclaimer_version  int,
  disclaimer_agreed_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  return query
    select
      u.id                           as user_id,
      u.email::text                  as email,
      coalesce(p.tier, 'free')::text as tier,
      coalesce(p.is_admin, false)    as is_admin,
      coalesce(p.is_owner, false)    as is_owner,
      coalesce(p.is_blocked, false)  as is_blocked,
      p.trial_expires_at             as trial_expires_at,
      cr.code                        as access_code,
      ac.kind::text                  as access_code_kind,
      cr.redeemed_at                 as redeemed_at,
      u.email_confirmed_at           as email_confirmed_at,
      u.last_sign_in_at              as last_sign_in_at,
      p.last_active_at               as last_active_at,
      u.created_at                   as created_at,
      dis.version                    as disclaimer_version,
      dis.agreed_at                  as disclaimer_agreed_at
    from auth.users u
    left join public.profiles p          on p.user_id = u.id
    left join public.code_redemptions cr on cr.user_id = u.id
    left join public.access_codes ac     on ac.code = cr.code
    -- Latest disclaimer the user accepted (highest version).
    left join lateral (
      select da.version, da.agreed_at
        from public.disclaimer_agreements da
       where da.user_id = u.id
       order by da.version desc
       limit 1
    ) dis on true
    order by u.created_at desc;
end;
$$;

revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;
