-- Add candidate-specific LO review state to the guarded PIE beta reset inventory.
-- Existing production reset functions remain preview-first and registry-scoped.

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
    (30,  'pie',          'decision_trace',              'trace_owner',         'pie_only'),
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
    (365, 'pie',          'lo_review',                    'user_id',             'pie_only'),
    (366, 'pie',          'lo_working_set',               'user_id',             'pie_only'),
    (370, 'pie',          'adaptive_policy_shadow',      'user_id',             'pie_only'),
    (380, 'pie',          'beta_serving_gate',            'user_id',             'pie_only'),
    (390, 'pie',          'pie_exam_environment',         'user_id',             'pie_only'),
    (395, 'pie',          'readiness_snapshot',          'user_id',             'pie_only'),
    (400, 'public',       'user_attempts',               'user_id',             'full_candidate'),
    (410, 'public',       'practice_session_questions',  'session_user',        'full_candidate'),
    (420, 'public',       'practice_sessions',           'user_id',             'full_candidate')
  ) as targets(sort_order, schema_name, table_name, scope_kind, min_mode)
$$;
