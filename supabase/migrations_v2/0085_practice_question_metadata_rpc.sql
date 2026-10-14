-- Learner-safe metadata for Practice filters.
-- Returns no question stem, options, answer key, or explanation.
-- Question content remains available only through the authenticated PIE session flow.

begin;

create or replace function public.get_practice_question_metadata(p_limit integer default 1000)
returns table (
  id uuid,
  zyntra_id text,
  subject_id uuid,
  subtopic_id uuid,
  difficulty_tier text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'p_limit must be 1..1000' using errcode = '22023';
  end if;

  return query
  select q.id, q.zyntra_id, q.subject_id, q.subtopic_id, q.difficulty_tier
  from public.questions q
  where q.status = 'active'
  order by q.id
  limit p_limit;
end;
$function$;

revoke all on function public.get_practice_question_metadata(integer) from public, anon;
grant execute on function public.get_practice_question_metadata(integer) to authenticated;

commit;
