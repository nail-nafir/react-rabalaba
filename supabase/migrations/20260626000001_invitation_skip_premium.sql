-- Bugfix: an already-premium user who opens an invitation link still had a
-- redemption slot consumed. The /invite page auto-claims on login, and
-- redeem_invitation inserted the redemption row BEFORE the "never downgrade an
-- existing premium" guard ran — so a permanent-premium user gained nothing yet
-- the invite's usage count ticked up (1/10 became 2/10, etc).
--
-- Fix: short-circuit at the top. If the caller is already 'premium', return the
-- new 'already_premium' outcome and touch nothing. No redemption row, no count.
-- Everything else (trial users extending, free users claiming) is unchanged.
create or replace function public.redeem_invitation(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_tier       text;
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

  -- Already permanently premium → nothing to grant. Bail out before consuming a
  -- redemption slot. (Trial users fall through so they can still upgrade/extend.)
  select tier into v_tier from public.profiles where user_id = v_uid;
  if v_tier = 'premium' then
    return 'already_premium';
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
