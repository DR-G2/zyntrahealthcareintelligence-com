-- 0058: P5 final rulings (Mr. G) - supersedes the C1/C3 parts of 0056. LOCAL-VERIFIED ONLY.
--  C1  Up to 2 questions per concept per session (cap kept). The different-LO requirement is
--      DROPPED: a second same-concept question is intended as a CONFIRMATION PROBE (real
--      understanding vs a lucky first answer). The probe bonus applies when the first
--      same-concept answer in this session was correct AND any of
--        correct_low_confidence : confidence_level <= 2 ('Guessing'/'Unsure'),
--        correct_fast           : time_taken_seconds < fast threshold
--                                 (0.5 x learner's median answer time over completed sessions,
--                                  or 15 s with < 5 timed attempts),
--        correct_uncertain_learner_state : that LO's mastery_confidence < 0.5 or fragile_correct > 0.
--      Trace: secondary_reasons.confirmation_probe {applied, reason, first_question_id, bonus}.
--  C3  No fixed "due review beats unseen" rule (review_priority and the secondary review_due
--      weight are 0). Every eligible candidate gets ONE comparable learner value V (replaces
--      primary_score), then total = V + secondary_score + starvation (+ probe bonus):
--        W = 1 - mastery              (mastery gap; unseen LO uses prior mastery 0.5 -> W = 0.5)
--        O = 1 - R, R = 2^(-elapsed / interval)   (retrievability; elapsed = now - last_seen,
--            interval = review_due_at - last_seen; O = 0.5 exactly at due, -> 1 when long overdue,
--            0 for never-seen LOs)
--        K = min(1, (confident_wrong + fragile_correct) / exposure_count)  (confidence miscalibration)
--        N = novelty: 1.0 unseen concept, 0.8 unseen LO in seen concept, 0.6 unseen question of
--            a seen LO, 0.3 already-attempted question
--        V = 1.0*W + 1.0*O + 0.5*K + 1.0*N*W      ("unseen value under weakness" = N*W)
--      All coefficients are DESIGN DEFAULTS (uncalibrated), in policy weights.learner_value.
--      Trace: primary_reasons.learner_value (components) and primary_reasons.comparison
--      {winner_class review|unseen|seen, best_review, best_unseen, decided_by, dominant_component, why}.
--  New active policy 'pie-select/p5.1'; p5.0 retired. RPCs already use pie.active_policy().

insert into pie.selection_policy(policy_version, weights, notes)
select 'pie-select/p5.1',
       jsonb_set(weights, '{secondary,review_due}', '0'::jsonb)
         || jsonb_build_object(
           'review_priority', 0,
           'session', jsonb_build_object('max_per_concept', 2, 'distinct_lo_within_concept', false),
           'learner_value', jsonb_build_object('mastery_gap', 1.0, 'overdue', 1.0, 'miscalibration', 0.5,
                                               'novelty_under_weakness', 1.0, 'unseen_mastery_prior', 0.5,
                                               'novelty', jsonb_build_object('unseen_concept', 1.0, 'unseen_lo', 0.8,
                                                                             'new_variant', 0.6, 'attempted', 0.3)),
           'confirmation_probe', jsonb_build_object('bonus', 0.5, 'low_conf_max_level', 2,
                                                    'fast_fraction_of_median', 0.5, 'fast_default_seconds', 15,
                                                    'fast_min_history', 5, 'uncertain_mastery_confidence', 0.5)),
       'P5.1 (final rulings): C1 confirmation probe, C3 single comparable learner value. DESIGN DEFAULTS, uncalibrated.'
from pie.selection_policy where policy_version = 'pie-select/p5.0'
on conflict (policy_version) do nothing;
update pie.selection_policy set status = 'retired' where policy_version = 'pie-select/p5.0';

-- The C3 formula as a pure function (also unit-tested).
create or replace function pie.learner_value(
  p_w jsonb, p_mastery numeric, p_last_seen timestamptz, p_due timestamptz,
  p_exposure integer, p_conf_wrong integer, p_fragile integer, p_novelty numeric)
returns jsonb language plpgsql stable set search_path = '' as $$
declare lv jsonb := p_w->'learner_value'; v_w numeric; v_o numeric := 0; v_k numeric := 0; v_v numeric;
begin
  v_w := 1 - coalesce(p_mastery, (lv->>'unseen_mastery_prior')::numeric);
  if p_last_seen is not null and p_due is not null and p_due > p_last_seen then
    v_o := 1 - power(2::numeric, -(extract(epoch from now() - p_last_seen) / extract(epoch from p_due - p_last_seen))::numeric);
    v_o := greatest(0, least(1, v_o));
  end if;
  if coalesce(p_exposure, 0) > 0 then v_k := least(1, (coalesce(p_conf_wrong,0) + coalesce(p_fragile,0))::numeric / p_exposure); end if;
  v_v := (lv->>'mastery_gap')::numeric * v_w + (lv->>'overdue')::numeric * v_o
       + (lv->>'miscalibration')::numeric * v_k + (lv->>'novelty_under_weakness')::numeric * coalesce(p_novelty,0) * v_w;
  return jsonb_build_object('W', round(v_w,4), 'O', round(v_o,4), 'K', round(v_k,4), 'N', p_novelty, 'value', round(v_v,6),
    'parts', jsonb_build_object('mastery_gap', round((lv->>'mastery_gap')::numeric * v_w,4),
                                'overdue', round((lv->>'overdue')::numeric * v_o,4),
                                'miscalibration', round((lv->>'miscalibration')::numeric * v_k,4),
                                'novelty_under_weakness', round((lv->>'novelty_under_weakness')::numeric * coalesce(p_novelty,0) * v_w,4)));
end $$;
revoke all on function pie.learner_value(jsonb, numeric, timestamptz, timestamptz, integer, integer, integer, numeric) from public, anon, authenticated;

create or replace function pie.decide(
  p_user uuid, p_session uuid, p_event_type text, p_n integer,
  p_policy text default 'pie-select/p5.1', p_blueprint_key text default 'AMC_CAT_MCQ')
returns table(question_id uuid, decision_id uuid, nble_type text)
language plpgsql security definer set search_path = '' as $$
-- 0058: based on 0056; C1 confirmation probe (no distinct-LO rule), C3 single learner value.
declare
  v_qs uuid[] := '{}'; v_los uuid[] := '{}';
  r record; v_rej jsonb; v_inelig jsonb; v_id uuid; i integer;
  w jsonb; v_rp numeric; v_max_concept integer; v_distinct_lo boolean;
  v_lv boolean; cp jsonb; v_fast numeric; v_median numeric; v_nt integer;
  v_best_rev record; v_best_uns record; v_cmp jsonb; v_dom text;
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
                   (select x.probe from pg_temp.pie_cand_x x where x.question_id = r.question_id))),
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
