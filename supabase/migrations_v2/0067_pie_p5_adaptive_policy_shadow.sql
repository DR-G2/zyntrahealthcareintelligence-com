-- P5 adaptive policy shadow contract.
-- Shadow only: records candidate selection rationale without taking over production serving.
create table if not exists pie.adaptive_policy_shadow(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 session_id uuid,
 lo_id uuid references pie.learning_objective(id) on delete set null,
 question_id uuid,
 decision_type text not null,
 selected_reason text not null,
 candidate_score numeric not null default 0,
 uncertainty numeric,
 policy_version text not null default 'pie-policy-v1-shadow',
 created_at timestamptz not null default now(),
 metadata jsonb not null default '{}'::jsonb
);
create index if not exists adaptive_policy_shadow_user_created_idx
 on pie.adaptive_policy_shadow(user_id,created_at desc);
revoke all on pie.adaptive_policy_shadow from anon,authenticated;
