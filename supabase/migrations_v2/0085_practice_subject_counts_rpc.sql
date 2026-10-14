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

-- Self-check: abort if the grant/definer/search_path posture is wrong.
do $$
declare fn constant regprocedure := 'public.get_practice_subject_counts()'::regprocedure;
begin
  if not (select p.prosecdef from pg_catalog.pg_proc p where p.oid = fn) then
    raise exception '0085 self-check: get_practice_subject_counts must be SECURITY DEFINER';
  end if;
  if has_function_privilege('anon', fn, 'EXECUTE') then
    raise exception '0085 self-check: anon has EXECUTE on get_practice_subject_counts';
  end if;
  if exists (select 1 from pg_catalog.pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
              where p.oid = fn and a.grantee = 0 and a.privilege_type = 'EXECUTE') then
    raise exception '0085 self-check: PUBLIC has EXECUTE on get_practice_subject_counts';
  end if;
  -- Postgres stores SET search_path TO '' as search_path="" (some versions: search_path=).
  if not exists (select 1 from pg_catalog.pg_proc p
                  where p.oid = fn
                    and (p.proconfig @> array['search_path=""']::text[]
                         or p.proconfig @> array['search_path=']::text[])) then
    raise exception '0085 self-check: get_practice_subject_counts must have search_path='''' in proconfig';
  end if;
end $$;
