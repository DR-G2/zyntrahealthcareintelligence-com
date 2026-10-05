import { describe, expect, test } from "vitest";
import {
  initialQuestionState,
  updateQuestionState,
  predictCandidateQuestion,
  predictLeaveOneQuestionOut,
  shouldQuarantineQuestion,
  summarizeQuestionEvidence,
} from "./question";
import { initialCandidateState } from "./inference";

describe("PIE P4 question intelligence", () => {
  test("question state starts protected and uncertain", () => {
    const q = initialQuestionState("q1", "v1");
    expect(q.protected).toBe(true);
    expect(q.difficulty.variance).toBeGreaterThan(0);
  });

  test("candidate evidence updates question state without certainty", () => {
    let q = initialQuestionState("q1", "v1");
    for (let i = 0; i < 12; i++) {
      q = updateQuestionState(q, {
        candidateId: `c${i}`,
        questionId: "q1",
        questionVersion: "v1",
        outcome: i % 2 as 0 | 1,
        candidateCapabilityEstimate: 0.3 + i / 20,
        candidateCapabilityVariance: 0.05,
        answerChanged: i % 3 === 0,
        confidence: 0.6,
      });
    }
    expect(q.difficulty.evidenceCount).toBe(12);
    expect(q.difficulty.variance).toBeGreaterThan(0);
  });

  test("single-candidate question evidence remains protected", () => {
    let q = initialQuestionState("q1", "v1");
    q = updateQuestionState(q, {
      candidateId: "c1",
      questionId: "q1",
      questionVersion: "v1",
      outcome: 0,
      candidateCapabilityEstimate: 0.8,
      answerChanged: false,
    });
    expect(q.protected).toBe(true);
  });

  test("joint prediction keeps candidate and question contributions separate", () => {
    const candidate = initialCandidateState();
    const question = initialQuestionState("q1", "v1");
    const prediction = predictCandidateQuestion(candidate, question);
    expect(prediction.candidateContribution).not.toBe(prediction.questionContribution);
    expect(prediction.questionUncertainty).toBeGreaterThan(0);
    expect(prediction.leaveOneQuestionOut).toBe(false);
  });

  test("leave-one-question-out path exists", () => {
    const prediction = predictLeaveOneQuestionOut(initialCandidateState(), initialQuestionState("q1", "v1"));
    expect(prediction.leaveOneQuestionOut).toBe(true);
  });

  test("bad-question protection can quarantine uncertain questions", () => {
    let q = initialQuestionState("q1", "v1");
    for (let i = 0; i < 3; i++) {
      q = updateQuestionState(q, {
        candidateId: `c${i}`,
        questionId: "q1",
        questionVersion: "v1",
        outcome: 0,
        candidateCapabilityEstimate: 0.8,
        answerChanged: true,
      });
    }
    expect(shouldQuarantineQuestion(q)).toBeDefined();
  });

  test("evidence summary keeps candidate count separate from raw attempt count", () => {
    const summary = summarizeQuestionEvidence([
      {candidateId:"c1",questionId:"q1",questionVersion:"v1",outcome:1,candidateCapabilityEstimate:.7,candidateCapabilityVariance:.1,answerChanged:false},
      {candidateId:"c1",questionId:"q1",questionVersion:"v1",outcome:0,candidateCapabilityEstimate:.7,candidateCapabilityVariance:.1,answerChanged:false},
      {candidateId:"c2",questionId:"q1",questionVersion:"v1",outcome:1,candidateCapabilityEstimate:.3,candidateCapabilityVariance:.1,answerChanged:false},
    ]);
    expect(summary.uniqueCandidates).toBe(2);
    expect(summary.validObservations).toBe(3);
  });
});
