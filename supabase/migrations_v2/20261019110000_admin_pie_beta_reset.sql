-- Admin-only, preview-first, synthetic-candidate-scoped PIE beta reset.
-- Fail closed unless public.profiles.is_synthetic exists. Never clear real-candidate rows.
-- Deliberately not applied to any database by this change.

create table if not exists pie.beta_reset_audit (
  id bigserial primary key,
  actor_id uuid not null,
  actor_email text not null,
  reset_mode text not null check (reset_mode in ('pie_only', 'full_candidate')),
  deleted_counts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table pie.beta_reset_audit enable row level security;
revoke all on pie.beta_reset_audit from public, anon, authenticated;

-- Preview/count and execution share one allowlist. Every target is scoped to profiles.is_synthetic.
-- scope_kind special cases exist only for child tables without their own user_id.
create or replace function public._admin_beta_reset_counts(p_mode text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pie, intelligence
as $$
declare
  r record;
  n bigint;
  result jsonb := '{}'::jsonb;
  predicate text;
begin
  if p_mode not in ('pie_only', 'full_candidate') then
    raise exception 'Unsupported reset mode';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_synthetic'
  ) then
    raise exception 'Reset blocked: public.profiles.is_synthetic is missing; cannot prove production-candidate exclusion.';
  end if;
  if not exists (select 1 from public.profiles where is_synthetic is true) then
    raise exception 'Reset blocked: no explicitly marked synthetic candidates exist.';
  end if;

  for r in
    select * from (values
      ('pie','pie_observation','user_id','pie_only'),
      ('pie','attempt_lo','attempt_user','pie_only'),
      ('pie','decision_trace','user_id','pie_only'),
      ('pie','inference_shadow','user_id','pie_only'),
      ('pie','inference_projection','user_id','pie_only'),
      ('pie','inference_state','user_id','pie_only'),
      ('pie','pie_candidate_state','user_id','pie_only'),
      ('pie','learner_lo_state','user_id','pie_only'),
      ('pie','lo_focus','user_id','pie_only'),
      ('pie','lo_misconception_state','user_id','pie_only'),
      ('pie','adaptive_policy_shadow','user_id','pie_only'),
      ('pie','beta_serving_gate','user_id','pie_only'),
      ('pie','pie_inference_run','user_id','pie_only'),
      ('pie','pie_exam_readiness','user_id','pie_only'),
      ('pie','pie_dynamic_observation','user_id','pie_only'),
      ('pie','pie_dynamic_state','user_id','pie_only'),
      ('pie','pie_exam_adapter_snapshot','user_id','pie_only'),
      ('pie','pie_exam_environment','user_id','pie_only'),
      ('pie','pie_hypothesis','user_id','pie_only'),
      ('pie','pie_identifiability','user_id','pie_only'),
      ('pie','pie_intervention_outcome','user_id','pie_only'),
      ('pie','pie_dwig_candidate','user_id','pie_only'),
      ('pie','pie_decision','user_id','pie_only'),
      ('pie','pie_decision_candidate','user_id','pie_only'),
      ('pie','pie_legacy_compatibility','user_id','pie_only'),
      ('pie','pie_question_state','user_id','pie_only'),
      ('pie','pie_question_uncertainty','user_id','pie_only'),
      ('pie','pie_runtime_decision','user_id','pie_only'),
      ('pie','pie_runtime_gate','user_id','pie_only'),
      ('pie','pie_shadow_run','user_id','pie_only'),
      ('pie','pie_state_uncertainty','user_id','pie_only'),
      ('intelligence','behavior_events','user_id','pie_only'),
      ('intelligence','behavior_dna','user_id','pie_only'),
      ('intelligence','confidence_intelligence','user_id','pie_only'),
      ('intelligence','candidate_interventions','user_id','pie_only'),
      ('intelligence','intervention_outcomes','intervention_user','pie_only'),
      ('intelligence','next_best_actions','user_id','pie_only'),
      ('intelligence','readiness_dna','user_id','pie_only'),
      ('intelligence','subject_dna','user_id','pie_only'),
      ('public','user_attempts','user_id','full_candidate'),
      ('public','practice_session_questions','session_user','full_candidate'),
      ('public','practice_sessions','user_id','full_candidate')
    ) as x(schema_name, table_name, scope_kind, min_mode)
    where p_mode = 'full_candidate' or min_mode = 'pie_only'
  loop
    if to_regclass(format('%I.%I', r.schema_name, r.table_name)) is not null then
      predicate := case r.scope_kind
        when 'user_id' then 't.user_id in (select p.id from public.profiles p where p.is_synthetic is true)'
        when 'attempt_user' then 'exists (select 1 from public.user_attempts ua join public.profiles p on p.id = ua.user_id where ua.id = t.attempt_id and p.is_synthetic is true)'
        when 'session_user' then 'exists (select 1 from public.practice_sessions ps join public.profiles p on p.id = ps.user_id where ps.id = t.session_id and p.is_synthetic is true)'
        when 'intervention_user' then 'exists (select 1 from intelligence.candidate_interventions ci join public.profiles p on p.id = ci.user_id where ci.id = t.candidate_intervention_id and p.is_synthetic is true)'
        else null
      end;
      if predicate is null then raise exception 'No safe scope predicate for %.%', r.schema_name, r.table_name; end if;
      execute format('select count(*) from %I.%I t where %s', r.schema_name, r.table_name, predicate) into n;
      result := result || jsonb_build_object(r.schema_name || '.' || r.table_name, n);
    end if;
  end loop;
  return result;
end;
$$;

create or replace function public.admin_preview_pie_beta_reset(p_mode text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pie, intelligence
as $$
declare counts jsonb;
begin
  if auth.uid() is null or not coalesce(public.is_admin(auth.jwt() ->> 'email'), false) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  counts := public._admin_beta_reset_counts(p_mode);
  return jsonb_build_object(
    'mode', p_mode,
    'counts', counts,
    'total_rows', (select coalesce(sum(value::text::bigint), 0) from jsonb_each(counts)),
    'preview_token', md5(p_mode || ':' || counts::text),
    'confirmation_phrase', case when p_mode = 'pie_only' then 'RESET PIE BETA DATA' else 'RESET ALL CANDIDATE DATA' end,
    'warning', 'Only rows belonging to explicitly marked synthetic candidates are eligible. Real candidate records, accounts, questions, LO mappings, model configuration and global certification evidence are excluded.'
  );
end;
$$;

create or replace function public.admin_execute_pie_beta_reset(
  p_mode text, p_confirmation text, p_preview_token text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pie, intelligence
as $$
declare
  counts jsonb;
  expected_phrase text;
  r record;
  deleted bigint;
  actual jsonb := '{}'::jsonb;
  predicate text;
begin
  if auth.uid() is null or not coalesce(public.is_admin(auth.jwt() ->> 'email'), false) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  counts := public._admin_beta_reset_counts(p_mode);
  if md5(p_mode || ':' || counts::text) <> p_preview_token then
    raise exception 'Data changed since preview. Run preview again.';
  end if;
  expected_phrase := case when p_mode = 'pie_only' then 'RESET PIE BETA DATA' else 'RESET ALL CANDIDATE DATA' end;
  if p_confirmation is distinct from expected_phrase then raise exception 'Confirmation phrase does not match'; end if;

  -- Child rows first. Unknown FK dependencies abort the whole transaction.
  for r in
    select * from (values
      ('pie','pie_observation','user_id','pie_only'),
      ('pie','attempt_lo','attempt_user','pie_only'),
      ('pie','decision_trace','user_id','pie_only'),
      ('pie','inference_shadow','user_id','pie_only'),
      ('pie','inference_projection','user_id','pie_only'),
      ('pie','inference_state','user_id','pie_only'),
      ('pie','pie_dynamic_observation','user_id','pie_only'),
      ('pie','pie_intervention_outcome','user_id','pie_only'),
      ('pie','pie_hypothesis','user_id','pie_only'),
      ('pie','pie_identifiability','user_id','pie_only'),
      ('pie','pie_question_state','user_id','pie_only'),
      ('pie','pie_question_uncertainty','user_id','pie_only'),
      ('pie','pie_runtime_decision','user_id','pie_only'),
      ('pie','pie_runtime_gate','user_id','pie_only'),
      ('pie','pie_state_uncertainty','user_id','pie_only'),
      ('pie','pie_shadow_run','user_id','pie_only'),
      ('pie','pie_exam_adapter_snapshot','user_id','pie_only'),
      ('pie','pie_exam_readiness','user_id','pie_only'),
      ('pie','pie_dynamic_state','user_id','pie_only'),
      ('pie','pie_legacy_compatibility','user_id','pie_only'),
      ('pie','pie_decision_candidate','user_id','pie_only'),
      ('pie','pie_decision','user_id','pie_only'),
      ('pie','pie_dwig_candidate','user_id','pie_only'),
      ('pie','pie_candidate_state','user_id','pie_only'),
      ('pie','pie_inference_run','user_id','pie_only'),
      ('pie','lo_misconception_state','user_id','pie_only'),
      ('pie','lo_focus','user_id','pie_only'),
      ('pie','learner_lo_state','user_id','pie_only'),
      ('pie','adaptive_policy_shadow','user_id','pie_only'),
      ('pie','beta_serving_gate','user_id','pie_only'),
      ('pie','pie_exam_environment','user_id','pie_only'),
      ('intelligence','intervention_outcomes','intervention_user','pie_only'),
      ('intelligence','candidate_interventions','user_id','pie_only'),
      ('intelligence','next_best_actions','user_id','pie_only'),
      ('intelligence','behavior_dna','user_id','pie_only'),
      ('intelligence','confidence_intelligence','user_id','pie_only'),
      ('intelligence','readiness_dna','user_id','pie_only'),
      ('intelligence','subject_dna','user_id','pie_only'),
      ('intelligence','behavior_events','user_id','pie_only'),
      ('public','user_attempts','user_id','full_candidate'),
      ('public','practice_session_questions','session_user','full_candidate'),
      ('public','practice_sessions','user_id','full_candidate')
    ) as x(schema_name, table_name, scope_kind, min_mode)
    where p_mode = 'full_candidate' or min_mode = 'pie_only'
  loop
    if to_regclass(format('%I.%I', r.schema_name, r.table_name)) is not null then
      predicate := case r.scope_kind
        when 'user_id' then 't.user_id in (select p.id from public.profiles p where p.is_synthetic is true)'
        when 'attempt_user' then 'exists (select 1 from public.user_attempts ua join public.profiles p on p.id = ua.user_id where ua.id = t.attempt_id and p.is_synthetic is true)'
        when 'session_user' then 'exists (select 1 from public.practice_sessions ps join public.profiles p on p.id = ps.user_id where ps.id = t.session_id and p.is_synthetic is true)'
        when 'intervention_user' then 'exists (select 1 from intelligence.candidate_interventions ci join public.profiles p on p.id = ci.user_id where ci.id = t.candidate_intervention_id and p.is_synthetic is true)'
        else null
      end;
      if predicate is null then raise exception 'No safe scope predicate for %.%', r.schema_name, r.table_name; end if;
      execute format('delete from %I.%I t where %s', r.schema_name, r.table_name, predicate);
      get diagnostics deleted = row_count;
      actual := actual || jsonb_build_object(r.schema_name || '.' || r.table_name, deleted);
    end if;
  end loop;

  insert into pie.beta_reset_audit(actor_id, actor_email, reset_mode, deleted_counts)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email','unknown'), p_mode, actual);
  return jsonb_build_object('success', true, 'mode', p_mode, 'deleted_counts', actual);
end;
$$;

revoke all on function public._admin_beta_reset_counts(text) from public, anon, authenticated;
revoke all on function public.admin_preview_pie_beta_reset(text) from public, anon;
revoke all on function public.admin_execute_pie_beta_reset(text,text,text) from public, anon;
grant execute on function public.admin_preview_pie_beta_reset(text) to authenticated;
grant execute on function public.admin_execute_pie_beta_reset(text,text,text) to authenticated;
