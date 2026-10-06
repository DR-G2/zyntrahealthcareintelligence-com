insert into auth.users(id,email) values ('aaaaaaaa-0000-0000-0000-00000000000a','a@test.local'),('bbbbbbbb-0000-0000-0000-00000000000b','b@test.local') on conflict do nothing;
insert into public.profiles(id,email,role,status) values ('aaaaaaaa-0000-0000-0000-00000000000a','a@test.local','learner','active'),('bbbbbbbb-0000-0000-0000-00000000000b','b@test.local','learner','active') on conflict do nothing;
insert into public.subjects(id,name,slug) select '11111111-0000-0000-0000-000000000001','Medicine','medicine' where not exists (select 1 from public.subjects where id='11111111-0000-0000-0000-000000000001');
insert into public.questions(id,subject_id,stem,options,correct_answer,status)
select ('22222222-0000-0000-0000-0000000000'||lpad(g::text,2,'0'))::uuid,'11111111-0000-0000-0000-000000000001','Q'||g,'["A","B","C","D"]'::jsonb,'A','active' from generate_series(1,12) g on conflict do nothing;
