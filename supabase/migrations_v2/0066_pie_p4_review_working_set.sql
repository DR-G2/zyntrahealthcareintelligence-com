-- P4 review/working-set contract. Canonical live implementation is deployed separately.
-- Keeps raw tables private and exposes learner-safe context only.
-- Review scheduling is intentionally conservative: the current P4 layer establishes
-- the review queue and working set substrate without claiming spaced-repetition
-- efficacy before enough outcome evidence exists.

create table if not exists pie.lo_review(
 user_id uuid not null references public.profiles(id) on delete cascade,
 lo_id uuid not null references pie.learning_objective(id) on delete cascade,
 ladder_step integer not null default 0,
 due_at timestamptz,
 last_result text,
 last_reviewed_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key(user_id,lo_id)
);

create table if not exists pie.lo_working_set(
 user_id uuid not null references public.profiles(id) on delete cascade,
 slot integer not null check(slot between 1 and 5),
 lo_id uuid not null references pie.learning_objective(id) on delete cascade,
 reason text not null,
 score numeric not null default 0,
 entered_at timestamptz not null default now(),
 expires_at timestamptz,
 primary key(user_id,slot),
 unique(user_id,lo_id)
);

create table if not exists pie.lo_focus(
 user_id uuid primary key references public.profiles(id) on delete cascade,
 lo_id uuid references pie.learning_objective(id) on delete set null,
 reason text,
 confidence numeric not null default 0,
 updated_at timestamptz not null default now()
);

revoke all on pie.lo_review from anon,authenticated;
revoke all on pie.lo_working_set from anon,authenticated;
revoke all on pie.lo_focus from anon,authenticated;
