-- Engine hardening: atomic cron claims, privileged-admin boundaries, and
-- database invariants for rows written by the autonomous journal.

create or replace function public.claim_auto_journal_slot(
  p_slot_start timestamptz,
  p_claimed_at timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.journal_settings
  set last_run_at = p_claimed_at,
      updated_at = p_claimed_at
  where id = true
    and (last_run_at is null or last_run_at < p_slot_start);
  return found;
end;
$$;

revoke all on function public.claim_auto_journal_slot(timestamptz, timestamptz) from public;
grant execute on function public.claim_auto_journal_slot(timestamptz, timestamptz) to service_role;

-- Decision provenance: enough context to compare engine cohorts without
-- reconstructing the signal from mutable code or a still-forming candle.
alter table public.journal_trades
  add column engine_version text,
  add column decision_candle_at timestamptz,
  add column regime text,
  add column higher_timeframe_trend text,
  add column direction_score double precision;

alter table public.journal_trades
  add constraint journal_trades_regime_check
  check (regime is null or regime in ('trending', 'ranging', 'high_volatility', 'low_volatility')) not valid;

alter table public.journal_trades
  add constraint journal_trades_htf_trend_check
  check (higher_timeframe_trend is null or higher_timeframe_trend in ('bullish', 'bearish', 'sideways')) not valid;

alter table public.journal_trades
  add constraint journal_trades_direction_score_check
  check (direction_score is null or direction_score between -1 and 1) not valid;

create index journal_trades_engine_version_idx
  on public.journal_trades (engine_version, opened_at desc);

-- Normalize the legacy Yahoo labels before enforcing the canonical contract.
update public.journal_trades
set timeframe = case timeframe
  when '1mo' then 'swing'
  when '1d/position' then 'position'
  when '1d' then 'position'
  else timeframe
end
where timeframe in ('1mo', '1d/position', '1d');

alter table public.journal_trades
  add constraint journal_trades_timeframe_check
  check (timeframe in ('scalp', 'swing', 'position')) not valid;

alter table public.journal_trades
  add constraint journal_trades_prices_check
  check (
    entry_price > 0
    and stop_loss > 0
    and (close_price is null or close_price > 0)
  ) not valid;

alter table public.journal_trades
  add constraint journal_trades_direction_stop_check
  check (
    (signal = 'long' and stop_loss < entry_price)
    or (signal = 'short' and stop_loss > entry_price)
  ) not valid;

alter table public.journal_trades
  add constraint journal_trades_highest_tp_check
  check (highest_tp_reached between 0 and 3) not valid;

alter table public.journal_trades
  add constraint journal_trades_terminal_fields_check
  check (
    (status = 'open' and closed_at is null and close_price is null)
    or (status <> 'open' and closed_at is not null and close_price is not null)
  ) not valid;

create or replace function public.admin_create_user(
  p_email text,
  p_password text,
  p_tier text default 'free',
  p_is_admin boolean default false,
  p_is_owner boolean default false,
  p_trial_expires_at timestamptz default null,
  p_is_blocked boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_encrypted_password text;
  v_actor_owner boolean := public.is_owner();
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if (p_is_admin or p_is_owner) and not v_actor_owner then
    raise exception 'owner_required';
  end if;
  if length(coalesce(p_password, '')) < 12 then
    raise exception 'password_too_short';
  end if;

  begin
    v_encrypted_password := extensions.crypt(p_password, extensions.gen_salt('bf'));
  exception when others then
    v_encrypted_password := crypt(p_password, gen_salt('bf'));
  end;

  insert into auth.users (
    instance_id, id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
  )
  values (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), p_email,
    v_encrypted_password, now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb, '{}'::jsonb,
    now(), now(), 'authenticated', 'authenticated'
  )
  returning id into v_user_id;

  insert into public.profiles (
    user_id, tier, is_admin, is_owner, trial_expires_at, is_blocked, updated_at
  )
  values (
    v_user_id, p_tier, p_is_admin, p_is_owner,
    case when p_tier = 'trial' then coalesce(p_trial_expires_at, now() + interval '30 days') else null end,
    p_is_blocked, now()
  )
  on conflict (user_id) do update set
    tier = excluded.tier,
    is_admin = excluded.is_admin,
    is_owner = excluded.is_owner,
    trial_expires_at = excluded.trial_expires_at,
    is_blocked = excluded.is_blocked,
    updated_at = now();
  return v_user_id;
end;
$$;

create or replace function public.admin_update_user(
  p_user_id uuid,
  p_tier text,
  p_is_admin boolean,
  p_is_owner boolean,
  p_trial_expires_at timestamptz default null,
  p_is_blocked boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_owner boolean := public.is_owner();
  v_target record;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select is_admin, is_owner into v_target
  from public.profiles where user_id = p_user_id;
  if not found then raise exception 'user_not_found'; end if;
  if not v_actor_owner and (v_target.is_admin or v_target.is_owner or p_is_admin or p_is_owner) then
    raise exception 'owner_required';
  end if;
  if p_user_id = auth.uid() and v_target.is_owner and not p_is_owner then
    raise exception 'cannot demote yourself from owner';
  end if;
  if p_user_id = auth.uid() and v_target.is_admin and not p_is_admin then
    raise exception 'cannot demote yourself from admin';
  end if;

  update public.profiles set
    tier = p_tier,
    is_admin = p_is_admin,
    is_owner = p_is_owner,
    trial_expires_at = case
      when p_tier = 'trial' then coalesce(p_trial_expires_at, trial_expires_at, now() + interval '30 days')
      else null
    end,
    is_blocked = p_is_blocked,
    updated_at = now()
  where user_id = p_user_id;
end;
$$;

create or replace function public.admin_toggle_block_user(
  p_user_id uuid,
  p_blocked boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_owner boolean := public.is_owner();
  v_target record;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_user_id = auth.uid() then raise exception 'cannot block self'; end if;
  select is_admin, is_owner into v_target from public.profiles where user_id = p_user_id;
  if not found then raise exception 'user_not_found'; end if;
  if not v_actor_owner and (v_target.is_admin or v_target.is_owner) then
    raise exception 'owner_required';
  end if;
  update public.profiles set is_blocked = p_blocked, updated_at = now()
  where user_id = p_user_id;
end;
$$;

create or replace function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_owner boolean := public.is_owner();
  v_target record;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_user_id = auth.uid() then raise exception 'cannot delete self'; end if;
  select is_admin, is_owner into v_target from public.profiles where user_id = p_user_id;
  if not found then raise exception 'user_not_found'; end if;
  if not v_actor_owner and (v_target.is_admin or v_target.is_owner) then
    raise exception 'owner_required';
  end if;
  delete from auth.users where id = p_user_id;
end;
$$;

revoke all on function public.admin_create_user(text, text, text, boolean, boolean, timestamptz, boolean) from public;
grant execute on function public.admin_create_user(text, text, text, boolean, boolean, timestamptz, boolean) to authenticated;
revoke all on function public.admin_update_user(uuid, text, boolean, boolean, timestamptz, boolean) from public;
grant execute on function public.admin_update_user(uuid, text, boolean, boolean, timestamptz, boolean) to authenticated;
revoke all on function public.admin_toggle_block_user(uuid, boolean) from public;
grant execute on function public.admin_toggle_block_user(uuid, boolean) to authenticated;
revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;

create or replace function public.get_public_journal_success_rates()
returns table (symbol text, wins bigint, total bigint)
language sql
security definer
set search_path = ''
stable
as $$
  select jt.symbol,
    count(*) filter (
      where (jt.signal = 'long' and jt.close_price > jt.entry_price)
         or (jt.signal = 'short' and jt.close_price < jt.entry_price)
    )::bigint as wins,
    count(*)::bigint as total
  from public.journal_trades jt
  where jt.status <> 'open'
    and jt.close_price is not null
  group by jt.symbol
  order by jt.symbol;
$$;
