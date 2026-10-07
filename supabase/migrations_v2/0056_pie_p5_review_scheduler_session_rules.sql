-- 0056: P5 review scheduler + session rules (Mr. G rulings C1, C3).
--  S1  Spaced review (DESIGN DEFAULTS, uncalibrated): per learner x LO, from answered
--      attempts in COMPLETED adaptive sessions (time order):
--        wrong -> 1 day; right with low confidence (1-2 of 5) -> 3 days;
--        right -> 7 days, doubling for each consecutive (non-low-confidence) right, cap 180 d.
--      review_due_at = last attempt + interval. Computed by a BEFORE INSERT/UPDATE trigger
--      on pie.learner_lo_state, so every recompute (which runs after attempts, on refresh)
--      sets it deterministically. Scheduling is not mastery evidence (first-exposure rule
--      unchanged).
--  C3  Due reviews outrank unseen: candidates whose LO review is due get policy
--      'review_priority' (10) added to total - larger than any other attainable total, so a
--      due review always wins; recorded in the trace (secondary_reasons.review_priority).
--  C1  At most 2 questions per concept per session, and only from different LOs
--      (reject reasons 'concept_session_cap', 'lo_already_in_session').
--  New active policy 'pie-select/p5.0' (= p3.0 weights + the above); p3.0 is retired. The
--      RPCs use pie.active_policy() (the single active policy) instead of a hard-coded
--      version. C1/C3 are read from the policy weights.

insert into pie.selection_policy(policy_version, weights, notes)
select 'pie-select/p5.0',
       weights || jsonb_build_object(
         'review_priority', 10,
         'session', jsonb_build_object('max_per_concept', 2, 'distinct_lo_within_concept', true),
         'review_schedule', jsonb_build_object('wrong_days', 1, 'right_low_conf_days', 3, 'right_days', 7,
                                               'right_growth', 2, 'max_days', 180, 'low_conf_max_level', 2)),
       'P5: C1 concept cap, C3 review priority, spaced-review schedule. DESIGN DEFAULTS, uncalibrated.'
from pie.selection_policy where policy_version = 'pie-select/p3.0'
on conflict (policy_version) do nothing;
update pie.selection_policy set status = 'retired' where policy_version = 'pie-select/p3.0';

-- S1 ------------------------------------------------------------------------------------
create or replace function pie.compute_review_due(p_user uuid, p_lo uuid)
returns timestamptz language plpgsql stable security definer set search_path = '' as $$
declare
  s jsonb; a record; v_streak integer := 0; v_days numeric; v_last timestamptz;
begin
  select weights->'review_schedule' into s from pie.selection_policy where policy_version = 'pie-select/p5.0';
  if s is null then return null; end if;
  for a in
    select ua.is_correct, ua.confidence_level, ua.created_at
    from public.user_attempts ua
    join public.practice_sessions ps on ps.id = ua.session_id and ps.status = 'completed'
    join pie.adaptive_session ad on ad.session_id = ua.session_id and ad.user_id = p_user
    join pie.question_lo ql on ql.question_id = ua.question_id and ql.lo_id = p_lo
    where ua.user_id = p_user
    order by ua.created_at, ua.id
  loop
    v_last := a.created_at;
    if not a.is_correct then
      v_streak := 0; v_days := (s->>'wrong_days')::numeric;
    elsif a.confidence_level is not null and a.confidence_level <= (s->>'low_conf_max_level')::int then
      v_streak := 0; v_days := (s->>'right_low_conf_days')::numeric;
    else
      v_streak := v_streak + 1;
      v_days := least((s->>'max_days')::numeric,
                      (s->>'right_days')::numeric * power((s->>'right_growth')::numeric, v_streak - 1));
    end if;
  end loop;
  if v_last is null then return null; end if;
  return v_last + make_interval(secs => (v_days * 86400)::double precision);
end $$;
revoke all on function pie.compute_review_due(uuid, uuid) from public, anon, authenticated;
grant execute on function pie.compute_review_due(uuid, uuid) to service_role;

create or replace function pie.learner_lo_state_set_review_due()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.review_due_at := pie.compute_review_due(new.user_id, new.lo_id);
  return new;
end $$;
revoke all on function pie.learner_lo_state_set_review_due() from public, anon, authenticated;
drop trigger if exists learner_lo_state_review_due on pie.learner_lo_state;
create trigger learner_lo_state_review_due before insert or update on pie.learner_lo_state
  for each row execute function pie.learner_lo_state_set_review_due();
