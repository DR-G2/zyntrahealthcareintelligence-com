-- LOCAL ONLY. 0057 bank-swap assertions (fresh replica + 0045-0057). Any failure aborts.
\set ON_ERROR_STOP 1
\pset tuples_only on
\echo '### B0 counts'
select public.t_assert((select count(*) from public.questions where zyntra_id like 'ZQ-%' and status='active') = 319, 'B0 319 active ZQ items');
select public.t_assert((select count(*) from public.questions where status='active' and (zyntra_id is null or zyntra_id not like 'ZQ-%')) = 0, 'B0 only ZQ items active');
select public.t_assert(not exists (select 1 from public.questions where zyntra_id in ('ZQ-0375')), 'B0 excluded items absent');
\echo '### B1 ZYNTRA-BS retired, not deleted'
select public.t_assert((select status from public.questions where zyntra_id='ZYNTRA-BS-001') = 'retired', 'B1 BS retired');
\echo '### B2 structure: key A-E within options, one primary LO, blueprint eligible, irt_b set'
select public.t_assert(not exists (select 1 from public.questions where zyntra_id like 'ZQ-%' and (correct_answer !~ '^[A-E]$' or ascii(correct_answer)-65 >= jsonb_array_length(options) or jsonb_array_length(options) not between 2 and 5)), 'B2 keys');
select public.t_assert(not exists (select 1 from public.questions q where q.zyntra_id like 'ZQ-%' and (select count(*) from pie.question_lo ql where ql.question_id=q.id and ql.is_primary) <> 1), 'B2 one primary LO');
select public.t_assert((select count(*) from amc.amc_blueprint_lo bl join pie.question_lo ql on ql.lo_id = bl.lo_id join public.questions q on q.id = ql.question_id where q.zyntra_id like 'ZQ-%' and bl.eligible) = 319, 'B2 blueprint eligible');
select public.t_assert(not exists (select 1 from public.questions where zyntra_id like 'ZQ-%' and (irt_b is null or irt_b_source not in ('expert_prior','tier_prior') or explanation is null or subtopic_id is null)), 'B2 irt_b/explanation/subtopic');
select public.t_assert((select count(*) from public.questions where zyntra_id like 'ZQ-%' and irt_b_source='expert_prior') = 149, 'B2 149 author irt_b');
\echo '### B3 blueprint split (patient group)'
select s.name, count(*) from public.questions q join public.subjects s on s.id=q.subject_id where q.zyntra_id like 'ZQ-%' group by 1 order by 2 desc;
select public.t_assert((select count(distinct subject_id) from public.questions where zyntra_id like 'ZQ-%') = 6, 'B3 six groups');
\echo '### B4 PIE builds a session from the new bank under C1'
begin;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}',true) \g /dev/null
set local role authenticated;
select session_id as bs, question_count as bn from public.pie_create_session(20) \gset
commit;
select public.t_assert(:bn = 20, 'B4 20 built');
select public.t_assert((select max(n) from (select lo.concept_id, count(*) n from public.practice_session_questions psq join pie.question_lo ql on ql.question_id=psq.question_id and ql.is_primary
  join pie.learning_objective lo on lo.id=ql.lo_id where psq.session_id=:'bs' group by 1) t) <= 2, 'B4 C1 on bank');
select public.t_assert(not exists (select 1 from public.practice_session_questions psq join public.questions q on q.id=psq.question_id where psq.session_id=:'bs' and q.zyntra_id not like 'ZQ-%'), 'B4 only ZQ served');
\echo 'ALL BANK ASSERTIONS PASSED'
