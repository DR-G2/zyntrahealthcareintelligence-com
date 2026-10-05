import { describe, expect, test } from "vitest";
import { initialCandidateState } from "./inference";
import { initialQuestionState, updateQuestionState } from "./question";
import { rankQuestionsForDWIG, selectNextQuestion, validateDWIGSafety } from "./dwig";

describe("PIE P5 decision-weighted information gain", () => {
  function question(id: string, candidateIds = 12) {
    let q = initialQuestionState(id, "v1", "PRODUCTION");
    for (let i = 0; i < candidateIds; i++) {
      q = updateQuestionState(q, {
        candidateId: `c${i}`,
        questionId: id,
        questionVersion: "v1",
        outcome: i % 2 as 0 | 1,
        candidateCapabilityEstimate: 0.2 + (i / Math.max(1, candidateIds - 1)) * 0.6,
        candidateCapabilityVariance: 0.05,
        answerChanged: i % 4 === 0,
        confidence: 0.6,
      });
    }
    return q;
  }

  test("ranks eligible questions without a readiness score", () => {
    const candidate = initialCandidateState();
    const q1 = question("q1");
    const q2 = question("q2");
    const selection = selectNextQuestion(candidate, [q1, q2], "CAPABILITY");
    expect(selection.selectedQuestionId).toBeTruthy();
    expect(selection).not.toHaveProperty("readiness");
  });

  test("protected question cannot be selected", () => {
    const candidate = initialCandidateState();
    const q = initialQuestionState("protected", "v1", "PRODUCTION");
    const selection = selectNextQuestion(candidate, [q], "CAPABILITY");
    expect(selection.selectedQuestionId).toBeNull();
  });

  test("uncertain question is excluded", () => {
    const candidate = initialCandidateState();
    const q = question("q", 12);
    q.difficulty.variance = 0.9;
    const ranked = rankQuestionsForDWIG(candidate, [q]);
    expect(ranked[0].eligible).toBe(false);
  });

  test("safety explains why a question is blocked", () => {
    const candidate = initialCandidateState();
    const q = initialQuestionState("protected", "v1", "PRODUCTION");
    const safety = validateDWIGSafety(candidate, q);
    expect(safety.allowed).toBe(false);
    expect(safety.reasons).toContain("QUESTION_PROTECTED");
  });
});
