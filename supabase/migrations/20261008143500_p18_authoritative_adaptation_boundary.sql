-- P18: authoritative adaptation boundary.
-- Production adaptation uses one server-side, versioned PIE selector.
-- P12 shadow inference is not an input to this path.

create table if not exists pie.selection_policy (
  policy_version text primary key,
  status text not null default 'active' check (status in ('draft','active','retired')),
  weights jsonb not null,
  notes text not null,
  created_at timestamptz not null default now()
);
insert into pie.selection_policy(policy_version,weights,notes) values (
 'pie-select/p3.0',
 jsonb_build_object(
  'primary',jsonb_build_object('weakness',1.0,'unseen',1.0,'weakness_prior_unseen',0.5),
  'hierarchy',jsonb_build_object('unseen_concept',1.0,'unseen_lo_within_seen_concept',0.8,'seen_lo_new_variant',0.6,'seen_lo_attempted',0.3,'review_due',0.2),
  'secondary',jsonb_build_object('uncertainty',0.25,'misconception',0.25,'behaviour',0.15,'review_due',0.20,'recency',0.10,'difficulty',0.15,'reasoning',0.0,'coverage',0.10,'information_value',0.20),
  'anti_starvation',jsonb_build_object('weight',0.30,'horizon_days',7),
  'difficulty',jsonb_build_object('target_p',0.7,'guess_floor',0.2),
  'nble',jsonb_build_object('remediation_mastery',0.4,'prerequisite_weak_mastery',0.4,'prerequisite_min_exposure',2,'prerequisite_ok_mastery',0.6,'verification_confidence',0.5)
 ),'DESIGN DEFAULTS, uncalibrated (P3).'
) on conflict(policy_version) do nothing;
revoke all on pie.selection_policy from public,anon,authenticated;
grant select on pie.selection_policy to service_role;

create table if not exists pie.lo_prerequisite (
 lo_id uuid not null references pie.learning_objective(id) on delete cascade,
 prerequisite_lo_id uuid not null references pie.learning_objective(id) on delete cascade,
 primary key(lo_id,prerequisite_lo_id), check(lo_id<>prerequisite_lo_id)
);
alter table pie.selection_policy enable row level security;
alter table pie.lo_prerequisite enable row level security;
revoke all on pie.lo_prerequisite from public,anon,authenticated;
grant select,insert,update,delete on pie.lo_prerequisite to service_role;

create or replace function pie.rank_candidates(
  p_user uuid, p_session uuid, p_policy text, p_blueprint_key text,
  p_exposed_questions uuid[] default '{}', p_exposed_los uuid[] default '{}')
returns void language plpgsql security definer set search_path = '' as $$
declare
  w jsonb;
  v_c numeric;
  v_target_shift numeric;
  v_total_exposure numeric;
