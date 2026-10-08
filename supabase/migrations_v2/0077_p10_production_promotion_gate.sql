create table if not exists pie.production_gate (
 gate_key text primary key,
 status text not null check(status in ('pass','fail','blocked')),
 checked_at timestamptz not null default now(),
 evidence jsonb not null default '{}'::jsonb
);
revoke all on pie.production_gate from public,anon,authenticated;

create or replace function pie.run_p10_production_gate()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_active_models integer; v_raw_grants integer; v_learner_fn boolean; v_save_definer boolean; v_shadow_serving boolean; v_result jsonb;
begin
 select count(*) into v_active_models from pie.pie_model_version where status='active';
 select count(*) into v_raw_grants from information_schema.role_table_grants where table_schema='pie' and table_name in ('pie_observation','learner_lo_state','adaptive_policy_shadow','inference_shadow','decision_trace') and grantee in ('anon','authenticated') and privilege_type='SELECT';
 select exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_my_pie_state') into v_learner_fn;
 select p.prosecdef into v_save_definer from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='save_attempt' limit 1;
 select exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='pie_shadow_run') into v_shadow_serving;
 v_result:=jsonb_build_object('active_model_count',v_active_models,'raw_pie_select_grants',v_raw_grants,'learner_safe_state_endpoint',v_learner_fn,'server_authoritative_save_attempt',coalesce(v_save_definer,false),'retired_shadow_serving_function_present',v_shadow_serving,'production_boundary',v_active_models=1 and v_raw_grants=0 and v_learner_fn and coalesce(v_save_definer,false) and not v_shadow_serving);
 insert into pie.production_gate(gate_key,status,evidence) values('P10_PRODUCTION_BOUNDARY',case when (v_active_models=1 and v_raw_grants=0 and v_learner_fn and coalesce(v_save_definer,false) and not v_shadow_serving) then 'pass' else 'fail' end,v_result)
 on conflict(gate_key) do update set status=excluded.status,checked_at=now(),evidence=excluded.evidence;
 return v_result;
end $$;
revoke all on function pie.run_p10_production_gate() from public,anon,authenticated;
