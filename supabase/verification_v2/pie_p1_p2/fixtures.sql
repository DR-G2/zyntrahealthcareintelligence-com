-- LOCAL ONLY test fixtures (run as superuser on a throwaway replica).
insert into pie.concept(id, concept_key, title) values
  ('c0000000-0000-0000-0000-000000000001','CARDIO.HF','Heart failure'),
  ('c0000000-0000-0000-0000-000000000002','RENAL.AKI','Acute kidney injury');
insert into pie.learning_objective(id, lo_key, concept_id, title) values
  ('10000000-0000-0000-0000-000000000001','CARDIO.HF.DX','c0000000-0000-0000-0000-000000000001','Diagnose HF'),
  ('10000000-0000-0000-0000-000000000002','CARDIO.HF.TX','c0000000-0000-0000-0000-000000000001','Treat HF'),
  ('10000000-0000-0000-0000-000000000003','RENAL.AKI.DX','c0000000-0000-0000-0000-000000000002','Diagnose AKI');
-- seed.sql questions 22222222-...-01..12 (correct answer 'A')
insert into pie.question_lo(question_id, lo_id, is_primary, weight)
select ('22222222-0000-0000-0000-0000000000'||lpad(g::text,2,'0'))::uuid,
       case when g <= 4 then '10000000-0000-0000-0000-000000000001'::uuid
            when g <= 8 then '10000000-0000-0000-0000-000000000002'::uuid
            else '10000000-0000-0000-0000-000000000003'::uuid end, true, 1
from generate_series(1,12) g;
-- secondary LO on Q1
insert into pie.question_lo(question_id, lo_id, is_primary, weight)
values ('22222222-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003', false, 0.5);
update public.questions set irt_b = (g.g - 6) / 3.0, irt_b_source = 'qbank_import', irt_b_se = 0.4
from generate_series(1,12) g where id = ('22222222-0000-0000-0000-0000000000'||lpad(g.g::text,2,'0'))::uuid;
-- test-only assertion helper (throwaway DB only)
create or replace function public.t_assert(ok boolean, msg text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'ASSERTION FAILED: %', msg; end if; end $$;
grant execute on function public.t_assert(boolean, text) to public;
