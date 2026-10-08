-- P10 scientific promotion gate.
create table if not exists public.amc_validation_run(
 id uuid primary key default gen_random_uuid(),plugin_version_id uuid not null references public.amc_plugin_version(id),
 dataset_id text not null,dataset_approved boolean not null default false,independent_calibration_complete boolean not null default false,
 holdout_complete boolean not null default false,external_review_complete boolean not null default false,candidate_count int not null default 0,
 holdout_count int not null default 0,spearman_theta numeric,brier numeric,auc numeric,ece numeric,log_loss numeric,
 criteria jsonb not null default '{}'::jsonb,gate_status text not null default 'BLOCKED' check(gate_status in('BLOCKED','ELIGIBLE','PROMOTED','REJECTED')),
 notes text,created_at timestamptz not null default now(),reviewed_at timestamptz);
create table if not exists public.amc_model_registry(
 id uuid primary key default gen_random_uuid(),plugin_version_id uuid not null references public.amc_plugin_version(id),
 model_version text not null,model_type text not null,calibration_run_id uuid references public.amc_validation_run(id),
 status text not null default 'SHADOW' check(status in('DRAFT','SHADOW','ACTIVE','RETIRED')),
 pass_probability_calibrated boolean not null default false,activated_at timestamptz,retired_at timestamptz,provenance jsonb not null default '{}'::jsonb,
 unique(plugin_version_id,model_version));
alter table public.amc_validation_run enable row level security; alter table public.amc_model_registry enable row level security;
revoke all on public.amc_validation_run,public.amc_model_registry from anon,authenticated; grant all on public.amc_validation_run,public.amc_model_registry to service_role;
create or replace function public.amc_evaluate_promotion_gate(p_validation_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r record; pass boolean; reasons jsonb:='[]'::jsonb;
begin select * into r from public.amc_validation_run where id=p_validation_id; if not found then raise exception 'validation run not found'; end if;
pass:=r.dataset_approved and r.independent_calibration_complete and r.holdout_complete and r.external_review_complete and r.candidate_count>=1000 and r.holdout_count>=200 and coalesce(r.spearman_theta,0)>=.75 and coalesce(r.brier,1)<=.18 and coalesce(r.auc,0)>=.75 and coalesce(r.ece,1)<=.05 and coalesce(r.log_loss,1)<=.60;
if not r.dataset_approved then reasons:=reasons||'["dataset_not_approved"]'::jsonb; end if;
if not r.independent_calibration_complete then reasons:=reasons||'["independent_calibration_incomplete"]'::jsonb; end if;
if not r.holdout_complete then reasons:=reasons||'["holdout_incomplete"]'::jsonb; end if;
if not r.external_review_complete then reasons:=reasons||'["external_review_incomplete"]'::jsonb; end if;
if r.candidate_count<1000 then reasons:=reasons||'["insufficient_candidates"]'::jsonb; end if;
if r.holdout_count<200 then reasons:=reasons||'["insufficient_holdout"]'::jsonb; end if;
if coalesce(r.spearman_theta,0)<.75 then reasons:=reasons||'["rank_recovery_below_threshold"]'::jsonb; end if;
if coalesce(r.brier,1)>.18 then reasons:=reasons||'["brier_above_threshold"]'::jsonb; end if;
if coalesce(r.auc,0)<.75 then reasons:=reasons||'["auc_below_threshold"]'::jsonb; end if;
if coalesce(r.ece,1)>.05 then reasons:=reasons||'["ece_above_threshold"]'::jsonb; end if;
if coalesce(r.log_loss,1)>.60 then reasons:=reasons||'["log_loss_above_threshold"]'::jsonb; end if;
update public.amc_validation_run set gate_status=case when pass then 'ELIGIBLE' else 'BLOCKED' end,reviewed_at=now() where id=p_validation_id;
return jsonb_build_object('eligible',pass,'reasons',reasons); end $$;
revoke all on function public.amc_evaluate_promotion_gate(uuid) from public,anon,authenticated; grant execute on function public.amc_evaluate_promotion_gate(uuid) to service_role;
create or replace function public.amc_promote_calibrated_model(p_validation_id uuid,p_model_version text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r record;p record;g jsonb;
begin select * into r from public.amc_validation_run where id=p_validation_id; if not found then raise exception 'validation run not found'; end if;
g:=public.amc_evaluate_promotion_gate(p_validation_id); if coalesce((g->>'eligible')::boolean,false) is not true then raise exception 'AMC model promotion blocked: %',g->'reasons'; end if;
select * into p from public.amc_plugin_version where id=r.plugin_version_id;
update public.amc_model_registry set status='RETIRED',pass_probability_calibrated=false,retired_at=now() where plugin_version_id=p.id and status='ACTIVE';
insert into public.amc_model_registry(plugin_version_id,model_version,model_type,calibration_run_id,status,pass_probability_calibrated,activated_at,provenance) values(p.id,p_model_version,'calibrated_amc_pass_probability',p_validation_id,'ACTIVE',true,now(),jsonb_build_object('validation_run',p_validation_id,'promotion_gate',g));
update public.amc_plugin_version set status='ACTIVE',assumptions=jsonb_set(assumptions,'{readiness_probability_status}','"CALIBRATED"'::jsonb,true) where id=p.id;
update public.amc_exam_environment_v1 set status='ACTIVE',target_definition=jsonb_set(target_definition,'{pass_probability_calibrated}','true'::jsonb,true) where plugin_version_id=p.id;
update public.amc_validation_run set gate_status='PROMOTED',reviewed_at=now() where id=p_validation_id;
return jsonb_build_object('promoted',true,'modelVersion',p_model_version,'plugin','AMC'); end $$;
revoke all on function public.amc_promote_calibrated_model(uuid,text) from public,anon,authenticated; grant execute on function public.amc_promote_calibrated_model(uuid,text) to service_role;
