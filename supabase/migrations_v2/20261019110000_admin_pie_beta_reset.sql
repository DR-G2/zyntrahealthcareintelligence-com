-- Admin-only, preview-first, synthetic-candidate-scoped PIE beta reset.
-- Fail closed unless public.profiles.is_synthetic is a BOOLEAN and synthetic candidates exist.
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

-- One source of truth for both preview and execution. Global question state,
-- runtime gates, compatibility mappings, LO taxonomy and model configuration
-- are intentionally excluded.
create or replace function public._admin_beta_reset_targets()
returns table (
  sort_order integer,
  schema_name text,
  table_name text,
  scope_kind text,
  min_mode text
)
language sql
immutable
set search_path = pg_catalog
as $$
  select * from (values
    (10,  'pie',          'pie_observation',             'user_id',             'pie_only'),
    (20,  'pie',          'attempt_lo',                  'attempt_user',        'pie_only'),
    (30,  'pie',          'decision_trace',              'user_id',             'pie_only'),
    (40,  'pie',          'inference_shadow',            'user_id',             'pie_only'),
    (50,  'pie',          'inference_projection',        'user_id',             'pie_only'),
    (60,  'pie',          'inference_state',             'user_id',             'pie_only'),
    (70,  'pie',          'pie_dynamic_observation',     'user_id',             'pie_only'),
    (80,  'pie',          'pie_intervention_outcome',    'user_id',             'pie_only'),
    (90,  'pie',          'pie_hypothesis',              'user_id',             'pie_only'),
    (100, 'pie',          'pie_identifiability',         'user_id',             'pie_only'),
    (110, 'pie',          'pie_runtime_decision',        'user_id',             'pie_only'),
    (120, 'pie',          'pie_state_uncertainty',       'candidate_state',     'pie_only'),
    (130, 'pie',          'pie_shadow_run',              'user_id',             'pie_only'),
    (140, 'pie',          'pie_exam_adapter_snapshot',   'user_id',             'pie_only'),
    (150, 'pie',          'pie_exam_readiness',          'user_id',             'pie_only'),
    (160, 'pie',          'pie_dynamic_state',           'user_id',             'pie_only'),
    (170, 'pie',          'pie_decision_outcome',        'decision_parent',     'pie_only'),
    (180, 'pie',          'pie_decision',                'decision_candidate',  'pie_only'),
    (190, 'pie',          'pie_dwig_evaluation',         'dwig_candidate',      'pie_only'),
    (200, 'pie',          'pie_dwig_selection',          'dwig_candidate',      'pie_only'),
    (210, 'intelligence', 'intervention_outcomes',       'intervention_user',   'pie_only'),
    (220, 'intelligence', 'candidate_interventions',     'user_id',             'pie_only'),
    (230, 'intelligence', 'next_best_actions',           'user_id',             'pie_only'),
    (240, 'intelligence', 'behavior_dna',                'user_id',             'pie_only'),
    (250, 'intelligence', 'confidence_intelligence',    'user_id',             'pie_only'),
    (260, 'intelligence', 'readiness_dna',               'user_id',             'pie_only'),
    (270, 'intelligence', 'subject_dna',                 'user_id',             'pie_only'),
    (280, 'intelligence', 'behavior_events',             'user_id',             'pie_only'),
    (290, 'public',       'amc_adapter_evaluation',      'user_id',             'pie_only'),
    (300, 'pie',          'pie_dwig_candidate',          'user_id',             'pie_only'),
    (310, 'pie',          'pie_decision_candidate',      'user_id',             'pie_only'),
    (320, 'pie',          'pie_candidate_state',         'user_id',             'pie_only'),
    (330, 'pie',          'pie_inference_run',           'user_id',             'pie_only'),
    (340, 'pie',          'lo_misconception_state',      'user_id',             'pie_only'),
    (350, 'pie',          'lo_focus',                    'user_id',             'pie_only'),
    (360, 'pie',          'learner_lo_state',            'user_id',             'pie_only'),
    (370, 'pie',          'adaptive_policy_shadow',      'user_id',             'pie_only'),
    (380, 'pie',          'beta_serving_gate',            'user_id',             'pie_only'),
    (390, 'pie',          'pie_exam_environment',         'user_id',             'pie_only'),
    (400, 'public',       'user_attempts',               'user_id',             'full_candidate'),
    (410, 'public',       'practice_session_questions',  'session_user',        'full_candidate'),
    (420, 'public',       'practice_sessions',           'user_id',             'full_candidate')
  ) as targets(sort_order, schema_name, table_name, scope_kind, min_mode)
