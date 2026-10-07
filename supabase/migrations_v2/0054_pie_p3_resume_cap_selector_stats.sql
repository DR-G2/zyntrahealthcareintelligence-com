-- 0054: PR #57 pass 4 (non-blocking).
--  R1  resume_practice_session: an ABANDONED adaptive session (incl. auto-expired by the
--      2 h stale rule) can never be resumed (55000, PIE_SESSION_EXPIRED). Any adaptive
--      resume enforces the 3-active cap (53400), serialised with pie_create_session on
--      the learner's pie.session_create_throttle row. Stale active sessions are expired
--      first, exactly as in pie_create_session. Legacy sessions keep the old behaviour.
--  O1  PIE_NO_ELIGIBLE_CANDIDATE rate for admins: view pie.selector_failure_stats.
--      The failing RPC raises, which rolls back its transaction, so a log TABLE row would
--      be rolled back too. Counts therefore use sequences (nextval is not transactional and
--      survives the rollback): pie.selector_call_seq (every selector RPC call) and
--      pie.selector_failure_seq (every PIE_NO_ELIGIBLE_CANDIDATE). Per-failure detail
--      (learner, session, event) goes to the Postgres log via RAISE LOG. Counts are
--      cumulative since 0054 and exact barring a server crash (sequence CACHE 1).
--      Learners have no access to the view, the sequences or the counting functions.

create sequence if not exists pie.selector_call_seq cache 1;
create sequence if not exists pie.selector_failure_seq cache 1;
revoke all on sequence pie.selector_call_seq, pie.selector_failure_seq from public, anon, authenticated;

create or replace view pie.selector_failure_stats as
select coalesce(pg_catalog.pg_sequence_last_value('pie.selector_call_seq'::regclass), 0)    as selector_calls,
       coalesce(pg_catalog.pg_sequence_last_value('pie.selector_failure_seq'::regclass), 0) as no_eligible_candidate_failures,
       round(coalesce(pg_catalog.pg_sequence_last_value('pie.selector_failure_seq'::regclass), 0)::numeric
             / nullif(coalesce(pg_catalog.pg_sequence_last_value('pie.selector_call_seq'::regclass), 0), 0), 6) as failure_rate;
revoke all on pie.selector_failure_stats from public, anon, authenticated;
grant select on pie.selector_failure_stats to service_role;

create or replace function pie.note_selector_failure(p_user uuid, p_session uuid, p_event text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.nextval('pie.selector_failure_seq');
  raise log 'PIE_NO_ELIGIBLE_CANDIDATE learner=% session=% event=%', p_user, p_session, p_event;
end $$;
revoke all on function pie.note_selector_failure(uuid, uuid, text) from public, anon, authenticated;

-- Counting wrapper around pie.decide (same signature/result).
create or replace function pie.decide_counted(
  p_user uuid, p_session uuid, p_event_type text, p_n integer, p_policy text, p_blueprint_key text)
returns table(question_id uuid, decision_id uuid, nble_type text)
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.nextval('pie.selector_call_seq');
  begin
    return query select * from pie.decide(p_user, p_session, p_event_type, p_n, p_policy, p_blueprint_key);
  exception when sqlstate 'P0002' then
    perform pie.note_selector_failure(p_user, p_session, p_event_type);
    raise;
  end;
end $$;
revoke all on function pie.decide_counted(uuid, uuid, text, integer, text, text) from public, anon, authenticated;
grant execute on function pie.decide_counted(uuid, uuid, text, integer, text, text) to service_role;

-- R1 ------------------------------------------------------------------------------------
create or replace function public.resume_practice_session(p_session_id uuid)
returns public.practice_sessions
language plpgsql security definer set search_path = '' as $function$
-- 0054 (based on live 0021): adaptive sessions - no resume after abandon/expiry; 3-active cap.
declare
  v_uid uuid := auth.uid(); v_session public.practice_sessions; v_adaptive boolean;
  c_max_active constant integer := 3;
  c_stale_after constant interval := interval '2 hours';  -- DESIGN DEFAULT (same as 0053)
begin
  if v_uid is null then raise exception 'authentication required'; end if;
  v_adaptive := exists (select 1 from pie.adaptive_session a where a.session_id = p_session_id and a.user_id = v_uid);
  if v_adaptive then
    -- Serialise with pie_create_session / other resumes for this learner.
    insert into pie.session_create_throttle(user_id, last_created_at, create_count)
    values (v_uid, '-infinity', 0) on conflict (user_id) do nothing;
    perform 1 from pie.session_create_throttle where user_id = v_uid for update;
    update public.practice_sessions ps set status = 'abandoned', updated_at = now()
      from pie.adaptive_session a
     where a.session_id = ps.id and a.user_id = v_uid and ps.status = 'active'
       and coalesce(ps.last_activity_at, ps.started_at, ps.created_at) < now() - c_stale_after;
  end if;
  select * into v_session from public.practice_sessions where id = p_session_id and user_id = v_uid for update;
  if not found then raise exception 'practice session not found'; end if;
  if v_session.status = 'completed' then raise exception 'practice session is already completed'; end if;
  if v_adaptive then
    if v_session.status = 'abandoned' then
      raise exception 'PIE_SESSION_EXPIRED: abandoned or expired adaptive sessions cannot be resumed; start a new session'
        using errcode = '55000';
    end if;
    if v_session.status <> 'active' and (select count(*) from pie.adaptive_session a
          join public.practice_sessions ps on ps.id = a.session_id
         where a.user_id = v_uid and ps.status = 'active') >= c_max_active then
      raise exception 'PIE_TOO_MANY_ACTIVE_SESSIONS: at most % active adaptive sessions', c_max_active using errcode = '53400';
    end if;
  end if;
  update public.practice_sessions set status = 'active', last_activity_at = now(), updated_at = now()
   where id = p_session_id and user_id = v_uid returning * into v_session;
  return v_session;
end $function$;
revoke all on function public.resume_practice_session(uuid) from public, anon;
grant execute on function public.resume_practice_session(uuid) to authenticated, service_role;

-- O1: selector RPCs (based on 0053) count calls/failures -------------------------------
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
  for d in select * from pie.decide_counted(v_uid, v_session, 'SESSION_BUILD', p_count, 'pie-select/p3.0', p_blueprint_key) loop
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
  select * into d from pie.decide_counted(v_uid, p_session_id, 'NEXT_QUESTION', 1, 'pie-select/p3.0', v_bp) limit 1;
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
