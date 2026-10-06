-- Phase 4 / 0010: safe infrastructure triggers and constraints
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','subjects','subtopics','questions','clinical_stations',
    'practice_sessions','station_sessions','user_progress','user_program_progress',
    'study_plans','user_notes','station_notes',
    'intelligence.question_dna','intelligence.behavior_dna',
    'intelligence.readiness_dna','intelligence.subject_dna',
    'intelligence.intervention_catalog','intelligence.candidate_interventions',
    'intelligence.next_best_actions','command.admin_roles',
    'ai_lab.connections','ai_lab.sessions','public.payments',
    'public.push_subscriptions','public.site_settings'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on %s', t);
    execute format('create trigger set_updated_at before update on %s for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- Append-only intent: no update/delete policies are created for attempts/events.
