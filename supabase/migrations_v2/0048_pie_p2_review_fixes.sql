-- 0048: PR #56 review fixes (Hank).
--  B1  Learner clear-data goes through public.erase_my_learning_data (SECURITY DEFINER,
--      own data only, audited). The append-only trigger honours a transaction-local
--      'pie.erase_user' setting ONLY when the current_user is not a learner role, i.e.
--      inside a SECURITY DEFINER function owned by the migration owner. A learner cannot
--      use the setting directly: as current_user=authenticated it is ignored, and the
--      learner has no DELETE privilege anyway.
--  B2  No answer-key-derived or correctness signal mid-drill: per-LO state and the
--      candidate-state aggregate use attempts from COMPLETED sessions only.
--  B3  save_attempt: session is mandatory; change_sequence (client-reported click
--      telemetry) is validated and normalised, and answer_changes_count is derived from
--      it server-side. Neither ever affects grading.
--  m1  behavior_events: revoke UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER from learners.
--  m2  refresh_my_lo_state: bounded recompute (5000 most recent completed attempts) and
--      a per-learner rate limit (one refresh per 10 s).
--  R2  (second review) save_attempt: one attempt per (session, question), enforced by a
--      FOR UPDATE row lock on practice_session_questions + answered_at IS NULL and a unique
--      index; resubmission raises (no key probing). search_path = ''. selected_answer is
--      normalised (upper/trim) and must be A-E and within the question's options.
--      Mastery evidence counts the FIRST exposure of a question only (re-served questions,
--      e.g. client-chosen ids in create_practice_session, cannot farm mastery).
--      refresh_my_lo_state rate-limit row is created with INSERT .. ON CONFLICT then locked.

-- B3 ----------------------------------------------------------------------------------
create or replace function public.save_attempt(
p_question_id uuid,
p_session_id uuid,
p_selected_answer text,
p_is_correct boolean,
p_time_taken_seconds integer default null,
p_confidence_level smallint default null,
p_answer_changes_count integer default 0,
p_time_to_first_click integer default null,
p_change_sequence jsonb default null,
p_pause_events jsonb default null,
p_time_of_day text default null,
p_question_position integer default null,
p_previous_question_correct boolean default null,
p_question_version integer default null,
p_app_version text default null,
p_provenance jsonb default '{}'::jsonb
)
returns public.user_attempts
language plpgsql
security definer
set search_path = ''
as $function$
-- 0048 (based on 0044): session required; change_sequence validated; answer_changes server-derived
declare
 v_attempt public.user_attempts;
 v_user uuid := auth.uid();
 v_correct_answer text;
 v_is_correct boolean;
 v_n_opts integer;
 v_seq jsonb;
 v_changes integer := 0;
 v_sel text := upper(trim(coalesce(p_selected_answer,'')));
 v_answered_at timestamptz;
