-- P8 authoritative inference promotion.
-- The inference layer is uncertainty-aware, versioned and sourced from
-- server-authoritative LO state. It does not make causal clinical claims.

create table if not exists pie.inference_state (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null,
 dimension text not null check (dimension in ('capability','decision','timing','calibration','sustained_performance','learning')),
 estimate numeric not null check (estimate >= 0 and estimate <= 1),
 uncertainty numeric not null check (uncertainty >= 0),
 lower_bound numeric not null check (lower_bound >= 0 and lower_bound <= 1),
 upper_bound numeric not null check (upper_bound >= 0 and upper_bound <= 1),
 evidence_count integer not null default 0,
 evidence_maturity text not null,
 signal_quality text not null,
 explanation jsonb not null default '{}'::jsonb,
 model_version text not null,
 source_state_version integer not null default 0,
 state_version integer not null default 1,
 calculated_at timestamptz not null default now(),
 unique(user_id,dimension)
);
revoke all on pie.inference_state from public,anon,authenticated;

insert into pie.pie_model_version(model_key,version,status,config)
values('advanced-inference','v2.0','active',jsonb_build_object(
 'method','bounded_bayesian_style_state_update',
 'dimensions',jsonb_build_array('capability','decision','timing','calibration','sustained_performance','learning'),
 'uncertainty_required',true,'source','learner_lo_state','causal_claims',false
))
on conflict(model_key,version) do update set status='active',config=excluded.config;

create or replace function pie.rebuild_authoritative_inference(p_user_id uuid)
returns integer language plpgsql security definer set search_path=''
as $$
declare v_state record; v_model text:='pie-inference-v2.0';
begin
 if auth.uid() is not null and auth.uid()<>p_user_id then raise exception 'user scope violation' using errcode='42501'; end if;
 select coalesce(avg(mastery_mean),0.5) capability,coalesce(avg(uncertainty),1) uncertainty,count(*)::integer evidence_count,
   coalesce(max(state_version),0) source_state_version,coalesce(avg(confidence_mean)/10,0.5) calibration,
   coalesce(1-(avg(median_time_seconds)/300),0.5) timing,
   coalesce(avg(case when miss_streak=0 then 1 else 0 end),0.5) sustained_performance,
   coalesce(avg(case when evidence_maturity in ('developing','initial_individual','established','robust') then 1 else 0 end),0.5) learning
 into v_state from pie.learner_lo_state where user_id=p_user_id;
 if v_state.evidence_count=0 then return 0; end if;
 delete from pie.inference_state where user_id=p_user_id;
 insert into pie.inference_state(user_id,dimension,estimate,uncertainty,lower_bound,upper_bound,evidence_count,evidence_maturity,signal_quality,explanation,model_version,source_state_version,state_version)
 select p_user_id,d,est,v_state.uncertainty,greatest(est-v_state.uncertainty,0),least(est+v_state.uncertainty,1),v_state.evidence_count,
   case when v_state.evidence_count<3 then 'insufficient' when v_state.evidence_count<10 then 'preliminary' when v_state.evidence_count<20 then 'developing' else 'established' end,
   case when v_state.evidence_count<3 then 'insufficient' else 'provisional' end,
   jsonb_build_object('derived_from','learner_lo_state','causal_claim',false,'authoritative',true),v_model,v_state.source_state_version,v_state.source_state_version
 from (values
   ('capability',v_state.capability),
   ('decision',greatest(0,least(1,(v_state.capability+v_state.sustained_performance)/2))),
   ('timing',greatest(0,least(1,v_state.timing))),
   ('calibration',greatest(0,least(1,v_state.calibration))),
   ('sustained_performance',greatest(0,least(1,v_state.sustained_performance))),
   ('learning',greatest(0,least(1,v_state.learning)))
 ) x(d,est);
 return 6;
end $$;

create or replace function public.rebuild_my_pie_inference()
returns integer language plpgsql security definer set search_path=''
as $$ begin if auth.uid() is null then raise exception 'not authenticated'; end if; return pie.rebuild_authoritative_inference(auth.uid()); end $$;
grant execute on function public.rebuild_my_pie_inference() to authenticated;

create or replace function public.get_my_pie_inference()
returns jsonb language plpgsql security definer set search_path=''
as $$ begin if auth.uid() is null then raise exception 'not authenticated'; end if; return coalesce((select jsonb_agg(to_jsonb(i) order by i.dimension) from pie.inference_state i where i.user_id=auth.uid()),'[]'::jsonb); end $$;
grant execute on function public.get_my_pie_inference() to authenticated;
