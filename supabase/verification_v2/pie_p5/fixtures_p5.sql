-- LOCAL ONLY P5 fixtures: concept X with three LOs and two questions each (Q13-Q18).
insert into public.questions(id,subject_id,stem,options,correct_answer,status)
select ('22222222-0000-0000-0000-0000000000'||g)::uuid,'11111111-0000-0000-0000-000000000001','Q'||g,'["A","B","C","D"]'::jsonb,'A','active'
from generate_series(13,18) g on conflict do nothing;
insert into pie.concept(id, concept_key, title) values ('c0000000-0000-0000-0000-000000000003','X.CONCEPT','Concept X');
insert into pie.learning_objective(id, lo_key, concept_id, title) values
  ('10000000-0000-0000-0000-000000000011','X.LO1','c0000000-0000-0000-0000-000000000003','X1'),
  ('10000000-0000-0000-0000-000000000012','X.LO2','c0000000-0000-0000-0000-000000000003','X2'),
  ('10000000-0000-0000-0000-000000000013','X.LO3','c0000000-0000-0000-0000-000000000003','X3');
insert into pie.question_lo(question_id, lo_id, is_primary, weight)
select ('22222222-0000-0000-0000-0000000000'||g)::uuid,
       ('10000000-0000-0000-0000-0000000000'||(11 + (g - 13) / 2))::uuid, true, 1
from generate_series(13,18) g;
insert into auth.users(id,email) values ('77777777-0000-0000-0000-000000000007','h@test.local') on conflict do nothing;
insert into public.profiles(id,email,role,status) values ('77777777-0000-0000-0000-000000000007','h@test.local','learner','active') on conflict do nothing;