begin
 if v_user is null then raise exception 'authentication required'; end if;
 if p_confidence_level is not null and p_confidence_level not between 1 and 5 then raise exception 'confidence_level must be between 1 and 5'; end if;

 select q.correct_answer, jsonb_array_length(q.options) into v_correct_answer, v_n_opts
 from public.questions q
 where q.id=p_question_id and q.status='active';

 if not found then raise exception 'question not found or inactive'; end if;

 if p_session_id is null then raise exception 'practice session required' using errcode = '22004'; end if;

 -- Selected answer must be an option letter of this question.
 if v_sel !~ '^[A-E]$'
    or ascii(v_sel) - 65 >= coalesce(v_n_opts,0) then
   raise exception 'selected_answer is not a valid option' using errcode = '22023';
 end if;

 -- change_sequence is client-reported click telemetry. It never affects grading. It is
 -- validated (array of option letters for this question, <= 50 entries, ending with the
 -- selected answer) and normalised; answer_changes_count is derived from it server-side.
 if p_change_sequence is not null and p_change_sequence <> '[]'::jsonb then
   if jsonb_typeof(p_change_sequence) <> 'array' or jsonb_array_length(p_change_sequence) > 50 then
     raise exception 'invalid change_sequence' using errcode = '22023';
   end if;
   if exists (
     select 1 from jsonb_array_elements(p_change_sequence) e
     where jsonb_typeof(e) <> 'string'
        or upper(trim(e #>> '{}')) !~ '^[A-Z]$'
        or ascii(upper(trim(e #>> '{}'))) - 65 >= v_n_opts
   ) then
     raise exception 'invalid change_sequence element' using errcode = '22023';
   end if;
   if upper(trim(p_change_sequence ->> -1)) <> v_sel then
     raise exception 'change_sequence must end with the selected answer' using errcode = '22023';
   end if;
   select jsonb_agg(upper(trim(e #>> '{}')) order by o) into v_seq
   from jsonb_array_elements(p_change_sequence) with ordinality t(e, o);
   select count(*) into v_changes
   from (select x, lag(x) over (order by o) px
         from jsonb_array_elements_text(v_seq) with ordinality t(x, o)) s
   where px is not null and x <> px;
 else
   v_seq := jsonb_build_array(v_sel);
   v_changes := 0;
 end if;

 -- Lock the session-question row: one attempt per (session, question), race-free.
 select psq.answered_at into v_answered_at
 from public.practice_session_questions psq
 join public.practice_sessions ps on ps.id=psq.session_id
 where psq.session_id=p_session_id
   and psq.question_id=p_question_id
   and ps.user_id=v_user
   and ps.status='active'
 for update of psq;
 if not found then
   raise exception 'question is not part of an active authenticated practice session';
 end if;
 if v_answered_at is not null then
   raise exception 'question already answered in this session' using errcode = '23505';
 end if;

 v_is_correct := v_sel=upper(trim(coalesce(v_correct_answer,'')));

 insert into public.user_attempts(
   user_id,question_id,session_id,selected_answer,is_correct,time_taken_seconds,
   confidence_level,answer_changes_count,time_to_first_click,change_sequence,
   pause_events,time_of_day,question_position,previous_question_correct,
   question_version,app_version,provenance
 )
 values(
   v_user,p_question_id,p_session_id,v_sel,v_is_correct,p_time_taken_seconds,
   p_confidence_level,v_changes,p_time_to_first_click,v_seq,
   p_pause_events,p_time_of_day,p_question_position,p_previous_question_correct,
   p_question_version,p_app_version,coalesce(p_provenance,'{}'::jsonb) operator(pg_catalog.||) jsonb_build_object('change_sequence_source','client_reported_validated','client_answer_changes_count',p_answer_changes_count)
 )
 returning * into v_attempt;

 update public.practice_session_questions
 set answered_at=now()
 where session_id=p_session_id and question_id=p_question_id and answered_at is null;

 update public.practice_sessions
 set last_activity_at=now(),updated_at=now()
 where id=p_session_id and user_id=v_user;

 begin
   insert into intelligence.behavior_events(
     user_id,session_id,question_id,event_type,event_version,occurred_at,
     sequence_no,question_position,payload
   )
   values(
     v_user,p_session_id,p_question_id,'MCQ_ATTEMPT',1,now(),
     p_question_position,p_question_position,
     jsonb_build_object(
       'is_correct',v_is_correct,
       'time_taken_seconds',p_time_taken_seconds,
       'confidence_level',p_confidence_level,
       'answer_changes_count',v_changes
     )
   );
 exception when others then
   raise warning 'save_attempt: behavior_event not recorded for attempt % (SQLSTATE %): %', v_attempt.id, sqlstate, sqlerrm;
 end;

 begin
   insert into pie.pie_observation(
     user_id,question_id,attempt_id,observation_type,observed_at,payload,provenance
   )
   values(
     v_user,p_question_id,v_attempt.id,'MCQ_ATTEMPT',now(),
     jsonb_build_object(
       'outcome',case when v_is_correct then 'CORRECT' else 'INCORRECT' end,
       'confidence_normalized',case when p_confidence_level is null then null else (p_confidence_level-1)/4.0 end,
       'time_total_ms',case when p_time_taken_seconds is null then null else p_time_taken_seconds*1000 end,
       'answer_changes',v_changes,
       'first_answer_correct',null,
       'final_answer_correct',v_is_correct
     ),
     jsonb_build_object('source','public.save_attempt','question_version',p_question_version)
   );
 exception when others then
   raise warning 'save_attempt: PIE observation not recorded for attempt % (SQLSTATE %): %', v_attempt.id, sqlstate, sqlerrm;
 end;

 return v_attempt;
end
$function$;

revoke all on function public.save_attempt(uuid,uuid,text,boolean,integer,smallint,integer,integer,jsonb,jsonb,text,integer,boolean,integer,text,jsonb) from public, anon;
grant execute on function public.save_attempt(uuid,uuid,text,boolean,integer,smallint,integer,integer,jsonb,jsonb,text,integer,boolean,integer,text,jsonb) to authenticated, service_role;

-- R2: at most one attempt per (session, question). Fails loudly if legacy duplicates exist.
create unique index if not exists user_attempts_session_question_uniq
  on public.user_attempts(session_id, question_id) where session_id is not null;

-- R2: first exposure of a question per learner = the only attempt that counts as mastery
-- evidence. Later attempts of the same question (re-served via client-chosen ids, retakes
-- after seeing the key) remain stored but are excluded from adaptive state.
create or replace function pie.first_exposure_attempt_ids(p_user_id uuid)
returns table(id uuid) language sql stable security definer set search_path = '' as $$
  select distinct on (ua.question_id) ua.id
  from public.user_attempts ua
  where ua.user_id = p_user_id
  order by ua.question_id, ua.created_at, ua.id
$$;
revoke all on function pie.first_exposure_attempt_ids(uuid) from public, anon, authenticated;
grant execute on function pie.first_exposure_attempt_ids(uuid) to service_role;

-- B2: candidate-state aggregate (0044 maths unchanged, evidence filter added) -----------
create or replace function pie.rebuild_candidate_state(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
-- 0048 (based on 0044_pie_candidate_state_pipeline_repair)
declare
  v_uid uuid := auth.uid();
  v_role text := coalesce(auth.role(), '');
  v_model uuid;
  v_run uuid;
  v_state_id uuid;
  v_n integer;
  v_accuracy numeric;
  v_confidence numeric;
  v_timing numeric;
  v_changes numeric;
  v_state jsonb;
begin
  if p_user_id is null then
    raise exception 'User id required' using errcode = '22004';
  end if;

  -- service_role may rebuild anyone; a learner JWT only itself. A call with no JWT at all
  -- can only come from a privileged database role (EXECUTE is service_role-only; the public
  -- wrapper below runs as owner but still carries the caller's JWT).
  if v_role = 'service_role' then
    null;
  elsif v_uid is not null and v_uid = p_user_id then
    null;
  elsif v_uid is null and v_role = '' then
    null;
  else
    raise exception 'User scope violation' using errcode = '42501';
  end if;

  insert into pie.pie_model_version (model_key, version, status, config)
  values ('candidate-state', 'v2.0', 'active',
          jsonb_build_object('method', 'deterministic_bounded_state', 'window', 100))
  on conflict (model_key, version) do nothing;
  select id into v_model from pie.pie_model_version
  where model_key = 'candidate-state' and version = 'v2.0';

  -- 0048: only evidence from COMPLETED sessions (no mid-drill correctness signal).
  with recent as (
    select o.payload from pie.pie_observation o
    join public.user_attempts ua on ua.id = o.attempt_id
    join public.practice_sessions ps on ps.id = ua.session_id and ps.status = 'completed'
    join pie.first_exposure_attempt_ids(p_user_id) fe on fe.id = ua.id
    where o.user_id = p_user_id
    order by o.observed_at desc
    limit 100
  )
  select count(*)::int,
    coalesce(avg(case when payload->>'outcome' = 'CORRECT' then 1 when payload->>'outcome' = 'INCORRECT' then 0 end), 0),
    coalesce(avg(nullif((payload->>'confidence_normalized')::numeric, null)), 0.5),
    coalesce(avg(case when (payload->>'time_total_ms')::numeric > 0 then 1 / (1 + ln(1 + (payload->>'time_total_ms')::numeric / 1000) / 10) end), 0.5),
    coalesce(avg(least(1, greatest(0, 1 - (coalesce((payload->>'answer_changes')::numeric, 0) / 3)))), 0.5)
  into v_n, v_accuracy, v_confidence, v_timing, v_changes
  from recent;

  v_state := jsonb_build_object(
    'capability', jsonb_build_object('estimate', round(v_accuracy, 4)),
    'decision', jsonb_build_object('estimate', round(v_changes, 4)),
    'timing', jsonb_build_object('estimate', round(v_timing, 4)),
    'calibration', jsonb_build_object('estimate', round(1 - abs(v_confidence - v_accuracy), 4)),
    'sustained_performance', jsonb_build_object('estimate', round(v_accuracy, 4)),
    'learning', jsonb_build_object('estimate', round(v_accuracy, 4)),
    'evidence_count', v_n,
    'evidence_level', case
      when v_n < 6 then 'INSUFFICIENT'
      when v_n < 20 then 'PRELIMINARY'
      when v_n < 40 then 'DEVELOPING'
      else 'ESTABLISHED_INDIVIDUAL_EVIDENCE'
    end
  );

  insert into pie.pie_inference_run (user_id, model_version_id, trigger_type, input_window, output_summary, status, started_at, completed_at)
  values (p_user_id, v_model, 'REBUILD', jsonb_build_object('observation_count', v_n, 'window', 100), v_state, 'completed', now(), now())
  returning id into v_run;

  -- One current row per learner (UNIQUE(user_id)); state_version increments on every rebuild.
  insert into pie.pie_candidate_state as cs
    (user_id, state_version, state, confidence, model_version_id, source_inference_id, calculated_at, updated_at)
  values
    (p_user_id, 1, v_state, least(1, greatest(0, v_n / 100.0)), v_model, v_run, now(), now())
  on conflict (user_id) do update
    set state_version = cs.state_version + 1,
        state = excluded.state,
        confidence = excluded.confidence,
        model_version_id = excluded.model_version_id,
        source_inference_id = excluded.source_inference_id,
        calculated_at = excluded.calculated_at,
        updated_at = excluded.updated_at
  returning cs.id into v_state_id;

  return v_state_id;
end $$;

revoke all on function pie.rebuild_candidate_state(uuid) from public, anon, authenticated;
grant execute on function pie.rebuild_candidate_state(uuid) to service_role;

-- B2 + m2: per-LO recompute -------------------------------------------------------------
create or replace function pie.recompute_learner_lo_state(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := coalesce(auth.role(), '');
  c_guess constant numeric := 0.2;
  c_policy constant text := 'pie-lo-state/p2.1';
  r record;
  a record;
  v_theta numeric; v_info numeric; v_n integer; v_p numeric; v_k numeric; v_b numeric;
  v_y integer; v_conf numeric; v_first text; v_first_correct boolean;
  v_hist jsonb; v_dhist jsonb; v_fragile integer; v_cwrong integer;
  v_conf_sum numeric; v_conf_n integer; v_correct_n integer;
  v_time_sum numeric; v_time_n integer; v_changes_sum numeric; v_fac_n integer; v_fac_known integer;
  v_wrong_opts jsonb; v_last timestamptz; v_distinct integer; v_rows integer := 0;
  c_max_attempts constant integer := 5000;  -- 0048 bound: most recent completed attempts only
  v_floor_at timestamptz; v_floor_id uuid;
begin
  if p_user_id is null then
    raise exception 'User id required' using errcode = '22004';
  end if;
  if v_role = 'service_role' then null;
  elsif v_uid is not null and v_uid = p_user_id then null;
  elsif v_uid is null and v_role = '' then null;  -- privileged DB role, no JWT
  else
    raise exception 'User scope violation' using errcode = '42501';
  end if;

  -- Serialise recomputes per learner.
  perform pg_advisory_xact_lock(hashtextextended('pie.learner_lo_state:' || p_user_id::text, 0));

  delete from pie.learner_lo_state where user_id = p_user_id;

  -- 0048: evidence = attempts in COMPLETED sessions only (no mid-drill correctness or
  -- answer-key-derived signal), bounded to the most recent c_max_attempts.
  create temp table if not exists pg_temp.pie_lo_evidence(id uuid primary key) on commit drop;
  truncate pg_temp.pie_lo_evidence;
  insert into pg_temp.pie_lo_evidence(id)
  select ua.id from public.user_attempts ua
  join public.practice_sessions ps on ps.id = ua.session_id and ps.status = 'completed'
  join pie.first_exposure_attempt_ids(p_user_id) fe on fe.id = ua.id
  where ua.user_id = p_user_id
  order by ua.created_at desc, ua.id desc
  limit c_max_attempts;

  for r in
    select ql.lo_id
    from public.user_attempts ua
    join pg_temp.pie_lo_evidence ev on ev.id = ua.id
    join pie.question_lo ql on ql.question_id = ua.question_id
    where ua.user_id = p_user_id
    group by ql.lo_id
  loop
    v_theta := 0; v_info := 0; v_n := 0;
    v_hist := '[]'::jsonb; v_dhist := '[]'::jsonb; v_fragile := 0; v_cwrong := 0;
    v_conf_sum := 0; v_conf_n := 0; v_correct_n := 0;
    v_time_sum := 0; v_time_n := 0; v_changes_sum := 0; v_fac_n := 0; v_fac_known := 0;
    v_wrong_opts := '{}'::jsonb; v_last := null;

    for a in
      select ua.id, ua.question_id, ua.is_correct, ua.selected_answer, ua.confidence_level,
             ua.time_taken_seconds, ua.answer_changes_count, ua.change_sequence, ua.created_at,
             q.correct_answer, q.irt_b, ql.weight
      from public.user_attempts ua
      join pg_temp.pie_lo_evidence ev on ev.id = ua.id
      join pie.question_lo ql on ql.question_id = ua.question_id and ql.lo_id = r.lo_id
      join public.questions q on q.id = ua.question_id
      where ua.user_id = p_user_id
      order by ua.created_at, ua.id
    loop
      v_n := v_n + 1;
      v_b := coalesce(a.irt_b, 0);
      v_y := case when a.is_correct then 1 else 0 end;
      v_p := c_guess + (1 - c_guess) / (1 + exp(-(v_theta - v_b)));
      v_k := 1.2 / (1 + 0.15 * (v_n - 1));
      v_theta := v_theta + a.weight * v_k * (v_y - v_p);
      v_info := v_info + a.weight * v_p * (1 - v_p);
      v_correct_n := v_correct_n + v_y;
      v_last := a.created_at;

      v_conf := case when a.confidence_level is null then null else (a.confidence_level - 1) / 4.0 end;
      if v_conf is not null then v_conf_sum := v_conf_sum + v_conf; v_conf_n := v_conf_n + 1; end if;
      if a.time_taken_seconds is not null then v_time_sum := v_time_sum + a.time_taken_seconds * 1000; v_time_n := v_time_n + 1; end if;
      v_changes_sum := v_changes_sum + coalesce(a.answer_changes_count, 0);

      v_first := null;
      if jsonb_typeof(a.change_sequence) = 'array' and jsonb_array_length(a.change_sequence) > 0 then
        v_first := case jsonb_typeof(a.change_sequence -> 0)
          when 'string' then a.change_sequence ->> 0
          when 'object' then coalesce(a.change_sequence -> 0 ->> 'option', a.change_sequence -> 0 ->> 'answer')
          else null end;
      end if;
      v_first_correct := case when v_first is null then null
        else upper(trim(v_first)) = upper(trim(coalesce(a.correct_answer, ''))) end;
      if v_first_correct is not null then
        v_fac_known := v_fac_known + 1;
        if v_first_correct then v_fac_n := v_fac_n + 1; end if;
      end if;

      if a.is_correct and ((v_conf is not null and v_conf <= 0.25) or v_first_correct = false) then
        v_fragile := v_fragile + 1;
      end if;
      if not a.is_correct and v_conf is not null and v_conf >= 0.75 then
        v_cwrong := v_cwrong + 1;
      end if;
      if not a.is_correct then
        v_wrong_opts := jsonb_set(v_wrong_opts, array[a.question_id::text || ':' || upper(trim(a.selected_answer))],
          to_jsonb(coalesce((v_wrong_opts ->> (a.question_id::text || ':' || upper(trim(a.selected_answer))))::int, 0) + 1));
      end if;

      -- Learner-safe history: no selected option, no answer key.
      v_hist := v_hist || jsonb_build_array(jsonb_build_object(
        'attempt_id', a.id, 'question_id', a.question_id, 'at', a.created_at,
        'correct', a.is_correct, 'first_answer_correct', v_first_correct,
        'confidence_normalized', v_conf));
      v_dhist := v_dhist || jsonb_build_array(jsonb_build_object(
        'at', a.created_at, 'irt_b', v_b, 'irt_b_known', a.irt_b is not null));
    end loop;

    -- Keep the most recent 50 entries.
    if jsonb_array_length(v_hist) > 50 then
      select jsonb_agg(e order by o) into v_hist from jsonb_array_elements(v_hist) with ordinality t(e,o) where o > jsonb_array_length(v_hist) - 50;
      select jsonb_agg(e order by o) into v_dhist from jsonb_array_elements(v_dhist) with ordinality t(e,o) where o > jsonb_array_length(v_dhist) - 50;
    end if;

    select count(distinct ua.question_id) into v_distinct
    from public.user_attempts ua join pg_temp.pie_lo_evidence ev on ev.id = ua.id
    join pie.question_lo ql on ql.question_id = ua.question_id and ql.lo_id = r.lo_id
    where ua.user_id = p_user_id;

    insert into pie.learner_lo_state(
      user_id, lo_id, mastery, mastery_confidence, ability_theta, exposure_count, distinct_question_count,
      outcome_history, last_seen_at, review_due_at, difficulty_history, misconception_state,
      confidence_state, behaviour_state, fragile_correct, confident_wrong, policy_version,
      source_attempt_count, computed_at)
    values (
      p_user_id, r.lo_id,
      round(1 / (1 + exp(-v_theta)), 6),
      round(1 - 1 / sqrt(1 + v_info), 6),
      round(v_theta, 6), v_n, v_distinct, v_hist, v_last, null, v_dhist,
      jsonb_build_object(
        'classes', '[]'::jsonb,
        'classification_status', 'NOT_CLASSIFIED',
        'repeated_wrong_option', (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from jsonb_each(v_wrong_opts) e(k,v) where (v)::int >= 2)),
      jsonb_build_object(
        'n_with_confidence', v_conf_n,
        'mean_confidence_normalized', case when v_conf_n > 0 then round(v_conf_sum / v_conf_n, 4) end,
        'accuracy', round(v_correct_n::numeric / v_n, 4),
        'calibration_gap', case when v_conf_n > 0 then round(v_conf_sum / v_conf_n - v_correct_n::numeric / v_n, 4) end),
      jsonb_build_object(
        'mean_time_total_ms', case when v_time_n > 0 then round(v_time_sum / v_time_n) end,
        'mean_answer_changes', round(v_changes_sum / v_n, 4),
        'first_answer_correct_rate', case when v_fac_known > 0 then round(v_fac_n::numeric / v_fac_known, 4) end,
        'first_answer_known_n', v_fac_known,
        'final_answer_correct_rate', round(v_correct_n::numeric / v_n, 4)),
      v_fragile, v_cwrong, c_policy, v_n, now());
    v_rows := v_rows + 1;
  end loop;

  return v_rows;
end $$;


revoke all on function pie.recompute_learner_lo_state(uuid) from public, anon, authenticated;
grant execute on function pie.recompute_learner_lo_state(uuid) to service_role;

create table if not exists pie.lo_state_refresh (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_refresh_at timestamptz not null,
  refresh_count bigint not null default 0
);
alter table pie.lo_state_refresh enable row level security;
revoke all on pie.lo_state_refresh from public, anon, authenticated;
grant select, insert, update, delete on pie.lo_state_refresh to service_role;

create or replace function public.refresh_my_lo_state()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_last timestamptz;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  -- Ensure the row exists (race-free), then lock it; concurrent callers serialise here.
  insert into pie.lo_state_refresh(user_id, last_refresh_at, refresh_count)
  values (v_uid, '-infinity', 0)
  on conflict (user_id) do nothing;
  select last_refresh_at into v_last from pie.lo_state_refresh where user_id = v_uid for update;
  if v_last > clock_timestamp() - interval '10 seconds' then
    raise exception 'PIE_RATE_LIMITED: refresh allowed once per 10 seconds' using errcode = '53400';
  end if;
  update pie.lo_state_refresh set last_refresh_at = clock_timestamp(), refresh_count = refresh_count + 1
  where user_id = v_uid;
  return pie.recompute_learner_lo_state(v_uid);
end $$;
revoke all on function public.refresh_my_lo_state() from public, anon;
grant execute on function public.refresh_my_lo_state() to authenticated, service_role;

-- B1: erasure ---------------------------------------------------------------------------
create or replace function public.forbid_attempt_mutation()
returns trigger language plpgsql set search_path = '' as $$
declare v_jwt_role text := coalesce((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'), '');
begin
  -- Definer-only erase bypass: set transaction-locally by public.erase_my_learning_data.
  if tg_op = 'DELETE'
     and current_user not in ('anon', 'authenticated')
     and coalesce(current_setting('pie.erase_user', true), '') = old.user_id::text then
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'session_id') = (to_jsonb(old) - 'session_id')
       and new.session_id is null
       and v_jwt_role not in ('anon','authenticated') then
      return new;
    end if;
    raise exception 'user_attempts is append-only' using errcode = '55000';
  end if;
  if v_jwt_role in ('anon','authenticated') then
    raise exception 'user_attempts rows cannot be deleted by learners' using errcode = '42501';
  end if;
  return old;
end $$;
revoke all on function public.forbid_attempt_mutation() from public, anon, authenticated;

create table if not exists pie.learning_data_erasure_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,               -- no FK: the audit row outlives the erased data
  requested_at timestamptz not null default now(),
  actor_role text not null,
  scope text not null,
  counts jsonb not null
);
alter table pie.learning_data_erasure_audit enable row level security;
revoke all on pie.learning_data_erasure_audit from public, anon, authenticated;
grant select on pie.learning_data_erasure_audit to service_role;

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
  delete from pie.pie_candidate_state where user_id = v_uid; get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('pie.pie_candidate_state', v_n);
  delete from pie.pie_inference_run where user_id = v_uid; get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('pie.pie_inference_run', v_n);
  delete from pie.pie_observation where user_id = v_uid; get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('pie.pie_observation', v_n);
  -- Other per-learner derived intelligence tables (any table with a user_id column).
  for t in
    select c.table_schema, c.table_name from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
    where c.table_schema = 'intelligence' and c.column_name = 'user_id'
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

-- m1 ------------------------------------------------------------------------------------
revoke update, delete, truncate, references, trigger on intelligence.behavior_events from anon, authenticated;

notify pgrst, 'reload schema';
