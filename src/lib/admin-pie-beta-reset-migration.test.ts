import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations_v2/20261019110000_admin_pie_beta_reset.sql'),
  'utf8',
);

type Target = {
  order: number;
  schema: string;
  table: string;
  scope: string;
  mode: string;
};

const targetBlock = migration.match(/create or replace function public\._admin_beta_reset_targets\(\)[\s\S]*?as \$\$([\s\S]*?)\$\$;/)?.[1] ?? '';
const targets: Target[] = [...targetBlock.matchAll(/\(\s*(\d+)\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/g)]
  .map((m) => ({ order: Number(m[1]), schema: m[2], table: m[3], scope: m[4], mode: m[5] }));

const key = (schema: string, table: string) => `${schema}.${table}`;
const orderOf = (name: string) => targets.find((target) => key(target.schema, target.table) === name)?.order;

describe('PIE beta reset migration source contract', () => {
  it('has one unique target inventory shared by preview and execution', () => {
    expect(targets.length).toBeGreaterThan(30);
    expect(new Set(targets.map((target) => key(target.schema, target.table))).size).toBe(targets.length);
    expect(migration.match(/_admin_beta_reset_targets\(\)/g)?.length).toBeGreaterThanOrEqual(4);
    expect(migration).toContain('public._admin_beta_reset_counts(p_mode)');
    expect(migration).toContain('public._admin_beta_reset_predicate(r.scope_kind)');
  });

  it('uses an explicit supported ownership key for every target', () => {
    const requiredColumn: Record<string, string> = {
      user_id: 'user_id',
      attempt_user: 'attempt_id',
      session_user: 'session_id',
      intervention_user: 'candidate_intervention_id',
      decision_candidate: 'decision_candidate_id',
      decision_parent: 'decision_id',
      dwig_candidate: 'dwig_candidate_id',
      dwig_selection: 'dwig_selection_id',
      candidate_state: 'candidate_state_id',
    };
    expect(targets.every((target) => requiredColumn[target.scope] !== undefined)).toBe(true);
    for (const target of targets) {
      expect(migration).toContain(`when '${target.scope}' then`);
    }
    expect(migration).toContain('missing required scope column');
    expect(migration).toContain('pie.synthetic_candidate_registry');
    expect(migration).toContain('alter table pie.synthetic_candidate_registry enable row level security');
    expect(migration).toContain('revoke all on pie.synthetic_candidate_registry from public, anon, authenticated');
    expect(migration).toContain('admin_register_synthetic_candidate(uuid,text)');
  });

  it('preserves global question state and configuration tables', () => {
    const preserved = [
      'pie.pie_question_state',
      'pie.pie_question_uncertainty',
      'pie.pie_runtime_gate',
      'pie.pie_legacy_compatibility',
      'pie.question_lo',
      'pie.learning_objective',
      'pie.pie_model_version',
      'pie.selection_policy',
      'intelligence.intervention_catalog',
      'public.amc_exam_environment_v1',
    ];
    for (const table of preserved) {
      expect(targets.some((target) => key(target.schema, target.table) === table)).toBe(false);
    }
  });

  it('orders child rows before parent rows to avoid hidden cascade-count drift', () => {
    const before = (child: string, parent: string) => {
      const childOrder = orderOf(child);
      const parentOrder = orderOf(parent);
      expect(childOrder, `missing child target ${child}`).toBeDefined();
      expect(parentOrder, `missing parent target ${parent}`).toBeDefined();
      expect(childOrder!).toBeLessThan(parentOrder!);
    };
    before('pie.pie_decision_outcome', 'pie.pie_decision');
    before('pie.pie_runtime_decision', 'pie.pie_decision');
    before('pie.pie_intervention_outcome', 'pie.pie_decision');
    before('pie.pie_decision', 'pie.pie_decision_candidate');
    before('pie.pie_dwig_evaluation', 'pie.pie_dwig_candidate');
    before('pie.pie_dwig_selection', 'pie.pie_dwig_candidate');
    before('pie.pie_dwig_outcome', 'pie.pie_dwig_selection');
    before('pie.pie_dwig_outcome', 'pie.pie_dwig_candidate');
    before('intelligence.intervention_outcomes', 'intelligence.candidate_interventions');
    before('pie.pie_state_uncertainty', 'pie.pie_candidate_state');
    before('public.amc_adapter_evaluation', 'pie.pie_candidate_state');
    before('pie.attempt_lo', 'public.user_attempts');
    before('public.user_attempts', 'public.practice_sessions');
    before('public.practice_session_questions', 'public.practice_sessions');
    before('pie.pie_observation', 'public.user_attempts');
    before('intelligence.behavior_events', 'public.practice_sessions');
  });

  it('enforces server-side super-admin access, locks, confirmation, and fail-closed cross-owner guards', () => {
    expect(migration).toContain('public._admin_beta_reset_is_super_admin()');
    expect(migration).toContain('Administrative accounts cannot be registered as synthetic candidates.');
    expect(migration).toContain("lower(coalesce(auth.jwt() ->> 'email', '')) = 'gopalrock.naren@gmail.com'");
    expect(migration).toContain('email_confirmed_at is not null');
    expect(migration).toContain("public._admin_beta_reset_lock_targets(p_mode, 'SHARE')");
    expect(migration).toContain("public._admin_beta_reset_lock_targets(p_mode, 'SHARE ROW EXCLUSIVE')");
    expect(migration).toContain('lock table public.profiles in %s mode');
    expect(migration).toContain("select 'public'::text, 'user_attempts'::text where p_mode = 'pie_only'");
    expect(migration).toContain('Data changed since preview. Run preview again.');
    expect(migration).toContain('public._admin_beta_reset_fingerprint(p_mode, counts)');
    expect(migration).toContain('string_agg(id::text');
    expect(migration).toContain('Confirmation phrase does not match');
    expect(migration).toContain("p_mode is null or p_mode not in ('pie_only', 'full_candidate')");
    expect(migration).toContain('a non-synthetic attempt references a synthetic practice session');
    expect(migration).toContain('a non-synthetic PIE observation references a synthetic attempt');
    expect(migration).toContain('a non-synthetic AMC evaluation references a synthetic candidate state');
  });

  it('keeps the reset fail-closed when synthetic provenance is unavailable', () => {
    expect(migration).toContain('synthetic-candidate registry is missing');
    expect(migration).toContain('no explicitly registered synthetic candidates exist');
    expect(migration).toContain('transaction will roll back');
  });
});
