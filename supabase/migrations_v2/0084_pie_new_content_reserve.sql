-- 0084_pie_new_content_reserve
-- PIE: reserve ceil(0.2 * target_length) slots per session for new content (approved by Mr. G, 2026-10-14).
-- NEEDS Mr. G's go before Gus applies it. Apply as postgres. Hank: security review (DEFINER function).
-- Based on the LIVE pie.decide (identical to 0083; captured in
-- supabase/verification_v2/pie_new_content_reserve/live_decide_20261014_post0083.sql). Only pie.decide changes.
--
-- New content = an eligible candidate with hierarchy unseen_concept / unseen_lo_within_seen_concept and an
--   anti_starvation signal of 0 (its LO was never served to, seen by, or decided on for this learner).
-- reserve = ceil(0.2 * target_length) (4 of 20); interval = floor(target / reserve) (5 of 20).
-- Each decision, after the 40% subject-cap exclusion: if fewer than `reserve` new items have been served in
--   the session (session decision_trace + this call), remaining slots <= need * interval, and the best eligible
--   candidate is not new, the best eligible new candidate is served instead. For 20 items the reserved picks
--   land at positions 1, 6, 11, 16 at the latest.
-- Skipped while the subject-cap fallback is active, and only eligible candidates are considered, so the cap,
--   no-repeat (in_current_session), quarantine and the answer lock (pie_next_question PIE_UNANSWERED) all hold.
-- Trace: state_snapshot.new_content_reserve (reserve, need, remaining_slots, forced, reason, displaced_candidate);
--   reason_codes gains 'new_content_reserved' when a pick was forced.
-- Grants unchanged from live: pie.decide EXECUTE = postgres, service_role only.
-- Rollback: re-apply supabase/verification_v2/pie_new_content_reserve/live_decide_20261014_post0083.sql.

create or replace function pie.decide(p_user uuid, p_session uuid, p_event_type text, p_n integer, p_policy text default 'pie-select/p3.0'::text, p_blueprint_key text default 'AMC_CAT_MCQ'::text)
 returns table(question_id uuid, decision_id uuid, nble_type text)
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_qs uuid[] := '{}'; v_los uuid[] := '{}'; v_subj uuid[] := '{}';
  r record; v_rej jsonb; v_inelig jsonb; v_id uuid; i integer;
  v_cfg_target integer; v_prior integer := 0; v_target integer; v_served integer; v_cap integer;
  v_counts jsonb; v_capped uuid[]; v_uncapped_left integer; v_fallback boolean; v_excluded jsonb; v_cap_state jsonb;
  -- 0084 new-content reservation
  v_reserve integer; v_new_count integer := 0; v_need integer; v_remaining integer; v_interval integer;
  v_new_avail integer; v_force boolean; v_is_new boolean; v_res_reason text; v_displaced jsonb; v_res_state jsonb; b record;
