-- 0059: P5 "everything in PIE" (Mr. G). LOCAL-VERIFIED ONLY.
--  D1  Diagnostic mode: pie_create_session(p_count, p_blueprint_key, p_mode) with
--      p_mode = 'pie_adaptive' (default, unchanged) | 'pie_diagnostic'. A diagnostic is a
--      server-built, blueprint-balanced FIXED set registered in pie.adaptive_session
--      (mode = 'diagnostic'), so its attempts count as evidence under the existing rules
--      (first-exposure, completed-session) exactly like adaptive ones.
--      Balancing (DESIGN DEFAULT): each pick is restricted to the subject (AMC blueprint
--      group) with the largest deficit  share_s * (k + 1) - chosen_s  among subjects that
--      still have an eligible candidate; share_s = sum(coverage_target) of the subject's
--      blueprint LOs (equal shares if the blueprint carries no targets). Within that subject
--      the normal PIE score picks (C1 concept cap, presented-unanswered exclusion apply).
--      Trace: secondary_reasons.diagnostic_quota; others rejected as 'diagnostic_quota'.
--      Throttle/caps (DESIGN DEFAULTS): the shared 30 s create throttle and 3-active cap
--      apply; additionally at most 1 active diagnostic (resume it instead) and at most one
--      new diagnostic per 24 h. Diagnostic count 10..50. pie_next_question refuses
--      diagnostic sessions (the set is fixed).
--  D2  save_attempt only accepts sessions registered in pie.adaptive_session for the caller
--      (PIE_SESSION_REQUIRED). No attempt can be written outside a PIE session.
--  D3  Client-chosen question sets are gone: create_practice_session(…, p_question_ids) and
--      get_practice_question_pool are no longer executable by anon/authenticated.

alter table pie.adaptive_session add column if not exists mode text not null default 'adaptive';
do $$ begin
  alter table pie.adaptive_session add constraint adaptive_session_mode_check check (mode in ('adaptive', 'diagnostic'));
exception when duplicate_object then null; end $$;
alter table pie.session_create_throttle add column if not exists last_diagnostic_at timestamptz;

revoke execute on function public.create_practice_session(text, jsonb, uuid[]) from public, anon, authenticated;
revoke execute on function public.get_practice_question_pool(integer) from public, anon, authenticated;


create or replace function pie.decide(
  p_user uuid, p_session uuid, p_event_type text, p_n integer,
  p_policy text default 'pie-select/p5.1', p_blueprint_key text default 'AMC_CAT_MCQ')
returns table(question_id uuid, decision_id uuid, nble_type text)
language plpgsql security definer set search_path = '' as $$
-- 0059: based on 0058; adds the diagnostic blueprint quota (adaptive_session.mode = 'diagnostic').
declare
  v_qs uuid[] := '{}'; v_los uuid[] := '{}';
  r record; v_rej jsonb; v_inelig jsonb; v_id uuid; i integer;
  w jsonb; v_rp numeric; v_max_concept integer; v_distinct_lo boolean;
  v_lv boolean; cp jsonb; v_fast numeric; v_median numeric; v_nt integer;
  v_best_rev record; v_best_uns record; v_cmp jsonb; v_dom text;
  v_diag boolean; v_qsub uuid; v_quota jsonb;
