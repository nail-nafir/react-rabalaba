-- Drop old functions to avoid overloading confusion
drop function if exists public.admin_create_user(text, text, text, boolean, boolean);
drop function if exists public.admin_update_user(uuid, text, boolean, boolean);

-- Re-create admin_create_user with p_trial_expires_at
create or replace function public.admin_create_user(
  p_email text,
  p_password text,
  p_tier text default 'free',
  p_is_admin boolean default false,
  p_is_owner boolean default false,
  p_trial_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_encrypted_password text;
begin
  -- Check if caller is admin/owner
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  -- Encrypt password
  begin
    v_encrypted_password := extensions.crypt(p_password, extensions.gen_salt('bf'));
  exception when others then
    v_encrypted_password := crypt(p_password, gen_salt('bf'));
  end;

  -- Create the user in auth.users
  insert into auth.users (
    instance_id,
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    role,
    aud
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    p_email,
    v_encrypted_password,
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    'authenticated',
    'authenticated'
  )
  returning id into v_user_id;

  -- Create/update profile
  insert into public.profiles (user_id, tier, is_admin, is_owner, trial_expires_at, updated_at)
  values (
    v_user_id,
    p_tier,
    p_is_admin,
    p_is_owner,
    case when p_tier = 'trial' then coalesce(p_trial_expires_at, now() + interval '30 days') else null end,
    now()
  )
  on conflict (user_id) do update
  set tier = p_tier,
      is_admin = p_is_admin,
      is_owner = p_is_owner,
      trial_expires_at = case when p_tier = 'trial' then coalesce(p_trial_expires_at, profiles.trial_expires_at, now() + interval '30 days') else null end,
      updated_at = now();

  return v_user_id;
end;
$$;

revoke all on function public.admin_create_user(text, text, text, boolean, boolean, timestamptz) from public;
grant execute on function public.admin_create_user(text, text, text, boolean, boolean, timestamptz) to authenticated;


-- Re-create admin_update_user with p_trial_expires_at
create or replace function public.admin_update_user(
  p_user_id uuid,
  p_tier text,
  p_is_admin boolean,
  p_is_owner boolean,
  p_trial_expires_at timestamptz default null
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

  -- Prevent demoting yourself from admin/owner if you are the one calling
  if p_user_id = auth.uid() and p_is_owner = false and (select is_owner from public.profiles where user_id = auth.uid()) then
    raise exception 'cannot demote yourself from owner';
  end if;
  if p_user_id = auth.uid() and p_is_admin = false and (select is_admin from public.profiles where user_id = auth.uid()) then
    raise exception 'cannot demote yourself from admin';
  end if;

  -- Update profiles
  update public.profiles
  set tier = p_tier,
      is_admin = p_is_admin,
      is_owner = p_is_owner,
      trial_expires_at = case
        when p_tier = 'trial' then coalesce(p_trial_expires_at, trial_expires_at, now() + interval '30 days')
        else null
      end,
      updated_at = now()
  where user_id = p_user_id;
end;
$$;

revoke all on function public.admin_update_user(uuid, text, boolean, boolean, timestamptz) from public;
grant execute on function public.admin_update_user(uuid, text, boolean, boolean, timestamptz) to authenticated;
