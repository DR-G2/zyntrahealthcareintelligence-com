-- 0053: PR #57 review pass 3 - peek-then-farm and DoS follow-ups.
-- Attack: create adaptive session -> answer nothing -> complete -> results reveal key for
-- the unanswered questions -> question re-served later -> correct answer counted as a
-- first exposure. Closed at three independent layers:
--  (a) Evidence: pie.first_exposure_attempt_ids counts an attempt only if the question was
--      never PRESENTED to the learner in any other session before that attempt
--      (practice_session_questions.presented_at, falling back to session start).
--  (b) Key exposure: get_practice_session_results returns correct_answer/explanation only
--      for questions the learner ANSWERED in that session. Audit of the other learner RPCs:
--      get_practice_session_questions and get_practice_question_pool already return
--      explanation NULL and no correct_answer; save_attempt returns the attempt row
--      (is_correct only, no key); PIE RPCs return ids only (S9).
--  (c) Selection: a question presented-but-unanswered in any earlier session of the learner
--      is permanently INELIGIBLE for that learner (reject_reason 'presented_unanswered').
--      Chosen over a cooldown: the key may already have been seen, so after any cooldown
--      the item is still compromised as evidence ((a) discards it) and re-serving it only
--      wastes a slot.
--  m1  pie_create_session / pie_next_question raise PIE_NO_ELIGIBLE_CANDIDATE (P0002)
--      when pie.decide returns nothing.
--  m2  Stale expiry: adaptive sessions with last_activity_at older than 2 hours (DESIGN
--      DEFAULT, uncalibrated) are auto-closed as 'abandoned' before the 3-active cap is
--      counted. Abandoned sessions feed no evidence (completed-only) and reveal no key.

create or replace function pie.presented_unanswered(p_user uuid, p_except_session uuid default null)
returns table(question_id uuid) language sql stable security definer set search_path = '' as $$
  select distinct psq.question_id
  from public.practice_session_questions psq
  join public.practice_sessions ps on ps.id = psq.session_id
  where ps.user_id = p_user and psq.answered_at is null
    and psq.session_id is distinct from p_except_session
$$;
revoke all on function pie.presented_unanswered(uuid, uuid) from public, anon, authenticated;
grant execute on function pie.presented_unanswered(uuid, uuid) to service_role;

-- (a) ----------------------------------------------------------------------------------
create or replace function pie.first_exposure_attempt_ids(p_user_id uuid)
returns table(id uuid) language sql stable security definer set search_path = '' as $$
  -- 0053: first attempt per question, in a server-selected session, and the question was
  -- never presented to this learner in any other session before that attempt.
  select fe.id from (
    select distinct on (ua.question_id) ua.id, ua.session_id, ua.question_id, ua.created_at
    from public.user_attempts ua
    where ua.user_id = p_user_id
    order by ua.question_id, ua.created_at, ua.id
  ) fe
  join pie.adaptive_session a on a.session_id = fe.session_id and a.user_id = p_user_id
  where not exists (
    select 1 from public.practice_session_questions psq2
    join public.practice_sessions ps2 on ps2.id = psq2.session_id
    where ps2.user_id = p_user_id and psq2.question_id = fe.question_id
      and psq2.session_id <> fe.session_id
      and coalesce(psq2.presented_at, ps2.started_at, ps2.created_at) <= fe.created_at)
$$;
revoke all on function pie.first_exposure_attempt_ids(uuid) from public, anon, authenticated;
grant execute on function pie.first_exposure_attempt_ids(uuid) to service_role;

-- (b) ----------------------------------------------------------------------------------
create or replace function public.get_practice_session_results(p_session_id uuid)
returns table(session_question_id uuid,session_id uuid,question_id uuid,question_position integer,zyntra_id text,stem text,options jsonb,correct_answer text,explanation text,subject_id uuid,subtopic_id uuid,difficulty_tier text,version integer,selected_answer text,is_correct boolean,confidence_level smallint,time_taken_seconds integer,answer_changes_count integer)
language sql stable security definer set search_path = '' as $function$
-- 0053: answer key and explanation only for questions answered in this session.
select psq.id,psq.session_id,psq.question_id,psq.position,q.zyntra_id,q.stem,q.options,
       case when ua.selected_answer is not null then q.correct_answer end,
       case when ua.selected_answer is not null then q.explanation end,
       q.subject_id,q.subtopic_id,q.difficulty_tier,q.version,ua.selected_answer,ua.is_correct,ua.confidence_level,ua.time_taken_seconds,ua.answer_changes_count
from public.practice_session_questions psq
join public.practice_sessions ps on ps.id=psq.session_id
join public.questions q on q.id=psq.question_id
left join lateral (
 select a.selected_answer,a.is_correct,a.confidence_level,a.time_taken_seconds,a.answer_changes_count
 from public.user_attempts a
 where a.session_id=psq.session_id and a.question_id=psq.question_id and a.user_id=auth.uid()
 order by a.created_at desc limit 1
) ua on true
where ps.id=p_session_id and ps.user_id=auth.uid() and ps.status='completed'
order by psq.position;
$function$;
revoke all on function public.get_practice_session_results(uuid) from public, anon;
grant execute on function public.get_practice_session_results(uuid) to authenticated, service_role;

-- (c) ----------------------------------------------------------------------------------
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
    -- 0053 (c): presented-but-unanswered in any earlier session of this learner => ineligible.
    update pg_temp.pie_cand c set eligible = false, reject_reason = 'presented_unanswered'
     where c.eligible and c.question_id in (select x.question_id from pie.presented_unanswered(p_user, p_session) x);
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

-- m1 + m2 (based on 0052) -------------------------------------------------------------
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
          jsonb_build_object('selector', 'pie', 'policy_version', 'pie-select/p3.0', 'blueprint_key', p_blueprint_key),
          now(), now())
  returning id into v_session;
  insert into pie.adaptive_session(session_id, user_id, policy_version, blueprint_key)
  values (v_session, v_uid, 'pie-select/p3.0', p_blueprint_key);
  for d in select * from pie.decide(v_uid, v_session, 'SESSION_BUILD', p_count, 'pie-select/p3.0', p_blueprint_key) loop
    insert into public.practice_session_questions(session_id, question_id, position, presented_at)
    values (v_session, d.question_id, v_pos, now());
    v_pos := v_pos + 1;
  end loop;
  if v_pos = 0 then
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
  select * into d from pie.decide(v_uid, p_session_id, 'NEXT_QUESTION', 1, 'pie-select/p3.0', v_bp) limit 1;
  if d.question_id is null then
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
