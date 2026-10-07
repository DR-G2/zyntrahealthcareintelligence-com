-- 0052: PR #57 review fixes.
--  E1  Adaptive evidence comes ONLY from server-selected sessions. pie_create_session
--      registers its session in pie.adaptive_session (learners cannot write it; the
--      session_type/config of a legacy create_practice_session call are client-chosen
--      and therefore NOT trusted). pie.first_exposure_attempt_ids - the single evidence
--      gate used by pie.recompute_learner_lo_state and pie.rebuild_candidate_state - now
--      returns a learner's first exposure of a question only when that first exposure
--      happened in a registered adaptive session. A question first seen in a legacy
--      session never becomes evidence later.
--  E2  Unknown / missing / not-currently-effective p_blueprint_key raises (22023).
--  E3  DoS limits: pie.session_create_throttle (1 create per 30 s per learner),
--      max 3 active adaptive sessions per learner, and pie_next_question refuses while a
--      served question of the session is unanswered.

-- E1 ------------------------------------------------------------------------------------
create table if not exists pie.adaptive_session (
  session_id uuid primary key references public.practice_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  policy_version text not null,
  blueprint_key text not null,
  created_at timestamptz not null default now()
);
create index if not exists adaptive_session_user_idx on pie.adaptive_session(user_id);
alter table pie.adaptive_session enable row level security;
revoke all on pie.adaptive_session from public, anon, authenticated;
grant select on pie.adaptive_session to service_role;

create or replace function pie.first_exposure_attempt_ids(p_user_id uuid)
returns table(id uuid) language sql stable security definer set search_path = '' as $$
  -- 0052: first exposure per question, counted only if it was server-selected (adaptive).
  select fe.id from (
    select distinct on (ua.question_id) ua.id, ua.session_id
    from public.user_attempts ua
    where ua.user_id = p_user_id
    order by ua.question_id, ua.created_at, ua.id
  ) fe
  join pie.adaptive_session a on a.session_id = fe.session_id and a.user_id = p_user_id
$$;
revoke all on function pie.first_exposure_attempt_ids(uuid) from public, anon, authenticated;
grant execute on function pie.first_exposure_attempt_ids(uuid) to service_role;

-- E2 ------------------------------------------------------------------------------------
create or replace function pie.assert_blueprint(p_blueprint_key text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if p_blueprint_key is null or btrim(p_blueprint_key) = '' then
    raise exception 'blueprint_key required' using errcode = '22023';
  end if;
  if not exists (
    select 1 from amc.amc_blueprint b
    where b.blueprint_key = p_blueprint_key
      and (b.effective_from is null or b.effective_from <= now())
      and (b.effective_to is null or b.effective_to > now())
  ) then
    raise exception 'unknown or inactive blueprint %', p_blueprint_key using errcode = '22023';
  end if;
end $$;
revoke all on function pie.assert_blueprint(text) from public, anon, authenticated;
grant execute on function pie.assert_blueprint(text) to service_role;

-- E3 ------------------------------------------------------------------------------------
create table if not exists pie.session_create_throttle (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_created_at timestamptz not null,
  create_count bigint not null default 0
);
alter table pie.session_create_throttle enable row level security;
revoke all on pie.session_create_throttle from public, anon, authenticated;
grant select, insert, update, delete on pie.session_create_throttle to service_role;

create or replace function public.pie_create_session(p_count integer default 10, p_blueprint_key text default 'AMC_CAT_MCQ')
returns table(session_id uuid, question_count integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_session uuid; v_pos integer := 0; d record; v_last timestamptz;
  c_min_interval constant interval := interval '30 seconds';
  c_max_active constant integer := 3;
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