$$;

create or replace function public._admin_beta_reset_predicate(p_scope_kind text)
returns text
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  return case p_scope_kind
    when 'user_id' then
      't.user_id in (select p.id from public.profiles p where p.is_synthetic is true)'
    when 'attempt_user' then
      'exists (select 1 from public.user_attempts ua join public.profiles p on p.id = ua.user_id where ua.id = t.attempt_id and p.is_synthetic is true)'
    when 'session_user' then
      'exists (select 1 from public.practice_sessions ps join public.profiles p on p.id = ps.user_id where ps.id = t.session_id and p.is_synthetic is true)'
    when 'intervention_user' then
      'exists (select 1 from intelligence.candidate_interventions ci join public.profiles p on p.id = ci.user_id where ci.id = t.candidate_intervention_id and p.is_synthetic is true)'
    when 'decision_candidate' then
      'exists (select 1 from pie.pie_decision_candidate dc join public.profiles p on p.id = dc.user_id where dc.id = t.decision_candidate_id and p.is_synthetic is true)'
    when 'decision_parent' then
      'exists (select 1 from pie.pie_decision d join pie.pie_decision_candidate dc on dc.id = d.decision_candidate_id join public.profiles p on p.id = dc.user_id where d.id = t.decision_id and p.is_synthetic is true)'
    when 'dwig_candidate' then
      'exists (select 1 from pie.pie_dwig_candidate dw join public.profiles p on p.id = dw.user_id where dw.id = t.dwig_candidate_id and p.is_synthetic is true)'
    when 'candidate_state' then
      'exists (select 1 from pie.pie_candidate_state cs join public.profiles p on p.id = cs.user_id where cs.id = t.candidate_state_id and p.is_synthetic is true)'
    else null
  end;
end;
$$;

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
  required_column text;
begin
  if p_mode not in ('pie_only', 'full_candidate') then
    raise exception 'Unsupported reset mode';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'is_synthetic' and data_type = 'boolean'
  ) then
    raise exception 'Reset blocked: public.profiles.is_synthetic BOOLEAN is missing; cannot prove production-candidate exclusion.';
  end if;
  if not exists (select 1 from public.profiles where is_synthetic is true) then
    raise exception 'Reset blocked: no explicitly marked synthetic candidates exist.';
  end if;

  for r in
    select * from public._admin_beta_reset_targets()
    where p_mode = 'full_candidate' or min_mode = 'pie_only'
    order by sort_order
  loop
    if to_regclass(format('%I.%I', r.schema_name, r.table_name)) is null then
      continue;
    end if;

    required_column := case r.scope_kind
      when 'user_id' then 'user_id'
      when 'attempt_user' then 'attempt_id'
      when 'session_user' then 'session_id'
      when 'intervention_user' then 'candidate_intervention_id'
      when 'decision_candidate' then 'decision_candidate_id'
      when 'decision_parent' then 'decision_id'
      when 'dwig_candidate' then 'dwig_candidate_id'
      when 'candidate_state' then 'candidate_state_id'
      else null
    end;
    if required_column is null or not exists (
      select 1 from information_schema.columns c
      where c.table_schema = r.schema_name and c.table_name = r.table_name
        and c.column_name = required_column
    ) then
      raise exception 'Reset blocked: missing required scope column for %.% (scope=%).',
        r.schema_name, r.table_name, r.scope_kind;
    end if;

    if r.scope_kind = 'intervention_user' and to_regclass('intelligence.candidate_interventions') is null then
      raise exception 'Reset blocked: missing intervention ownership relation.';
    elsif r.scope_kind in ('decision_candidate','decision_parent') and
      (to_regclass('pie.pie_decision_candidate') is null or to_regclass('pie.pie_decision') is null) then
      raise exception 'Reset blocked: missing decision ownership relation.';
    elsif r.scope_kind = 'dwig_candidate' and to_regclass('pie.pie_dwig_candidate') is null then
      raise exception 'Reset blocked: missing DWIG ownership relation.';
    elsif r.scope_kind = 'candidate_state' and to_regclass('pie.pie_candidate_state') is null then
      raise exception 'Reset blocked: missing candidate-state ownership relation.';
    end if;

    predicate := public._admin_beta_reset_predicate(r.scope_kind);
    execute format('select count(*) from %I.%I t where %s', r.schema_name, r.table_name, predicate) into n;
    result := result || jsonb_build_object(r.schema_name || '.' || r.table_name, n);
  end loop;
  return result;
end;
$$;

