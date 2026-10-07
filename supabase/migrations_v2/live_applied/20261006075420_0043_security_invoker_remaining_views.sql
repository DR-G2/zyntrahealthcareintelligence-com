create or replace view public.clinical_stations_for_learner with (security_invoker=true) as
select id,zyntra_id,subject,scenario_title,candidate_instructions,scenario_data,reading_time_minutes,station_time_minutes,status,version
from public.clinical_stations where status='active';

create or replace view public.my_behavior_dna with (security_invoker=true) as
select user_id,archetype,rush_index,hesitation_index,fatigue_index,stability_metrics,model_version,calculated_at
from intelligence.behavior_dna where user_id=auth.uid();

create or replace view public.my_subject_dna with (security_invoker=true) as
select user_id,subject_id,accuracy,timing_profile,confidence_profile,dimensions,model_version,calculated_at
from intelligence.subject_dna where user_id=auth.uid();

create or replace view public.my_confidence_intelligence with (security_invoker=true) as
select user_id,evidence_window,calibration_score,overconfidence_score,underconfidence_score,stability_score,dimensions,model_version,calculated_at
from intelligence.confidence_intelligence where user_id=auth.uid();

create or replace view public.my_next_best_actions with (security_invoker=true) as
select user_id,action_type,action_data,priority,expires_at,created_at,updated_at
from intelligence.next_best_actions where user_id=auth.uid();

create or replace view public.questions_for_learner with (security_invoker=true) as
select id,zyntra_id,subject_id,subtopic_id,stem,options,explanation,difficulty_tier,status,version
from public.questions where status='active';