-- PIE P0-P11 rebuild contract. Additive migration; no legacy PIE tables are deleted.
-- Deployment order: P0 integrity -> P1 LO identity -> P2 state -> P3/P4 learning loop
-- -> P5 shadow policy -> P6 decision trace -> P7 gated serving -> P8 inference
-- -> P9 tutor context -> P10 AMC readiness -> P11 certification/promotion.

-- P0
create or replace function public.get_practice_session_questions(p_session_id uuid)
returns table(session_question_id uuid,session_id uuid,question_id uuid,question_position integer,presented_at timestamptz,answered_at timestamptz,zyntra_id text,stem text,options jsonb,explanation text,subject_id uuid,subtopic_id uuid,difficulty_tier text,version integer)
language sql security definer set search_path=public,pg_temp as $$
select psq.id,psq.session_id,psq.question_id,psq.position,psq.presented_at,psq.answered_at,q.zyntra_id,q.stem,q.options,null::text,q.subject_id,q.subtopic_id,q.difficulty_tier,q.version
from public.practice_session_questions psq join public.practice_sessions ps on ps.id=psq.session_id join public.questions q on q.id=psq.question_id
where ps.id=p_session_id and ps.user_id=auth.uid() order by psq.position
$$;

-- P1
create table if not exists pie.attempt_lo(
 attempt_id uuid not null references public.user_attempts(id) on delete cascade,
 lo_id uuid not null references pie.learning_objective(id) on delete restrict,
 concept_id uuid references pie.concept(id) on delete set null,
 is_primary boolean not null default true,
 mapping_weight numeric not null default 1 check(mapping_weight>0 and mapping_weight<=1),
 created_at timestamptz not null default now(),
 primary key(attempt_id,lo_id));
create index if not exists attempt_lo_lo_idx on pie.attempt_lo(lo_id,created_at desc);
insert into pie.attempt_lo(attempt_id,lo_id,concept_id,is_primary,mapping_weight)
select ua.id,ql.lo_id,lo.concept_id,ql.is_primary,ql.weight
from public.user_attempts ua join pie.question_lo ql on ql.question_id=ua.question_id
join pie.learning_objective lo on lo.id=ql.lo_id where ql.is_primary on conflict do nothing;

-- P2
alter table pie.learner_lo_state add column if not exists mastery_mean numeric not null default 0;
alter table pie.learner_lo_state add column if not exists mastery_sd numeric not null default 1;
alter table pie.learner_lo_state add column if not exists mastery_lcb numeric not null default 0;
alter table pie.learner_lo_state add column if not exists uncertainty numeric not null default 1;
alter table pie.learner_lo_state add column if not exists miss_count integer not null default 0;
alter table pie.learner_lo_state add column if not exists miss_streak integer not null default 0;
alter table pie.learner_lo_state add column if not exists last_miss_at timestamptz;
alter table pie.learner_lo_state add column if not exists last_seen_at timestamptz;
alter table pie.learner_lo_state add column if not exists median_time_seconds numeric;
alter table pie.learner_lo_state add column if not exists median_ttfc_seconds numeric;
alter table pie.learner_lo_state add column if not exists confidence_mean numeric;
alter table pie.learner_lo_state add column if not exists confidence_count integer not null default 0;
alter table pie.learner_lo_state add column if not exists answer_changes integer not null default 0;
alter table pie.learner_lo_state add column if not exists confident_wrong integer not null default 0;
alter table pie.learner_lo_state add column if not exists fragile_correct integer not null default 0;
alter table pie.learner_lo_state add column if not exists status text not null default 'unseen';
alter table pie.learner_lo_state add column if not exists status_reason text;
alter table pie.learner_lo_state add column if not exists evidence_maturity text not null default 'insufficient';
alter table pie.learner_lo_state add column if not exists policy_version text;
alter table pie.learner_lo_state add column if not exists model_version text;
alter table pie.learner_lo_state add column if not exists state_version integer not null default 1;

-- P3/P4
create table if not exists pie.lo_misconception(
 id uuid primary key default gen_random_uuid(),lo_id uuid not null references pie.learning_objective(id) on delete cascade,
 key text not null,title text not null,description text,status text not null default 'active',
 created_at timestamptz not null default now(),unique(lo_id,key));
create table if not exists pie.lo_misconception_state(
 user_id uuid not null references public.profiles(id) on delete cascade,
 misconception_id uuid not null references pie.lo_misconception(id) on delete cascade,
 times_chosen integer not null default 0,times_confident integer not null default 0,
 last_chosen_at timestamptz,resolved_at timestamptz,confidence numeric not null default 0,
 primary key(user_id,misconception_id));
