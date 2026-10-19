-- Admin-only, preview-first PIE beta reset controls.
-- Deliberately not applied to any database by this change.
-- Preserves accounts, question content/mappings, LO taxonomy, model/configuration,
-- intervention catalog, security controls, and protected P12 inference contracts.

create table if not exists pie.beta_reset_audit (
  id bigserial primary key,
  actor_id uuid not null,
  actor_email text not null,
  reset_mode text not null check (reset_mode in ('pie_only', 'full_candidate')),
  deleted_counts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table pie.beta_reset_audit enable row level security;
revoke all on pie.beta_reset_audit from anon, authenticated;

-- The old question-retirement backup is not an application-facing table.
-- Keep it unavailable to anon/authenticated; service_role retains its bypass.
alter table public.question_retirement_backup_20261014 enable row level security;
revoke all on public.question_retirement_backup_20261014 from anon, authenticated;

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
begin
  if p_mode not in ('pie_only', 'full_candidate') then
    raise exception 'Unsupported reset mode';
  end if;

  for r in
    select * from (values
      ('pie','pie_observation','pie_only'),
      ('pie','decision_trace','pie_only'),
      ('pie','inference_shadow','pie_only'),
      ('pie','inference_projection','pie_only'),
      ('pie','inference_state','pie_only'),
      ('pie','pie_candidate_state','pie_only'),
      ('pie','learner_lo_state','pie_only'),
      ('pie','lo_focus','pie_only'),
      ('pie','lo_misconception_state','pie_only'),
      ('pie','adaptive_policy_shadow','pie_only'),
      ('pie','beta_serving_gate','pie_only'),
      ('pie','pie_inference_run','pie_only'),
      ('pie','pie_exam_readiness','pie_only'),
      ('pie','pie_dynamic_observation','pie_only'),
      ('pie','pie_dynamic_state','pie_only'),
      ('pie','pie_exam_adapter_snapshot','pie_only'),
      ('pie','pie_exam_environment','pie_only'),
      ('pie','pie_hypothesis','pie_only'),
      ('pie','pie_identifiability','pie_only'),
      ('pie','pie_intervention_causal_evidence','pie_only'),
      ('pie','pie_intervention_effect_estimate','pie_only'),
      ('pie','pie_intervention_outcome','pie_only'),
      ('pie','pie_legacy_compatibility','pie_only'),
      ('pie','pie_question_state','pie_only'),
      ('pie','pie_question_uncertainty','pie_only'),
      ('pie','pie_runtime_decision','pie_only'),
      ('pie','pie_runtime_gate','pie_only'),
      ('pie','pie_shadow_run','pie_only'),
      ('pie','pie_state_uncertainty','pie_only'),
      ('pie','pie_validation_claim','pie_only'),
      ('pie','pie_validation_metric','pie_only'),
      ('pie','pie_validation_run','pie_only'),
      ('intelligence','behavior_events','pie_only'),
      ('intelligence','behavior_dna','pie_only'),
      ('intelligence','confidence_intelligence','pie_only'),
      ('intelligence','candidate_interventions','pie_only'),
      ('intelligence','intervention_outcomes','pie_only'),
      ('intelligence','intervention_effectiveness','pie_only'),
      ('intelligence','next_best_actions','pie_only'),
      ('intelligence','readiness_dna','pie_only'),
      ('intelligence','subject_dna','pie_only'),
      ('public','user_attempts','full_candidate'),
      ('public','practice_session_questions','full_candidate'),
      ('public','practice_sessions','full_candidate')
    ) as x(schema_name, table_name, min_mode)
    where p_mode = 'full_candidate' or min_mode = 'pie_only'
  loop
    if to_regclass(format('%I.%I', r.schema_name, r.table_name)) is not null then
      execute format('select count(*) from %I.%I', r.schema_name, r.table_name) into n;
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
declare
  counts jsonb;
begin
  if auth.uid() is null
     or not coalesce(public.is_admin(auth.jwt() ->> 'email'), false) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  counts := public._admin_beta_reset_counts(p_mode);
  return jsonb_build_object(
    'mode', p_mode,
    'counts', counts,
    'total_rows', (select coalesce(sum(value::text::bigint), 0) from jsonb_each(counts)),
    'preview_token', md5(p_mode || ':' || counts::text),
    'confirmation_phrase', case when p_mode = 'pie_only' then 'RESET PIE BETA DATA' else 'RESET ALL CANDIDATE DATA' end,
    'warning', case when p_mode = 'pie_only'
      then 'Clears PIE-derived candidate evidence and intelligence telemetry; preserves canonical MCQ attempts and practice sessions.'
      else 'Clears PIE-derived evidence, canonical MCQ attempts, session membership, and practice sessions for all candidates. Accounts and question content remain.'
    end
  );
end;
$$;

create or replace function public.admin_execute_pie_beta_reset(
  p_mode text,
  p_confirmation text,
  p_preview_token text
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
begin
  if auth.uid() is null
     or not coalesce(public.is_admin(auth.jwt() ->> 'email'), false) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_mode not in ('pie_only', 'full_candidate') then
    raise exception 'Unsupported reset mode';
  end if;

  counts := public._admin_beta_reset_counts(p_mode);
  if md5(p_mode || ':' || counts::text) <> p_preview_token then
    raise exception 'Data changed since preview. Run preview again.';
  end if;
  expected_phrase := case when p_mode = 'pie_only' then 'RESET PIE BETA DATA' else 'RESET ALL CANDIDATE DATA' end;
  if p_confirmation is distinct from expected_phrase then
    raise exception 'Confirmation phrase does not match';
  end if;

  -- Child/telemetry rows first. Any unexpected FK dependency aborts the whole transaction.
  for r in
    select * from (values
      ('pie','pie_observation','pie_only'),
      ('pie','decision_trace','pie_only'),
      ('pie','inference_shadow','pie_only'),
      ('pie','inference_projection','pie_only'),
      ('pie','inference_state','pie_only'),
      ('pie','pie_dynamic_observation','pie_only'),
      ('pie','pie_intervention_outcome','pie_only'),
      ('pie','pie_intervention_effect_estimate','pie_only'),
      ('pie','pie_intervention_causal_evidence','pie_only'),
      ('pie','pie_validation_metric','pie_only'),
      ('pie','pie_validation_claim','pie_only'),
      ('pie','pie_validation_run','pie_only'),
      ('pie','pie_dwig_outcome','pie_only'),
      ('pie','pie_dwig_evaluation','pie_only'),
      ('pie','pie_dwig_selection','pie_only'),
      ('pie','pie_dwig_candidate','pie_only'),
      ('pie','pie_decision_outcome','pie_only'),
      ('pie','pie_decision_candidate','pie_only'),
      ('pie','pie_decision','pie_only'),
      ('pie','pie_exam_readiness','pie_only'),
      ('pie','pie_exam_adapter_snapshot','pie_only'),
      ('pie','pie_exam_environment','pie_only'),
      ('pie','pie_hypothesis','pie_only'),
      ('pie','pie_identifiability','pie_only'),
      ('pie','pie_legacy_compatibility','pie_only'),
      ('pie','pie_question_state','pie_only'),
      ('pie','pie_question_uncertainty','pie_only'),
      ('pie','pie_runtime_decision','pie_only'),
      ('pie','pie_runtime_gate','pie_only'),
      ('pie','pie_shadow_run','pie_only'),
      ('pie','pie_state_uncertainty','pie_only'),
      ('pie','pie_dynamic_state','pie_only'),
      ('pie','pie_inference_run','pie_only'),
      ('pie','adaptive_policy_shadow','pie_only'),
      ('pie','beta_serving_gate','pie_only'),
      ('pie','lo_focus','pie_only'),
      ('pie','lo_misconception_state','pie_only'),
      ('pie','learner_lo_state','pie_only'),
      ('pie','pie_candidate_state','pie_only'),
      ('intelligence','intervention_outcomes','pie_only'),
      ('intelligence','intervention_effectiveness','pie_only'),
      ('intelligence','candidate_interventions','pie_only'),
      ('intelligence','next_best_actions','pie_only'),
      ('intelligence','behavior_dna','pie_only'),
      ('intelligence','confidence_intelligence','pie_only'),
      ('intelligence','readiness_dna','pie_only'),
      ('intelligence','subject_dna','pie_only'),
      ('intelligence','behavior_events','pie_only'),
      ('public','user_attempts','full_candidate'),
      ('public','practice_session_questions','full_candidate'),
      ('public','practice_sessions','full_candidate')
    ) as x(schema_name, table_name, min_mode)
    where p_mode = 'full_candidate' or min_mode = 'pie_only'
  loop
    if to_regclass(format('%I.%I', r.schema_name, r.table_name)) is not null then
      execute format('delete from %I.%I', r.schema_name, r.table_name);
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
