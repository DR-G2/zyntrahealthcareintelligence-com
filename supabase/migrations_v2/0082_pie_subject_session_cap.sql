-- 0082_pie_subject_session_cap
-- PIE: 40% per-session subject coverage cap (approved by Mr. G, 2026-10-14).
--
-- Based on the LIVE definition of pie.decide on V2 hkowvjazuwebmibssdut (captured in
-- supabase/verification_v2/pie_subject_cap/live_baseline_20261014.sql), not on repo 0051.
-- pie.rank_candidates is unchanged; the cap is applied in pie.decide, after ranking.
--
-- Rule: in one session no subject may exceed cap = ceil(0.4 * target_length) served items.
--   target_length = practice_sessions.config->>'target_length' when set (positive int);
--                   else, for SESSION_BUILD, items already served + p_n (the requested build size);
--                   else 20 (Nudge's session length).
--   If the session has already served >= target_length items, target_length grows to
--   served + 1 so the cap keeps scaling with open-ended sessions.
--   Served = practice_session_questions rows for the session + items picked earlier in this call.
-- When a subject is at the cap its candidates are marked ineligible with
-- reject_reason = 'subject_cap' for this decision, provided another subject still has an
-- eligible candidate. If every eligible candidate is capped, the best capped candidate is
-- served (graceful fallback) and the decision trace records the fallback.
-- decision_trace.state_snapshot.subject_cap holds the cap state; reason_codes gains
-- 'subject_cap_applied' or 'subject_cap_fallback'; evidence of excluded candidates appears in
-- state_snapshot.subject_cap.excluded_candidates and in the ineligible counts.
--
-- Security: SECURITY DEFINER and search_path '' kept exactly as live. EXECUTE on pie.decide stays
-- as on live (service_role only, plus owner): learners reach it only through
-- public.pie_create_session / public.pie_next_question (unchanged, authenticated-only).
-- Granting authenticated EXECUTE on pie.decide would let a learner run decisions for any p_user.

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
begin
  if p_n is null or p_n < 1 or p_n > 50 then raise exception 'n must be 1..50' using errcode = '22023'; end if;

  if p_session is not null then
    select case when (s.config->>'target_length') ~ '^[0-9]{1,4}$' and (s.config->>'target_length')::int > 0
                then (s.config->>'target_length')::int end
      into v_cfg_target from public.practice_sessions s where s.id = p_session;
    select count(*)::int into v_prior from public.practice_session_questions x where x.session_id = p_session;
  end if;
  v_target := coalesce(v_cfg_target, case when p_event_type = 'SESSION_BUILD' then v_prior + p_n end, 20);

  for i in 1..p_n loop
    perform pie.rank_candidates(p_user, p_session, p_policy, p_blueprint_key, v_qs, v_los);

    -- ---- subject cap state for this decision
    v_served := v_prior + coalesce(array_length(v_qs, 1), 0);
    v_cap := ceil(0.4 * greatest(v_target, v_served + 1))::int;
    with served as (
      select q.subject_id from public.practice_session_questions x join public.questions q on q.id = x.question_id
       where x.session_id = p_session
      union all select unnest(v_subj)
    ), c as (select subject_id, count(*)::int n from served group by 1)
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
                when cardinality(v_capped) > 0 then array['subject_cap_applied'] else '{}'::text[] end,
      r.secondary,
      jsonb_build_object('weakness',r.weakness,'unseen_value',r.unseen_value,
                         'eligible_count',(select count(*) from pg_temp.pie_cand where eligible),
                         'ineligible_counts', v_inelig,
                         'subject_cap', v_cap_state),
      p_policy,'pie-select/p3.0-authoritative',
      greatest(least(coalesce(1-r.secondary_score,1),1),0),'authoritative'
    )
    returning pie.decision_trace.id into v_id;

    v_qs := v_qs || r.question_id; v_los := v_los || r.lo_id; v_subj := v_subj || r.subject_id;
    question_id := r.question_id; decision_id := v_id; nble_type := r.nble_type;
    return next;
  end loop;
end $function$;

revoke all on function pie.decide(uuid, uuid, text, integer, text, text) from public, anon, authenticated;
grant execute on function pie.decide(uuid, uuid, text, integer, text, text) to service_role;