begin
  if p_n is null or p_n < 1 or p_n > 50 then raise exception 'n must be 1..50' using errcode = '22023'; end if;
  select weights into w from pie.selection_policy where policy_version = p_policy;
  v_rp := coalesce((w->>'review_priority')::numeric, 0);
  v_max_concept := (w->'session'->>'max_per_concept')::int;
  v_distinct_lo := coalesce((w->'session'->>'distinct_lo_within_concept')::boolean, false);
  v_lv := w ? 'learner_value';
  cp := w->'confirmation_probe';
  if cp is not null then
    select percentile_cont(0.5) within group (order by ua.time_taken_seconds), count(*) into v_median, v_nt
      from public.user_attempts ua join public.practice_sessions ps on ps.id = ua.session_id and ps.status = 'completed'
     where ua.user_id = p_user and ua.time_taken_seconds is not null;
    v_fast := case when v_nt >= (cp->>'fast_min_history')::int then (cp->>'fast_fraction_of_median')::numeric * v_median
                   else (cp->>'fast_default_seconds')::numeric end;
  end if;
  v_diag := exists (select 1 from pie.adaptive_session a where a.session_id = p_session and a.mode = 'diagnostic');
  if v_diag then
    create temp table if not exists pie_diag_share (subject_id uuid primary key, share numeric) on commit drop;
    truncate pg_temp.pie_diag_share;
  end if;
  for i in 1..p_n loop
    perform pie.rank_candidates(p_user, p_session, p_policy, p_blueprint_key, v_qs, v_los);
    update pg_temp.pie_cand c set eligible = false, reject_reason = 'presented_unanswered'
     where c.eligible and c.question_id in (select x.question_id from pie.presented_unanswered(p_user, p_session) x);
    create temp table if not exists pie_sess_q (question_id uuid, lo_id uuid, concept_id uuid, position integer) on commit drop;
    truncate pg_temp.pie_sess_q;
    insert into pg_temp.pie_sess_q
      select psq.question_id, ql.lo_id, lo.concept_id, psq.position from public.practice_session_questions psq
      join pie.question_lo ql on ql.question_id = psq.question_id and ql.is_primary
      join pie.learning_objective lo on lo.id = ql.lo_id
      where psq.session_id = p_session
      union all
      select x.qid, lo.id, lo.concept_id, 100000 + x.ord::int
      from unnest(v_qs, v_los) with ordinality x(qid, lo_id, ord) join pie.learning_objective lo on lo.id = x.lo_id;
    if v_distinct_lo then
      update pg_temp.pie_cand c set eligible = false, reject_reason = 'lo_already_in_session'
       where c.eligible and c.lo_id in (select s.lo_id from pg_temp.pie_sess_q s);
    end if;
    if v_max_concept is not null then
      update pg_temp.pie_cand c set eligible = false, reject_reason = 'concept_session_cap'
       where c.eligible and (select count(*) from pg_temp.pie_sess_q s where s.concept_id = c.concept_id) >= v_max_concept;
    end if;

    -- 0059 D1: diagnostic blueprint quota by subject (largest deficit).
    v_quota := null;
    if v_diag then
      if i = 1 then
        insert into pg_temp.pie_diag_share
        select c.subject_id, coalesce(sum(t.ct), 0) from (select distinct subject_id from pg_temp.pie_cand where eligible) c
          left join lateral (select bl.coverage_target ct from amc.amc_blueprint_lo bl
                             join amc.amc_blueprint b on b.id = bl.blueprint_id and b.blueprint_key = p_blueprint_key
                             join pie.question_lo ql on ql.lo_id = bl.lo_id and ql.is_primary
                             join public.questions q on q.id = ql.question_id and q.subject_id = c.subject_id and q.status = 'active'
                             group by bl.lo_id, bl.coverage_target) t on true
         group by c.subject_id;
        if (select coalesce(sum(share), 0) from pg_temp.pie_diag_share) = 0 then update pg_temp.pie_diag_share set share = 1; end if;
        update pg_temp.pie_diag_share set share = share / (select sum(share) from pg_temp.pie_diag_share);
      end if;
      select ds.subject_id, jsonb_build_object('subject_id', ds.subject_id, 'share', round(ds.share, 4),
               'chosen_before', ds.chosen, 'target_after', round(ds.share * i, 3))
        into v_qsub, v_quota
        from (select s.subject_id, s.share,
                     (select count(*) from pg_temp.pie_sess_q q join public.questions qq on qq.id = q.question_id where qq.subject_id = s.subject_id) chosen
              from pg_temp.pie_diag_share s
              where exists (select 1 from pg_temp.pie_cand c where c.eligible and c.subject_id = s.subject_id)) ds
       order by ds.share * i - ds.chosen desc, ds.share desc, ds.subject_id limit 1;
      if v_qsub is not null then
        update pg_temp.pie_cand c set eligible = false, reject_reason = 'diagnostic_quota'
         where c.eligible and c.subject_id is distinct from v_qsub;
      end if;
    end if;

    create temp table if not exists pie_cand_x (question_id uuid primary key, cls text, lv jsonb, probe jsonb) on commit drop;
    truncate pg_temp.pie_cand_x;
    if v_lv then
      -- C3: one comparable learner value per eligible candidate.
      insert into pg_temp.pie_cand_x(question_id, cls, lv)
      select c.question_id,
             case when s.lo_id is null then 'unseen' when s.review_due_at is not null and s.review_due_at <= now() then 'review' else 'seen' end,
             pie.learner_value(w, s.mastery, s.last_seen_at, s.review_due_at, s.exposure_count, s.confident_wrong, s.fragile_correct,
               (w->'learner_value'->'novelty'->>(
                 case when s.lo_id is null then
                        case when exists (select 1 from pie.learner_lo_state s2 join pie.learning_objective l2 on l2.id = s2.lo_id
                                          where s2.user_id = p_user and l2.concept_id = c.concept_id)
                               or exists (select 1 from pg_temp.pie_sess_q q where q.concept_id = c.concept_id)
                             then 'unseen_lo' else 'unseen_concept' end
                      when exists (select 1 from public.user_attempts ua join public.practice_sessions ps on ps.id = ua.session_id and ps.status = 'completed'
                                   where ua.user_id = p_user and ua.question_id = c.question_id) then 'attempted'
                      else 'new_variant' end))::numeric)
      from pg_temp.pie_cand c left join pie.learner_lo_state s on s.user_id = p_user and s.lo_id = c.lo_id
      where c.eligible;
      update pg_temp.pie_cand c set primary_score = (x.lv->>'value')::numeric,
             total = (x.lv->>'value')::numeric + c.secondary_score + c.starvation
        from pg_temp.pie_cand_x x where x.question_id = c.question_id;
    end if;
    if cp is not null then
      -- C1: second same-concept question as a confirmation probe of the first.
      insert into pg_temp.pie_cand_x(question_id, probe)
      select c.question_id, jsonb_build_object(
               'first_question_id', f.question_id,
               'applied', pr.reason is not null,
               'reason', coalesce(pr.reason, case when ua.id is null then 'first_unanswered'
                                                  when not ua.is_correct then 'first_answer_wrong'
                                                  else 'first_correct_confident' end),
               'bonus', case when pr.reason is not null then (cp->>'bonus')::numeric else 0 end,
               'confidence_level', ua.confidence_level, 'time_taken_seconds', ua.time_taken_seconds,
               'fast_threshold_seconds', round(v_fast, 2))
      from pg_temp.pie_cand c
      join lateral (select q.* from pg_temp.pie_sess_q q where q.concept_id = c.concept_id order by q.position limit 1) f on true
      left join public.user_attempts ua on ua.session_id = p_session and ua.question_id = f.question_id
      left join pie.learner_lo_state fs on fs.user_id = p_user and fs.lo_id = f.lo_id
      cross join lateral (select case
          when ua.is_correct and ua.confidence_level is not null and ua.confidence_level <= (cp->>'low_conf_max_level')::int then 'correct_low_confidence'
          when ua.is_correct and ua.time_taken_seconds is not null and ua.time_taken_seconds < v_fast then 'correct_fast'
          when ua.is_correct and (fs.mastery_confidence < (cp->>'uncertain_mastery_confidence')::numeric or fs.fragile_correct > 0) then 'correct_uncertain_learner_state'
          end reason) pr
      where c.eligible and (select count(*) from pg_temp.pie_sess_q q where q.concept_id = c.concept_id) = 1
      on conflict on constraint pie_cand_x_pkey do update set probe = excluded.probe;
      update pg_temp.pie_cand c set total = c.total + (x.probe->>'bonus')::numeric
        from pg_temp.pie_cand_x x where x.question_id = c.question_id and x.probe is not null;
    end if;
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

    v_cmp := null;
    if v_lv then
      select c.question_id, c.total, x.lv into v_best_rev from pg_temp.pie_cand c join pg_temp.pie_cand_x x on x.question_id = c.question_id
       where c.eligible and x.cls = 'review' order by c.total desc, c.tie_rank, c.tie_hash limit 1;
      select c.question_id, c.total, x.lv into v_best_uns from pg_temp.pie_cand c join pg_temp.pie_cand_x x on x.question_id = c.question_id
       where c.eligible and x.cls = 'unseen' order by c.total desc, c.tie_rank, c.tie_hash limit 1;
      select k into v_dom from pg_temp.pie_cand_x x, jsonb_each_text(x.lv->'parts') p(k, v)
       where x.question_id = r.question_id order by v::numeric desc, k limit 1;
      v_cmp := jsonb_build_object(
        'winner_class', (select x.cls from pg_temp.pie_cand_x x where x.question_id = r.question_id),
        'best_review', case when v_best_rev.question_id is null then null else jsonb_build_object('question_id', v_best_rev.question_id, 'total', v_best_rev.total, 'learner_value', v_best_rev.lv->'value') end,
        'best_unseen', case when v_best_uns.question_id is null then null else jsonb_build_object('question_id', v_best_uns.question_id, 'total', v_best_uns.total, 'learner_value', v_best_uns.lv->'value') end,
        'decided_by', 'total_score',
        'dominant_component', v_dom,
        'why', case
          when v_best_rev.question_id is not null and v_best_uns.question_id is not null then
            (select x.cls from pg_temp.pie_cand_x x where x.question_id = r.question_id) || ' won: total '
              || r.total || ' vs best review ' || v_best_rev.total || ' / best unseen ' || v_best_uns.total
              || '; largest learner-value component ' || coalesce(v_dom, '-')
          else 'only one candidate class eligible; largest learner-value component ' || coalesce(v_dom, '-') end);
    end if;

    insert into pie.decision_trace(learner_id, session_id, question_id, event_type, nble_type, subject_id, concept_id, lo_id,
                                   primary_reasons, secondary_reasons, rejected_candidates, total_score, policy_version)
    values (p_user, p_session, r.question_id, p_event_type, r.nble_type, r.subject_id, r.concept_id, r.lo_id,
            jsonb_build_object('hierarchy', r.hierarchy, 'weakness', r.weakness, 'unseen_value', r.unseen_value,
                               'primary_score', r.primary_score)
              || jsonb_strip_nulls(jsonb_build_object(
                   'learner_value', (select x.lv from pg_temp.pie_cand_x x where x.question_id = r.question_id),
                   'comparison', v_cmp)),
            r.secondary || jsonb_build_object('secondary_score', r.secondary_score, 'starvation_score', r.starvation,
                                              'review_priority', jsonb_build_object('value', case when r.hierarchy = 'review_due' then 1 else 0 end, 'weight', v_rp))
              || jsonb_strip_nulls(jsonb_build_object('confirmation_probe',
                   (select x.probe from pg_temp.pie_cand_x x where x.question_id = r.question_id),
                   'diagnostic_quota', v_quota)),
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


drop function if exists public.pie_create_session(integer, text);
create or replace function public.pie_create_session(
  p_count integer default 10, p_blueprint_key text default 'AMC_CAT_MCQ', p_mode text default 'pie_adaptive')
returns table(session_id uuid, question_count integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_session uuid; v_pos integer := 0; d record; v_last timestamptz; v_last_diag timestamptz;
  v_diag boolean;
  c_min_interval constant interval := interval '30 seconds';
  c_max_active constant integer := 3;
  c_stale_after constant interval := interval '2 hours';  -- DESIGN DEFAULT (0053)
  c_diag_interval constant interval := interval '24 hours'; -- DESIGN DEFAULT (0059)
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_mode is null or p_mode not in ('pie_adaptive', 'pie_diagnostic') then
    raise exception 'p_mode must be pie_adaptive or pie_diagnostic' using errcode = '22023';
  end if;
  v_diag := p_mode = 'pie_diagnostic';
  if v_diag then
    if p_count is null or p_count < 10 or p_count > 50 then raise exception 'diagnostic p_count must be 10..50' using errcode = '22023'; end if;
  elsif p_count is null or p_count < 1 or p_count > 50 then raise exception 'p_count must be 1..50' using errcode = '22023'; end if;
  perform pie.assert_blueprint(p_blueprint_key);

  insert into pie.session_create_throttle(user_id, last_created_at, create_count)
  values (v_uid, '-infinity', 0) on conflict (user_id) do nothing;
  select t.last_created_at, t.last_diagnostic_at into v_last, v_last_diag
    from pie.session_create_throttle t where t.user_id = v_uid for update;
  if v_last > clock_timestamp() - c_min_interval then
    raise exception 'PIE_RATE_LIMITED: one adaptive session per 30 seconds' using errcode = '53400';
  end if;
  update public.practice_sessions ps set status = 'abandoned', updated_at = now()
   from pie.adaptive_session a
   where a.session_id = ps.id and a.user_id = v_uid and ps.status = 'active'
     and coalesce(ps.last_activity_at, ps.started_at, ps.created_at) < now() - c_stale_after;
  if v_diag then
    if exists (select 1 from pie.adaptive_session a join public.practice_sessions ps on ps.id = a.session_id
               where a.user_id = v_uid and a.mode = 'diagnostic' and ps.status = 'active') then
      raise exception 'PIE_DIAGNOSTIC_ACTIVE: finish or resume the active diagnostic' using errcode = '53400';
    end if;
    if v_last_diag > clock_timestamp() - c_diag_interval then
      raise exception 'PIE_DIAGNOSTIC_RATE_LIMITED: one diagnostic per 24 hours' using errcode = '53400';
    end if;
  end if;
  if (select count(*) from pie.adaptive_session a
        join public.practice_sessions ps on ps.id = a.session_id
       where a.user_id = v_uid and ps.status = 'active') >= c_max_active then
    raise exception 'PIE_TOO_MANY_ACTIVE_SESSIONS: at most % active adaptive sessions', c_max_active using errcode = '53400';
  end if;
  update pie.session_create_throttle set last_created_at = clock_timestamp(), create_count = create_count + 1,
         last_diagnostic_at = case when v_diag then clock_timestamp() else last_diagnostic_at end
   where user_id = v_uid;

  insert into public.practice_sessions(user_id, session_type, status, config, started_at, last_activity_at)
  values (v_uid, p_mode, 'active',
          jsonb_build_object('selector', 'pie', 'policy_version', pie.active_policy(), 'blueprint_key', p_blueprint_key,
                             'mode', case when v_diag then 'diagnostic' else 'adaptive' end),
          now(), now())
  returning id into v_session;
  insert into pie.adaptive_session(session_id, user_id, policy_version, blueprint_key, mode)
  values (v_session, v_uid, pie.active_policy(), p_blueprint_key, case when v_diag then 'diagnostic' else 'adaptive' end);
  for d in select * from pie.decide_counted(v_uid, v_session, 'SESSION_BUILD',
                                            p_count, pie.active_policy(), p_blueprint_key) loop
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
revoke all on function public.pie_create_session(integer, text, text) from public, anon;
grant execute on function public.pie_create_session(integer, text, text) to authenticated, service_role;

create or replace function public.pie_next_question(p_session_id uuid)
returns table(question_id uuid, question_position integer, nble_type text, decision_id uuid)
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_pos integer; d record; v_bp text; v_mode text;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  perform 1 from public.practice_sessions
   where id = p_session_id and user_id = v_uid and status = 'active' for update;
  if not found then raise exception 'active session not found' using errcode = '42501'; end if;
  select a.blueprint_key, a.mode into v_bp, v_mode from pie.adaptive_session a where a.session_id = p_session_id and a.user_id = v_uid;
  if not found then raise exception 'not an adaptive (server-selected) session' using errcode = '42501'; end if;
  if v_mode = 'diagnostic' then raise exception 'PIE_DIAGNOSTIC_FIXED: a diagnostic set is built once' using errcode = '55000'; end if;
  perform pie.assert_blueprint(v_bp);
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
revoke all on function public.pie_next_question(uuid) from public, anon;
grant execute on function public.pie_next_question(uuid) to authenticated, service_role;

-- save_attempt (from 0048 as replayed) + D2
CREATE OR REPLACE FUNCTION public.save_attempt(p_question_id uuid, p_session_id uuid, p_selected_answer text, p_is_correct boolean, p_time_taken_seconds integer DEFAULT NULL::integer, p_confidence_level smallint DEFAULT NULL::smallint, p_answer_changes_count integer DEFAULT 0, p_time_to_first_click integer DEFAULT NULL::integer, p_change_sequence jsonb DEFAULT NULL::jsonb, p_pause_events jsonb DEFAULT NULL::jsonb, p_time_of_day text DEFAULT NULL::text, p_question_position integer DEFAULT NULL::integer, p_previous_question_correct boolean DEFAULT NULL::boolean, p_question_version integer DEFAULT NULL::integer, p_app_version text DEFAULT NULL::text, p_provenance jsonb DEFAULT '{}'::jsonb)
 RETURNS user_attempts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
-- 0059: requires a PIE session (D2). 0048 (based on 0044): session required; change_sequence validated; answer_changes server-derived
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
 -- 0059 D2: only sessions registered in pie.adaptive_session (PIE adaptive or diagnostic).
 if not exists (select 1 from pie.adaptive_session a where a.session_id = p_session_id and a.user_id = v_user) then
   raise exception 'PIE_SESSION_REQUIRED: attempts must belong to a PIE session' using errcode = '42501';
 end if;

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

notify pgrst, 'reload schema';
