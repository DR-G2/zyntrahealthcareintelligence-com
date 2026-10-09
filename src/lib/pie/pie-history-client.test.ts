import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchLegacyShapedHistory, fetchPieAttemptHistory, fetchReviewDue, toLegacyAttempt, type HistoryDeps, type PieHistoryRow } from "./pie-history-client";
import { canBrowseQuestionBank } from "@/pages/Questions";
import { ADMIN_EMAILS, SUPER_ADMIN_EMAIL } from "@/lib/admin-emails";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const row = (i: number, extra: Partial<PieHistoryRow> = {}): PieHistoryRow => ({
  attempt_id: `a${i}`, session_id: "s1", session_mode: "pie_adaptive", question_id: `q${i}`, zyntra_id: `ZQ-${i}`,
  stem: `stem ${i}`, options: ["x", "y"], subject_id: "sub", subject_name: "Adult Medicine", subtopic_id: null, subtopic_name: null,
  difficulty_tier: "3", lo_id: "lo", lo_title: "LO title", concept_title: "C", selected_answer: "A", is_correct: i % 2 === 0,
  correct_answer: "A", explanation: "why", confidence_level: 2, time_taken_seconds: 30, time_to_first_click: 4,
  answer_changes_count: 1, change_sequence: ["B", "A"], question_position: i, created_at: `2026-10-0${i + 1}T00:00:00Z`, ...extra,
});
const deps = (data: unknown, error: { message?: string } | null = null): HistoryDeps => ({ ensureSession: vi.fn(async () => undefined), rpc: vi.fn(async () => ({ data, error })) });

describe("P5 learner history (PIE attempts only)", () => {
  it("calls get_my_attempt_history with a clamped limit, never a question id", async () => {
    const d = deps([row(0)]);
    await fetchPieAttemptHistory(99999, d);
    expect(d.rpc).toHaveBeenCalledWith("get_my_attempt_history", { p_limit: 5000 });
  });

  it("passes both fields of the composite cursor for stable pagination", async () => {
    const d = deps([row(0)]);
    await fetchPieAttemptHistory(25, d, { createdAt: "2026-10-01T00:00:00Z", attemptId: "00000000-0000-0000-0000-000000000001" });
    expect(d.rpc).toHaveBeenCalledWith("get_my_attempt_history", {
      p_limit: 25,
      p_before: "2026-10-01T00:00:00Z",
      p_before_attempt_id: "00000000-0000-0000-0000-000000000001",
    });
  });

  it("rejects incomplete history cursors", async () => {
    await expect(fetchPieAttemptHistory(25, deps([]), { createdAt: "", attemptId: "attempt-id" }))
      .rejects.toThrow("Both history cursor fields are required.");
  });

  it("maps to the legacy page shape, keeping answered-only key and telemetry", () => {
    const l = toLegacyAttempt(row(0));
    expect(l.questions.correct_answer).toBe("A");
    expect(l.questions.question_text).toBe("stem 0");
    expect(l.questions.category).toBe("Adult Medicine");
    expect(l.questions.subtopic).toBe("LO title");
    expect(l.change_sequence).toEqual(["B", "A"]);
    expect(l.confidence_level).toBe(2);
  });

  it("supports deployed V2 session_type values and surfaces RPC errors", async () => {
    const rows = await fetchLegacyShapedHistory(10, "asc", deps([row(1), row(0)]));
    expect(rows.map((r) => r.id)).toEqual(["a0", "a1"]);
    expect(row(0, { session_mode: "pie_adaptive" }).session_mode).toBe("pie_adaptive");
    await expect(fetchPieAttemptHistory(10, deps(null, { message: "boom" }))).rejects.toThrow("boom");
  });

  it("review-due uses get_my_review_due", async () => {
    const d = deps([]);
    await fetchReviewDue(50, 7, d);
    expect(d.rpc).toHaveBeenCalledWith("get_my_review_due", { p_limit: 50, p_horizon_days: 7 });
  });

  it("no learner history page reads user_attempts or question keys directly", () => {
    for (const f of ["src/pages/QuestionHistory.tsx", "src/components/history/MCQHistory.tsx", "src/components/history/MCQReviewQueue.tsx",
      "src/pages/MistakeReview.tsx", "src/pages/Profile.tsx", "src/pages/TrustYourGut.tsx", "src/pages/StudyPlan.tsx", "src/pages/PerformanceIntelligenceV2.tsx"]) {
      const src = read(f);
      expect(src, f).not.toMatch(/from\(['"]user_attempts['"]\)/);
      expect(src, f).not.toMatch(/from\(['"]questions['"]\)/);
      expect(src, f).not.toMatch(/questions\([^)]*correct_answer/);
      expect(src, f).toContain("fetchLegacyShapedHistory");
    }
  });

  it("/questions bank browser is super-admin-only (mirrors admin-question-bank)", () => {
    expect(canBrowseQuestionBank(null)).toBe(false);
    expect(canBrowseQuestionBank("learner@example.com")).toBe(false);
    expect(canBrowseQuestionBank(SUPER_ADMIN_EMAIL)).toBe(true);
    expect(canBrowseQuestionBank(` ${SUPER_ADMIN_EMAIL.toUpperCase()} `)).toBe(true);
    for (const e of ADMIN_EMAILS.filter((a) => a !== SUPER_ADMIN_EMAIL)) expect(canBrowseQuestionBank(e)).toBe(false);
  });

  it("maps legacy attempts without a session and withholds answer keys", () => {
    const legacy = toLegacyAttempt(row(0, { session_id: null, correct_answer: null, explanation: null }));
    expect(legacy.session_id).toBeNull();
    expect(legacy.questions.correct_answer).toBe("");
    expect(legacy.questions.explanation).toBeNull();
  });

  it("0081 history RPC aligns to deployed V2 schema and preserves learner isolation", () => {
    const m = read("supabase/migrations_v2/0081_v2_p5_history_rpc_schema_alignment.sql");
    expect(m).toContain("left join public.practice_sessions ps");
    expect(m).toContain("(ua.session_id is null or ps.id is not null)");
    expect(m).toContain("ps.user_id = v_uid");
    expect(m).toContain("where ua.user_id = v_uid");
    expect(m).toContain("case when ps.status = 'completed' then q.correct_answer else null end");
    expect(m).toContain("case when ps.status = 'completed' then q.explanation else null end");
    expect(m).toContain("drop function if exists public.get_my_attempt_history(integer, timestamptz)");
    expect(m).toContain("p_before_attempt_id uuid default null");
    expect(m).toContain("ua.created_at = p_before");
    expect(m).toContain("ua.id < p_before_attempt_id");
    expect(m).toContain("order by ua.created_at desc, ua.id desc");
    expect(m).toContain("revoke all on function public.get_my_attempt_history(integer, timestamptz, uuid)");
    expect(m).toContain("grant execute on function public.get_my_attempt_history(integer, timestamptz, uuid)");
    expect(m).toContain("to authenticated, service_role");
    expect(m).toContain("left join public.practice_sessions ps");
    expect(m).toContain("(ua.session_id is null or ps.id is not null)");
    expect(m).not.toMatch(/(?:from|join)\\s+pie\\.adaptive_session/i);
  });
});
