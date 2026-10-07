-- 0051: PIE P3 - server-side global candidate pool, NBLE assignment and DECISION_TRACE.
--
-- Pipeline (policy pie-select/p3.0):
--   GLOBAL_LEARNER_STATE (pie.learner_lo_state, completed-session evidence only)
--   -> GLOBAL_CANDIDATE_POOL (every question, all subjects)
--   -> HARD_ELIGIBILITY (active, has active primary LO, not in current session,
--                        not quarantined, plugin-eligible via amc.amc_blueprint_lo)
--   -> PRIMARY_LEARNER_VALUE (weakness + unseen value from the content hierarchy)
--   -> SECONDARY_REFINEMENT (uncertainty, misconception, behaviour, review_due, recency,
--                            difficulty, reasoning, coverage, information_value)
--   -> ANTI_STARVATION -> NBLE type -> decision + pie.decision_trace row.
-- Global cross-subject competition: one ordering by total score. There are NO fixed
-- ratios, quotas, subject rotation or per-domain caps. The blueprint only filters
-- eligibility, adds a coverage signal and breaks ties.
-- All weights are DESIGN DEFAULTS (uncalibrated) stored versioned in pie.selection_policy.
-- No function here returns or reads into output any answer key or explanation.

create table if not exists pie.selection_policy (
  policy_version text primary key,
  status text not null default 'active' check (status in ('draft','active','retired')),
  weights jsonb not null,
  notes text not null,
  created_at timestamptz not null default now()
);
insert into pie.selection_policy(policy_version, weights, notes) values (
  'pie-select/p3.0',
  jsonb_build_object(
    'primary', jsonb_build_object('weakness', 1.0, 'unseen', 1.0, 'weakness_prior_unseen', 0.5),
    'hierarchy', jsonb_build_object('unseen_concept', 1.0, 'unseen_lo_within_seen_concept', 0.8,
                                    'seen_lo_new_variant', 0.6, 'seen_lo_attempted', 0.3, 'review_due', 0.2),
    'secondary', jsonb_build_object('uncertainty', 0.25, 'misconception', 0.25, 'behaviour', 0.15,
                                    'review_due', 0.20, 'recency', 0.10, 'difficulty', 0.15,
                                    'reasoning', 0.0, 'coverage', 0.10, 'information_value', 0.20),
    'anti_starvation', jsonb_build_object('weight', 0.30, 'horizon_days', 7),
    'difficulty', jsonb_build_object('target_p', 0.7, 'guess_floor', 0.2),
    'nble', jsonb_build_object('remediation_mastery', 0.4, 'prerequisite_weak_mastery', 0.4,
                               'prerequisite_min_exposure', 2, 'prerequisite_ok_mastery', 0.6,
                               'verification_confidence', 0.5)
  ),
  'DESIGN DEFAULTS, uncalibrated (P3). reasoning weight 0: no reasoning signal exists yet. Change only by adding a new policy_version.'
) on conflict (policy_version) do nothing;

create table if not exists pie.lo_prerequisite (
  lo_id uuid not null references pie.learning_objective(id) on delete cascade,
  prerequisite_lo_id uuid not null references pie.learning_objective(id) on delete cascade,
  primary key (lo_id, prerequisite_lo_id),
  check (lo_id <> prerequisite_lo_id)
);

