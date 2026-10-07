-- 0046: PIE P2 - per-item IRT difficulty, immutable attempts, per-LO learner state.
--
-- * public.questions gains irt_b (+ standard error, source, calibration fields).
--   These columns get NO learner column grants (live grants are column-level).
-- * public.user_attempts becomes append-only: learners can no longer INSERT directly
--   (only through public.save_attempt, SECURITY DEFINER, server-graded); UPDATE is
--   forbidden for every role; learner-JWT DELETE is forbidden.
-- * pie.learner_lo_state is a pure derivation of user_attempts x pie.question_lo x
--   questions.irt_b, rebuilt deterministically by pie.recompute_learner_lo_state().
--   Learners have no table privileges; they read their own rows via
--   public.get_my_lo_state() and may only trigger a recompute of their own state via
--   public.refresh_my_lo_state() (values are always computed server-side).
-- * No answer key or explanation is returned by any function in this migration.

-- ---------------------------------------------------------------------------
-- 1. Per-item IRT difficulty (Rasch / 1PL with guessing floor, logit scale)
-- ---------------------------------------------------------------------------
alter table public.questions
  add column if not exists irt_b numeric check (irt_b is null or irt_b between -6 and 6),
  add column if not exists irt_b_se numeric check (irt_b_se is null or irt_b_se >= 0),
  add column if not exists irt_b_source text check (irt_b_source is null or irt_b_source in ('expert_prior','qbank_import','calibrated')),
  add column if not exists irt_b_calibrated_at timestamptz,
  add column if not exists irt_b_calibration_n integer check (irt_b_calibration_n is null or irt_b_calibration_n >= 0),
  add column if not exists irt_model text not null default 'rasch_1pl_c0.2';

alter table public.questions drop constraint if exists questions_irt_b_source_required;
alter table public.questions add constraint questions_irt_b_source_required
  check (irt_b is null or irt_b_source is not null);
alter table public.questions drop constraint if exists questions_irt_b_calibration_fields;
alter table public.questions add constraint questions_irt_b_calibration_fields
  check (irt_b_source is distinct from 'calibrated' or (irt_b_calibrated_at is not null and irt_b_calibration_n is not null));

comment on column public.questions.irt_b is
  'Item difficulty b (logits). NULL = uncalibrated; PIE treats NULL as b=0 with source "default" in derived state. Internal: no learner grant.';

-- Defensive: make sure learner roles never hold column privileges on the new columns.
revoke all (irt_b, irt_b_se, irt_b_source, irt_b_calibrated_at, irt_b_calibration_n, irt_model)
  on public.questions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Immutable raw attempts + close learner write paths found live (P0 STEP 1)