begin
  if p_n is null or p_n < 1 or p_n > 50 then raise exception 'n must be 1..50' using errcode = '22023'; end if;

  if p_session is not null then
    select case when (s.config->>'target_length') ~ '^[0-9]{1,4}$' and (s.config->>'target_length')::int > 0
                then (s.config->>'target_length')::int end
      into v_cfg_target from public.practice_sessions s where s.id = p_session;
    select count(*)::int into v_prior from public.practice_session_questions x where x.session_id = p_session;
  end if;
  v_target := coalesce(v_cfg_target, case when p_event_type = 'SESSION_BUILD' then v_prior + p_n end, 20);

  -- 0084: reserve ceil(0.2 * target) slots for new content (never served to / decided on for this learner)
  v_reserve := ceil(0.2 * v_target)::int;
  v_interval := greatest(1, floor(v_target::numeric / greatest(v_reserve, 1))::int);
  if p_session is not null then
    select count(*)::int into v_new_count from pie.decision_trace dt
     where dt.session_id = p_session and dt.user_id = p_user
       and coalesce((dt.state_snapshot->'new_content_reserve'->>'selected_is_new')::boolean,
                    'new_content' = any(dt.reason_codes));
  end if;

  for i in 1..p_n loop
    perform pie.rank_candidates(p_user, p_session, p_policy, p_blueprint_key, v_qs, v_los);

    -- ---- subject cap state for this decision
    v_served := v_prior + coalesce(array_length(v_qs, 1), 0);
    v_cap := ceil(0.4 * greatest(v_target, v_served + 1))::int;
    with served as (
      select q.subject_id from public.practice_session_questions x join public.questions q on q.id = x.question_id
       where x.session_id = p_session
      union all select unnest(v_subj)
    ), c as (select subject_id, count(*)::int n from served where subject_id is not null group by 1)
    select coalesce(jsonb_object_agg(subject_id::text, n), '{}'::jsonb),
           coalesce(array_agg(subject_id) filter (where n >= v_cap), '{}')
      into v_counts, v_capped from c;

    select count(*)::int into v_uncapped_left from pg_temp.pie_cand c
     where c.eligible and not (c.subject_id = any(v_capped));
    v_fallback := v_uncapped_left = 0 and exists (select 1 from pg_temp.pie_cand c where c.eligible);

    select coalesce(jsonb_agg(jsonb_build_object('question_id', t.question_id, 'subject_id', t.subject_id, 'total', t.total,
                    'reason', 'subject_cap') order by t.total desc, t.tie_rank, t.tie_hash), '[]'::jsonb)
      into v_excluded
      from (select * from pg_temp.pie_cand c where c.eligible and c.subject_id = any(v_capped)
             order by c.total desc, c.tie_rank, c.tie_hash limit 5) t;

    if not v_fallback then
      update pg_temp.pie_cand c set eligible = false, reject_reason = 'subject_cap'
       where c.eligible and c.subject_id = any(v_capped);
    end if;

    if v_fallback then
      -- every eligible candidate is capped: least-represented subject first, then best score
      select c.* into r from pg_temp.pie_cand c where c.eligible
        order by coalesce((v_counts->>c.subject_id::text)::int, 0) asc, c.total desc, c.tie_rank asc, c.tie_hash asc limit 1;
    else
      select * into r from pg_temp.pie_cand c where c.eligible
        order by c.total desc, c.tie_rank asc, c.tie_hash asc limit 1;
    end if;
    -- ---- 0084 new-content reservation (after the cap exclusion, so it never breaks the cap;
    -- only eligible candidates are considered, so no-repeat / answer-lock rules are untouched)
    v_remaining := greatest(v_target, v_served + 1) - v_served;
    v_need := greatest(v_reserve - v_new_count, 0);
    select count(*)::int into v_new_avail from pg_temp.pie_cand c where c.eligible and c.hierarchy in ('unseen_concept','unseen_lo_within_seen_concept') and coalesce((c.secondary->'anti_starvation'->>'value')::numeric, 0) = 0;
    v_force := false; v_displaced := null;
    v_is_new := r.question_id is not null and r.hierarchy in ('unseen_concept','unseen_lo_within_seen_concept')
                and coalesce((r.secondary->'anti_starvation'->>'value')::numeric, 0) = 0;
    v_res_reason := case when r.question_id is null then 'no_candidate'
                         when v_need = 0 then 'reserve_met'
                         when v_is_new then 'best_candidate_is_new'
                         when v_fallback then 'cap_fallback_active'
                         when v_new_avail = 0 then 'no_new_content_eligible'
                         when v_remaining > v_need * v_interval then 'not_due'
                         else 'reserve_due' end;
    if v_res_reason = 'reserve_due' then
      v_displaced := jsonb_build_object('question_id', r.question_id, 'subject_id', r.subject_id, 'total', r.total, 'hierarchy', r.hierarchy);
      select c.* into r from pg_temp.pie_cand c where c.eligible and c.hierarchy in ('unseen_concept','unseen_lo_within_seen_concept') and coalesce((c.secondary->'anti_starvation'->>'value')::numeric, 0) = 0
       order by c.total desc, c.tie_rank asc, c.tie_hash asc limit 1;
      v_force := true; v_is_new := true;
    end if;
    v_res_state := jsonb_build_object(
      'rule', 'reserve ceil(0.2 * target_length) slots for content never served to or decided on for this learner',
      'reserve_fraction', 0.2, 'target_length', v_target, 'reserve', v_reserve, 'interval', v_interval,
      'new_served_before', v_new_count, 'need', v_need, 'remaining_slots', v_remaining,
      'new_eligible_count', v_new_avail, 'forced', v_force, 'reason', v_res_reason,
      'selected_is_new', coalesce(v_is_new, false), 'displaced_candidate', v_displaced);

    if r is null then
      if i = 1 then
        raise exception 'PIE_NO_ELIGIBLE_CANDIDATE' using errcode = 'P0002',
          detail = (select coalesce(jsonb_object_agg(reject_reason, n), '{}'::jsonb)::text
                    from (select reject_reason, count(*) n from pg_temp.pie_cand group by 1) t);
      end if;
      exit;
    end if;

    v_cap_state := jsonb_build_object(
      'rule', 'max 40% of session items per subject',
      'cap_fraction', 0.4, 'target_length', v_target,
      'target_source', case when v_cfg_target is not null then 'session_config'
                            when p_event_type = 'SESSION_BUILD' then 'session_build_size' else 'default_20' end,
      'effective_target', greatest(v_target, v_served + 1), 'cap', v_cap, 'served_before', v_served,
      'subject_counts', v_counts, 'capped_subjects', to_jsonb(v_capped),
      'selected_subject_id', r.subject_id,
      'selected_subject_count_after', coalesce((v_counts->>r.subject_id::text)::int, 0) + 1,
      'fallback', v_fallback,
      'fallback_reason', case when v_fallback then 'all_remaining_eligible_candidates_capped' end,
      'fallback_rule', case when v_fallback then 'least_represented_subject_then_score' end,
      'excluded_candidates', case when v_fallback then '[]'::jsonb else v_excluded end,
      'excluded_count', case when v_fallback then 0 else
          (select count(*) from pg_temp.pie_cand c where c.reject_reason = 'subject_cap') end);

    select coalesce(jsonb_agg(jsonb_build_object('question_id', c.question_id, 'lo_id', c.lo_id, 'total', c.total,
             'primary', c.primary_score, 'secondary', c.secondary_score, 'hierarchy', c.hierarchy, 'reason', 'lower_total_score')
             order by c.total desc, c.tie_rank, c.tie_hash), '[]'::jsonb)
      into v_rej
      from (select * from pg_temp.pie_cand c where c.eligible and c.question_id <> r.question_id
            order by c.total desc, c.tie_rank, c.tie_hash limit 5) c;
    select coalesce(jsonb_object_agg(reject_reason, n), '{}'::jsonb) into v_inelig
      from (select reject_reason, count(*) n from pg_temp.pie_cand where not eligible group by 1) t;

    insert into pie.decision_trace(
      user_id, session_id, question_id, decision_type, selected_action, rejected_actions,
      reason_codes, evidence_snapshot, state_snapshot, policy_version, model_version, confidence, source
    )
    values (
      p_user, p_session, r.question_id, p_event_type,
      jsonb_build_object('lo_id',r.lo_id,'nble_type',r.nble_type,'hierarchy',r.hierarchy,'subject_id',r.subject_id,
                         'total_score',r.total,'primary_score',r.primary_score,'secondary_score',r.secondary_score),
      v_rej,
      array[r.nble_type,r.hierarchy]
        || case when v_fallback then array['subject_cap_fallback']
                when cardinality(v_capped) > 0 then array['subject_cap_applied'] else '{}'::text[] end
        || case when v_force then array['new_content_reserved'] else '{}'::text[] end,
      r.secondary,
      jsonb_build_object('weakness',r.weakness,'unseen_value',r.unseen_value,
                         'eligible_count',(select count(*) from pg_temp.pie_cand where eligible),
                         'ineligible_counts', v_inelig,
                         'subject_cap', v_cap_state,
                                'new_content_reserve', v_res_state),
      p_policy,'pie-select/p3.0-authoritative',
      greatest(least(coalesce(1-r.secondary_score,1),1),0),'authoritative'
    )
    returning pie.decision_trace.id into v_id;

    if v_is_new then v_new_count := v_new_count + 1; end if;
    v_qs := v_qs || r.question_id; v_los := v_los || r.lo_id; v_subj := v_subj || r.subject_id;
    question_id := r.question_id; decision_id := v_id; nble_type := r.nble_type;
    return next;
  end loop;
end $function$;
revoke all on function pie.decide(uuid, uuid, text, integer, text, text) from public, anon, authenticated;
grant execute on function pie.decide(uuid, uuid, text, integer, text, text) to service_role;
