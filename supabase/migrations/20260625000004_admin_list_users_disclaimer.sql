-- Surface disclaimer acceptance in User Management: add the user's LATEST
-- accepted disclaimer version + timestamp to admin_list_users(). Sourced from
-- disclaimer_agreements (20260625000002). Changing a RETURNS TABLE shape needs a
-- DROP + recreate (can't CREATE OR REPLACE a new return type). Body mirrors the
-- prior definition (20260623000005) + two new trailing columns.

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
