-- LOCAL/CI ONLY. Verify candidate-wide Behaviour scope on a disposable replica.
\set ON_ERROR_STOP on
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'intelligence.behavior_profiles'::regclass
      and conname = 'behavior_profiles_session_mode_check'
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%candidate_wide%'
      and pg_get_constraintdef(oid) like '%normal_mcq%'
  ) then
    raise exception 'FAIL 0104 Behaviour profile must permit candidate_wide and preserve legacy normal_mcq rows during refresh';
  end if;
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'intelligence'
      and table_name = 'behavior_profiles'
      and column_name = 'archetype_signals'
      and data_type = 'jsonb'
  ) then
    raise exception 'FAIL 0104 mode-labelled evidence breakdown storage missing';
  end if;
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'intelligence'
      and tablename = 'behavior_profiles'
      and policyname = 'behavior_profiles_select_own'
      and cmd = 'SELECT'
  ) then
    raise exception 'FAIL 0104 owner-scoped Behaviour policy missing';
  end if;
  raise notice 'ALL 0104 CANDIDATE-WIDE BEHAVIOUR ASSERTIONS PASSED';
end $$;
