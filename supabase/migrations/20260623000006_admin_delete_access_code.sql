-- Create delete access code RPC for admin panel
create or replace function public.admin_delete_access_code(
  p_code text
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

  -- Delete from access_codes (will cascade delete related code_redemptions due to ON DELETE CASCADE)
  delete from public.access_codes where code = p_code;
end;
$$;

revoke all on function public.admin_delete_access_code(text) from public;
grant execute on function public.admin_delete_access_code(text) to authenticated;
