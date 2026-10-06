insert into migration.batches(source_system,status,source_snapshot,notes,started_at)
values(
 'legacy_supabase',
 'pending',
 jsonb_build_object(
  'target_project','hkowvjazuwebmibssdut',
  'target_questions',225,
  'target_subjects',9,
  'target_subtopics',45,
  'target_practice_sessions',0,
  'target_intelligence_rows',0,
  'target_pie_observations',0,
  'target_amc_plugin_versions',1,
  'target_ai_lab_sessions',0
 ),
 'Rehearsal baseline captured. Legacy source project is not currently queryable through the available Supabase connection, so source-to-target row reconciliation remains pending.',
 now()
);