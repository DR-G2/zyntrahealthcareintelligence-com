import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(__dirname, "../../../supabase/migrations_v2/0096_pie_runtime_query_hardening.sql"),
  "utf8",
);
const aclMigration = readFileSync(
  resolve(__dirname, "../../../supabase/migrations_v2/0097_revoke_service_role_from_session_trace_rpc.sql"),
  "utf8",
);
const p21 = readFileSync(
  resolve(__dirname, "../../../scripts/pie-p21-2-decision-trace-integrity.mts"),
  "utf8",
);
const live = readFileSync(
  resolve(__dirname, "../../../scripts/pie-live-certification.mts"),
  "utf8",
);

describe("PIE runtime query hardening contract", () => {
  it("adds indexes for repeated selector eligibility probes", () => {
    expect(migration).toContain("pie_question_quarantine_open_question_idx");
    expect(migration).toContain("pie_lo_prerequisite_prerequisite_lo_idx");
    expect(migration).toContain("user_attempts_user_session_question_idx");
    expect(migration).toContain("practice_session_questions_session_question_idx");
    expect(migration).toContain("pie_decision_trace_user_session_created_idx");
  });

  it("exposes only the authenticated candidate's traces for the requested session", () => {
    expect(migration).toContain("public.get_my_pie_decision_traces_for_session(p_session_id uuid)");
    expect(migration).toContain("d.user_id = auth.uid()");
    expect(migration).toContain("d.session_id = p_session_id");
    expect(migration).toContain("ps.id = p_session_id and ps.user_id = auth.uid()");
    expect(migration).toContain("'question_id', d.question_id");
    expect(migration).toContain("'decision_type', d.decision_type");
    expect(migration).toContain("grant execute on function public.get_my_pie_decision_traces_for_session(uuid) to authenticated;");
    expect(migration).not.toContain("to authenticated, service_role");
    expect(migration).toContain("notify pgrst, 'reload schema';");
    expect(aclMigration).toContain("revoke all on function public.get_my_pie_decision_traces_for_session(uuid) from service_role;");
  });

  it("P21.2 uses the session-scoped trace contract rather than aggregating all candidate history", () => {
    expect(p21).toContain('rpc("get_my_pie_decision_traces_for_session", { p_session_id: sessionId })');
    expect(p21).not.toContain('rpc("get_my_pie_decision_traces")');
  });

  it("keeps live session-build certification to one initial selector decision", () => {
    expect(live).toContain('p_count: 1, p_blueprint_key: "AMC_CAT_MCQ", p_mode: "pie_adaptive"');
  });
});