create or replace function public._admin_beta_reset_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select auth.uid() is not null
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'gopalrock.naren@gmail.com'
    and exists (
      select 1 from auth.users u
      where u.id = auth.uid()
        and lower(u.email) = 'gopalrock.naren@gmail.com'
        and u.email_confirmed_at is not null
    )
$$;

create or replace function public.admin_preview_pie_beta_reset(p_mode text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pie, intelligence
as $$
declare counts jsonb;
begin
  if not public._admin_beta_reset_is_super_admin() then
    raise exception 'Super-administrator access required' using errcode = '42501';
  end if;
  counts := public._admin_beta_reset_counts(p_mode);
  return jsonb_build_object(
    'mode', p_mode,
    'counts', counts,
    'total_rows', (select coalesce(sum(value::text::bigint), 0) from jsonb_each(counts)),
    'preview_token', md5(p_mode || ':' || counts::text),
    'confirmation_phrase', case when p_mode = 'pie_only' then 'RESET PIE BETA DATA' else 'RESET ALL CANDIDATE DATA' end,
    'warning', 'Only rows belonging to explicitly marked synthetic candidates are eligible. Real candidate records, accounts, questions, LO mappings, global question state, model configuration and global certification evidence are excluded.'
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
  if not public._admin_beta_reset_is_super_admin() then
    raise exception 'Super-administrator access required' using errcode = '42501';
  end if;

  -- Validate the marker before acquiring locks. Then lock all candidate scope
  -- and target relations in a deterministic order to prevent a write race
  -- between the preview fingerprint check and the deletes.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'is_synthetic' and data_type = 'boolean'
  ) then
    raise exception 'Reset blocked: public.profiles.is_synthetic BOOLEAN is missing.';
  end if;
  lock table public.profiles in share row exclusive mode;
  for r in
    select distinct schema_name, table_name
    from public._admin_beta_reset_targets()
    where (p_mode = 'full_candidate' or min_mode = 'pie_only')
      and to_regclass(format('%I.%I', schema_name, table_name)) is not null
    order by schema_name, table_name
  loop
    execute format('lock table %I.%I in share row exclusive mode', r.schema_name, r.table_name);
  end loop;

  counts := public._admin_beta_reset_counts(p_mode);
  if md5(p_mode || ':' || counts::text) <> p_preview_token then
    raise exception 'Data changed since preview. Run preview again.';
  end if;
  expected_phrase := case when p_mode = 'pie_only' then 'RESET PIE BETA DATA' else 'RESET ALL CANDIDATE DATA' end;
  if p_confirmation is distinct from expected_phrase then
    raise exception 'Confirmation phrase does not match';
  end if;

  for r in
    select * from public._admin_beta_reset_targets()
    where p_mode = 'full_candidate' or min_mode = 'pie_only'
    order by sort_order
  loop
    if to_regclass(format('%I.%I', r.schema_name, r.table_name)) is null then
      continue;
    end if;
    predicate := public._admin_beta_reset_predicate(r.scope_kind);
    execute format('delete from %I.%I t where %s', r.schema_name, r.table_name, predicate);
    get diagnostics deleted = row_count;
    actual := actual || jsonb_build_object(r.schema_name || '.' || r.table_name, deleted);
    if deleted <> coalesce((counts ->> (r.schema_name || '.' || r.table_name))::bigint, 0) then
      raise exception 'Reset aborted: expected % rows from %.%, deleted %; transaction will roll back.',
        coalesce((counts ->> (r.schema_name || '.' || r.table_name))::bigint, 0),
        r.schema_name, r.table_name, deleted;
    end if;
  end loop;

  insert into pie.beta_reset_audit(actor_id, actor_email, reset_mode, deleted_counts)
  values (auth.uid(), lower(auth.jwt() ->> 'email'), p_mode, actual);
  return jsonb_build_object('success', true, 'mode', p_mode, 'deleted_counts', actual);
end;
$$;

revoke all on function public._admin_beta_reset_targets() from public, anon, authenticated;
revoke all on function public._admin_beta_reset_predicate(text) from public, anon, authenticated;
revoke all on function public._admin_beta_reset_counts(text) from public, anon, authenticated;
revoke all on function public._admin_beta_reset_is_super_admin() from public, anon, authenticated;
revoke all on function public.admin_preview_pie_beta_reset(text) from public, anon, authenticated;
revoke all on function public.admin_execute_pie_beta_reset(text,text,text) from public, anon, authenticated;
grant execute on function public.admin_preview_pie_beta_reset(text) to authenticated;
grant execute on function public.admin_execute_pie_beta_reset(text,text,text) to authenticated;
