import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(__dirname, "../../../supabase/migrations_v2/0092_nudge_targeted_session_lifecycle.sql"),
  "utf8",
);
const coldStartMigration = readFileSync(
  resolve(__dirname, "../../../supabase/migrations_v2/0095_nudge_cold_start_progression.sql"),
  "utf8",
);
const v2AlignmentMigration = readFileSync(
  resolve(__dirname, "../../../supabase/migrations_v2/0098_nudge_v2_session_registry_alignment.sql"),
  "utf8",
);
const currentNudgeMigration = readFileSync(
  resolve(__dirname, "../../../supabase/migrations_v2/0103_nudge_cold_start_mixed_fallback.sql"),
  "utf8",
);

const client = readFileSync(resolve(__dirname, "pie-practice-client.ts"), "utf8");
const session = readFileSync(resolve(__dirname, "../../components/practice/PieDrillSession.tsx"), "utf8");
const page = readFileSync(resolve(__dirname, "../../pages/Practice.tsx"), "utf8");

describe("Nudge targeted-session contract", () => {
  it("creates a session only after the authoritative selector returns READY", () => {
    expect(migration).toContain("public.get_my_nudge_target()");
    expect(migration).toContain("v_target.status <> 'READY'");
    expect(migration).toContain("'NUDGE_NOT_READY");
  });

  it("restricts every target question to the chosen primary LO and unseen active content", () => {
    expect(migration).toContain("ql.lo_id = v_target.lo_id");
    expect(migration).toContain("ql.is_primary");
    expect(migration).toContain("q.status = 'active'");
    expect(migration).toContain("pie.pie_question_quarantine");
    expect(migration).toContain("bl.eligible");
    expect(migration).toContain("b.blueprint_key = 'AMC_CAT_MCQ'");
    expect(migration).toContain("ua.user_id = v_user and ua.question_id = q.id");
    expect(migration).toContain("if v_pos < 3 then");
  });

  it("enforces the deployed active-session ceiling without assuming a throttle table", () => {
    expect(migration).toContain("PIE_TOO_MANY_ACTIVE_SESSIONS");
    expect(migration).toContain(">= 3 then");
    // The deployed schema has no pie.session_create_throttle table. Do not
    // encode an unimplemented 30-second throttle as a contract requirement.
    expect(migration).not.toContain("pie.session_create_throttle");
    expect(migration).not.toContain("interval '30 seconds'");
    // The deployed V2 schema has no pie.adaptive_session relation. Nudge
    // session ceilings must be derived from the canonical practice_sessions row.
    expect(migration).toContain("ps.config->>'mode' = 'nudge'");
    expect(migration).not.toContain("pie.adaptive_session");
    expect(coldStartMigration).toContain("ps.config->>'mode' = 'nudge'");
    expect(coldStartMigration).not.toContain("pie.adaptive_session");
  });

  it("uses the canonical V2 session registry for Nudge creation", () => {
    expect(v2AlignmentMigration).toContain("ps.config->>'mode' = 'nudge'");
    expect(v2AlignmentMigration).toContain("public.practice_sessions");
    expect(v2AlignmentMigration).not.toContain("pie.adaptive_session");
    expect(v2AlignmentMigration).toContain("public.get_my_nudge_target()");
  });

  it("keeps server grading and PIE telemetry on the existing attempt path", () => {
    expect(migration).not.toContain("create or replace function public.save_attempt");
    expect(migration).not.toContain("create or replace function pie.rebuild_authoritative_inference");
    expect(session).toContain("submitPieAnswer");
    expect(session).toContain("confidenceLevel: conf");
    expect(session).toContain("changeSequence: sequence[index] || [answer]");
  });

  it("uses a fixed LO-scoped question set rather than global adaptive continuation", () => {
    expect(client).toContain("create_my_nudge_session");
    expect(session).toContain("primaryMode !== 'nudge' && questions.length < target");
    expect(session).toContain("startNudgeSession(target)");
  });

  it("reassesses only after completion and scopes progress to a completed Nudge objective", () => {
    expect(migration).toContain("public.get_my_nudge_progress(p_lo_id uuid)");
    expect(migration).toContain("ps.status = 'completed'");
    expect(migration).toContain("ps.config->>'selector' = 'nudge-gap-v1'");
    expect(client).toContain("get_my_nudge_progress");
    expect(session).toContain("getNudgeProgress(nudgeTarget.loId)");
    expect(page).toContain("PIE reassessment");
  });

  it("uses mixed approved questions for the first 50 mapped interactions and falls back when PIE has no supported target", () => {
    expect(currentNudgeMigration).toContain("v_mapped_interactions >= 50");
    expect(currentNudgeMigration).toContain("'nudge-cold-start-v1'");
    expect(currentNudgeMigration).toContain("'MIXED_PRACTICE_NO_SUPPORTED_TARGET'");
    expect(currentNudgeMigration).toContain("'mixed_fallback'");
    expect(currentNudgeMigration).not.toContain("v_target.status <> 'READY'");
    expect(currentNudgeMigration).toContain("public.get_my_nudge_target()");
    expect(currentNudgeMigration).toContain("pie.pie_question_quarantine");
    expect(currentNudgeMigration).toContain("b.blueprint_key = 'AMC_CAT_MCQ'");
    expect(coldStartMigration).toContain("v_mapped_interactions >= 50");
    expect(coldStartMigration).toContain("'nudge-cold-start-v1'");
    expect(coldStartMigration).toContain("'MIXED_PRACTICE_NO_SUPPORTED_TARGET'");
    expect(coldStartMigration).toContain("'mixed_fallback'");
    expect(coldStartMigration).toContain("public.get_my_nudge_target()");
    expect(coldStartMigration).toContain("pie.pie_question_quarantine");
    expect(coldStartMigration).toContain("b.blueprint_key = 'AMC_CAT_MCQ'");
    expect(coldStartMigration).toContain("order by");
    expect(coldStartMigration).toContain("random()");
    expect(client).toContain("COLD_START_FIRST_50");
    expect(session).toContain("Nudge · evidence-building");
    expect(session).toContain("first 50 saved learning-objective interactions");
    expect(session).toContain("Nudge · mixed fallback");
    expect(session).toContain("PIE has no supported target with enough unseen questions right now.");
    expect(session).toContain("nudgeTarget?.loId");
  });

  it("does not enable a Nudge session without explicit server status or eligible content", () => {
    expect(client).toContain("(!row.lo_id && !coldStart)");
    expect(page).toContain("Start Nudge");
    expect(page).toContain("Reassessment unavailable");
  });
});
