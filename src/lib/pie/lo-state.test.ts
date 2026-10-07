import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { deriveLoState, pCorrect, type GradedAttempt } from "./lo-state";

const att = (o: Partial<GradedAttempt>, i: number): GradedAttempt => ({
  attemptId: `a${i}`, questionId: `q${i}`, at: `2026-10-07T00:00:0${i}Z`, correct: true,
  firstAnswerCorrect: true, confidenceLevel: 3, timeTakenSeconds: 20, answerChanges: 0,
  irtB: 0, loWeight: 1, ...o,
});

describe("PIE P2 per-LO state policy (TS reference of SQL pie-lo-state/p2.0)", () => {
  it("matches the SQL replica result for the CARDIO.HF.DX fixture", () => {
    // fixtures.sql: Q1 b=-5/3, Q2 b=-4/3, Q3 b=-1; verify_p1_p2.sql T4 attempts.
    const s = deriveLoState([
      att({ correct: true, firstAnswerCorrect: false, confidenceLevel: 1, irtB: -5 / 3 }, 1),
      att({ correct: true, firstAnswerCorrect: true, confidenceLevel: 5, irtB: -4 / 3 }, 2),
      att({ correct: false, firstAnswerCorrect: false, confidenceLevel: 5, irtB: -1 }, 3),
    ])!;
    // Values produced by the local Postgres replica (pie.learner_lo_state).
    expect(s.mastery).toBeCloseTo(0.387183, 5);
    expect(s.masteryConfidence).toBeCloseTo(0.148181, 5);
    expect(s.abilityTheta).toBeCloseTo(-0.459169, 5);
    expect(s.fragileCorrect).toBe(1);
    expect(s.confidentWrong).toBe(1);
    expect(s.firstAnswerCorrectRate).toBeCloseTo(0.3333, 4);
    expect(s.reviewDueAt).toBeNull();
  });

  it("is difficulty-weighted: a correct answer on a hard item moves mastery more than on an easy item", () => {
    const hard = deriveLoState([att({ irtB: 2 }, 1)])!;
    const easy = deriveLoState([att({ irtB: -2 }, 1)])!;
    expect(hard.mastery).toBeGreaterThan(easy.mastery);
  });

  it("keeps weakness (mastery) and uncertainty (mastery_confidence) separate", () => {
    const fewWrong = deriveLoState([att({ correct: false }, 1)])!;
    const manyWrong = deriveLoState(Array.from({ length: 8 }, (_, i) => att({ correct: false }, i)))!;
    expect(manyWrong.mastery).toBeLessThan(fewWrong.mastery);
    expect(manyWrong.masteryConfidence).toBeGreaterThan(fewWrong.masteryConfidence);
  });

  it("is deterministic and order-sensitive only through the given order", () => {
    const xs = [att({ correct: false }, 1), att({}, 2), att({ irtB: 1 }, 3)];
    expect(deriveLoState(xs)).toEqual(deriveLoState(xs.map((x) => ({ ...x }))));
  });

  it("applies the guessing floor", () => {
    expect(pCorrect(-50, 0)).toBeCloseTo(0.2, 6);
    expect(pCorrect(50, 0)).toBeCloseTo(1, 6);
  });

  it("uses no fixed weakness slot or subject quota anywhere in PIE source", () => {
    const sql = readFileSync(resolve(process.cwd(), "supabase/migrations_v2/0046_pie_p2_learner_lo_state.sql"), "utf8");
    expect(sql).not.toMatch(/quota|weakness slot/i);
  });
});

describe("P2 migration security contract", () => {
  const sql = readFileSync(resolve(process.cwd(), "supabase/migrations_v2/0046_pie_p2_learner_lo_state.sql"), "utf8");
  it("closes direct learner writes to attempts, sessions and behaviour events", () => {
    expect(sql).toContain("drop policy if exists attempts_insert_own on public.user_attempts");
    expect(sql).toContain("drop policy if exists sessions_update_own on public.practice_sessions");
    expect(sql).toContain("revoke insert on intelligence.behavior_events from anon, authenticated");
    expect(sql).toContain("create trigger user_attempts_append_only");
  });
  it("never grants learners the irt or answer-key columns and returns no answer key", () => {
    expect(sql).not.toMatch(/grant[^;]*(irt_b|correct_answer)[^;]*to[^;]*authenticated/i);
    const getter = sql.slice(sql.indexOf("create or replace function public.get_my_lo_state"));
    expect(getter).not.toContain("correct_answer");
    expect(getter).not.toContain("selected_answer");
  });
  it("keeps the recompute internal and exposes only auth.uid()-scoped wrappers", () => {
    expect(sql).toContain("grant execute on function pie.recompute_learner_lo_state(uuid) to service_role;");
    expect(sql).toMatch(/refresh_my_lo_state\(\)[\s\S]*auth\.uid\(\)/);
  });
});
