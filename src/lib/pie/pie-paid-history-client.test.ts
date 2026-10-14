import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchAttemptSummary, fetchPracticeResultsHistory, fetchReviewQueueAttempts, fetchTrustGutAttempts, isPaywallError, PAYWALL_MESSAGE, type PaidHistoryDeps } from "./pie-paid-history-client";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const PAGES = ["src/pages/Questions.tsx", "src/pages/QuestionHistory.tsx", "src/pages/MistakeReview.tsx", "src/pages/TrustYourGut.tsx",
  "src/pages/StudyPlan.tsx", "src/pages/Profile.tsx", "src/pages/PerformanceIntelligenceV2.tsx",
  "src/components/history/MCQHistory.tsx", "src/components/history/MCQReviewQueue.tsx"];

function deps(impl: (fn: string, args: Record<string, unknown>) => { data: unknown; error: { message?: string; code?: string } | null }): PaidHistoryDeps {
  return { ensureSession: vi.fn(async () => undefined), rpc: vi.fn(async (fn, args) => impl(fn, args)) };
}

describe("paid history client (post paid-practice lock)", () => {
  it("42501 becomes a generic PaywallError with no server detail and no fallback call", async () => {
    for (const run of [fetchTrustGutAttempts, fetchReviewQueueAttempts, fetchPracticeResultsHistory, fetchAttemptSummary] as Array<(n: number, d: PaidHistoryDeps) => Promise<unknown>>) {
      const d = deps(() => ({ data: null, error: { code: "42501", message: "PIE practice session required" } }));
      const err = (await run(10, d).catch((e) => e)) as Error;
      expect(isPaywallError(err)).toBe(true);
      expect(err.message).toBe(PAYWALL_MESSAGE);
      expect(err.message).not.toMatch(/session|paid access required/i);
      expect(d.rpc).toHaveBeenCalledTimes(1);
    }
  });

  it("practice history reads content only via get_practice_session_results", async () => {
    const d = deps((fn) => {
      if (fn === "get_my_practice_sessions") return { data: [{ session_id: "s1", created_at: "2026-10-01T00:00:00Z", completed_at: "2026-10-01T00:10:00Z", question_count: 2 }], error: null };
      if (fn === "get_my_trust_gut_attempts") return { data: [{ attempt_id: "a1", session_id: "s1", question_id: "q1", created_at: "2026-10-01T00:05:00Z", subject_name: "Cardio", subtopic_name: "HF", change_sequence: ["B", "A"], time_to_first_click: 2 }], error: null };
      if (fn === "get_practice_session_results") return { data: [
        { session_question_id: "x1", session_id: "s1", question_id: "q1", stem: "S", options: ["a", "b"], correct_answer: "A", explanation: "E", selected_answer: "A", is_correct: true, answer_changes_count: 1 },
        { session_question_id: "x2", session_id: "s1", question_id: "q2", stem: "T", options: [], correct_answer: "C", explanation: null, selected_answer: null, is_correct: null },
      ], error: null };
      throw new Error("unexpected " + fn);
    });
    const rows = await fetchPracticeResultsHistory(5, d);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "a1", change_sequence: ["B", "A"], time_to_first_click: 2, questions: { category: "Cardio", subtopic: "HF", correct_answer: "A" } });
    expect((d.rpc as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]).sort()).toEqual(["get_my_practice_sessions", "get_my_trust_gut_attempts", "get_practice_session_results"]);
  });

  it("no migrated page calls the revoked history RPC, reads question/history tables, or uses a service key", () => {
    for (const f of PAGES) {
      const src = read(f);
      expect(src, f).not.toMatch(/fetchLegacyShapedHistory|fetchPieAttemptHistory|get_my_attempt_history/);
      expect(src, f).not.toMatch(/from\(\s*['"](questions|questions_for_learner|user_attempts|practice_session_questions)['"]/);
      expect(src, f).not.toMatch(/service_role|SERVICE_ROLE|serviceRole/);
    }
  });

  it("0086 RPCs: definer, empty search_path, authenticated-only, paid guard reused from the lock", () => {
    const m = read("supabase/migrations_v2/0086_paid_history_rpcs.sql");
    for (const fn of ["get_my_practice_sessions", "get_my_trust_gut_attempts", "get_my_review_queue_attempts", "get_my_attempt_summary"]) expect(m).toContain(`function public.${fn}(`);
    expect(m.match(/security definer set search_path = ''/g)?.length).toBe(4);
    expect(m.match(/perform public\._assert_paid_pie_session\(null\)/g)?.length).toBe(3);
    expect(m).toMatch(/from public, anon;/);
    expect(m).toMatch(/to authenticated;/);
    expect(m).not.toMatch(/to (anon|public)\b/);
  });
});