-- ---------------------------------------------------------------------------
create or replace function public.forbid_attempt_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    -- Only exception: ON DELETE SET NULL of session_id from a privileged role
    -- (session/account erasure). Every other column is immutable for everyone.
    if (to_jsonb(new) - 'session_id') = (to_jsonb(old) - 'session_id')
       and new.session_id is null
       and coalesce((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'), '') not in ('anon','authenticated') then
      return new;
    end if;
    raise exception 'user_attempts is append-only' using errcode = '55000';
  end if;
  -- DELETE: allowed only for privileged DB roles / service_role (e.g. account erasure
  -- cascading from profiles). Never for a learner or anon JWT.
  if coalesce((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'), '') in ('anon','authenticated') then
    raise exception 'user_attempts rows cannot be deleted by learners' using errcode = '42501';
  end if;
  return old;
end $$;

drop trigger if exists user_attempts_append_only on public.user_attempts;
create trigger user_attempts_append_only before update or delete on public.user_attempts
  for each row execute function public.forbid_attempt_mutation();
revoke all on function public.forbid_attempt_mutation() from public, anon, authenticated;

-- Direct learner writes bypass server grading (live: INSERT granted + attempts_insert_own).
drop policy if exists attempts_insert_own on public.user_attempts;
revoke insert, update, delete, truncate, references, trigger on public.user_attempts from anon, authenticated;
revoke all on public.user_attempts from anon;

-- Session rows are created/advanced only by SECURITY DEFINER RPCs. A learner UPDATE
-- could reopen a completed session after reading answer keys from
-- get_practice_session_results (live: UPDATE granted + sessions_update_own).
drop policy if exists sessions_update_own on public.practice_sessions;
drop policy if exists sessions_insert_own on public.practice_sessions;
revoke insert, update, delete, truncate, references, trigger on public.practice_sessions from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.practice_session_questions from anon, authenticated;
revoke all on public.practice_sessions, public.practice_session_questions from anon;

-- Behaviour stream is written by save_attempt (SECURITY DEFINER); learner inserts
-- would let a learner inject behaviour evidence.
drop policy if exists behavior_events_insert_own on intelligence.behavior_events;
revoke insert on intelligence.behavior_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Per-LO learner state (derived, recomputable)
-- ---------------------------------------------------------------------------
create table if not exists pie.learner_lo_state (
  user_id uuid not null references public.profiles(id) on delete cascade,
  lo_id uuid not null references pie.learning_objective(id) on delete cascade,
  mastery numeric not null check (mastery between 0 and 1),
  mastery_confidence numeric not null check (mastery_confidence between 0 and 1),
  ability_theta numeric not null,
  exposure_count integer not null check (exposure_count >= 0),
  distinct_question_count integer not null check (distinct_question_count >= 0),
  outcome_history jsonb not null default '[]'::jsonb,
  last_seen_at timestamptz,
  review_due_at timestamptz,
  difficulty_history jsonb not null default '[]'::jsonb,
  misconception_state jsonb not null default '{}'::jsonb,
  confidence_state jsonb not null default '{}'::jsonb,
  behaviour_state jsonb not null default '{}'::jsonb,
  fragile_correct integer not null default 0 check (fragile_correct >= 0),
  confident_wrong integer not null default 0 check (confident_wrong >= 0),
  policy_version text not null,
  source_attempt_count integer not null,
  computed_at timestamptz not null default now(),
  primary key (user_id, lo_id)
);
comment on table pie.learner_lo_state is
  'Derived per-LO learner state. Never written by learners. Fully recomputable from public.user_attempts via pie.recompute_learner_lo_state().';
comment on column pie.learner_lo_state.review_due_at is
  'Reserved for spaced review (P6). Always NULL in policy pie-lo-state/p2.0.';

alter table pie.learner_lo_state enable row level security;
revoke all on pie.learner_lo_state from public, anon, authenticated;
grant select, insert, update, delete on pie.learner_lo_state to service_role;

-- Deterministic recompute. Policy pie-lo-state/p2.0:
--   p_i      = c + (1-c) * logistic(theta - b_i),   c = 0.2, b_i = coalesce(irt_b, 0)
--   theta   <- theta + K_n * (y_i - p_i),           K_n = 1.2 / (1 + 0.15 n), theta0 = 0
--   evidence weight per attempt = question_lo.weight
--   mastery            = logistic(theta)   (P(correct) on a b=0 item, no guessing)
--   mastery_confidence = 1 - 1/sqrt(1 + sum(w * p(1-p)))
--   confidence_normalized = (confidence_level - 1) / 4
--   first_answer_correct  = first element of change_sequence = correct_answer (server-side)
--   fragile_correct = correct AND (confidence_normalized <= 0.25 OR first answer wrong)
--   confident_wrong = wrong AND confidence_normalized >= 0.75
-- Attempt order: created_at, id. Weakness (mastery) and uncertainty (mastery_confidence)
-- are stored separately and never combined here.
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
  c_policy constant text := 'pie-lo-state/p2.0';
  r record;
  a record;
  v_theta numeric; v_info numeric; v_n integer; v_p numeric; v_k numeric; v_b numeric;
  v_y integer; v_conf numeric; v_first text; v_first_correct boolean;
  v_hist jsonb; v_dhist jsonb; v_fragile integer; v_cwrong integer;
  v_conf_sum numeric; v_conf_n integer; v_correct_n integer;
  v_time_sum numeric; v_time_n integer; v_changes_sum numeric; v_fac_n integer; v_fac_known integer;
  v_wrong_opts jsonb; v_last timestamptz; v_distinct integer; v_rows integer := 0;
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

  for r in
    select ql.lo_id
    from public.user_attempts ua
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
    from public.user_attempts ua join pie.question_lo ql on ql.question_id = ua.question_id and ql.lo_id = r.lo_id
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

-- Learner wrappers (auth.uid() scoped; no arguments to forge).
create or replace function public.refresh_my_lo_state()
returns integer language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  return pie.recompute_learner_lo_state(auth.uid());
end $$;

create or replace function public.get_my_lo_state()
returns table(
  lo_key text, concept_key text, mastery numeric, mastery_confidence numeric,
  exposure_count integer, distinct_question_count integer, outcome_history jsonb,
  last_seen_at timestamptz, review_due_at timestamptz, difficulty_history jsonb,
  misconception_state jsonb, confidence_state jsonb, behaviour_state jsonb,
  fragile_correct integer, confident_wrong integer, policy_version text, computed_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select lo.lo_key, c.concept_key, s.mastery, s.mastery_confidence, s.exposure_count,
         s.distinct_question_count, s.outcome_history, s.last_seen_at, s.review_due_at,
         s.difficulty_history, s.misconception_state, s.confidence_state, s.behaviour_state,
         s.fragile_correct, s.confident_wrong, s.policy_version, s.computed_at
  from pie.learner_lo_state s
  join pie.learning_objective lo on lo.id = s.lo_id
  join pie.concept c on c.id = lo.concept_id
  where auth.uid() is not null and s.user_id = auth.uid()
  order by lo.lo_key
$$;

revoke all on function public.refresh_my_lo_state() from public, anon;
revoke all on function public.get_my_lo_state() from public, anon;
grant execute on function public.refresh_my_lo_state() to authenticated, service_role;
grant execute on function public.get_my_lo_state() to authenticated, service_role;
