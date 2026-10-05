import { describe, expect, test } from "vitest";
import { initialCandidateState } from "./inference";
import {
  estimateDescriptiveEffect,
  estimateBetweenGroupContrast,
  causalClaimAllowed,
  rankInterventions,
} from "./intervention";

describe("PIE P6 intervention intelligence", () => {
  test("descriptive improvement is not labelled causal", () => {
    const effect = estimateDescriptiveEffect([
      {
        interventionId: "i1",
        userId: "u1",
        outcomeType: "IMMEDIATE_PERFORMANCE",
        baselineValue: 0.5,
        immediateValue: 0.7,
        completed: true,
        outcomeQuality: 1,
        measuredAt: new Date().toISOString(),
        sourceObservationIds: [],
      },
    ]);
    expect(effect.effectEstimate).toBeCloseTo(0.2);
    expect(effect.causalStatus).toBe("NOT_CAUSAL");
    expect(causalClaimAllowed(effect)).toBe(false);
  });

  test("between-group contrast remains quasi-experimental", () => {
    const effect = estimateBetweenGroupContrast(
      { interventionId: "i1", outcomes: [{
        interventionId:"i1", userId:"u1", outcomeType:"IMMEDIATE_PERFORMANCE",
        baselineValue:.5, immediateValue:.7, completed:true, outcomeQuality:1,
        measuredAt:new Date().toISOString(), sourceObservationIds:[]
      }]},
      { interventionId: "control", outcomes: [{
        interventionId:"control", userId:"u2", outcomeType:"IMMEDIATE_PERFORMANCE",
        baselineValue:.5, immediateValue:.55, completed:true, outcomeQuality:1,
        measuredAt:new Date().toISOString(), sourceObservationIds:[]
      }]}
    );
    expect(effect.effectEstimate).toBeCloseTo(0.15);
    expect(effect.design).toBe("QUASI_EXPERIMENTAL");
    expect(effect.causalStatus).toBe("NOT_CAUSAL");
  });

  test("intervention ranking does not invent evidence", () => {
    const candidate = initialCandidateState();
    const result = rankInterventions(candidate, [{
      id:"i1", name:"Test", targetDimension:"TIMING",
      intendedMechanism:"timed practice", estimatedCost:.1,
      completionProbability:.9, outcomeType:"TIMING", productionStatus:"ACTIVE"
    }], new Map());
    expect(result[0].eligible).toBe(false);
    expect(result[0].exclusionReason).toBe("INSUFFICIENT_VALIDATED_EVIDENCE");
  });

  test("causal status requires stronger design evidence", () => {
    expect(causalClaimAllowed({
      interventionId:"i1", targetDimension:"TIMING",
      treatmentMean:.7, comparisonMean:.5, effectEstimate:.2,
      uncertainty:.02, sampleSize:100, evidenceQuality:1,
      confoundingRisk:0.1, design:"QUASI_EXPERIMENTAL",
      causalStatus:"NOT_CAUSAL"
    })).toBe(false);
  });
});