create table if not exists pie.lo_review(
 user_id uuid not null references public.profiles(id) on delete cascade,
 lo_id uuid not null references pie.learning_objective(id) on delete cascade,
 ladder_step integer not null default 0,due_at timestamptz,last_result text,last_reviewed_at timestamptz,
 updated_at timestamptz not null default now(),primary key(user_id,lo_id));
create table if not exists pie.lo_working_set(
 user_id uuid not null references public.profiles(id) on delete cascade,
 slot integer not null check(slot between 1 and 5),lo_id uuid not null references pie.learning_objective(id) on delete cascade,
 reason text not null,score numeric not null default 0,entered_at timestamptz not null default now(),
 expires_at timestamptz,primary key(user_id,slot),unique(user_id,lo_id));
create table if not exists pie.lo_focus(
 user_id uuid primary key references public.profiles(id) on delete cascade,
 lo_id uuid references pie.learning_objective(id) on delete set null,reason text,confidence numeric not null default 0,updated_at timestamptz not null default now());

-- P6
create table if not exists pie.lo_decision_event(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 session_id uuid references public.practice_sessions(id) on delete set null,question_id uuid references public.questions(id) on delete set null,
 lo_id uuid references pie.learning_objective(id) on delete set null,action text not null,nble_type text,reason_code text,
 score_terms jsonb not null default '{}'::jsonb,alternatives jsonb not null default '[]'::jsonb,
 target_misconception text,propensity numeric,mode text,policy_version text,learner_text text,
 created_at timestamptz not null default now());

-- P10
create table if not exists pie.readiness_snapshot(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 plugin_key text not null,status text not null check(status in ('NOT_AVAILABLE','PRELIMINARY','CALIBRATED')),
 score numeric,uncertainty jsonb not null default '{}'::jsonb,evidence jsonb not null default '{}'::jsonb,
 blueprint_version text,model_version text,calculated_at timestamptz not null default now());

