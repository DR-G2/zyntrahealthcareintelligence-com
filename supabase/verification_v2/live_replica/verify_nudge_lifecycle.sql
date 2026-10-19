-- LOCAL ONLY: Nudge ↔ PIE lifecycle regression on a disposable live-schema replica.
-- All identities, questions, and attempts are synthetic. Never run on production.
\set ON_ERROR_STOP on
\pset footer off

-- The committed live-applied snapshot predates the LO/concept schema added later in production.
-- Bootstrap only the minimum current schema surface required by Nudge inside this disposable DB.
create schema if not exists pie;
create schema if not exists amc;

create table if not exists pie.concept (
  id uuid primary key default gen_random_uuid(),
  concept_key text not null unique,
  title text not null,
  description text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists pie_concept_key_nudge_fixture_idx on pie.concept(concept_key);

create table if not exists pie.learning_objective (
  id uuid primary key default gen_random_uuid(),
  lo_key text not null unique,
  concept_id uuid not null references pie.concept(id) on delete restrict,
  title text not null,
  description text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table pie.learning_objective add column if not exists concept_id uuid references pie.concept(id) on delete restrict;
alter table pie.learning_objective add column if not exists title text;
alter table pie.learning_objective add column if not exists description text;
alter table pie.learning_objective add column if not exists status text default 'active';
alter table pie.learning_objective add column if not exists created_at timestamptz default now();
alter table pie.learning_objective add column if not exists updated_at timestamptz default now();
create unique index if not exists pie_learning_objective_lo_key_nudge_fixture_idx on pie.learning_objective(lo_key);

create table if not exists pie.question_lo (
  question_id uuid not null references public.questions(id) on delete cascade,
  lo_id uuid not null references pie.learning_objective(id) on delete restrict,
  is_primary boolean not null default false,
  weight numeric not null default 1,
  mapping_source text not null default 'manual',
  created_at timestamptz not null default now(),
  primary key (question_id,lo_id),
  check (not is_primary or weight=1),
  check (weight>0 and weight<=1),
  check (mapping_source in ('manual','import','model_suggested_reviewed'))
);
alter table pie.question_lo add column if not exists is_primary boolean not null default false;
alter table pie.question_lo add column if not exists weight numeric not null default 1;
alter table pie.question_lo add column if not exists mapping_source text not null default 'manual';
alter table pie.question_lo add column if not exists created_at timestamptz default now();

create table if not exists amc.amc_blueprint (
  id uuid primary key default gen_random_uuid(),
  plugin_version_id uuid,
  blueprint_key text not null,
  version text not null,
  content jsonb not null default '{}'::jsonb,
  effective_from timestamptz,
  effective_to timestamptz,
  unique (blueprint_key,version)
);
create table if not exists amc.amc_blueprint_lo (
  blueprint_id uuid not null references amc.amc_blueprint(id) on delete cascade,
  lo_id uuid not null references pie.learning_objective(id) on delete restrict,
  eligible boolean not null default false,
  coverage_target numeric check (coverage_target is null or coverage_target between 0 and 1),
  tie_break_rank integer,
  primary key (blueprint_id,lo_id)
);

do $
declare
  v_user_a constant uuid := 'aaaaaaaa-0000-0000-0000-00000000000a';
  v_user_b constant uuid := 'bbbbbbbb-0000-0000-0000-00000000000b';
  v_subject constant uuid := '11111111-0000-0000-0000-000000000001';
  v_concept_a constant uuid := '33333333-0000-0000-0000-000000000001';
  v_concept_b constant uuid := '33333333-0000-0000-0000-000000000002';
  v_lo_a constant uuid := '44444444-0000-0000-0000-000000000001';
  v_lo_b constant uuid := '44444444-0000-0000-0000-000000000002';
  v_blueprint uuid;
  v_history_ids uuid[];
  v_history public.practice_sessions;
  v_cold record;
  v_nudge record;
  v_progress record;
  v_qid uuid;
  v_n integer;
  v_no_key integer;
  v_baseline numeric;
  v_followup numeric;
  g integer;
begin
  -- Stable synthetic users already exist in the disposable seed, but upsert for repeatability.
  insert into auth.users(id,email)
  values (v_user_a,'nudge-a@test.local'),(v_user_b,'nudge-b@test.local')
  on conflict (id) do nothing;
  insert into public.profiles(id,email,role,status)
  values (v_user_a,'nudge-a@test.local','learner','active'),
         (v_user_b,'nudge-b@test.local','learner','active')
  on conflict (id) do nothing;

  insert into pie.concept(id,concept_key,title,description,status)
  values (v_concept_a,'TEST_NUDGE_CONCEPT_A','Synthetic Nudge LO A','Disposable local regression fixture','active'),
         (v_concept_b,'TEST_NUDGE_CONCEPT_B','Synthetic Nudge LO B','Disposable local regression fixture','active')
  on conflict (concept_key) do update set status='active', updated_at=now();

  insert into pie.learning_objective(id,lo_key,concept_id,title,description,status)
  values (v_lo_a,'TEST_NUDGE_LO_A',v_concept_a,'Synthetic weakness objective','Disposable local regression fixture','active'),
         (v_lo_b,'TEST_NUDGE_LO_B',v_concept_b,'Synthetic strong objective','Disposable local regression fixture','active')
  on conflict (lo_key) do update set concept_id=excluded.concept_id,title=excluded.title,status='active',updated_at=now();

  insert into public.questions(id,zyntra_id,subject_id,stem,options,correct_answer,explanation,status,version,provenance)
  select md5('nudge-lifecycle-' || g::text)::uuid,
         'NUDGE-LIFE-' || lpad(g::text,3,'0'),
         v_subject,
         'Synthetic Nudge lifecycle question ' || g,
         '["A","B","C","D"]'::jsonb,
         'A',
         'Synthetic explanation withheld during practice.',
         'active',1,jsonb_build_object('synthetic',true,'fixture','nudge-local')
  from generate_series(1,110) g
  on conflict (zyntra_id) do nothing;

  insert into pie.question_lo(question_id,lo_id,is_primary,weight,mapping_source)
  select md5('nudge-lifecycle-' || g::text)::uuid,
         case when g <= 60 then v_lo_a else v_lo_b end,
         true,1,'manual'
  from generate_series(1,110) g
  on conflict (question_id,lo_id) do update
    set is_primary=true,weight=1,mapping_source='manual';

  insert into amc.amc_blueprint(blueprint_key,version,content,effective_from,effective_to)
  values ('AMC_CAT_MCQ','nudge-lifecycle-fixture-v1','{}'::jsonb,now()-interval '1 day',now()+interval '1 day')
  on conflict (blueprint_key,version) do nothing;
  select id into v_blueprint
  from amc.amc_blueprint
  where blueprint_key='AMC_CAT_MCQ' and version='nudge-lifecycle-fixture-v1';

  insert into amc.amc_blueprint_lo(blueprint_id,lo_id,eligible,coverage_target)
  values (v_blueprint,v_lo_a,true,0.5),(v_blueprint,v_lo_b,true,0.5)
  on conflict (blueprint_id,lo_id) do update set eligible=true,coverage_target=excluded.coverage_target;

  -- Cold-start candidate: no mapped attempts must receive a mixed evidence-building session.
  perform set_config('request.jwt.claim.sub',v_user_b::text,true);
  select * into v_cold from public.create_my_nudge_session(10);
  if v_cold.lo_id is not null or v_cold.reason_code <> 'COLD_START_FIRST_50' or v_cold.question_count < 3 then
    raise exception 'FAIL cold-start: %', row_to_json(v_cold);
  end if;
  select count(*) into v_n from public.practice_session_questions where session_id=v_cold.session_id;
  if v_n < 3 then raise exception 'FAIL cold-start question delivery: %',v_n; end if;
  perform public.complete_practice_session(v_cold.session_id);
  raise notice 'PASS cold-start mixed session created with % questions',v_n;

  -- Candidate A history: three wrong LO-A questions establish a gap; 46 + 1 correct
  -- LO-B questions bring total valid mapped saved interactions to 49 then 50.
  select array_agg(id order by sort_order) into v_history_ids
  from (
    select g as sort_order,md5('nudge-lifecycle-' || g::text)::uuid as id
    from generate_series(1,3) g
    union all
    select g as sort_order,md5('nudge-lifecycle-' || g::text)::uuid as id
    from generate_series(61,107) g
  ) q;

  perform set_config('request.jwt.claim.sub',v_user_a::text,true);
  select * into v_history
  from public.create_practice_session(
    'nudge-fixture-history',
    jsonb_build_object('mode','fixture','synthetic',true),
    v_history_ids
  );

  for g in 1..49 loop
    if g <= 3 then
      v_qid := md5('nudge-lifecycle-' || g::text)::uuid;
      perform public.save_attempt(v_qid,v_history.id,'B',false,17,3,0,4,'["B"]'::jsonb,'[]'::jsonb,
        'nudge-local-test',g,null,1,'nudge-local-test',jsonb_build_object('synthetic',true,'fixture','nudge-local'));
    else
      v_qid := md5('nudge-lifecycle-' || (g+57)::text)::uuid;
      perform public.save_attempt(v_qid,v_history.id,'A',true,17,4,0,4,'["A"]'::jsonb,'[]'::jsonb,
        'nudge-local-test',g,null,1,'nudge-local-test',jsonb_build_object('synthetic',true,'fixture','nudge-local'));
    end if;
  end loop;

  select * into v_cold from public.create_my_nudge_session(10);
  if v_cold.lo_id is not null or v_cold.reason_code <> 'COLD_START_FIRST_50' then
    raise exception 'FAIL 49-interaction threshold: expected mixed mode, got %',row_to_json(v_cold);
  end if;
  perform public.complete_practice_session(v_cold.session_id);
  raise notice 'PASS 49 mapped interactions remain in mixed evidence-building mode';

  v_qid := md5('nudge-lifecycle-107')::uuid;
  perform public.save_attempt(v_qid,v_history.id,'A',true,17,4,0,4,'["A"]'::jsonb,'[]'::jsonb,
    'nudge-local-test',50,null,1,'nudge-local-test',jsonb_build_object('synthetic',true,'fixture','nudge-local'));
  perform public.complete_practice_session(v_history.id);

  select * into v_nudge from public.create_my_nudge_session(3);
  if v_nudge.lo_id <> v_lo_a or v_nudge.question_count <> 3 or v_nudge.reason_code <> 'LOW_MAPPED_ACCURACY' then
    raise exception 'FAIL 50-interaction PIE targeting: expected LO-A READY, got %',row_to_json(v_nudge);
  end if;
  v_baseline := v_nudge.baseline_accuracy;
  select count(*) into v_n from public.get_practice_session_questions(v_nudge.session_id);
  if v_n <> 3 then raise exception 'FAIL targeted question delivery: expected 3, got %',v_n; end if;

  select count(*) into v_no_key
  from public.get_practice_session_questions(v_nudge.session_id)
  where explanation is not null;
  if v_no_key <> 0 then raise exception 'FAIL explanation leakage: % questions exposed explanation',v_no_key; end if;
  if exists (
    select 1 from pg_proc
    where oid='public.get_practice_session_questions(uuid)'::regprocedure
      and coalesce(proargnames,'{}'::text[]) @> array['correct_answer']::text[]
  ) then
    raise exception 'FAIL answer-key leakage: question RPC exposes correct_answer';
  end if;
  raise notice 'PASS 50 mapped interactions switch to PIE target % with baseline accuracy %',v_nudge.lo_key,v_baseline;

  -- Follow-up: answer the three targeted questions correctly through authoritative save_attempt.
  for v_qid in
    select question_id from public.practice_session_questions
    where session_id=v_nudge.session_id order by position
  loop
    perform public.save_attempt(v_qid,v_nudge.session_id,'A',true,15,4,0,3,'["A"]'::jsonb,'[]'::jsonb,
      'nudge-local-test',0,null,1,'nudge-local-test',jsonb_build_object('synthetic',true,'fixture','nudge-local','phase','followup'));
  end loop;
  perform public.complete_practice_session(v_nudge.session_id);

  select * into v_progress from public.get_my_nudge_progress(v_lo_a);
  v_followup := v_progress.accuracy;
  if v_progress.status <> 'READY' or v_progress.distinct_question_count <> 6 or
     v_baseline is null or v_followup <= v_baseline then
    raise exception 'FAIL reassessment improvement: baseline %, progress %',v_baseline,row_to_json(v_progress);
  end if;
  raise notice 'PASS reassessment improvement: baseline %, follow-up %, attempts %, distinct %',
    v_baseline,v_followup,v_progress.attempt_count,v_progress.distinct_question_count;

  -- Candidate B cannot inspect Candidate A's completed Nudge objective.
  perform set_config('request.jwt.claim.sub',v_user_b::text,true);
  begin
    perform * from public.get_my_nudge_progress(v_lo_a);
    raise exception 'FAIL cross-user isolation: candidate B read candidate A progress';
  exception when insufficient_privilege then
    raise notice 'PASS cross-user reassessment isolation';
  end;
end $$;

select 'NUDGE LOCAL LIFECYCLE PASS' as result;
