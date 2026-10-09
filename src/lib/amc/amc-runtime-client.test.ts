import { describe, expect, it } from "vitest";
import {
  parseAMCBlueprintResponse,
  parseAMCPluginSummary,
  parseAMCReadinessResponse,
} from "./amc-runtime-client";

describe("AMC live runtime response contracts", () => {
  it("does not represent an uncalibrated summary as a pass probability", () => {
    const summary = parseAMCPluginSummary({
      plugin: "AMC", pluginVersion: "1.0.0", status: "VALIDATING",
      environmentCode: "AMC_CAT_MCQ", environmentVersion: "2026.1", examMode: "MCQ",
      readiness: { probability: null, index: null, uncertainty: null, status: "INSUFFICIENT_EVIDENCE", probabilityStatus: "NOT_CALIBRATED" },
    });
    expect(summary.readiness.probability).toBeNull();
    expect(summary.readiness.probabilityStatus).toBe("NOT_CALIBRATED");
  });

  it("rejects a probability value until calibration is supported", () => {
    expect(() => parseAMCPluginSummary({
      plugin: "AMC", pluginVersion: "1.0.0", status: "VALIDATING",
      examMode: "MCQ", readiness: { probability: 0.8, probabilityStatus: "CALIBRATED" },
    })).toThrow();
  });

  it("validates blueprint row structure and proportions", () => {
    const result = parseAMCBlueprintResponse({
      plugin: "AMC", pluginVersion: "1.0.0", examMode: "MCQ",
      blueprint: [{ exam_mode: "MCQ", patient_group: "ADULT_MEDICINE", task_domain: null, proportion: 0.3, item_target: null }],
    });
    expect(result.blueprint[0].proportion).toBe(0.3);
    expect(() => parseAMCBlueprintResponse({
      plugin: "AMC", pluginVersion: "1.0.0", examMode: "MCQ",
      blueprint: [{ exam_mode: "MCQ", patient_group: "ADULT_MEDICINE", proportion: 1.5 }],
    })).toThrow();
  });

  it("keeps readiness evidence explicit and probability null", () => {
    const result = parseAMCReadinessResponse({
      plugin: "AMC", pluginVersion: "1.0.0", examMode: "CLINICAL",
      environmentCode: "AMC_CLINICAL",
      readiness: { probability: null, status: "INSUFFICIENT_EVIDENCE" },
      dimensionCount: 6, probabilityStatus: "NOT_CALIBRATED", modelVersion: "amc-readiness-v1.0",
    });
    expect(result.readiness.probability).toBeNull();
    expect(result.readiness.status).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.dimensionCount).toBe(6);
    expect(result.probabilityStatus).toBe("NOT_CALIBRATED");
  });

  it("rejects readiness payloads that claim a calibrated probability", () => {
    expect(() => parseAMCReadinessResponse({
      plugin: "AMC", pluginVersion: "1.0.0", examMode: "MCQ",
      readiness: { probability: 0.75, status: "DECISION_STABLE" }, dimensionCount: 6, probabilityStatus: "CALIBRATED",
    })).toThrow();
  });
});
