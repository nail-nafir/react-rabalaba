-- Admin user-list & access-code RPCs — returns all registered users with their
-- entitlement + access-code info, and all access codes with redemption counts.
-- SECURITY DEFINER bypasses RLS on profiles/auth.users; the is_admin() guard
-- limits callers to admins only. See [[admin-list-users]], [[access-codes]].

-- 1. admin_list_users — every registered user with their tier + redeemed code.
create or replace function public.admin_list_users()
returns table (
  user_id            uuid,
  email              text,
  tier               text,
  is_admin           boolean,
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

revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;

-- 2. admin_list_access_codes — every code with its redemption count.
create or replace function public.admin_list_access_codes()
returns table (
  code              text,
  kind              text,
  note              text,
  max_redemptions   int,
  trial_days        int,
  redemption_count  bigint,
  created_at        timestamptz
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
      ac.code                                                as code,
      ac.kind::text                                          as kind,
      ac.note                                                as note,
      ac.max_redemptions                                     as max_redemptions,
      ac.trial_days                                          as trial_days,
      (select count(*) from public.code_redemptions cr
       where cr.code = ac.code)                              as redemption_count,
      ac.created_at                                          as created_at
    from public.access_codes ac
    order by ac.created_at desc;
end;
$$;

revoke all on function public.admin_list_access_codes() from public;
grant execute on function public.admin_list_access_codes() to authenticated;
