-- 1. Add is_blocked column to public.profiles table
alter table public.profiles
  add column if not exists is_blocked boolean not null default false;

-- 2. Update is_premium() to respect is_blocked
create or replace function public.is_premium()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid()
      and coalesce(is_blocked, false) = false
      and (
        tier = 'premium'
        or (tier = 'trial' and trial_expires_at > now())
      )
  );
$$;

-- 3. Update is_admin() to respect is_blocked
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select is_admin or is_owner from public.profiles where user_id = auth.uid() and coalesce(is_blocked, false) = false),
    false
  );
$$;

-- 4. Update is_owner() to respect is_blocked
create or replace function public.is_owner()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select is_owner from public.profiles where user_id = auth.uid() and coalesce(is_blocked, false) = false),
    false
  );
$$;

-- 5. Update admin_list_users() to return is_blocked
drop function if exists public.admin_list_users();
create or replace function public.admin_list_users()
returns table (
  user_id            uuid,
  email              text,
  tier               text,
  is_admin           boolean,
  is_owner           boolean,
  is_blocked         boolean,
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
      coalesce(p.is_blocked, false)  as is_blocked,
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

-- 6. Create RPC for deactivating / blocking a user
create or replace function public.admin_toggle_block_user(
  p_user_id uuid,
  p_blocked boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Check if caller is admin/owner
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  -- Prevent blocking yourself
  if p_user_id = auth.uid() then
    raise exception 'cannot block self';
  end if;

  -- Update profiles
  update public.profiles
  set is_blocked = p_blocked,
      updated_at = now()
  where user_id = p_user_id;
end;
$$;

-- 7. Create RPC for deleting a user
create or replace function public.admin_delete_user(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Check if caller is admin/owner
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  -- Prevent deleting yourself
  if p_user_id = auth.uid() then
    raise exception 'cannot delete self';
  end if;

  -- Delete from auth.users (profile cascades)
  delete from auth.users where id = p_user_id;
end;
$$;

-- Grant execution permissions
revoke all on function public.admin_toggle_block_user(uuid, boolean) from public;
grant execute on function public.admin_toggle_block_user(uuid, boolean) to authenticated;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;
