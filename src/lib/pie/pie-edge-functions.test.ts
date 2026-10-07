import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { toAnalyzeAttempts, toFlashcardSources, sameLearner, PIE_V2_AUTH_HEADER, type PieHistoryRow } from "../../../supabase/functions/_shared/pie-v2-history";
import { PIE_V2_AUTH_HEADER as CLIENT_HEADER } from "./pie-history-client";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const row = (i: number, ok: boolean, q = `q${i}`, t = `2026-10-0${i + 1}T00:00:00Z`): PieHistoryRow => ({
  attempt_id: `a${i}`, session_id: "s", session_mode: "adaptive", question_id: q, stem: `stem ${q}`, options: [],
  subject_name: "Adult Medicine", subtopic_name: null, difficulty_tier: "3", lo_title: "LO", selected_answer: "B",
  is_correct: ok, correct_answer: "A", explanation: "why", confidence_level: 2, time_taken_seconds: 20, time_to_first_click: 3,
  answer_changes_count: 1, change_sequence: ["A", "B"], question_position: i, created_at: t,
});

describe("P5 edge functions read PIE attempts on V2", () => {
  it("analyze-behavior shape: oldest first, legacy fields, answered-only key", () => {
    const a = toAnalyzeAttempts([row(2, true), row(0, false)]);
    expect(a.map((x) => x.id)).toEqual(["a0", "a2"]);
    expect(a[0].questions).toEqual({ category: "Adult Medicine", difficulty: "3", difficulty_tier: "3", correct_answer: "A" });
    expect(a[0].change_sequence).toEqual(["A", "B"]);
  });

  it("flashcards use only the learner's own wrong answers, distinct, newest first, capped", () => {
    const rows = [row(0, false, "qx"), row(1, true, "qy"), row(2, false, "qx"), row(3, false, "qz")];
    const f = toFlashcardSources(rows, 50, 20);
    expect(f.map((x) => x.id)).toEqual(["qz", "qx"]);
    expect(f.every((x) => x.correct_answer === "A")).toBe(true);
    expect(toFlashcardSources(rows, 50, 1)).toHaveLength(1);
    expect(toFlashcardSources([row(0, true)])).toEqual([]);
  });

  it("V2 identity must match the V1 caller", () => {
    expect(sameLearner("A@x.com", "a@x.com ")).toBe(true);
    expect(sameLearner("a@x.com", "b@x.com")).toBe(false);
    expect(sameLearner(null, "a@x.com")).toBe(false);
  });

  it("functions no longer read the legacy attempt/question tables and use the caller's V2 JWT", () => {
    expect(CLIENT_HEADER).toBe(PIE_V2_AUTH_HEADER);
    for (const f of ["supabase/functions/analyze-behavior/index.ts", "supabase/functions/generate-flashcards/index.ts"]) {
      const src = read(f);
      expect(src, f).not.toMatch(/from\("user_attempts"\)/);
      expect(src, f).not.toMatch(/from\("questions"\)/);
      expect(src, f).toContain("fetchCallerPieHistory(req, user.email");
      expect(src, f).toContain("x-pie-v2-authorization");
    }
    const shared = read("supabase/functions/_shared/pie-v2.ts");
    expect(shared).toContain('rpc("get_my_attempt_history"');
    expect(shared).not.toMatch(/SERVICE_ROLE/);
    expect(read("src/pages/Flashcards.tsx")).toContain("pieV2AuthHeaders()");
    expect(read("src/pages/BehaviorProfile.tsx")).toContain("pieV2AuthHeaders()");
  });
});
