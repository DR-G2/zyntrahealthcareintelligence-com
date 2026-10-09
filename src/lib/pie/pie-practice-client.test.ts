import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { startPieSession, nextPieQuestion, finishPieSession, loadSessionQuestions, type PieDeps } from "./pie-practice-client";
import { resultsToQuestions } from "@/components/practice/PieDrillSession";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

function deps(rpcImpl: PieDeps["rpc"]): PieDeps {
  return {
    ensureSession: vi.fn(async () => undefined),
    rpc: vi.fn(rpcImpl),
    saveAttempt: vi.fn(async () => ({}) as never),
    complete: vi.fn(async () => ({})),
    results: vi.fn(async () => []),
    resume: vi.fn(async () => ({})),
  };
}

const row = (pos: number, extra: Record<string, unknown> = {}) => ({
  session_question_id: `sq${pos}`, session_id: "s1", question_id: `q${pos}`, question_position: pos,
  presented_at: null, answered_at: null, zyntra_id: `ZQ-000${pos}`, stem: `stem ${pos}`, options: ["a", "b"],
  subject_id: null, subtopic_id: null, difficulty_tier: null, version: 1, ...extra,
});

describe("P5 Practice data path (PIE, server-selected, no client key)", () => {
  it("creates the session server-side and never sends question ids", async () => {
    const d = deps(async (fn) => fn === "pie_create_session"
      ? { data: [{ session_id: "s1", question_count: 2 }], error: null }
      : { data: [row(1), row(0)], error: null });
    const r = await startPieSession(500, d);
    expect(d.rpc).toHaveBeenCalledWith("pie_create_session", { p_count: 50, p_blueprint_key: "ZYNTRA_GENERAL" });
    expect(JSON.stringify((d.rpc as ReturnType<typeof vi.fn>).mock.calls)).not.toContain("p_question_ids");
    expect(r.sessionId).toBe("s1");
    expect(r.questions.map((q) => q.question_position)).toEqual([0, 1]);
  });

  it("strips any key-like field even if a server ever returned one", async () => {
    const d = deps(async () => ({ data: [row(0, { correct_answer: "A", explanation: "why" })], error: null }));
    const [q] = await loadSessionQuestions("s1", d);
    expect(q).not.toHaveProperty("correct_answer");
    expect(q).not.toHaveProperty("explanation");
  });

  it("next question: appends a server-selected item, returns null when PIE has none", async () => {
    let calls = 0;
    const d = deps(async (fn) => {
      if (fn === "pie_next_question") { calls += 1; return calls === 1 ? { data: [{}], error: null } : { data: null, error: { message: "PIE_NO_ELIGIBLE_CANDIDATE" } }; }
      return { data: [row(0), row(1)], error: null };
    });
    expect((await nextPieQuestion("s1", d))?.question_id).toBe("q1");
    expect(await nextPieQuestion("s1", d)).toBeNull();
  });

  it("other next-question errors (e.g. unanswered) are raised, not swallowed", async () => {
    const d = deps(async () => ({ data: null, error: { message: "PIE_UNANSWERED: answer first" } }));
    await expect(nextPieQuestion("s1", d)).rejects.toThrow("PIE_UNANSWERED");
  });

  it("finish completes then reads answered-only results", async () => {
    const d = deps(async () => ({ data: null, error: null }));
    await finishPieSession("s1", d);
    expect(d.complete).toHaveBeenCalledWith("s1");
    expect(d.results).toHaveBeenCalledWith("s1");
  });

  it("results mapping keeps unanswered items keyless", () => {
    const r = resultsToQuestions([
      { ...row(0), correct_answer: "B", explanation: "x", selected_answer: "B", is_correct: true, confidence_level: 3, time_taken_seconds: 10, answer_changes_count: 0 },
      { ...row(1), correct_answer: null as unknown as string, explanation: null, selected_answer: null, is_correct: null, confidence_level: null, time_taken_seconds: null, answer_changes_count: 0 },
    ] as never);
    expect(r.questions[1].correct_answer).toBe("");
    expect(r.questions[1].explanation).toBeNull();
    expect(r.answers).toEqual({ 0: "B" });
  });

  it("Practice has no client-side selector and no key read", () => {
    const practice = read("src/pages/Practice.tsx");
    const drill = read("src/components/practice/PieDrillSession.tsx");
    for (const src of [practice, drill]) {
      expect(src).not.toMatch(/select\([^)]*correct_answer/);
      expect(src).not.toContain("adaptNextQuestion");
      expect(src).not.toContain("adaptivePoolRef");
      expect(src).not.toContain("create_practice_session");
      expect(src).not.toContain("persistAttemptsViaV2");
    }
    expect(practice).toContain("<PieDrillSession");
    expect(read("src/lib/pie/pie-practice-client.ts")).toContain("'pie_create_session'");
  });

  it("migrations: F1 revoke, scheduler/C1/C3 policy, bank swap retires (never deletes) ZYNTRA-BS", () => {
    const f1 = read("supabase/migrations_v2/0055_pie_p5_f1_question_key_columns.sql");
    expect(f1).toContain("revoke select (explanation, correct_answer) on public.questions from public, anon, authenticated");
    expect(f1).toContain("with (security_invoker = true)");
    const p5 = read("supabase/migrations_v2/0056_pie_p5_review_scheduler_session_rules.sql");
    expect(p5).toContain("'max_per_concept', 2");
    expect(p5).toContain("'review_priority', 10");
    expect(p5).not.toMatch(/quota|ratio|per_domain|slot/i);
    const bank = read("supabase/migrations_v2/0057_pie_p5_qbank_swap.sql");
    expect(bank).toMatch(/where zyntra_id like 'ZYNTRA-BS-%' and status <> 'retired'/);
    expect(bank).not.toMatch(/delete from public\.questions/i);
  });
});
