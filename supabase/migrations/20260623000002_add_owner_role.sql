-- Add is_owner column to profiles table
alter table public.profiles
  add column if not exists is_owner boolean not null default false;

-- Create or replace is_owner() helper function
create or replace function public.is_owner()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select is_owner from public.profiles where user_id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to authenticated;

-- Update is_admin() function to return true if the user is an admin OR an owner
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select is_admin or is_owner from public.profiles where user_id = auth.uid()),
    false
  );
$$;

-- Update admin_list_users() RPC to return is_owner
drop function if exists public.admin_list_users();
create or replace function public.admin_list_users()
returns table (
  user_id            uuid,
  email              text,
  tier               text,
  is_admin           boolean,
  is_owner           boolean,
  trial_expires_at   timestamptz,
  access_code        text,
  access_code_kind   text,
  redeemed_at        timestamptz,
  email_confirmed_at timestamptz,
  last_sign_in_at    timestamptz,
  created_at         timestamptz
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
      p.trial_expires_at             as trial_expires_at,
      cr.code                        as access_code,
      ac.kind::text                  as access_code_kind,
      cr.redeemed_at                 as redeemed_at,
      u.email_confirmed_at           as email_confirmed_at,
      u.last_sign_in_at              as last_sign_in_at,
      u.created_at                   as created_at
    from auth.users u
    left join public.profiles p          on p.user_id = u.id
    left join public.code_redemptions cr on cr.user_id = u.id
    left join public.access_codes ac     on ac.code = cr.code
    order by u.created_at desc;
end;
$$;
