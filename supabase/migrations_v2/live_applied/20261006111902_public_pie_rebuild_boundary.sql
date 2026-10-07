
create or replace function public.rebuild_candidate_state(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pie, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_user_id is null or auth.uid() <> p_user_id then
    raise exception 'User scope violation';
  end if;

  return pie.rebuild_candidate_state(p_user_id);
end;
$$;

revoke all on function public.rebuild_candidate_state(uuid) from public, anon;
grant execute on function public.rebuild_candidate_state(uuid) to authenticated;
