-- 0049: Ruling (7 Oct 2026): readiness is exam-specific and belongs to the AMC plugin.
-- Move the learner readiness/exam tables out of core pie.* into amc.* (0 rows live per
-- baseline; RLS, policies, indexes and FKs move with the tables). Core pie keeps no
-- exam concepts. Erasure (0048) is extended to per-learner amc.* tables.
alter table if exists pie.pie_exam_readiness set schema amc;
alter table if exists amc.pie_exam_readiness rename to amc_learner_readiness;
alter table if exists pie.pie_exam_environment set schema amc;
alter table if exists amc.pie_exam_environment rename to amc_learner_exam_environment;
alter table if exists pie.pie_exam_adapter_snapshot set schema amc;
alter table if exists amc.pie_exam_adapter_snapshot rename to amc_learner_adapter_snapshot;

comment on table amc.amc_learner_readiness is 'AMC plugin: learner readiness (moved from pie.pie_exam_readiness in 0049).';
comment on table amc.amc_learner_exam_environment is 'AMC plugin: learner exam environment (moved from pie.pie_exam_environment in 0049).';
comment on table amc.amc_learner_adapter_snapshot is 'AMC plugin: adapter snapshot (moved from pie.pie_exam_adapter_snapshot in 0049).';

revoke all on amc.amc_learner_readiness, amc.amc_learner_exam_environment, amc.amc_learner_adapter_snapshot from public, anon, authenticated;
grant select, insert, update, delete on amc.amc_learner_readiness, amc.amc_learner_exam_environment, amc.amc_learner_adapter_snapshot to service_role;

create or replace function public.erase_my_learning_data(p_confirm text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_counts jsonb := '{}'::jsonb;
  v_n bigint;
  t record;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_confirm is distinct from 'ERASE_MY_LEARNING_DATA' then
    raise exception 'confirmation phrase required' using errcode = '22023';
  end if;

  perform set_config('pie.erase_user', v_uid::text, true);

  -- Derived state first (cleared, not rebuilt: no evidence remains).
  delete from pie.learner_lo_state where user_id = v_uid; get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('pie.learner_lo_state', v_n);
  delete from pie.lo_state_refresh where user_id = v_uid;
  delete from pie.pie_candidate_state where user_id = v_uid; get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('pie.pie_candidate_state', v_n);
  delete from pie.pie_inference_run where user_id = v_uid; get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('pie.pie_inference_run', v_n);
  delete from pie.pie_observation where user_id = v_uid; get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('pie.pie_observation', v_n);
  -- Other per-learner derived intelligence tables (any table with a user_id column).
  for t in
    select c.table_schema, c.table_name from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
    where c.table_schema in ('intelligence','amc') and c.column_name = 'user_id'
    order by c.table_name
  loop
    execute format('delete from %I.%I where user_id = $1', t.table_schema, t.table_name) using v_uid;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object(t.table_schema || '.' || t.table_name, v_n);
  end loop;
  -- Raw evidence.
  delete from public.user_attempts where user_id = v_uid; get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('public.user_attempts', v_n);
  delete from public.practice_session_questions psq using public.practice_sessions ps
    where ps.id = psq.session_id and ps.user_id = v_uid;
  delete from public.practice_sessions where user_id = v_uid; get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('public.practice_sessions', v_n);

  perform set_config('pie.erase_user', '', true);

  insert into pie.learning_data_erasure_audit(user_id, actor_role, scope, counts)
  values (v_uid, coalesce(auth.role(), ''), 'learning_data', v_counts);
  return v_counts;
end $$;
revoke all on function public.erase_my_learning_data(text) from public, anon;
grant execute on function public.erase_my_learning_data(text) to authenticated, service_role;
