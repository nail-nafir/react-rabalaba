-- Create user RPC for admin panel
create or replace function public.admin_create_user(
  p_email text,
  p_password text,
  p_tier text default 'free',
  p_is_admin boolean default false,
  p_is_owner boolean default false
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

  -- Encrypt password (try extensions schema first, then fallback to public)
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
  insert into public.profiles (user_id, tier, is_admin, is_owner, updated_at)
  values (v_user_id, p_tier, p_is_admin, p_is_owner, now())
  on conflict (user_id) do update
  set tier = p_tier,
      is_admin = p_is_admin,
      is_owner = p_is_owner,
      updated_at = now();

  return v_user_id;
end;
$$;

revoke all on function public.admin_create_user(text, text, text, boolean, boolean) from public;
grant execute on function public.admin_create_user(text, text, text, boolean, boolean) to authenticated;
