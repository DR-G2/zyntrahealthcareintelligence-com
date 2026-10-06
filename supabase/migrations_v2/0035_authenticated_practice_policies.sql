-- 0035: authenticated-only practice learner data policies
-- Keep anonymous question/diagnostic access unchanged.
-- Practice sessions and attempts are learner-owned data and must be
-- reachable only by signed-in users, even though their RLS predicates
-- already require auth.uid() ownership.

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('practice_sessions', 'practice_session_questions', 'user_attempts')
      and roles::text = '{public}'
  loop
    execute format(
      'alter policy %I on %I.%I to authenticated',
      r.policyname,
      r.schemaname,
      r.tablename
    );
  end loop;
end $$;
