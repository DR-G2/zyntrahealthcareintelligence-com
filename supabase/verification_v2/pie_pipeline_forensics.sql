-- READ-ONLY forensics for the V2 PIE pipeline (project hkowvjazuwebmibssdut).
-- Run in the Supabase SQL editor BEFORE and AFTER applying migrations_v2/0044_pie_candidate_state_pipeline_repair.sql.
-- Nothing here writes data.

-- 1. Function definitions, SECURITY DEFINER, search_path and EXECUTE grants
select p.oid::regprocedure as function,
       pg_get_function_result(p.oid) as returns,
       p.prosecdef as security_definer,
       p.proconfig as config,
       pg_get_userbyid(p.proowner) as owner,
       array(select r.rolname from pg_roles r
             where r.rolname in ('anon','authenticated','service_role')
               and has_function_privilege(r.oid, p.oid, 'EXECUTE')) as execute_roles
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where (n.nspname, p.proname) in (('pie','rebuild_candidate_state'), ('public','rebuild_candidate_state'),
                                 ('public','get_my_pie_state'), ('public','save_attempt'),
                                 ('public','refresh_candidate_intelligence'), ('pie','record_observation'));

-- 2. Full bodies (compare against migrations_v2 to detect drift)
select p.oid::regprocedure, pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where (n.nspname, p.proname) in (('pie','rebuild_candidate_state'), ('public','rebuild_candidate_state'), ('public','get_my_pie_state'));

-- 3. View definition and options
select c.oid::regclass, c.reloptions, pg_get_viewdef(c.oid, true)
from pg_class c where c.oid = 'public.my_pie_state'::regclass;

-- 4. RLS + learner table privileges on internal PIE tables (expected: RLS on, no learner grants)
select c.oid::regclass as table, c.relrowsecurity as rls, c.relforcerowsecurity as force_rls,
       array(select r.rolname || ':' || pr from pg_roles r, unnest(array['SELECT','INSERT','UPDATE','DELETE']) pr
             where r.rolname in ('anon','authenticated') and has_table_privilege(r.oid, c.oid, pr)) as learner_privileges
from pg_class c
where c.oid in ('pie.pie_observation'::regclass, 'pie.pie_candidate_state'::regclass,
                'pie.pie_model_version'::regclass, 'pie.pie_inference_run'::regclass);
select schemaname, tablename, policyname, roles, cmd, qual from pg_policies
where schemaname = 'pie' and tablename in ('pie_observation','pie_candidate_state');

-- 5. Constraints that broke the rebuild (status CHECKs, UNIQUE(user_id))
select conrelid::regclass, conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid in ('pie.pie_model_version'::regclass, 'pie.pie_inference_run'::regclass, 'pie.pie_candidate_state'::regclass)
  and contype in ('c','u');

-- 6. Schema exposure / usage
select n.nspname, has_schema_privilege('authenticated', n.oid, 'USAGE') as authenticated_usage,
       has_schema_privilege('anon', n.oid, 'USAGE') as anon_usage
from pg_namespace n where n.nspname in ('public','pie');

-- 7. Pipeline volumes
select (select count(*) from public.user_attempts)                         as v2_attempts,
       (select count(*) from pie.pie_observation)                          as observations,
       (select count(distinct user_id) from pie.pie_observation)           as users_with_observations,
       (select count(*) from pie.pie_candidate_state)                      as candidate_states,
       (select count(*) from pie.pie_inference_run)                        as inference_runs,
       (select count(*) from pie.pie_model_version where model_key = 'candidate-state') as model_versions;

-- 8. Attempts without observations (save_attempt swallows observation errors)
select count(*) as attempts_missing_observation
from public.user_attempts a
where not exists (select 1 from pie.pie_observation o where o.attempt_id = a.id);

-- 9. State shape (latest 20)
select user_id, state_version, confidence, calculated_at, updated_at,
       state->>'evidence_level' as evidence_level, (state->>'evidence_count')::int as evidence_count,
       state->'capability'->>'estimate' as capability, source_inference_id
from pie.pie_candidate_state order by updated_at desc limit 20;