begin
  select weights into w from pie.selection_policy where policy_version = p_policy and status = 'active';
  if w is null then raise exception 'unknown or inactive selection policy %', p_policy using errcode = '22023'; end if;
  v_c := (w->'difficulty'->>'guess_floor')::numeric;
  -- theta - b at which P(correct) = target_p under p = c + (1-c) logistic(theta - b)
  v_target_shift := ln( (((w->'difficulty'->>'target_p')::numeric - v_c) / (1 - v_c))
                        / (1 - (((w->'difficulty'->>'target_p')::numeric - v_c) / (1 - v_c))) );
  select coalesce(sum(exposure_count), 0) into v_total_exposure from pie.learner_lo_state where user_id = p_user;

  create temp table if not exists pie_cand (
    question_id uuid primary key, lo_id uuid, concept_id uuid, subject_id uuid,
    eligible boolean, reject_reason text, hierarchy text,
    weakness numeric, unseen_value numeric, primary_score numeric,
    secondary jsonb, secondary_score numeric, starvation numeric, total numeric,
    nble_type text, tie_rank integer, tie_hash text
  ) on commit drop;
  truncate pg_temp.pie_cand;

  insert into pg_temp.pie_cand
  with bp as (
    select b.id from amc.amc_blueprint b
    where b.blueprint_key = p_blueprint_key
      and (b.effective_from is null or b.effective_from <= now())
      and (b.effective_to is null or b.effective_to > now())
    order by b.effective_from desc nulls last limit 1
  ),
  sess as (
    select psq.question_id from public.practice_session_questions psq where psq.session_id = p_session
    union select unnest(p_exposed_questions)
  ),
  sess_lo as (
    select ql.lo_id from public.practice_session_questions psq
    join pie.question_lo ql on ql.question_id = psq.question_id and ql.is_primary
    where psq.session_id = p_session
    union select unnest(p_exposed_los)
  ),
  seen_concepts as (
    select lo.concept_id from pie.learner_lo_state s join pie.learning_objective lo on lo.id = s.lo_id where s.user_id = p_user
    union select lo.concept_id from sess_lo x join pie.learning_objective lo on lo.id = x.lo_id
  ),
  attempted as (
    select distinct ua.question_id from public.user_attempts ua
    join public.practice_sessions ps on ps.id = ua.session_id and ps.status = 'completed'
    where ua.user_id = p_user
  ),
  last_decided as (
    select dt.lo_id, max(dt.created_at) at from pie.decision_trace dt where dt.learner_id = p_user group by dt.lo_id
  ),
  base as (
    select q.id question_id, q.subject_id, q.status, q.irt_b,
           ql.lo_id, lo.concept_id, lo.status lo_status,
           s.mastery, s.mastery_confidence, s.ability_theta, s.exposure_count, s.last_seen_at, s.review_due_at,
           s.fragile_correct, s.confident_wrong, s.misconception_state,
           (q.id in (select question_id from sess)) in_session,
           exists (select 1 from pie.pie_question_quarantine qq where qq.question_id = q.id and qq.status = 'open') quarantined,
           bl.eligible bp_eligible, bl.coverage_target, bl.tie_break_rank,
           (s.lo_id is not null or ql.lo_id in (select lo_id from sess_lo)) lo_seen,
           (lo.concept_id in (select concept_id from seen_concepts)) concept_seen,
           (q.id in (select question_id from attempted)) q_attempted,
           ld.at last_decided_at
    from public.questions q
    left join pie.question_lo ql on ql.question_id = q.id and ql.is_primary
    left join pie.learning_objective lo on lo.id = ql.lo_id
    left join pie.learner_lo_state s on s.user_id = p_user and s.lo_id = ql.lo_id
    left join amc.amc_blueprint_lo bl on bl.lo_id = ql.lo_id and bl.blueprint_id = (select id from bp)
    left join last_decided ld on ld.lo_id = ql.lo_id
  ),
  elig as (
    select b.*,
      case
        when b.status <> 'active' then 'inactive'
        when b.lo_id is null then 'no_primary_lo'
        when b.lo_status <> 'active' then 'lo_inactive'
        when b.in_session then 'in_current_session'
        when b.quarantined then 'quarantined'
        when b.bp_eligible = false then 'plugin_ineligible'
        else null end reject_reason,
      case
        when b.review_due_at is not null and b.review_due_at <= now() then 'review_due'
        when not b.concept_seen then 'unseen_concept'
        when not b.lo_seen then 'unseen_lo_within_seen_concept'
        when not b.q_attempted then 'seen_lo_new_variant'
        else 'seen_lo_attempted' end hierarchy,
      coalesce(b.ability_theta, 0) theta,
      coalesce(b.irt_b, 0) bb
    from base b
  ),
  sig as (
    select e.*,
      case when e.mastery is null then (w->'primary'->>'weakness_prior_unseen')::numeric else 1 - e.mastery end weakness,
      (w->'hierarchy'->>e.hierarchy)::numeric unseen_value,
      case when e.mastery_confidence is null then 1 else 1 - e.mastery_confidence end s_uncertainty,
      case when e.exposure_count > 0 then least(1, (e.confident_wrong
            + (select count(*) from jsonb_object_keys(coalesce(e.misconception_state->'repeated_wrong_option','{}'::jsonb))))::numeric / e.exposure_count) else 0 end s_misconception,
      case when e.exposure_count > 0 then least(1, e.fragile_correct::numeric / e.exposure_count) else 0 end s_behaviour,
      case when e.hierarchy = 'review_due' then 1 else 0 end s_review_due,
      case when e.last_seen_at is null then 1 else least(1, extract(epoch from now() - e.last_seen_at) / 86400.0 / 30) end s_recency,
      1 - least(1, abs(e.bb - (e.theta - v_target_shift)) / 4) s_difficulty,
      0::numeric s_reasoning,
      case when e.coverage_target is null or e.coverage_target = 0 then 0
           else greatest(0, (e.coverage_target - case when v_total_exposure = 0 then 0 else coalesce(e.exposure_count,0) / v_total_exposure end) / e.coverage_target) end s_coverage,
      ((v_c + (1 - v_c) / (1 + exp(-(e.theta - e.bb)))) * (1 - (v_c + (1 - v_c) / (1 + exp(-(e.theta - e.bb)))))) / 0.25 s_information,
      case when e.last_decided_at is null and e.last_seen_at is null then 0
           else least(1, extract(epoch from now() - coalesce(e.last_decided_at, e.last_seen_at)) / 86400.0
                         / (w->'anti_starvation'->>'horizon_days')::numeric) end s_starvation,
      exists (select 1 from pie.lo_prerequisite p join pie.learner_lo_state ws on ws.user_id = p_user and ws.lo_id = p.lo_id
              where p.prerequisite_lo_id = e.lo_id
                and ws.mastery < (w->'nble'->>'prerequisite_weak_mastery')::numeric
                and ws.exposure_count >= (w->'nble'->>'prerequisite_min_exposure')::int) is_prereq_of_weak
    from elig e
  )
  select x.question_id, x.lo_id, x.concept_id, x.subject_id,
    x.reject_reason is null, x.reject_reason, x.hierarchy,
    round(x.weakness, 6), round(x.unseen_value, 6),
    round((w->'primary'->>'weakness')::numeric * x.weakness + (w->'primary'->>'unseen')::numeric * x.unseen_value, 6),
    jsonb_build_object(
      'uncertainty', jsonb_build_object('value', round(x.s_uncertainty,4), 'weight', (w->'secondary'->>'uncertainty')::numeric),
      'misconception', jsonb_build_object('value', round(x.s_misconception,4), 'weight', (w->'secondary'->>'misconception')::numeric),
      'behaviour', jsonb_build_object('value', round(x.s_behaviour,4), 'weight', (w->'secondary'->>'behaviour')::numeric),
      'review_due', jsonb_build_object('value', x.s_review_due, 'weight', (w->'secondary'->>'review_due')::numeric),
      'recency', jsonb_build_object('value', round(x.s_recency,4), 'weight', (w->'secondary'->>'recency')::numeric),
      'difficulty', jsonb_build_object('value', round(x.s_difficulty,4), 'weight', (w->'secondary'->>'difficulty')::numeric, 'irt_b', x.bb, 'theta', round(x.theta,4)),
      'reasoning', jsonb_build_object('value', x.s_reasoning, 'weight', (w->'secondary'->>'reasoning')::numeric, 'note', 'no reasoning signal yet'),
      'coverage', jsonb_build_object('value', round(x.s_coverage,4), 'weight', (w->'secondary'->>'coverage')::numeric),
      'information_value', jsonb_build_object('value', round(x.s_information,4), 'weight', (w->'secondary'->>'information_value')::numeric),
      'anti_starvation', jsonb_build_object('value', round(x.s_starvation,4), 'weight', (w->'anti_starvation'->>'weight')::numeric)),
    round((w->'secondary'->>'uncertainty')::numeric * x.s_uncertainty
        + (w->'secondary'->>'misconception')::numeric * x.s_misconception
        + (w->'secondary'->>'behaviour')::numeric * x.s_behaviour
        + (w->'secondary'->>'review_due')::numeric * x.s_review_due
        + (w->'secondary'->>'recency')::numeric * x.s_recency
        + (w->'secondary'->>'difficulty')::numeric * x.s_difficulty
        + (w->'secondary'->>'reasoning')::numeric * x.s_reasoning
        + (w->'secondary'->>'coverage')::numeric * x.s_coverage
        + (w->'secondary'->>'information_value')::numeric * x.s_information, 6),
    round((w->'anti_starvation'->>'weight')::numeric * x.s_starvation, 6),
    null,
    case
      when x.is_prereq_of_weak and (x.mastery is null or x.mastery < (w->'nble'->>'prerequisite_ok_mastery')::numeric) then 'prerequisite_repair'
      when x.hierarchy in ('unseen_concept','unseen_lo_within_seen_concept') then 'new_content'
      when x.s_misconception > 0 then 'misconception_repair'
      when x.hierarchy = 'review_due' then 'review'
      when x.mastery < (w->'nble'->>'remediation_mastery')::numeric then 'remediation'
      when x.fragile_correct > 0 or coalesce(x.mastery_confidence, 0) < (w->'nble'->>'verification_confidence')::numeric then 'verification'
      else 'review' end,
    coalesce(x.tie_break_rank, 2147483647),
    md5(x.question_id::text || coalesce(p_session::text, ''))
  from sig x;

  update pg_temp.pie_cand set total = primary_score + secondary_score + starvation where eligible;
