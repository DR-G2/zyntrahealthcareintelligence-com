import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { toAnalyzeAttempts, toCompletedCandidateBehaviourAttempts, toFlashcardSources, sameLearner, PIE_V2_AUTH_HEADER, type PieHistoryRow } from "../../../supabase/functions/_shared/pie-v2-history";
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
    expect(a[0].session_mode).toBe("adaptive");
  });

  it("Behaviour uses candidate-wide verified evidence from explicitly labelled comparable MCQ modes", () => {
    const candidates = [
      { ...row(0, true), session_mode: "normal_mcq" },
      { ...row(1, true), session_mode: "normal_mcq", correct_answer: null },
      { ...row(2, true), session_mode: "normal_mcq", correct_answer: "   " },
      { ...row(3, true), session_mode: "nudge" },
      { ...row(4, true), session_mode: "amc_exam" },
      { ...row(5, true), session_mode: "mock_practice" },
      { ...row(6, true), session_mode: "osce" },
      row(7, true),
    ];
    const eligible = toCompletedCandidateBehaviourAttempts(candidates);
    expect(eligible.map(attempt => attempt.id)).toEqual(["a0", "a3", "a4", "a5"]);
    expect(eligible.map(attempt => attempt.session_mode)).toEqual(["normal_mcq", "nudge", "amc_exam", "mock_practice"]);
  });

  it("keeps missing answer-change counts unavailable in Behaviour analysis", () => {
    const missing = toAnalyzeAttempts([{ ...row(0, true), answer_changes_count: null }]);
    expect(missing[0].answer_changes_count).toBeNull();
    const src = read("supabase/functions/analyze-behavior/index.ts");
    expect(src).toContain("const changeEvidence = attempts.filter((a) => a.answer_changes_count !== null)");
    expect(src).toContain("const changedAttempts = changeEvidence.filter((a) => (a.answer_changes_count as number) > 0).length");
    expect(src).toContain("changeEvidence.length > 0 ? changedAttempts / changeEvidence.length : null");
    expect(src).toContain("s.changeEvidenceCount > 0 ? Math.round((s.changedAttempts / s.changeEvidenceCount) * 100) : null");
    expect(src).toContain("validChanges.filter((a) => (a.answer_changes_count as number) > 0).length");
    expect(src).not.toContain("totalChanges / changeEvidence.length");
    expect(src).toContain("top-level changeRate is a fraction from 0 to 1");
    expect(src).toContain("subjectStats and blockPerformance changeRate values are percentages from 0 to 100");
    expect(src).not.toContain("a.answer_changes_count || 0");
  });

  it("flashcards use only the learner's own wrong answers, distinct, newest first, capped", () => {
    const rows = [row(0, false, "qx"), row(1, true, "qy"), row(2, false, "qx"), row(3, false, "qz")];
    const f = toFlashcardSources(rows, 50, 20);
    expect(f.map((x) => x.id)).toEqual(["qz", "qx"]);
    expect(f.every((x) => x.correct_answer === "A")).toBe(true);
    expect(toFlashcardSources(rows, 50, 1)).toHaveLength(1);
    expect(toFlashcardSources([row(0, true)])).toEqual([]);
  });

  it("Trust Your Gut renders unavailable changed-answer metrics without dereferencing null", () => {
    const src = read("src/pages/TrustYourGut.tsx");
    expect(src).toContain("stats.firstInstinctAccuracy === null ? 'Unavailable'");
    expect(src).toContain("stats.finalAccuracy === null ? 'Unavailable'");
    expect(src).toContain("a.answer_changes_count === a.change_sequence.length - 1");
    expect(src).toContain("function hasValidChangeEvidence(a: AttemptWithQuestion): boolean");
    expect(src).toContain("changeEvidenceCount > 0 ? (attemptsWithChangesCount / changeEvidenceCount) * 100 : null");
    expect(src).toContain("Candidate-wide view · practice context retained");
    expect(src).toContain("const candidateAttempts = useMemo(");
    expect(src).not.toContain("Choose practice mode");
    expect(src).not.toContain("selectedMode");
    expect(src).toContain("missingChangeEvidenceCount");
    expect(src).not.toContain("(attemptsWithChangesCount / totalAttempts)");
    expect(src).toContain("answersMatch(a.change_sequence[a.change_sequence.length - 1], a.selected_answer)");
    expect(src).toContain("a.change_sequence.length === 1 && answersMatch(a.change_sequence[0], a.selected_answer)");
    expect(src).toContain("a.answer_changes_count === 0 && hasValidChangeEvidence(a)");
    expect(src).toContain("if (!a.change_sequence_valid || a.answer_changes_count === null) return false;");
    expect(src).toContain("firstTotal > 0 ? Math.round((s.firstCorrect / s.firstTotal) * 100) : null");
    expect(src).not.toContain(">{stats.firstInstinctAccuracy.toFixed(1)}%");
    expect(src).not.toContain(">{stats.finalAccuracy.toFixed(1)}%");
    expect(src).toContain("row.changeRate !== null && <div");
    expect(src).not.toContain("row.changeRate ?? 0");
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
    expect(read("src/pages/BehaviorProfile.tsx")).toContain("Behaviour analysis is temporarily unavailable. Please try again later.");
    expect(read("src/pages/BehaviorProfile.tsx")).toContain("s.type === 'stable' ? '✅ Stable' : 'Pattern unavailable'");
    expect(read("src/pages/BehaviorProfile.tsx")).not.toContain("description: e.message");
    expect(read("src/pages/BehaviorProfile.tsx")).toContain("if (profileError) throw profileError;");
    expect(read("src/pages/BehaviorProfile.tsx")).toContain("if (!profile) throw new Error('Behaviour profile was not returned.');");
    const behaviorUi = read("src/pages/BehaviorProfile.tsx");
    expect(behaviorUi).toContain("if (data.session_mode !== 'candidate_wide')");
    expect(behaviorUi).toContain("The stored profile predates the candidate-wide evidence contract.");
    expect(behaviorUi).toContain("Observed Response Pattern");
    expect(behaviorUi).toContain("Answer Changes Observed");
    expect(behaviorUi).not.toContain("Frequent Answer Changes");
    expect(behaviorUi).not.toContain("Recorded attempts show comparatively stable decision behaviour across the available sample.");
    expect(behaviorUi).toContain("s.type === 'stable' ? '✅ Stable' : 'Pattern unavailable'");
    expect(behaviorUi).not.toContain("s.type === 'unavailable' ? 'Evidence unavailable' : '✅ Stable'");
    const behaviorFn = read("supabase/functions/analyze-behavior/index.ts");
    const historyShared = read("supabase/functions/_shared/pie-v2-history.ts");
    expect(historyShared).toContain('const eligibleModes = new Set(["normal", "normal_mcq", "amc_exam", "mock_practice", "nudge"])');
    expect(historyShared).toContain("attempt.questions.correct_answer.trim().length > 0");
    expect(behaviorFn).toContain("toCompletedCandidateBehaviourAttempts(pie.rows)");
    expect(behaviorFn).toContain("signals.avgTime < 45");
    expect(behaviorFn).toContain("signals.fatigueIncrease >= 1.4");
    expect(behaviorFn).toContain("const latestSessionTimedAttempts = (latestSession ?? []).filter");
    expect(behaviorFn).toContain("lateBlock.meanChangesPerAttempt > earlyBlock.meanChangesPerAttempt");
    expect(behaviorFn).toContain("classification.recommendations.length === 0");
    expect(behaviorFn).toContain("const unsupportedClaimPattern =");
    expect(behaviorFn).toContain("&& visibleClaimsSupported");
    expect(behaviorFn).toContain("!unsupportedClaimPattern.test(classification.critical_finding)");
    expect(behaviorFn).toContain("No completed, verified candidate Behaviour attempts found");
    expect(behaviorFn).not.toContain("Predict AMC score range");
    expect(behaviorFn).not.toContain("osceBehavioralSignalsSample");
    expect(behaviorFn).toContain("predicted_score_low: null");
    expect(behaviorFn).toContain("avgTime: s.avgTime === null ? null : Math.round(s.avgTime)");
    expect(behaviorFn).not.toContain('from("station_attempts")');
    expect(behaviorFn).not.toContain('from("psychograph_history")');
    expect(behaviorFn).not.toContain('from("behavior_dna")');
    expect(behaviorFn).not.toContain("Multiple pauses, re-reads");
    expect(behaviorFn).not.toContain("visible stress markers");
    expect(behaviorFn).toContain("Behaviour profile lookup failed:");
    expect(behaviorFn).toContain("Behaviour profile write failed:");
    expect(behaviorFn).toContain("const validClassification = classification");
    expect(behaviorFn).toContain('enum: ["panic_changer", "rusher", "paralyzer", "strategist", "fatigue_victim", "subject_avoider", "unavailable"]');
    expect(behaviorFn).toContain('trap: { type: "string", enum: ["rushing_at_end"] }');
    expect(behaviorFn).toContain("&& archetypeHasEvidence(classification.archetype)");
    expect(behaviorFn).toContain('item?.trap === "rushing_at_end" && hasRushingAtEndEvidence');
    expect(behaviorFn).toContain('case "fatigue_victim": return hasFatigueTrend');
    expect(behaviorFn).toContain("meanChangesPerAttempt: meanChangesPerAttempt === null ? null");
    expect(behaviorFn).toContain('case "panic_changer": return finiteMetric(signals.meanChangesPerAttempt) && signals.meanChangesPerAttempt > 2');

    expect(behaviorFn).toContain("returned evidence was invalid.");
    expect(behaviorFn).toContain("Behaviour analysis is temporarily unavailable.");
    expect(behaviorFn).toContain('"Access-Control-Allow-Methods": "POST, OPTIONS"');
    expect(behaviorFn).not.toContain("JSON.stringify({ error: pie.error })");
    expect(behaviorFn).not.toContain("e instanceof Error ? e.message");
  });
});
