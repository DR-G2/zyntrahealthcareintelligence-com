-- P18 selector content-schema alignment.
-- Production questions do not carry IRT-b; use the canonical difficulty tier as
-- the selector's bounded difficulty proxy rather than inventing an IRT value.
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
    select (dt.selected_action->>'lo_id')::uuid as lo_id, max(dt.created_at) at from pie.decision_trace dt where dt.user_id = p_user and (dt.selected_action->>'lo_id') is not null group by (dt.selected_action->>'lo_id')
  ),
  base as (
    select q.id question_id, q.subject_id, q.status, case lower(coalesce(q.difficulty_tier,'')) when 'easy' then -1::numeric when 'difficult' then 1::numeric else 0::numeric end,
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