end $$;
revoke all on function pie.rank_candidates(uuid, uuid, text, text, uuid[], uuid[]) from public, anon, authenticated;
grant execute on function pie.rank_candidates(uuid, uuid, text, text, uuid[], uuid[]) to service_role;



create or replace function pie.decide(
  p_user uuid, p_session uuid, p_event_type text, p_n integer,
  p_policy text default 'pie-select/p3.0', p_blueprint_key text default 'AMC_CAT_MCQ')
returns table(question_id uuid, decision_id uuid, nble_type text)
language plpgsql security definer set search_path = '' as $$
declare
  v_qs uuid[] := '{}'; v_los uuid[] := '{}';
  r record; v_rej jsonb; v_inelig jsonb; v_id uuid; i integer;
begin
  if p_n is null or p_n < 1 or p_n > 50 then raise exception 'n must be 1..50' using errcode = '22023'; end if;
  for i in 1..p_n loop
    perform pie.rank_candidates(p_user, p_session, p_policy, p_blueprint_key, v_qs, v_los);
    select * into r from pg_temp.pie_cand c where c.eligible
      order by c.total desc, c.tie_rank asc, c.tie_hash asc limit 1;
    if r is null then
      if i = 1 then
        raise exception 'PIE_NO_ELIGIBLE_CANDIDATE' using errcode = 'P0002',
          detail = (select coalesce(jsonb_object_agg(reject_reason, n), '{}'::jsonb)::text
                    from (select reject_reason, count(*) n from pg_temp.pie_cand group by 1) t);
      end if;
      exit;
    end if;
    select coalesce(jsonb_agg(jsonb_build_object('question_id', c.question_id, 'lo_id', c.lo_id, 'total', c.total,
             'primary', c.primary_score, 'secondary', c.secondary_score, 'hierarchy', c.hierarchy, 'reason', 'lower_total_score')
             order by c.total desc, c.tie_rank, c.tie_hash), '[]'::jsonb)
      into v_rej
      from (select * from pg_temp.pie_cand c where c.eligible and c.question_id <> r.question_id
            order by c.total desc, c.tie_rank, c.tie_hash limit 5) c;
    select coalesce(jsonb_object_agg(reject_reason, n), '{}'::jsonb) into v_inelig
      from (select reject_reason, count(*) n from pg_temp.pie_cand where not eligible group by 1) t;

    insert into pie.decision_trace(
      user_id, session_id, question_id, decision_type, selected_action, rejected_actions,
      reason_codes, evidence_snapshot, state_snapshot, policy_version, model_version, confidence, source
    )
    values (
      p_user, p_session, r.question_id, p_event_type,
      jsonb_build_object('nble_type', r.nble_type, 'hierarchy', r.hierarchy, 'total_score', r.total,
                         'primary_score', r.primary_score, 'secondary_score', r.secondary_score),
      v_rej, array[r.nble_type, r.hierarchy], r.secondary,
      jsonb_build_object('weakness', r.weakness, 'unseen_value', r.unseen_value,
                         'eligible_count', (select count(*) from pg_temp.pie_cand where eligible)),
      p_policy, 'pie-select/p3.0-authoritative',
      greatest(least(coalesce(1-r.secondary_score,1),1),0), 'authoritative'
    )
    returning pie.decision_trace.id into v_id;

    v_qs := v_qs || r.question_id; v_los := v_los || r.lo_id;
    question_id := r.question_id; decision_id := v_id; nble_type := r.nble_type;
    return next;
  end loop;
