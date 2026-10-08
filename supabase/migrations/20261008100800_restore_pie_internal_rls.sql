-- Restore defense-in-depth RLS on internal PIE/security tables.
-- These tables are intentionally not directly learner-readable/writable.
-- Application access is mediated by scoped RPCs / service-role operations.
-- No permissive learner policies are added here.

alter table pie.attempt_lo enable row level security;
alter table pie.lo_misconception enable row level security;
alter table pie.lo_misconception_state enable row level security;
alter table pie.lo_review enable row level security;
alter table pie.lo_working_set enable row level security;
alter table pie.lo_focus enable row level security;
alter table pie.adaptive_policy_shadow enable row level security;
alter table pie.decision_trace enable row level security;
alter table pie.beta_serving_gate enable row level security;
alter table pie.inference_shadow enable row level security;
alter table pie.tutor_context enable row level security;
alter table pie.security_event enable row level security;
alter table pie.security_incident enable row level security;
alter table pie.security_evidence enable row level security;
alter table pie.security_detection_rule enable row level security;
alter table pie.security_session_signal enable row level security;
alter table pie.security_screenshot_policy enable row level security;
alter table pie.security_admin_access_audit enable row level security;
alter table pie.security_admin_access_log enable row level security;
alter table pie.security_enforcement enable row level security;
alter table pie.security_user_notice enable row level security;
alter table pie.security_admin_allowlist enable row level security;
alter table pie.security_incident_event enable row level security;
alter table pie.security_notification_delivery enable row level security;
alter table pie.production_gate enable row level security;
alter table pie.inference_state enable row level security;
