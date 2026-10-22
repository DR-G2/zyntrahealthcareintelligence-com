-- Expose only the admin membership boolean through the public PostgREST schema.
-- The command schema itself remains private to browser roles.
create or replace function public.is_admin(p_user_id uuid default auth.uid())
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, command, auth
as $$
begin
  -- A signed-in caller may only ask about their own identity.
  if auth.uid() is not null and p_user_id is distinct from auth.uid() then
    return false;
  end if;

  return exists (
    select 1
    from command.admin_roles ar
    where ar.user_id = coalesce(p_user_id, auth.uid())
      and ar.active = true
      and lower(ar.role) in ('admin', 'super_admin', 'super-admin')
  );
end;
$$;

revoke all on function public.is_admin(uuid) from public, anon, authenticated;
grant execute on function public.is_admin(uuid) to authenticated;
