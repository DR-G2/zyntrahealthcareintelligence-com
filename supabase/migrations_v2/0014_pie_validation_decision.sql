-- Zyntra V2 Phase 5 / PIE validation, decision and runtime
create table if not exists pie.pie_validation_run (
  id uuid primary key default gen_random_uuid(),
  model_version_id uuid references pie.pie_model_version(id) on delete set null,
  run_type text not null,
  status text not null default 'started' check (status in ('started','completed','failed')),
  dataset_ref jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists pie.pie_validation_metric (
  id uuid primary key default gen_random_uuid(),
  validation_run_id uuid not null references pie.pie_validation_run(id) on delete cascade,
  metric_key text not null,
  metric_value numeric,
  details jsonb not null default '{}'::jsonb,
  unique(validation_run_id,metric_key)
);

create table if not exists pie.pie_validation_claim (
  id uuid primary key default gen_random_uuid(),
  validation_run_id uuid not null references pie.pie_validation_run(id) on delete cascade,
  claim text not null,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'unverified' check (status in ('unverified','supported','rejected')),
  created_at timestamptz not null default now()
);

create table if not exists pie.pie_exam_environment (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exam_key text not null,
  environment jsonb not null default '{}'::jsonb,
  effective_from timestamptz,
  effective_to timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists pie.pie_exam_adapter_snapshot (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  adapter_key text not null,
  adapter_version text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists pie.pie_exam_readiness (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exam_key text not null,
  readiness_score numeric,
  readiness_band text,
  dimensions jsonb not null default '{}'::jsonb,
  model_version_id uuid references pie.pie_model_version(id) on delete set null,
  calculated_at timestamptz not null default now()
);

create table if not exists pie.pie_dwig_candidate (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  candidate_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists pie.pie_dwig_selection (
  id uuid primary key default gen_random_uuid(),
  dwig_candidate_id uuid not null references pie.pie_dwig_candidate(id) on delete cascade,
  selected_action text not null,
  rationale jsonb not null default '{}'::jsonb,
  score numeric,
  created_at timestamptz not null default now()
);

create table if not exists pie.pie_dwig_outcome (
  id uuid primary key default gen_random_uuid(),
  dwig_selection_id uuid not null references pie.pie_dwig_selection(id) on delete cascade,
  outcome jsonb not null default '{}'::jsonb,
  measured_at timestamptz not null default now()
);

create table if not exists pie.pie_dwig_evaluation (
  id uuid primary key default gen_random_uuid(),
  dwig_candidate_id uuid not null references pie.pie_dwig_candidate(id) on delete cascade,
  evaluation jsonb not null default '{}'::jsonb,
  score numeric,
  created_at timestamptz not null default now()
);

create table if not exists pie.pie_decision_candidate (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  decision_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists pie.pie_decision (
  id uuid primary key default gen_random_uuid(),
  decision_candidate_id uuid not null references pie.pie_decision_candidate(id) on delete cascade,
  decision_key text not null,
  decision jsonb not null default '{}'::jsonb,
  confidence numeric,
  model_version_id uuid references pie.pie_model_version(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists pie.pie_decision_outcome (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references pie.pie_decision(id) on delete cascade,
  outcome jsonb not null default '{}'::jsonb,
  measured_at timestamptz not null default now()
);

create table if not exists pie.pie_intervention_outcome (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  intervention_id uuid references intelligence.intervention_catalog(id) on delete set null,
  decision_id uuid references pie.pie_decision(id) on delete set null,
  outcome jsonb not null default '{}'::jsonb,
  measured_at timestamptz not null default now()
);

create table if not exists pie.pie_intervention_effect_estimate (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid references intelligence.intervention_catalog(id) on delete cascade,
  estimate numeric,
  uncertainty jsonb not null default '{}'::jsonb,
  evidence_window jsonb not null default '{}'::jsonb,
  model_version_id uuid references pie.pie_model_version(id) on delete set null,
  calculated_at timestamptz not null default now()
);

create table if not exists pie.pie_intervention_causal_evidence (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid references intelligence.intervention_catalog(id) on delete cascade,
  evidence jsonb not null default '{}'::jsonb,
  design text,
  strength numeric,
  created_at timestamptz not null default now()
);

create table if not exists pie.pie_runtime_decision (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  decision_id uuid references pie.pie_decision(id) on delete set null,
  request_context jsonb not null default '{}'::jsonb,
  response jsonb not null default '{}'::jsonb,
  gate_status text,
  created_at timestamptz not null default now()
);

create table if not exists pie.pie_runtime_gate (
  id uuid primary key default gen_random_uuid(),
  gate_key text not null unique,
  status text not null default 'blocked' check (status in ('blocked','shadow','allowed','revoked')),
  requirements jsonb not null default '{}'::jsonb,
  evaluated_at timestamptz
);

create table if not exists pie.pie_shadow_run (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  model_version_id uuid references pie.pie_model_version(id) on delete set null,
  input_snapshot jsonb not null default '{}'::jsonb,
  output_snapshot jsonb not null default '{}'::jsonb,
  comparison jsonb not null default '{}'::jsonb,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

create table if not exists pie.pie_certification_gate (
  id uuid primary key default gen_random_uuid(),
  gate_key text not null unique,
  status text not null default 'pending' check (status in ('pending','passed','failed','revoked')),
  evidence jsonb not null default '{}'::jsonb,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists pie.pie_legacy_compatibility (
  id uuid primary key default gen_random_uuid(),
  legacy_key text not null unique,
  v2_key text not null,
  expires_at timestamptz,
  notes text
);

create index if not exists pie_exam_readiness_user_idx on pie.pie_exam_readiness(user_id,calculated_at desc);
create index if not exists pie_decision_candidate_user_idx on pie.pie_decision_candidate(user_id,created_at desc);
create index if not exists pie_runtime_decision_user_idx on pie.pie_runtime_decision(user_id,created_at desc);