comment on column pie.learner_lo_state.review_due_at is
  'Spaced review due time (0056, DESIGN DEFAULT schedule in pie.selection_policy pie-select/p5.0 review_schedule).';

-- C1 + C3: decide (based on 0053) ------------------------------------------------------
create or replace function pie.active_policy() returns text language sql stable security definer set search_path = '' as $$
  -- The single active selection policy (most recent if several). RPCs never hard-code it.
  select policy_version from pie.selection_policy where status = 'active' order by created_at desc, policy_version desc limit 1
$$;
revoke all on function pie.active_policy() from public, anon, authenticated;
grant execute on function pie.active_policy() to service_role;

create or replace function pie.decide(
  p_user uuid, p_session uuid, p_event_type text, p_n integer,
  p_policy text default 'pie-select/p3.0', p_blueprint_key text default 'AMC_CAT_MCQ')
returns table(question_id uuid, decision_id uuid, nble_type text)
language plpgsql security definer set search_path = '' as $$
-- 0056: based on 0053; adds C1 concept/LO session rules and C3 review priority.
declare
  v_qs uuid[] := '{}'; v_los uuid[] := '{}';
  r record; v_rej jsonb; v_inelig jsonb; v_id uuid; i integer;
  w jsonb; v_rp numeric; v_max_concept integer; v_distinct_lo boolean;
begin
  if p_n is null or p_n < 1 or p_n > 50 then raise exception 'n must be 1..50' using errcode = '22023'; end if;
  select weights into w from pie.selection_policy where policy_version = p_policy;
  v_rp := coalesce((w->>'review_priority')::numeric, 0);
  v_max_concept := (w->'session'->>'max_per_concept')::int;
  v_distinct_lo := coalesce((w->'session'->>'distinct_lo_within_concept')::boolean, false);
  for i in 1..p_n loop
    perform pie.rank_candidates(p_user, p_session, p_policy, p_blueprint_key, v_qs, v_los);
    -- 0053 (c): presented-but-unanswered in any earlier session of this learner => ineligible.
    update pg_temp.pie_cand c set eligible = false, reject_reason = 'presented_unanswered'
     where c.eligible and c.question_id in (select x.question_id from pie.presented_unanswered(p_user, p_session) x);
    -- 0056 C1: LOs already in this session (persisted + chosen in this call).
    create temp table if not exists pie_sess_lo (lo_id uuid, concept_id uuid) on commit drop;
    truncate pg_temp.pie_sess_lo;
    insert into pg_temp.pie_sess_lo
      select ql.lo_id, lo.concept_id from public.practice_session_questions psq
      join pie.question_lo ql on ql.question_id = psq.question_id and ql.is_primary
      join pie.learning_objective lo on lo.id = ql.lo_id
      where psq.session_id = p_session
      union all
      select lo.id, lo.concept_id from unnest(v_los) x(lo_id) join pie.learning_objective lo on lo.id = x.lo_id;
    if v_distinct_lo then
      update pg_temp.pie_cand c set eligible = false, reject_reason = 'lo_already_in_session'
       where c.eligible and c.lo_id in (select s.lo_id from pg_temp.pie_sess_lo s);
    end if;
    if v_max_concept is not null then
      update pg_temp.pie_cand c set eligible = false, reject_reason = 'concept_session_cap'
       where c.eligible and (select count(*) from pg_temp.pie_sess_lo s where s.concept_id = c.concept_id) >= v_max_concept;
    end if;
    -- 0056 C3: a due review outranks any unseen candidate.
    if v_rp > 0 then
      update pg_temp.pie_cand c set total = c.total + v_rp where c.eligible and c.hierarchy = 'review_due';
    end if;
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
            r.secondary || jsonb_build_object('secondary_score', r.secondary_score, 'starvation_score', r.starvation,
                                              'review_priority', jsonb_build_object('value', case when r.hierarchy = 'review_due' then 1 else 0 end, 'weight', v_rp)),
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

