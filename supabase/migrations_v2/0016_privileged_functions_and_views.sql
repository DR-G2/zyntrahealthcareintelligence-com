-- Zyntra V2 Phase 5 / privileged functions and safe learner views

create or replace function command.is_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = command, public, pg_temp
as $$
  select exists (
    select 1 from command.admin_roles ar
    where ar.user_id = coalesce(p_user_id,auth.uid())
      and ar.active = true
  );
$$;

revoke all on function command.is_admin(uuid) from public;
grant execute on function command.is_admin(uuid) to authenticated;

create or replace function command.write_audit(
  p_action text,
  p_target_type text default null,
  p_target_id text default null,
  p_reason text default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_correlation_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = command, public, pg_temp
as $$
declare
  v_id uuid;
  v_role text;
begin
  if not command.is_admin(auth.uid()) then
    raise exception 'admin authorization required';
  end if;

  select role into v_role
  from command.admin_roles
  where user_id = auth.uid() and active = true
  order by created_at desc limit 1;

  insert into command.admin_activity_logs(
    actor_user_id,actor_role,action,target_type,target_id,reason,
    before_snapshot,after_snapshot,correlation_id
  )
  values(
    auth.uid(),coalesce(v_role,'unknown'),p_action,p_target_type,p_target_id,
    p_reason,p_before,p_after,p_correlation_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function command.write_audit(text,text,text,text,jsonb,jsonb,uuid) from public;
grant execute on function command.write_audit(text,text,text,text,jsonb,jsonb,uuid) to authenticated;

create or replace view public.my_readiness as
select user_id, readiness_score, readiness_band, dimensions, model_version, calculated_at
from intelligence.readiness_dna
where user_id = auth.uid();

create or replace view public.my_behavior_dna as
select user_id, archetype, rush_index, hesitation_index, fatigue_index,
       stability_metrics, model_version, calculated_at
from intelligence.behavior_dna
where user_id = auth.uid();

create or replace view public.my_subject_dna as
select user_id, subject_id, accuracy, timing_profile, confidence_profile,
       dimensions, model_version, calculated_at
from intelligence.subject_dna
where user_id = auth.uid();

create or replace view public.my_confidence_intelligence as
select user_id, evidence_window, calibration_score,
       overconfidence_score, underconfidence_score, stability_score,
       dimensions, model_version, calculated_at
from intelligence.confidence_intelligence
where user_id = auth.uid();

create or replace view public.my_next_best_actions as
select user_id, action_type, action_data, priority, expires_at, created_at, updated_at
from intelligence.next_best_actions
where user_id = auth.uid();

grant select on public.my_readiness to authenticated;
grant select on public.my_behavior_dna to authenticated;
grant select on public.my_subject_dna to authenticated;
grant select on public.my_confidence_intelligence to authenticated;
grant select on public.my_next_best_actions to authenticated;
