-- Phase 4 / 0009: baseline RLS
-- Default deny is intentional. Service-role/server paths can operate outside RLS.

alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.subtopics enable row level security;
alter table public.questions enable row level security;
alter table public.clinical_stations enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.practice_session_questions enable row level security;
alter table public.user_attempts enable row level security;
alter table public.station_sessions enable row level security;
alter table public.station_session_items enable row level security;
alter table public.station_attempts enable row level security;
alter table public.user_progress enable row level security;
alter table public.user_program_progress enable row level security;
alter table public.study_plans enable row level security;
alter table public.bookmarks enable row level security;
alter table public.user_notes enable row level security;
alter table public.station_bookmarks enable row level security;
alter table public.station_notes enable row level security;
alter table public.payments enable row level security;
alter table public.user_legal_acceptance enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.data_export_history enable row level security;
alter table public.site_settings enable row level security;
alter table intelligence.behavior_events enable row level security;
alter table intelligence.question_dna enable row level security;
alter table intelligence.question_dna_history enable row level security;
alter table intelligence.behavior_dna enable row level security;
alter table intelligence.readiness_dna enable row level security;
alter table intelligence.subject_dna enable row level security;
alter table intelligence.confidence_intelligence enable row level security;
alter table intelligence.ideal_candidate_profile enable row level security;
alter table intelligence.intervention_catalog enable row level security;
alter table intelligence.candidate_interventions enable row level security;
alter table intelligence.intervention_outcomes enable row level security;
alter table intelligence.intervention_effectiveness enable row level security;
alter table intelligence.next_best_actions enable row level security;
alter table command.admin_roles enable row level security;
alter table command.admin_activity_logs enable row level security;
alter table command.manual_overrides enable row level security;
alter table command.system_health_logs enable row level security;
alter table command.system_error_logs enable row level security;
alter table ai_lab.connections enable row level security;
alter table ai_lab.sessions enable row level security;
alter table ai_lab.interactions enable row level security;
alter table public.payments enable row level security;
alter table public.user_legal_acceptance enable row level security;

create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
create policy profiles_update_own on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy taxonomy_select on public.subjects for select using (is_active = true);
create policy subtopics_select on public.subtopics for select using (is_active = true);
create policy questions_select_published on public.questions for select using (status = 'active');
create policy stations_select_published on public.clinical_stations for select using (status = 'active');

create policy sessions_select_own on public.practice_sessions for select using (auth.uid() = user_id);
create policy sessions_insert_own on public.practice_sessions for insert with check (auth.uid() = user_id);
create policy sessions_update_own on public.practice_sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy session_questions_select_own on public.practice_session_questions for select using (
  exists (select 1 from public.practice_sessions s where s.id = session_id and s.user_id = auth.uid())
);

create policy attempts_select_own on public.user_attempts for select using (auth.uid() = user_id);
create policy attempts_insert_own on public.user_attempts for insert with check (auth.uid() = user_id);

create policy station_sessions_select_own on public.station_sessions for select using (auth.uid() = user_id);
create policy station_sessions_insert_own on public.station_sessions for insert with check (auth.uid() = user_id);
create policy station_sessions_update_own on public.station_sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy station_attempts_select_own on public.station_attempts for select using (auth.uid() = user_id);
create policy station_attempts_insert_own on public.station_attempts for insert with check (auth.uid() = user_id);

create policy user_progress_own on public.user_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy program_progress_own on public.user_program_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy study_plans_own on public.study_plans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy bookmarks_own on public.bookmarks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy notes_own on public.user_notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy station_bookmarks_own on public.station_bookmarks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy station_notes_own on public.station_notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy behavior_events_insert_own on intelligence.behavior_events for insert with check (auth.uid() = user_id);
create policy behavior_events_select_own on intelligence.behavior_events for select using (auth.uid() = user_id);

create policy behavior_dna_select_own on intelligence.behavior_dna for select using (auth.uid() = user_id);
create policy readiness_dna_select_own on intelligence.readiness_dna for select using (auth.uid() = user_id);
create policy subject_dna_select_own on intelligence.subject_dna for select using (auth.uid() = user_id);
create policy confidence_select_own on intelligence.confidence_intelligence for select using (auth.uid() = user_id);
create policy candidate_interventions_select_own on intelligence.candidate_interventions for select using (auth.uid() = user_id);
create policy intervention_outcomes_select_own on intelligence.intervention_outcomes for select using (
  exists (
    select 1 from intelligence.candidate_interventions ci
    where ci.id = candidate_intervention_id and ci.user_id = auth.uid()
  )
);
create policy next_best_actions_select_own on intelligence.next_best_actions for select using (auth.uid() = user_id);

create policy payments_select_own on public.payments for select using (auth.uid() = user_id);
create policy legal_select_own on public.user_legal_acceptance for select using (auth.uid() = user_id);
create policy push_own on public.push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy export_history_own on public.data_export_history for select using (auth.uid() = user_id);

create policy site_settings_public on public.site_settings for select using (is_public = true);

-- Explicitly no learner policies for:
-- question_dna, question_dna_history, ideal_candidate_profile,
-- intervention_catalog/effectiveness, command.*, ai_lab.*.