-- RPCs (based on 0054) now use policy pie-select/p5.0 ----------------------------------
create or replace function public.pie_create_session(p_count integer default 10, p_blueprint_key text default 'AMC_CAT_MCQ')
returns table(session_id uuid, question_count integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_session uuid; v_pos integer := 0; d record; v_last timestamptz;
  c_min_interval constant interval := interval '30 seconds';
  c_max_active constant integer := 3;
  c_stale_after constant interval := interval '2 hours';  -- DESIGN DEFAULT (0053)
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_count is null or p_count < 1 or p_count > 50 then raise exception 'p_count must be 1..50' using errcode = '22023'; end if;
  perform pie.assert_blueprint(p_blueprint_key);

  -- Throttle: row created race-free, then locked; concurrent creates serialise per learner.
  insert into pie.session_create_throttle(user_id, last_created_at, create_count)
  values (v_uid, '-infinity', 0) on conflict (user_id) do nothing;
  select last_created_at into v_last from pie.session_create_throttle where user_id = v_uid for update;
  if v_last > clock_timestamp() - c_min_interval then
    raise exception 'PIE_RATE_LIMITED: one adaptive session per 30 seconds' using errcode = '53400';
  end if;
  -- m2: auto-close stale adaptive sessions (inactive > 2 h, design default) before counting.
  update public.practice_sessions ps set status = 'abandoned', updated_at = now()
   from pie.adaptive_session a
   where a.session_id = ps.id and a.user_id = v_uid and ps.status = 'active'
     and coalesce(ps.last_activity_at, ps.started_at, ps.created_at) < now() - c_stale_after;
  if (select count(*) from pie.adaptive_session a
        join public.practice_sessions ps on ps.id = a.session_id
       where a.user_id = v_uid and ps.status = 'active') >= c_max_active then
    raise exception 'PIE_TOO_MANY_ACTIVE_SESSIONS: at most % active adaptive sessions', c_max_active using errcode = '53400';
  end if;
  update pie.session_create_throttle set last_created_at = clock_timestamp(), create_count = create_count + 1
   where user_id = v_uid;

  insert into public.practice_sessions(user_id, session_type, status, config, started_at, last_activity_at)
  values (v_uid, 'pie_adaptive', 'active',
          jsonb_build_object('selector', 'pie', 'policy_version', pie.active_policy(), 'blueprint_key', p_blueprint_key),
          now(), now())
  returning id into v_session;
  insert into pie.adaptive_session(session_id, user_id, policy_version, blueprint_key)
  values (v_session, v_uid, pie.active_policy(), p_blueprint_key);
  for d in select * from pie.decide_counted(v_uid, v_session, 'SESSION_BUILD', p_count, pie.active_policy(), p_blueprint_key) loop
    insert into public.practice_session_questions(session_id, question_id, position, presented_at)
    values (v_session, d.question_id, v_pos, now());
    v_pos := v_pos + 1;
  end loop;
  if v_pos = 0 then
    perform pie.note_selector_failure(v_uid, v_session, 'SESSION_BUILD');
    raise exception 'PIE_NO_ELIGIBLE_CANDIDATE' using errcode = 'P0002';
  end if;
  session_id := v_session; question_count := v_pos;
  return next;
end $$;

create or replace function public.pie_next_question(p_session_id uuid)
returns table(question_id uuid, question_position integer, nble_type text, decision_id uuid)
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_pos integer; d record; v_bp text;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  perform 1 from public.practice_sessions
   where id = p_session_id and user_id = v_uid and status = 'active' for update;
  if not found then raise exception 'active session not found' using errcode = '42501'; end if;
  select a.blueprint_key into v_bp from pie.adaptive_session a where a.session_id = p_session_id and a.user_id = v_uid;
  if not found then raise exception 'not an adaptive (server-selected) session' using errcode = '42501'; end if;
  perform pie.assert_blueprint(v_bp);
  -- No skipping: every served question (incl. the last one) must be answered first.
  if exists (select 1 from public.practice_session_questions psq
             where psq.session_id = p_session_id and psq.answered_at is null) then
    raise exception 'PIE_UNANSWERED: answer the served question before requesting another' using errcode = '55000';
  end if;
  select coalesce(max(position) + 1, 0) into v_pos from public.practice_session_questions where session_id = p_session_id;
  if v_pos >= 1000 then raise exception 'practice session cannot contain more than 1000 questions' using errcode = '54000'; end if;
  select * into d from pie.decide_counted(v_uid, p_session_id, 'NEXT_QUESTION', 1, pie.active_policy(), v_bp) limit 1;
  if d.question_id is null then
    perform pie.note_selector_failure(v_uid, p_session_id, 'NEXT_QUESTION');
    raise exception 'PIE_NO_ELIGIBLE_CANDIDATE: selector returned no question' using errcode = 'P0002';
  end if;
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

notify pgrst, 'reload schema';
