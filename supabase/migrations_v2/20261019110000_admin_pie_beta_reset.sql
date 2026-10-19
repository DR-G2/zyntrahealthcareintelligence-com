-- Admin-only, preview-first, synthetic-candidate-scoped PIE beta reset.
-- Synthetic eligibility comes only from an explicit, server-controlled registry.
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

-- Only explicitly provisioned disposable accounts belong in this registry.
-- No client role can read or write it; registration is through a guarded RPC.
create table if not exists pie.synthetic_candidate_registry (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  registered_by uuid not null references auth.users(id) on delete restrict,
  reason text not null check (length(btrim(reason)) between 10 and 300),
  registered_at timestamptz not null default now()
);
alter table pie.synthetic_candidate_registry enable row level security;
revoke all on pie.synthetic_candidate_registry from public, anon, authenticated;

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
    (195, 'pie',          'pie_dwig_outcome',             'dwig_selection',      'pie_only'),
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
      't.user_id in (select p.id from public.profiles p where exists (select 1 from pie.synthetic_candidate_registry scr where scr.user_id = p.id))'
    when 'attempt_user' then
      'exists (select 1 from public.user_attempts ua join public.profiles p on p.id = ua.user_id where ua.id = t.attempt_id and exists (select 1 from pie.synthetic_candidate_registry scr where scr.user_id = p.id))'
    when 'session_user' then
      'exists (select 1 from public.practice_sessions ps join public.profiles p on p.id = ps.user_id where ps.id = t.session_id and exists (select 1 from pie.synthetic_candidate_registry scr where scr.user_id = p.id))'
    when 'intervention_user' then
      'exists (select 1 from intelligence.candidate_interventions ci join public.profiles p on p.id = ci.user_id where ci.id = t.candidate_intervention_id and exists (select 1 from pie.synthetic_candidate_registry scr where scr.user_id = p.id))'
    when 'decision_candidate' then
      'exists (select 1 from pie.pie_decision_candidate dc join public.profiles p on p.id = dc.user_id where dc.id = t.decision_candidate_id and exists (select 1 from pie.synthetic_candidate_registry scr where scr.user_id = p.id))'
    when 'decision_parent' then
      'exists (select 1 from pie.pie_decision d join pie.pie_decision_candidate dc on dc.id = d.decision_candidate_id join public.profiles p on p.id = dc.user_id where d.id = t.decision_id and exists (select 1 from pie.synthetic_candidate_registry scr where scr.user_id = p.id))'
    when 'dwig_candidate' then
      'exists (select 1 from pie.pie_dwig_candidate dw join public.profiles p on p.id = dw.user_id where dw.id = t.dwig_candidate_id and exists (select 1 from pie.synthetic_candidate_registry scr where scr.user_id = p.id))'
    when 'dwig_selection' then
      'exists (select 1 from pie.pie_dwig_selection ds join pie.pie_dwig_candidate dw on dw.id = ds.dwig_candidate_id join public.profiles p on p.id = dw.user_id where ds.id = t.dwig_selection_id and exists (select 1 from pie.synthetic_candidate_registry scr where scr.user_id = p.id))'
    when 'candidate_state' then
      'exists (select 1 from pie.pie_candidate_state cs join public.profiles p on p.id = cs.user_id where cs.id = t.candidate_state_id and exists (select 1 from pie.synthetic_candidate_registry scr where scr.user_id = p.id))'
    else null
  end;
end;
$$;

create or replace function public._admin_beta_reset_fingerprint(p_mode text, p_counts jsonb)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  candidate_ids text;
begin
  if to_regclass('pie.synthetic_candidate_registry') is null then
    raise exception 'Reset blocked: synthetic-candidate registry is missing.';
  end if;

  select coalesce(string_agg(user_id::text, ',' order by user_id), '')
  into candidate_ids
  from pie.synthetic_candidate_registry;

  return md5(p_mode || ':' || p_counts::text || ':' || candidate_ids);
end;
$$;