end $$;
revoke all on function pie.decide(uuid, uuid, text, integer, text, text) from public, anon, authenticated;
grant execute on function pie.decide(uuid, uuid, text, integer, text, text) to service_role;



drop function if exists public.pie_create_session(integer,text,text);
create or replace function public.pie_create_session(p_count integer default 10,p_blueprint_key text default 'AMC_CAT_MCQ',p_mode text default 'pie_adaptive')
returns table(session_id uuid,question_count integer)
language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_session uuid; v_pos integer:=0; d record;
begin
 if v_uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if p_count is null or p_count<1 or p_count>50 then raise exception 'p_count must be 1..50' using errcode='22023'; end if;
 if p_mode not in ('pie_adaptive','pie_diagnostic') then raise exception 'invalid mode' using errcode='22023'; end if;
 insert into public.practice_sessions(user_id,session_type,status,config,started_at,last_activity_at)
 values(v_uid,p_mode,'active',jsonb_build_object('selector',case when p_mode='pie_adaptive' then 'pie' else 'diagnostic_fixed' end,'policy_version',case when p_mode='pie_adaptive' then 'pie-select/p3.0' else null end,'blueprint_key',p_blueprint_key,'mode',p_mode),now(),now())
 returning id into v_session;
 if p_mode='pie_diagnostic' then
   for d in select q.id question_id from public.questions q where q.status='active'
     and not exists(select 1 from public.practice_session_questions x where x.session_id=v_session and x.question_id=q.id)
     and not exists(select 1 from public.user_attempts ua where ua.user_id=v_uid and ua.question_id=q.id)
     order by q.id limit p_count loop
       insert into public.practice_session_questions(session_id,question_id,position,presented_at) values(v_session,d.question_id,v_pos,now()); v_pos:=v_pos+1;
   end loop;
 else
   for d in select * from pie.decide(v_uid,v_session,'SESSION_BUILD',p_count,'pie-select/p3.0',p_blueprint_key) loop
     insert into public.practice_session_questions(session_id,question_id,position,presented_at) values(v_session,d.question_id,v_pos,now()); v_pos:=v_pos+1;
   end loop;
 end if;
 if v_pos=0 then raise exception 'PIE_NO_ELIGIBLE_CANDIDATE: no questions available' using errcode='P0002'; end if;
 session_id:=v_session; question_count:=v_pos; return next;
