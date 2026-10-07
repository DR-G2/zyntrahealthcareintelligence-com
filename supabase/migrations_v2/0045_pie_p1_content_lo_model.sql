-- 0045: PIE P1 - stable content / concept / LO model and exam-plugin boundary.
--
-- Core (schema pie) is exam-agnostic: concepts, learning objectives (LOs) and a
-- question -> LO mapping. The LO/concept is the PIE knowledge unit.
-- Exam-specific taxonomy, blueprint eligibility and coverage live in schema amc
-- (the AMC plugin) and only reference core ids; core never references amc.
--
-- Security: no learner (anon/authenticated) grants on any table created here.
-- RLS is enabled with no learner policies. Content is administered by service_role.

-- ---------------------------------------------------------------------------
-- Stable content ids
-- questions.zyntra_id is the stable cross-database content id (unique since 0004).
-- Stable concept/LO ids are the immutable *_key text columns below; uuids are
-- internal surrogate keys.
-- ---------------------------------------------------------------------------

create table if not exists pie.concept (
  id uuid primary key default gen_random_uuid(),
  concept_key text not null unique check (concept_key ~ '^[A-Z0-9][A-Z0-9_.-]{1,95}$'),
  title text not null,
  description text,
  status text not null default 'active' check (status in ('draft','active','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pie.learning_objective (
  id uuid primary key default gen_random_uuid(),
  lo_key text not null unique check (lo_key ~ '^[A-Z0-9][A-Z0-9_.-]{1,95}$'),
  concept_id uuid not null references pie.concept(id) on delete restrict,
  title text not null,
  description text,
  status text not null default 'active' check (status in ('draft','active','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists learning_objective_concept_idx on pie.learning_objective(concept_id);

-- Many-to-many with exactly one primary LO per mapped question.
create table if not exists pie.question_lo (
  question_id uuid not null references public.questions(id) on delete cascade,
  lo_id uuid not null references pie.learning_objective(id) on delete restrict,
  is_primary boolean not null default false,
  weight numeric not null default 1 check (weight > 0 and weight <= 1),
  mapping_source text not null default 'manual' check (mapping_source in ('manual','import','model_suggested_reviewed')),
  created_at timestamptz not null default now(),
  primary key (question_id, lo_id),
  check (not is_primary or weight = 1)
);
create unique index if not exists question_lo_one_primary_uidx
  on pie.question_lo(question_id) where is_primary;
create index if not exists question_lo_lo_idx on pie.question_lo(lo_id);

-- Prevent non-key edits: stable keys are immutable once created.
create or replace function pie.forbid_stable_key_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'concept' then
    if to_jsonb(new) ->> 'concept_key' is distinct from to_jsonb(old) ->> 'concept_key' then
      raise exception 'concept_key is immutable' using errcode = '55000';
    end if;
  elsif tg_table_name = 'learning_objective' then
    if to_jsonb(new) ->> 'lo_key' is distinct from to_jsonb(old) ->> 'lo_key' then
      raise exception 'lo_key is immutable' using errcode = '55000';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists concept_stable_key on pie.concept;
create trigger concept_stable_key before update on pie.concept
  for each row execute function pie.forbid_stable_key_change();
drop trigger if exists learning_objective_stable_key on pie.learning_objective;
create trigger learning_objective_stable_key before update on pie.learning_objective
  for each row execute function pie.forbid_stable_key_change();

-- Primary LO lookup (internal).
create or replace function pie.question_primary_lo(p_question_id uuid)
returns uuid language sql stable set search_path = '' as $$
  select ql.lo_id from pie.question_lo ql
  where ql.question_id = p_question_id and ql.is_primary
$$;

-- ---------------------------------------------------------------------------
-- AMC plugin boundary (schema amc). References core ids; core is unaware of amc.
-- Blueprint = eligibility / coverage / tie-break only (never a selection quota).
-- ---------------------------------------------------------------------------

create table if not exists amc.amc_lo_taxonomy (
  plugin_version_id uuid not null references amc.amc_plugin_version(id) on delete cascade,
  lo_id uuid not null references pie.learning_objective(id) on delete restrict,
  patient_group text,
  body_system text,
  clinician_task_id uuid references amc.amc_task_taxonomy(id) on delete set null,
  attributes jsonb not null default '{}'::jsonb,
  primary key (plugin_version_id, lo_id)
);

create table if not exists amc.amc_blueprint_lo (
  blueprint_id uuid not null references amc.amc_blueprint(id) on delete cascade,
  lo_id uuid not null references pie.learning_objective(id) on delete restrict,
  eligible boolean not null default true,
  coverage_target numeric check (coverage_target is null or (coverage_target >= 0 and coverage_target <= 1)),
  tie_break_rank integer,
  primary key (blueprint_id, lo_id)
);
comment on table amc.amc_blueprint_lo is
  'AMC plugin: LO eligibility, coverage target and tie-break rank. Not a selection quota or subject rotation.';
comment on column amc.amc_blueprint_lo.coverage_target is
  'Coverage reporting/tie-break only. PIE must not convert this into fixed slots or percentages.';

-- ---------------------------------------------------------------------------
-- RLS + privileges: internal only
-- ---------------------------------------------------------------------------
alter table pie.concept enable row level security;
alter table pie.learning_objective enable row level security;
alter table pie.question_lo enable row level security;
alter table amc.amc_lo_taxonomy enable row level security;
alter table amc.amc_blueprint_lo enable row level security;

revoke all on pie.concept, pie.learning_objective, pie.question_lo from public, anon, authenticated;
revoke all on amc.amc_lo_taxonomy, amc.amc_blueprint_lo from public, anon, authenticated;
grant select, insert, update, delete on pie.concept, pie.learning_objective, pie.question_lo to service_role;
grant select, insert, update, delete on amc.amc_lo_taxonomy, amc.amc_blueprint_lo to service_role;

revoke all on function pie.forbid_stable_key_change() from public, anon, authenticated;
revoke all on function pie.question_primary_lo(uuid) from public, anon, authenticated;
grant execute on function pie.question_primary_lo(uuid) to service_role;
