-- P2 follow-up: make LO behavioral state replay derive answer changes from the
-- server-side change sequence, not the client-supplied answer_changes_count.
-- This is additive and intentionally does not alter legacy PIE tables.

create or replace function pie.rebuild_lo_state(p_user_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare r record;n integer:=0;v_changes integer;
begin
 if auth.uid() is not null and auth.uid()<>p_user_id then
   raise exception 'user scope violation' using errcode='42501';
 end if;

 delete from pie.learner_lo_state where user_id=p_user_id;

 for r in
  select ql.lo_id,
         ua.id attempt_id,
         ua.is_correct,
         ua.time_taken_seconds,
         ua.time_to_first_click,
         ua.confidence_level,
         greatest(
           0,
           coalesce(
             jsonb_array_length(
               case when jsonb_typeof(ua.change_sequence)='array'
                    then ua.change_sequence else '[]'::jsonb end
             ),0
           )-1
         ) as derived_answer_changes,
         ua.created_at
  from public.user_attempts ua
  join pie.question_lo ql
    on ql.question_id=ua.question_id
   and ql.is_primary
  where ua.user_id=p_user_id
  order by ua.created_at,ua.id
 loop
  v_changes:=coalesce(r.derived_answer_changes,0);

  insert into pie.learner_lo_state(
    user_id,lo_id,exposure_count,correct_count,mastery_mean,mastery_sd,
    mastery_lcb,uncertainty,miss_count,miss_streak,last_miss_at,last_seen_at,
    confidence_mean,confidence_count,answer_changes,confident_wrong,
    fragile_correct,status,evidence_maturity,model_version,state_version
  )
  values(
    p_user_id,r.lo_id,1,case when r.is_correct then 1 else 0 end,
    case when r.is_correct then .75 else .25 end,1,0,1,
    case when r.is_correct then 0 else 1 end,
    case when r.is_correct then 0 else 1 end,
    case when r.is_correct then null else r.created_at end,
    r.created_at,r.confidence_level,
    case when r.confidence_level is null then 0 else 1 end,
    v_changes,
    case when not r.is_correct and coalesce(r.confidence_level,0)>=4 then 1 else 0 end,
    case when r.is_correct and
      (coalesce(r.confidence_level,3)<=2 or coalesce(r.time_taken_seconds,9999)<=15)
      then 1 else 0 end,
    case when r.is_correct then 'developing' else 'weak' end,
    'insufficient','pie-lo-v1',1
  )
  on conflict(user_id,lo_id) do update set
    exposure_count=pie.learner_lo_state.exposure_count+1,
    correct_count=pie.learner_lo_state.correct_count+case when r.is_correct then 1 else 0 end,
    mastery_mean=(
      pie.learner_lo_state.mastery_mean*pie.learner_lo_state.exposure_count+
      case when r.is_correct then 1 else 0 end
    )/(pie.learner_lo_state.exposure_count+1),
    mastery_sd=greatest(.05,1/sqrt(pie.learner_lo_state.exposure_count+1)),
    uncertainty=greatest(.05,1/sqrt(pie.learner_lo_state.exposure_count+1)),
    miss_count=pie.learner_lo_state.miss_count+case when r.is_correct then 0 else 1 end,
    miss_streak=case when r.is_correct then 0 else pie.learner_lo_state.miss_streak+1 end,
    last_miss_at=case when r.is_correct then pie.learner_lo_state.last_miss_at else r.created_at end,
    last_seen_at=r.created_at,
    answer_changes=pie.learner_lo_state.answer_changes+v_changes,
    confidence_mean=case
      when r.confidence_level is null then pie.learner_lo_state.confidence_mean
      else coalesce(
        (pie.learner_lo_state.confidence_mean*pie.learner_lo_state.confidence_count+
         r.confidence_level)/(pie.learner_lo_state.confidence_count+1),
        r.confidence_level)
    end,
    confidence_count=pie.learner_lo_state.confidence_count+
      case when r.confidence_level is null then 0 else 1 end,
    confident_wrong=pie.learner_lo_state.confident_wrong+
      case when not r.is_correct and coalesce(r.confidence_level,0)>=4 then 1 else 0 end,
    fragile_correct=pie.learner_lo_state.fragile_correct+
      case when r.is_correct and
        (coalesce(r.confidence_level,3)<=2 or coalesce(r.time_taken_seconds,9999)<=15)
        then 1 else 0 end,
    mastery_lcb=greatest(
      0,
      (
        (pie.learner_lo_state.mastery_mean*pie.learner_lo_state.exposure_count+
         case when r.is_correct then 1 else 0 end)/
        (pie.learner_lo_state.exposure_count+1)
      )-1.96*greatest(.05,1/sqrt(pie.learner_lo_state.exposure_count+1))
    ),
    status=case when not r.is_correct then 'weak' else 'developing' end,
    evidence_maturity=case
      when pie.learner_lo_state.exposure_count+1<3 then 'insufficient'
      when pie.learner_lo_state.exposure_count+1<8 then 'preliminary'
      when pie.learner_lo_state.exposure_count+1<20 then 'developing'
      when pie.learner_lo_state.exposure_count+1<40 then 'initial_individual'
      else 'established'
    end,
    state_version=pie.learner_lo_state.state_version+1,
    updated_at=now();

  n:=n+1;
 end loop;

 return n;
end $$;