create table if not exists pie.decision_trace (
  decision_id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid references public.practice_sessions(id) on delete set null,
  question_id uuid not null references public.questions(id) on delete restrict,
  event_type text not null check (event_type in ('SESSION_BUILD','NEXT_QUESTION')),
  nble_type text not null check (nble_type in ('new_content','remediation','review','verification','prerequisite_repair','misconception_repair')),
  subject_id uuid,
  concept_id uuid not null references pie.concept(id) on delete restrict,
  lo_id uuid not null references pie.learning_objective(id) on delete restrict,
  primary_reasons jsonb not null,
  secondary_reasons jsonb not null,
  rejected_candidates jsonb not null,
  total_score numeric not null,
  policy_version text not null references pie.selection_policy(policy_version),
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists decision_trace_learner_time_idx on pie.decision_trace(learner_id, created_at desc);
create index if not exists decision_trace_learner_lo_idx on pie.decision_trace(learner_id, lo_id, created_at desc);

alter table pie.selection_policy enable row level security;
alter table pie.lo_prerequisite enable row level security;
alter table pie.decision_trace enable row level security;
revoke all on pie.selection_policy, pie.lo_prerequisite, pie.decision_trace from public, anon, authenticated;
grant select, insert, update, delete on pie.selection_policy, pie.lo_prerequisite to service_role;
grant select, insert on pie.decision_trace to service_role;

-- Trace rows are immutable.
create or replace function pie.forbid_trace_mutation() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (to_jsonb(new) - 'session_id') = (to_jsonb(old) - 'session_id') and new.session_id is null then
    return new;  -- ON DELETE SET NULL
  end if;
  if tg_op = 'DELETE' and current_user not in ('anon','authenticated')
     and coalesce(current_setting('pie.erase_user', true), '') = old.learner_id::text then
    return old;  -- learner erasure (public.erase_my_learning_data)
  end if;
  raise exception 'decision_trace is append-only' using errcode = '55000';
end $$;
drop trigger if exists decision_trace_append_only on pie.decision_trace;
create trigger decision_trace_append_only before update or delete on pie.decision_trace
  for each row execute function pie.forbid_trace_mutation();
revoke all on function pie.forbid_trace_mutation() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ranking: fills pg_temp.pie_cand for (learner, session) with every candidate,
-- eligibility verdict, stage scores and NBLE type. Internal only.
-- p_exposed_los / p_exposed_questions: provisional exposures picked earlier in the
-- same decision batch (they count as "seen" for the content hierarchy).
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Decide n items: repeated global argmax with provisional exposure, one trace each.
-- ---------------------------------------------------------------------------
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

    insert into pie.decision_trace(learner_id, session_id, question_id, event_type, nble_type, subject_id, concept_id, lo_id,
                                   primary_reasons, secondary_reasons, rejected_candidates, total_score, policy_version)
    values (p_user, p_session, r.question_id, p_event_type, r.nble_type, r.subject_id, r.concept_id, r.lo_id,
            jsonb_build_object('hierarchy', r.hierarchy, 'weakness', r.weakness, 'unseen_value', r.unseen_value,
                               'primary_score', r.primary_score),
            r.secondary || jsonb_build_object('secondary_score', r.secondary_score, 'starvation_score', r.starvation),
            jsonb_build_object('top_eligible', v_rej, 'ineligible_counts', v_inelig,
                               'eligible_count', (select count(*) from pg_temp.pie_cand where eligible)),
            r.total, p_policy)
    returning pie.decision_trace.decision_id into v_id;

    v_qs := v_qs || r.question_id; v_los := v_los || r.lo_id;
    question_id := r.question_id; decision_id := v_id; nble_type := r.nble_type;
    return next;
  end loop;
end $$;
revoke all on function pie.decide(uuid, uuid, text, integer, text, text) from public, anon, authenticated;
grant execute on function pie.decide(uuid, uuid, text, integer, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Learner RPCs (server-authoritative; no client-chosen question ids; no answer key).
-- ---------------------------------------------------------------------------
create or replace function public.pie_create_session(p_count integer default 10, p_blueprint_key text default 'AMC_CAT_MCQ')
returns table(session_id uuid, question_count integer)
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_session uuid; v_pos integer := 0; d record;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_count is null or p_count < 1 or p_count > 50 then raise exception 'p_count must be 1..50' using errcode = '22023'; end if;
  insert into public.practice_sessions(user_id, session_type, status, config, started_at, last_activity_at)
  values (v_uid, 'pie_adaptive', 'active',
          jsonb_build_object('selector', 'pie', 'policy_version', 'pie-select/p3.0', 'blueprint_key', p_blueprint_key),
          now(), now())
  returning id into v_session;
  for d in select * from pie.decide(v_uid, v_session, 'SESSION_BUILD', p_count, 'pie-select/p3.0', p_blueprint_key) loop
    insert into public.practice_session_questions(session_id, question_id, position, presented_at)
    values (v_session, d.question_id, v_pos, now());
    v_pos := v_pos + 1;
  end loop;
  session_id := v_session; question_count := v_pos;
  return next;
end $$;

create or replace function public.pie_next_question(p_session_id uuid)
returns table(question_id uuid, question_position integer, nble_type text, decision_id uuid)
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_pos integer; d record; v_cfg jsonb;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select config into v_cfg from public.practice_sessions
   where id = p_session_id and user_id = v_uid and status = 'active' for update;
  if not found then raise exception 'active session not found' using errcode = '42501'; end if;
  select coalesce(max(position) + 1, 0) into v_pos from public.practice_session_questions where session_id = p_session_id;
  if v_pos >= 1000 then raise exception 'practice session cannot contain more than 1000 questions' using errcode = '54000'; end if;
  select * into d from pie.decide(v_uid, p_session_id, 'NEXT_QUESTION', 1, 'pie-select/p3.0',
                                  coalesce(v_cfg->>'blueprint_key', 'AMC_CAT_MCQ')) limit 1;
  insert into public.practice_session_questions(session_id, question_id, position, presented_at)
  values (p_session_id, d.question_id, v_pos, now());
  update public.practice_sessions set last_activity_at = now(), updated_at = now() where id = p_session_id;
  question_id := d.question_id; question_position := v_pos; nble_type := d.nble_type; decision_id := d.decision_id;
  return next;
end $$;

revoke all on function public.pie_create_session(integer, text) from public, anon;
revoke all on function public.pie_next_question(uuid) from public, anon;
grant execute on function public.pie_create_session(integer, text) to authenticated, service_role;
grant execute on function public.pie_next_question(uuid) to authenticated, service_role;

-- Erasure must also clear decision traces (append-only trigger honours pie.erase_user).
create or replace function public.erase_my_learning_data(p_confirm text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_counts jsonb := '{}'::jsonb;
  v_n bigint;
  t record;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_confirm is distinct from 'ERASE_MY_LEARNING_DATA' then
    raise exception 'confirmation phrase required' using errcode = '22023';
  end if;

  perform set_config('pie.erase_user', v_uid::text, true);

  -- Derived state first (cleared, not rebuilt: no evidence remains).
  delete from pie.learner_lo_state where user_id = v_uid; get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('pie.learner_lo_state', v_n);
  delete from pie.lo_state_refresh where user_id = v_uid;
  delete from pie.decision_trace where learner_id = v_uid; get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('pie.decision_trace', v_n);
  delete from pie.pie_candidate_state where user_id = v_uid; get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('pie.pie_candidate_state', v_n);
  delete from pie.pie_inference_run where user_id = v_uid; get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('pie.pie_inference_run', v_n);
  delete from pie.pie_observation where user_id = v_uid; get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('pie.pie_observation', v_n);
  -- Other per-learner derived intelligence tables (any table with a user_id column).
  for t in
    select c.table_schema, c.table_name from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
    where c.table_schema in ('intelligence','amc') and c.column_name = 'user_id'
    order by c.table_name
  loop
    execute format('delete from %I.%I where user_id = $1', t.table_schema, t.table_name) using v_uid;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object(t.table_schema || '.' || t.table_name, v_n);
  end loop;
  -- Raw evidence.
  delete from public.user_attempts where user_id = v_uid; get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('public.user_attempts', v_n);
  delete from public.practice_session_questions psq using public.practice_sessions ps
    where ps.id = psq.session_id and ps.user_id = v_uid;
  delete from public.practice_sessions where user_id = v_uid; get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('public.practice_sessions', v_n);

  perform set_config('pie.erase_user', '', true);

  insert into pie.learning_data_erasure_audit(user_id, actor_role, scope, counts)
  values (v_uid, coalesce(auth.role(), ''), 'learning_data', v_counts);
  return v_counts;
end $$;
revoke all on function public.erase_my_learning_data(text) from public, anon;
grant execute on function public.erase_my_learning_data(text) to authenticated, service_role;