create or replace function public._admin_beta_reset_lock_targets(p_mode text, p_lock_mode text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  r record;
begin
  if p_mode is null or p_mode not in ('pie_only', 'full_candidate') then
    raise exception 'Unsupported reset mode';
  end if;
  if p_lock_mode is null or p_lock_mode not in ('SHARE', 'SHARE ROW EXCLUSIVE') then
    raise exception 'Unsupported reset lock mode';
  end if;
  if to_regclass('pie.synthetic_candidate_registry') is null then
    raise exception 'Reset blocked: synthetic-candidate registry is missing.';
  end if;

  -- A short-lived table lock makes the preview counts, target rows, and
  -- synthetic-candidate cohort stable for the duration of this RPC transaction.
  execute format('lock table pie.synthetic_candidate_registry in %s mode', p_lock_mode);
  for r in
    with lock_targets as (
      select schema_name, table_name
      from public._admin_beta_reset_targets()
      where p_mode = 'full_candidate' or min_mode = 'pie_only'
      union
      -- PIE-only counts attempt_lo through canonical attempts; lock that source
      -- table too, even though PIE-only mode does not delete its rows.
      select 'public'::text, 'user_attempts'::text where p_mode = 'pie_only'
    )
    select schema_name, table_name
    from lock_targets
    where to_regclass(format('%I.%I', schema_name, table_name)) is not null
    order by schema_name, table_name
  loop
    if to_regclass(format('%I.%I', r.schema_name, r.table_name)) is not null then
      execute format('lock table %I.%I in %s mode', r.schema_name, r.table_name, p_lock_mode);
    end if;
  end loop;
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
  if p_mode is null or p_mode not in ('pie_only', 'full_candidate') then
    raise exception 'Unsupported reset mode';
  end if;
  if to_regclass('pie.synthetic_candidate_registry') is null then
    raise exception 'Reset blocked: synthetic-candidate registry is missing; cannot prove production-candidate exclusion.';
  end if;
  if not exists (select 1 from pie.synthetic_candidate_registry) then
    raise exception 'Reset blocked: no explicitly registered synthetic candidates exist.';
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
      when 'dwig_selection' then 'dwig_selection_id'
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
    elsif r.scope_kind = 'dwig_selection' and (to_regclass('pie.pie_dwig_selection') is null or to_regclass('pie.pie_dwig_candidate') is null) then
      raise exception 'Reset blocked: missing DWIG selection ownership relation.';
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

create or replace function public.admin_register_synthetic_candidate(p_user_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pie
as $
declare target_role text;
begin
  if not public._admin_beta_reset_is_super_admin() then
    raise exception 'Super-administrator access required' using errcode = '42501';
  end if;
  if p_user_id is null or p_user_id = auth.uid() then
    raise exception 'Register a separate, explicitly provisioned disposable account.';
  end if;
  if p_reason is null or length(btrim(p_reason)) < 10 or length(btrim(p_reason)) > 300 then
    raise exception 'Provide a reason between 10 and 300 characters.';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id)
     or not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'The supplied user ID must exist in auth.users and public.profiles.';
  end if;
  select lower(coalesce(p.role, '')) into target_role
  from public.profiles p where p.id = p_user_id;
  if target_role in ('admin', 'super_admin', 'super-admin') then
    raise exception 'Administrative accounts cannot be registered as synthetic candidates.';
  end if;
  insert into pie.synthetic_candidate_registry(user_id, registered_by, reason)
  values (p_user_id, auth.uid(), btrim(p_reason));
  return jsonb_build_object('success', true, 'user_id', p_user_id);
exception
  when unique_violation then
    raise exception 'This account is already registered as a synthetic candidate.';
end;
$;

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
  perform public._admin_beta_reset_lock_targets(p_mode, 'SHARE');
  counts := public._admin_beta_reset_counts(p_mode);
  return jsonb_build_object(
    'mode', p_mode,
    'counts', counts,
    'total_rows', (select coalesce(sum(value::text::bigint), 0) from jsonb_each(counts)),
    'preview_token', public._admin_beta_reset_fingerprint(p_mode, counts),
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
  if p_mode is null or p_mode not in ('pie_only', 'full_candidate') then
    raise exception 'Unsupported reset mode';
  end if;

  -- Acquire the stronger write-blocking locks in the same deterministic order
  -- used by preview, then verify the preview fingerprint and perform the deletes.
  perform public._admin_beta_reset_lock_targets(p_mode, 'SHARE ROW EXCLUSIVE');
  counts := public._admin_beta_reset_counts(p_mode);
  if public._admin_beta_reset_fingerprint(p_mode, counts) <> p_preview_token then
    raise exception 'Data changed since preview. Run preview again.';
  end if;
  expected_phrase := case when p_mode = 'pie_only' then 'RESET PIE BETA DATA' else 'RESET ALL CANDIDATE DATA' end;
  if p_confirmation is distinct from expected_phrase then
    raise exception 'Confirmation phrase does not match';
  end if;

  -- Abort rather than mutate any non-synthetic candidate record through SET NULL
  -- or CASCADE side-effects from a synthetic parent. These are integrity guards,
  -- not extra deletion targets.
  if p_mode = 'full_candidate' then
    if to_regclass('public.user_attempts') is not null and to_regclass('public.practice_sessions') is not null
       and exists (
         select 1
         from public.user_attempts ua
         join public.practice_sessions ps on ps.id = ua.session_id
         join public.profiles session_owner on session_owner.id = ps.user_id
         left join public.profiles attempt_owner on attempt_owner.id = ua.user_id
         where exists (select 1 from pie.synthetic_candidate_registry scr where scr.user_id = session_owner.id)
           and not exists (select 1 from pie.synthetic_candidate_registry scr where scr.user_id = attempt_owner.id)
       ) then
      raise exception 'Reset blocked: a non-synthetic attempt references a synthetic practice session.';
    end if;

    if to_regclass('intelligence.behavior_events') is not null and to_regclass('public.practice_sessions') is not null
       and exists (
         select 1
         from intelligence.behavior_events be
         join public.practice_sessions ps on ps.id = be.session_id
         join public.profiles session_owner on session_owner.id = ps.user_id
         left join public.profiles event_owner on event_owner.id = be.user_id
         where exists (select 1 from pie.synthetic_candidate_registry scr where scr.user_id = session_owner.id)
           and not exists (select 1 from pie.synthetic_candidate_registry scr where scr.user_id = event_owner.id)
       ) then
      raise exception 'Reset blocked: a non-synthetic behaviour event references a synthetic practice session.';
    end if;

    if to_regclass('pie.pie_observation') is not null and to_regclass('public.user_attempts') is not null
       and exists (
         select 1
         from pie.pie_observation po
         join public.user_attempts ua on ua.id = po.attempt_id
         join public.profiles attempt_owner on attempt_owner.id = ua.user_id
         left join public.profiles observation_owner on observation_owner.id = po.user_id
         where exists (select 1 from pie.synthetic_candidate_registry scr where scr.user_id = attempt_owner.id)
           and not exists (select 1 from pie.synthetic_candidate_registry scr where scr.user_id = observation_owner.id)
       ) then
      raise exception 'Reset blocked: a non-synthetic PIE observation references a synthetic attempt.';
    end if;

    if to_regclass('public.amc_adapter_evaluation') is not null and to_regclass('pie.pie_candidate_state') is not null
       and exists (
         select 1
         from public.amc_adapter_evaluation ae
         join pie.pie_candidate_state cs on cs.id = ae.candidate_state_id
         join public.profiles state_owner on state_owner.id = cs.user_id
         left join public.profiles evaluation_owner on evaluation_owner.id = ae.user_id
         where exists (select 1 from pie.synthetic_candidate_registry scr where scr.user_id = state_owner.id)
           and not exists (select 1 from pie.synthetic_candidate_registry scr where scr.user_id = evaluation_owner.id)
       ) then
      raise exception 'Reset blocked: a non-synthetic AMC evaluation references a synthetic candidate state.';
    end if;

    if to_regclass('pie.pie_runtime_decision') is not null and to_regclass('pie.pie_decision') is not null
       and exists (
         select 1
         from pie.pie_runtime_decision rd
         join pie.pie_decision d on d.id = rd.decision_id
         join pie.pie_decision_candidate dc on dc.id = d.decision_candidate_id
         join public.profiles decision_owner on decision_owner.id = dc.user_id
         left join public.profiles runtime_owner on runtime_owner.id = rd.user_id
         where exists (select 1 from pie.synthetic_candidate_registry scr where scr.user_id = decision_owner.id)
           and not exists (select 1 from pie.synthetic_candidate_registry scr where scr.user_id = runtime_owner.id)
       ) then
      raise exception 'Reset blocked: a non-synthetic runtime decision references a synthetic PIE decision.';
    end if;

    if to_regclass('pie.pie_candidate_state') is not null and to_regclass('pie.pie_inference_run') is not null
       and exists (
         select 1
         from pie.pie_candidate_state cs
         join pie.pie_inference_run ir on ir.id = cs.source_inference_id
         join public.profiles run_owner on run_owner.id = ir.user_id
         left join public.profiles state_owner on state_owner.id = cs.user_id
         where exists (select 1 from pie.synthetic_candidate_registry scr where scr.user_id = run_owner.id)
           and not exists (select 1 from pie.synthetic_candidate_registry scr where scr.user_id = state_owner.id)
       ) then
      raise exception 'Reset blocked: a non-synthetic candidate state references a synthetic inference run.';
    end if;
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
revoke all on function public._admin_beta_reset_lock_targets(text,text) from public, anon, authenticated;
revoke all on function public._admin_beta_reset_fingerprint(text,jsonb) from public, anon, authenticated;
revoke all on function public._admin_beta_reset_is_super_admin() from public, anon, authenticated;
revoke all on function public.admin_register_synthetic_candidate(uuid,text) from public, anon, authenticated;
revoke all on function public.admin_preview_pie_beta_reset(text) from public, anon, authenticated;
revoke all on function public.admin_execute_pie_beta_reset(text,text,text) from public, anon, authenticated;
grant execute on function public.admin_register_synthetic_candidate(uuid,text) to authenticated;
grant execute on function public.admin_preview_pie_beta_reset(text) to authenticated;
grant execute on function public.admin_execute_pie_beta_reset(text,text,text) to authenticated;
