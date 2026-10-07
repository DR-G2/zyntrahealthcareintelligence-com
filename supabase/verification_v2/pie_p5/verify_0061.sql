-- LOCAL ONLY. 0061 log redaction switch.
\set ON_ERROR_STOP 1
\pset tuples_only on
select public.t_assert(pie.selector_failure_log_line('aaaaaaaa-0000-0000-0000-00000000000a', '55555555-0000-0000-0000-000000000001', 'NEXT_QUESTION')
  = 'PIE_NO_ELIGIBLE_CANDIDATE event=NEXT_QUESTION', 'L1 default strips learner/session ids');
select public.t_assert(not has_table_privilege('authenticated', 'pie.runtime_flag', 'select'), 'L1 flag table not learner-readable');
update pie.runtime_flag set enabled = true where flag = 'log_selector_identifiers';
select public.t_assert(pie.selector_failure_log_line('aaaaaaaa-0000-0000-0000-00000000000a', '55555555-0000-0000-0000-000000000001', 'NEXT_QUESTION')
  like '%learner=aaaaaaaa-0000-0000-0000-00000000000a session=55555555-%', 'L1 switch re-enables ids');
update pie.runtime_flag set enabled = false where flag = 'log_selector_identifiers';
\echo 'ALL 0061 ASSERTIONS PASSED'
