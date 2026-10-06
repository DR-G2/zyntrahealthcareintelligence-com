-- Phase 4 / 0002: migration control
create table if not exists migration.batches (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  status text not null default 'pending' check (status in ('pending','running','completed','failed','cancelled')),
  source_snapshot jsonb not null default '{}'::jsonb,
  notes text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists migration.records (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references migration.batches(id) on delete cascade,
  source_table text not null,
  source_id text not null,
  target_schema text not null,
  target_table text not null,
  target_id text,
  status text not null default 'pending' check (status in ('pending','migrated','skipped','failed')),
  error_message text,
  migrated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source_table, source_id, target_schema, target_table)
);

create index if not exists migration_records_batch_idx on migration.records(batch_id);
create index if not exists migration_records_status_idx on migration.records(status);