-- P2 replayable state updater
create or replace function pie.rebuild_lo_state(p_user_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare r record;n integer:=0;
begin
 if auth.uid() is not null and auth.uid()<>p_user_id then raise exception 'user scope violation' using errcode='42501'; end if;
 delete from pie.learner_lo_state where user_id=p_user_id;
 for r in
  select ql.lo_id,ua.id attempt_id,ua.is_correct,ua.time_taken_seconds,ua.time_to_first_click,ua.confidence_level,ua.answer_changes_count,ua.created_at
  from public.user_attempts ua join pie.question_lo ql on ql.question_id=ua.question_id and ql.is_primary
  where ua.user_id=p_user_id order by ua.created_at,ua.id
 loop
  insert into pie.learner_lo_state(user_id,lo_id,exposure_count,correct_count,mastery_mean,mastery_sd,mastery_lcb,uncertainty,miss_count,miss_streak,last_miss_at,last_seen_at,confidence_mean,confidence_count,answer_changes,confident_wrong,fragile_correct,status,evidence_maturity,model_version,state_version)
  values(p_user_id,r.lo_id,1,case when r.is_correct then 1 else 0 end,case when r.is_correct then .75 else .25 end,1,0,1,case when r.is_correct then 0 else 1 end,case when r.is_correct then 0 else 1 end,case when r.is_correct then null else r.created_at end,r.created_at,r.confidence_level,r.confidence_level::int is not null,coalesce(r.answer_changes_count,0),case when not r.is_correct and coalesce(r.confidence_level,0)>=4 then 1 else 0 end,case when r.is_correct and (coalesce(r.confidence_level,3)<=2 or coalesce(r.time_taken_seconds,9999)<=15) then 1 else 0 end,'developing','insufficient','pie-lo-v1',1)
  on conflict(user_id,lo_id) do update set
   exposure_count=pie.learner_lo_state.exposure_count+1,
   correct_count=pie.learner_lo_state.correct_count+case when r.is_correct then 1 else 0 end,
   mastery_mean=(pie.learner_lo_state.mastery_mean*pie.learner_lo_state.exposure_count+case when r.is_correct then 1 else 0 end)/(pie.learner_lo_state.exposure_count+1),
   mastery_sd=greatest(.05,1/sqrt(pie.learner_lo_state.exposure_count+1)),
   uncertainty=greatest(.05,1/sqrt(pie.learner_lo_state.exposure_count+1)),
   miss_count=pie.learner_lo_state.miss_count+case when r.is_correct then 0 else 1 end,
   miss_streak=case when r.is_correct then 0 else pie.learner_lo_state.miss_streak+1 end,
   last_miss_at=case when r.is_correct then pie.learner_lo_state.last_miss_at else r.created_at end,
   last_seen_at=r.created_at,
   answer_changes=pie.learner_lo_state.answer_changes+coalesce(r.answer_changes_count,0),
   confidence_mean=case when r.confidence_level is null then pie.learner_lo_state.confidence_mean else coalesce((pie.learner_lo_state.confidence_mean*pie.learner_lo_state.confidence_count+r.confidence_level)/(pie.learner_lo_state.confidence_count+1),r.confidence_level) end,
   confidence_count=pie.learner_lo_state.confidence_count+case when r.confidence_level is null then 0 else 1 end,
   confident_wrong=pie.learner_lo_state.confident_wrong+case when not r.is_correct and coalesce(r.confidence_level,0)>=4 then 1 else 0 end,
   fragile_correct=pie.learner_lo_state.fragile_correct+case when r.is_correct and (coalesce(r.confidence_level,3)<=2 or coalesce(r.time_taken_seconds,9999)<=15) then 1 else 0 end,
   mastery_lcb=greatest(0,((pie.learner_lo_state.mastery_mean*pie.learner_lo_state.exposure_count+case when r.is_correct then 1 else 0 end)/(pie.learner_lo_state.exposure_count+1))-1.96*greatest(.05,1/sqrt(pie.learner_lo_state.exposure_count+1))),
   status=case when not r.is_correct and pie.learner_lo_state.miss_streak+1>=2 then 'weak' else 'developing' end,
   evidence_maturity=case when pie.learner_lo_state.exposure_count+1<3 then 'insufficient' when pie.learner_lo_state.exposure_count+1<8 then 'preliminary' when pie.learner_lo_state.exposure_count+1<20 then 'developing' when pie.learner_lo_state.exposure_count+1<40 then 'initial_individual' else 'established' end,
   state_version=pie.learner_lo_state.state_version+1,updated_at=now();
  n:=n+1;
 end loop;
 return n;
end $$;

-- P5/P6 shadow decision contract
create or replace function pie.record_lo_decision(p_user_id uuid,p_session_id uuid,p_question_id uuid,p_lo_id uuid,p_action text,p_nble text,p_reason text,p_score_terms jsonb,p_alternatives jsonb,p_policy text,p_mode text default 'shadow')
returns uuid language plpgsql security definer set search_path='' as $$
declare v uuid;
begin
 insert into pie.lo_decision_event(user_id,session_id,question_id,lo_id,action,nble_type,reason_code,score_terms,alternatives,policy_version,mode)
 values(p_user_id,p_session_id,p_question_id,p_lo_id,p_action,p_nble,p_reason,coalesce(p_score_terms,'{}'),coalesce(p_alternatives,'[]'),p_policy,p_mode)
 returning id into v; return v;
end $$;

-- P9 safe tutor context and P10 readiness gate
create or replace function public.get_my_pie_tutor_context()
returns jsonb language sql security definer set search_path='' as $$
select jsonb_build_object(
 'lo_state',coalesce((select jsonb_agg(jsonb_build_object('lo_id',s.lo_id,'mastery',s.mastery_mean,'uncertainty',s.uncertainty,'status',s.status,'miss_streak',s.miss_streak,'confident_wrong',s.confident_wrong,'fragile_correct',s.fragile_correct) order by s.mastery_mean) from pie.learner_lo_state s where s.user_id=auth.uid()),'[]'::jsonb),
 'readiness',coalesce((select jsonb_build_object('status',r.status,'score',r.score,'uncertainty',r.uncertainty,'evidence',r.evidence,'blueprint_version',r.blueprint_version,'model_version',r.model_version) from pie.readiness_snapshot r where r.user_id=auth.uid() order by r.calculated_at desc limit 1),'{"status":"NOT_AVAILABLE","reason":"insufficient_calibrated_evidence"}'::jsonb)
)
$$;
revoke all on function public.get_my_pie_tutor_context() from public,anon;
grant execute on function public.get_my_pie_tutor_context() to authenticated;

create or replace function public.get_my_pie_readiness()
returns jsonb language sql security definer set search_path='' as $$
select coalesce((select jsonb_build_object('status',r.status,'score',r.score,'uncertainty',r.uncertainty,'evidence',r.evidence,'blueprint_version',r.blueprint_version,'model_version',r.model_version,'calculated_at',r.calculated_at) from pie.readiness_snapshot r where r.user_id=auth.uid() order by r.calculated_at desc limit 1),'{"status":"NOT_AVAILABLE","reason":"insufficient_calibrated_evidence"}'::jsonb)
$$;
revoke all on function public.get_my_pie_readiness() from public,anon;
grant execute on function public.get_my_pie_readiness() to authenticated;

notify pgrst,'reload schema';
