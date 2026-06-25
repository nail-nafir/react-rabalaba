-- Premium/trial via an INVITATION LINK (/invite/:code). An invitation is a
-- close cousin of an access_code, but kept in its own table so it can carry a
-- link expiry, a recipient label and a revoke flag, and so the "click a link"
-- UX stays separate from the "type a code" one. The grant logic deliberately
-- mirrors redeem_access_code (20260614000001). Admin-issued only.

-- 1. invitations — LOCKED table (RLS, no policies). Reached only via the
--    SECURITY DEFINER RPCs below, exactly like access_codes.
create table if not exists public.invitations (
  code            text primary key,
  kind            text not null check (kind in ('full', 'trial')),
  trial_days      int,                        -- trial length when kind = 'trial'
  max_redemptions int default 1,              -- null = unlimited; default single-use
  recipient_label text,                       -- free note: who it's for
  expires_at      timestamptz,                -- null = never expires
  revoked         boolean not null default false,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now()
);

alter table public.invitations enable row level security;
-- No policies on purpose: anon/publishable key can't read or write the list.

-- 2. invitation_redemptions — who claimed what (single-use + audit).
create table if not exists public.invitation_redemptions (
  code        text not null references public.invitations (code) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (code, user_id)
);

alter table public.invitation_redemptions enable row level security;
drop policy if exists invitation_redemptions_select_own on public.invitation_redemptions;
create policy invitation_redemptions_select_own on public.invitation_redemptions
  for select using (auth.uid() = user_id);

-- 3. peek_invitation — anon-safe PREVIEW for the /invite/:code page. Never leaks
--    the code list; returns just enough to render the claim card or an error.
create or replace function public.peek_invitation(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_kind       text;
  v_trial_days int;
  v_max        int;
  v_revoked    boolean;
  v_expires    timestamptz;
  v_used       int;
begin
  select kind, trial_days, max_redemptions, revoked, expires_at
    into v_kind, v_trial_days, v_max, v_revoked, v_expires
    from public.invitations
   where code = p_code;

  if v_kind is null then
    return jsonb_build_object('valid', false, 'reason', 'invalid', 'kind', null, 'trial_days', null);
  end if;
  if v_revoked then
    return jsonb_build_object('valid', false, 'reason', 'revoked', 'kind', v_kind, 'trial_days', v_trial_days);
  end if;
  if v_expires is not null and v_expires < now() then
    return jsonb_build_object('valid', false, 'reason', 'expired', 'kind', v_kind, 'trial_days', v_trial_days);
  end if;
  if v_max is not null then
    select count(*) into v_used from public.invitation_redemptions where code = p_code;
    if v_used >= v_max then
      return jsonb_build_object('valid', false, 'reason', 'exhausted', 'kind', v_kind, 'trial_days', v_trial_days);
    end if;
  end if;

  return jsonb_build_object('valid', true, 'reason', null, 'kind', v_kind, 'trial_days', v_trial_days);
end;
$$;

revoke all on function public.peek_invitation(text) from public;
grant execute on function public.peek_invitation(text) to anon, authenticated;

-- 4. redeem_invitation — the ONLY path an invitation grants entitlement. Runs as
--    the caller; mirrors redeem_access_code. Returns:
--    'premium'|'trial'|'invalid'|'expired'|'revoked'|'exhausted'|'already'|'unauthenticated'.
create or replace function public.redeem_invitation(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_kind       text;
  v_trial_days int;
  v_max        int;
  v_revoked    boolean;
  v_expires    timestamptz;
  v_used       int;
begin
  if v_uid is null then
    return 'unauthenticated';
  end if;

  -- Lock the row so concurrent claims serialize (race-free cap check).
  select kind, trial_days, max_redemptions, revoked, expires_at
    into v_kind, v_trial_days, v_max, v_revoked, v_expires
    from public.invitations
   where code = p_code
     for update;

  if v_kind is null then
    return 'invalid';
  end if;
  if v_revoked then
    return 'revoked';
  end if;
  if v_expires is not null and v_expires < now() then
    return 'expired';
  end if;

  -- Already claimed by this user → idempotent no-op.
  if exists (
    select 1 from public.invitation_redemptions
     where code = p_code and user_id = v_uid
  ) then
    return 'already';
  end if;

  if v_max is not null then
    select count(*) into v_used
      from public.invitation_redemptions where code = p_code;
    if v_used >= v_max then
      return 'exhausted';
    end if;
  end if;

  -- Defensive: guarantee a profile row (trigger normally creates it).
  insert into public.profiles (user_id, tier)
  values (v_uid, 'free')
  on conflict (user_id) do nothing;

  insert into public.invitation_redemptions (code, user_id) values (p_code, v_uid);

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

revoke all on function public.redeem_invitation(text) from public;
grant execute on function public.redeem_invitation(text) to authenticated;

-- 5. admin_create_invitation — mint an invite with a server-generated code.
create or replace function public.admin_create_invitation(
  p_kind            text,
  p_trial_days      int default null,
  p_max_redemptions int default 1,
  p_recipient_label text default null,
  p_expires_at      timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if p_kind not in ('full', 'trial') then
    raise exception 'invalid invitation kind';
  end if;

  -- Unguessable, URL-safe code (12 hex chars from a random uuid). No prefix so
  -- the share link reads /invite/<code> cleanly.
  v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);

  insert into public.invitations
    (code, kind, trial_days, max_redemptions, recipient_label, expires_at, created_by)
  values
    (v_code, p_kind,
     case when p_kind = 'trial' then p_trial_days else null end,
     p_max_redemptions, p_recipient_label, p_expires_at, auth.uid());

  return v_code;
end;
$$;

revoke all on function public.admin_create_invitation(text, int, int, text, timestamptz) from public;
grant execute on function public.admin_create_invitation(text, int, int, text, timestamptz) to authenticated;

-- 6. admin_list_invitations — every invite + its redemption count.
create or replace function public.admin_list_invitations()
returns table (
  code            text,
  kind            text,
  trial_days      int,
  max_redemptions int,
  recipient_label text,
  expires_at      timestamptz,
  revoked         boolean,
  redemption_count int,
  created_by      uuid,
  created_at      timestamptz
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
    select i.code, i.kind, i.trial_days, i.max_redemptions, i.recipient_label,
           i.expires_at, i.revoked,
           (select count(*)::int from public.invitation_redemptions r where r.code = i.code),
           i.created_by, i.created_at
      from public.invitations i
     order by i.created_at desc;
end;
$$;

revoke all on function public.admin_list_invitations() from public;
grant execute on function public.admin_list_invitations() to authenticated;

-- 7. admin_revoke_invitation — flip the revoked flag (revoke / un-revoke).
create or replace function public.admin_revoke_invitation(p_code text, p_revoked boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  update public.invitations set revoked = p_revoked where code = p_code;
  return found;
end;
$$;

revoke all on function public.admin_revoke_invitation(text, boolean) from public;
grant execute on function public.admin_revoke_invitation(text, boolean) to authenticated;

-- 8. admin_delete_invitation — permanently remove an invite. Its redemption
--    rows cascade away via the invitation_redemptions FK (on delete cascade).
create or replace function public.admin_delete_invitation(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  delete from public.invitations where code = p_code;
  return found;
end;
$$;

revoke all on function public.admin_delete_invitation(text) from public;
grant execute on function public.admin_delete_invitation(text) to authenticated;
