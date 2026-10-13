CREATE OR REPLACE FUNCTION pie.decide(p_user uuid, p_session uuid, p_event_type text, p_n integer, p_policy text DEFAULT 'pie-select/p3.0'::text, p_blueprint_key text DEFAULT 'AMC_CAT_MCQ'::text)
 RETURNS TABLE(question_id uuid, decision_id uuid, nble_type text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_qs uuid[] := '{}'; v_los uuid[] := '{}';
  r record; v_rej jsonb; v_inelig jsonb; v_id uuid; i integer;
begin
  if p_n is null or p_n < 1 or p_n > 50 then raise exception 'n must be 1..50' using errcode = '22023'; end if;
  for i in 1..p_n loop
    perform pie.rank_candidates(p_user, p_session, p_policy, p_blueprint_key, v_qs, v_los);
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

    insert into pie.decision_trace(
      user_id, session_id, question_id, decision_type, selected_action, rejected_actions,
      reason_codes, evidence_snapshot, state_snapshot, policy_version, model_version, confidence, source
    )
    values (
      p_user, p_session, r.question_id, p_event_type,
      jsonb_build_object('lo_id',r.lo_id,'nble_type',r.nble_type,'hierarchy',r.hierarchy,
                         'total_score',r.total,'primary_score',r.primary_score,'secondary_score',r.secondary_score),
      v_rej, array[r.nble_type,r.hierarchy], r.secondary,
      jsonb_build_object('weakness',r.weakness,'unseen_value',r.unseen_value,
                         'eligible_count',(select count(*) from pg_temp.pie_cand where eligible)),
      p_policy,'pie-select/p3.0-authoritative',
      greatest(least(coalesce(1-r.secondary_score,1),1),0),'authoritative'
    )
    returning pie.decision_trace.id into v_id;

    v_qs := v_qs || r.question_id; v_los := v_los || r.lo_id;
    question_id := r.question_id; decision_id := v_id; nble_type := r.nble_type;
    return next;
  end loop;
end $function$;
