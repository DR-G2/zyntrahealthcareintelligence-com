create or replace function public.get_practice_question_pool(p_limit integer default 100)
returns table(id uuid, zyntra_id text, stem text, options jsonb, explanation text, subject_id uuid, subtopic_id uuid, difficulty_tier text, version integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return query
  select q.id, q.zyntra_id, q.stem, q.options, null::text, q.subject_id, q.subtopic_id, q.difficulty_tier, q.version
  from public.questions q
  where q.status = 'active'
  order by random()
  limit greatest(1, least(coalesce(p_limit,100),1000));
end;
$function$;