-- P14: private projection of the certified P12 shadow contract.
-- Browser roles receive no grants. The projection is populated/read only by the
-- authenticated P14 Edge Function using service_role server-side.

create table if not exists pie.inference_projection (
  user_id uuid primary key references auth.users(id) on delete cascade,
  inference_hash text not null,
  observation_count integer not null check (observation_count >= 0),
  latest_observation_id uuid null,
  latest_observed_at timestamptz null,
  dimensions jsonb not null check (jsonb_typeof(dimensions) = 'array'),
  model_version text not null,
  source_state_version integer null,
  evidence_maturity text null,
  signal_quality text null,
  explanation jsonb null,
  inferred_at timestamptz not null,
  updated_at timestamptz not null default now(),
  shadow_only boolean not null default true check (shadow_only = true),
  authoritative boolean not null default false check (authoritative = false),
  influences_adaptation boolean not null default false check (influences_adaptation = false)
);

alter table pie.inference_projection enable row level security;

revoke all on table pie.inference_projection from public, anon, authenticated;
grant select, insert, update on table pie.inference_projection to service_role;

create index if not exists inference_projection_updated_at_idx
  on pie.inference_projection (updated_at desc);
