-- Create update user RPC for admin panel
create or replace function public.admin_update_user(
  p_user_id uuid,
  p_tier text,
  p_is_admin boolean,
  p_is_owner boolean
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
        when p_tier = 'trial' then coalesce(trial_expires_at, now() + interval '30 days')
        else null
      end,
      updated_at = now()
  where user_id = p_user_id;
end;
$$;

revoke all on function public.admin_update_user(uuid, text, boolean, boolean) from public;
grant execute on function public.admin_update_user(uuid, text, boolean, boolean) to authenticated;
