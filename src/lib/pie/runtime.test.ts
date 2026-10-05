import { describe, expect, test } from "vitest";
import { initialCandidateState } from "./inference";
import { orchestrate } from "./runtime";

const question = {
  questionId:"q1",
  questionVersion:"1",
  difficulty:{estimate:.5,variance:.02,lower:.2,upper:.8,evidenceCount:20,evidenceQuality:.9},
  discrimination:{estimate:.8,variance:.02,lower:.4,upper:1,evidenceCount:20,evidenceQuality:.9},
  ambiguity:{estimate:.1,variance:.01,lower:0,upper:.2,evidenceCount:20,evidenceQuality:.9},
  novelty:{estimate:.5,variance:.02,lower:.2,upper:.8,evidenceCount:20,evidenceQuality:.9},
  evidenceLevel:"STABLE_PRODUCTION" as const,
  productionStatus:"PRODUCTION",
  modelVersion:"pie-question-dev-0.1",
  protected:false,
  uniqueCandidateCount:20,
  candidateIdsSeen:[],
};

describe("PIE P7 runtime orchestration",()=>{
 test("shadow mode never exposes a candidate-facing decision",()=>{
  const r=orchestrate({
    candidate:initialCandidateState(),
    questions:[question],
    context:"CAPABILITY",
    mode:"SHADOW",
  });
  expect(r.decision.candidateFacing).toBe(false);
  expect(r.promotionAllowed).toBe(false);
 });
 test("certified mode still requires an eligible question",()=>{
  const r=orchestrate({
    candidate:initialCandidateState(),
    questions:[{...question,protected:true}],
    context:"CAPABILITY",
    mode:"CERTIFIED",
  });
  expect(r.dwig.selectedQuestionId).toBeNull();
  expect(r.promotionAllowed).toBe(false);
 });
 test("runtime keeps candidate state and exam context separate",()=>{
  const r=orchestrate({
    candidate:initialCandidateState(),
    questions:[question],
    context:"EXAM_READINESS",
    mode:"DEVELOPMENT",
    examAdapterVersion:"exam-v1",
  });
  expect(r.decision.modelVersions.candidate).toBe("pie-state-space-dev-0.1");
  expect(r.decision.context).toBe("EXAM_READINESS");
 });
});
