-- 0085_practice_subject_counts_rpc
-- Numbered 0085: 0084 is taken by branch kim/pie-new-content-reserve (PR #90). Apply as postgres. NOT APPLIED.
-- Practice setup needs active-question counts per subject. Hank's paid-only lock
-- (questions_paid_practice_only.sql) revokes every direct SELECT on public.questions, so the
-- PR #89 direct read would fail with 42501. This RPC returns counts per SUBJECT only
-- (per Hank: no per-subtopic or per-tag counts, no question ids, no content).
-- Subtopic names still come from public.subtopics, without counts.
-- Security: SECURITY DEFINER, search_path '', EXECUTE for authenticated only (PUBLIC and anon revoked).
-- Rollback: drop function public.get_practice_subject_counts();

create or replace function public.get_practice_subject_counts()
returns table(subject_id uuid, question_count integer)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  return query
    select q.subject_id, count(*)::int
      from public.questions q
      join public.subjects s on s.id = q.subject_id and s.is_active
     where q.status = 'active'
     group by q.subject_id;
end $function$;

revoke all on function public.get_practice_subject_counts() from public, anon;
grant execute on function public.get_practice_subject_counts() to authenticated;
