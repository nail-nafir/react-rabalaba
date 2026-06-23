-- Create access code RPC for admin panel
create or replace function public.admin_create_access_code(
  p_code text,
  p_kind text,
  p_max_redemptions int default null,
  p_trial_days int default null,
  p_note text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Check if caller is admin/owner
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  -- Validate kind
  if p_kind not in ('full', 'trial') then
    raise exception 'invalid code kind';
  end if;

  -- Create the access code
  insert into public.access_codes (code, kind, max_redemptions, trial_days, note)
  values (p_code, p_kind, p_max_redemptions, p_trial_days, p_note);

  return p_code;
end;
$$;

revoke all on function public.admin_create_access_code(text, text, int, int, text) from public;
grant execute on function public.admin_create_access_code(text, text, int, int, text) to authenticated;