end $$;
revoke all on function public.pie_create_session(integer,text,text) from public,anon;
grant execute on function public.pie_create_session(integer,text,text) to authenticated,service_role;

create or replace function public.pie_next_question(p_session_id uuid)
returns table(question_id uuid,question_position integer,nble_type text,decision_id uuid)
language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_pos integer; d record; v_cfg jsonb;
begin
 if v_uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
 select config into v_cfg from public.practice_sessions where id=p_session_id and user_id=v_uid and status='active' for update;
 if not found then raise exception 'active session not found' using errcode='42501'; end if;
 if coalesce(v_cfg->>'mode','pie_adaptive')<>'pie_adaptive' then raise exception 'not an adaptive session' using errcode='42501'; end if;
 if exists(select 1 from public.practice_session_questions where session_id=p_session_id and answered_at is null) then raise exception 'PIE_UNANSWERED: answer the served question before requesting another' using errcode='55000'; end if;
 select coalesce(max(position)+1,0) into v_pos from public.practice_session_questions where session_id=p_session_id;
 if v_pos>=1000 then raise exception 'practice session cannot contain more than 1000 questions' using errcode='54000'; end if;
 select * into d from pie.decide(v_uid,p_session_id,'NEXT_QUESTION',1,'pie-select/p3.0',coalesce(v_cfg->>'blueprint_key','AMC_CAT_MCQ')) limit 1;
 if d.question_id is null then raise exception 'PIE_NO_ELIGIBLE_CANDIDATE: selector returned no question' using errcode='P0002'; end if;
 insert into public.practice_session_questions(session_id,question_id,position,presented_at) values(p_session_id,d.question_id,v_pos,now());
 update public.practice_sessions set last_activity_at=now(),updated_at=now() where id=p_session_id;
 question_id:=d.question_id; question_position:=v_pos; nble_type:=d.nble_type; decision_id:=d.decision_id; return next;
end $$;
revoke all on function public.pie_next_question(uuid) from public,anon;
grant execute on function public.pie_next_question(uuid) to authenticated,service_role;

create or replace function public.get_practice_session_questions(p_session_id uuid)
returns table(session_question_id uuid,session_id uuid,question_id uuid,question_position integer,presented_at timestamptz,answered_at timestamptz,zyntra_id text,stem text,options jsonb,explanation text,subject_id uuid,subtopic_id uuid,difficulty_tier text,version integer)
language sql security definer set search_path=public,pg_temp
as $$
select psq.id,psq.session_id,psq.question_id,psq.position,psq.presented_at,psq.answered_at,q.zyntra_id,q.stem,q.options,null::text,q.subject_id,q.subtopic_id,q.difficulty_tier,q.version
from public.practice_session_questions psq join public.practice_sessions ps on ps.id=psq.session_id join public.questions q on q.id=psq.question_id
where ps.id=p_session_id and ps.user_id=auth.uid() order by psq.position
$$;
revoke all on function public.get_practice_session_questions(uuid) from public,anon;
grant execute on function public.get_practice_session_questions(uuid) to authenticated;
