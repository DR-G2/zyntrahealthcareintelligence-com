import { describe, expect, it } from "vitest";
import {
  classifyTrainingProvenance,
  isEligibleForHumanTraining,
} from "./provenance";

describe("PIE offline training provenance gate", () => {
  it("excludes registered synthetic candidates regardless of source label", () => {
    expect(classifyTrainingProvenance({
      source: "practice-pie",
      registeredSynthetic: true,
      explicitlyApprovedRealSource: true,
    })).toBe("synthetic");
  });

  it.each([
    "pie-live-certification",
    "P21.1-certification",
    "nudge-live-certification",
    "test",
    "smoke-test",
    "e2e",
    "staging",
  ])("excludes certification/test source %s", (source) => {
    expect(classifyTrainingProvenance({
      source,
      explicitlyApprovedRealSource: true,
    })).toBe("certification_or_test");
  });

  it.each(["synthetic-seed", "fixture", "demo", "mock-data"])(
    "classifies synthetic source %s separately",
    (source) => {
      expect(classifyTrainingProvenance({ source })).toBe("synthetic");
    },
  );

  it("keeps unknown and unlabeled sources out of the human dataset", () => {
    expect(classifyTrainingProvenance({ source: "practice-pie" })).toBe("unknown");
    expect(classifyTrainingProvenance({ source: null })).toBe("unknown");
    expect(isEligibleForHumanTraining("unknown")).toBe(false);
  });

  it("accepts a source only when explicitly approved and not test-labelled", () => {
    expect(classifyTrainingProvenance({
      source: "reviewed-consented-cohort-v1",
      explicitlyApprovedRealSource: true,
    })).toBe("verified_real_candidate");
    expect(isEligibleForHumanTraining("verified_real_candidate")).toBe(true);
  });

  it("never treats certification or synthetic data as human training data", () => {
    expect(isEligibleForHumanTraining("certification_or_test")).toBe(false);
    expect(isEligibleForHumanTraining("synthetic")).toBe(false);
    expect(isEligibleForHumanTraining("excluded")).toBe(false);
  });
});
