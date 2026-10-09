import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  parseAMCBlueprintResponse,
  parseAMCPluginSummary,
  parseAMCPracticeStatus,
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
  it("keeps AMC question delivery disabled until mapping and selector gates pass", () => {
    const status = parseAMCPracticeStatus({
      plugin: "AMC", pluginVersion: "1.0.0", examMode: "MCQ",
      mappedQuestionCount: 0, approvedQuestionCount: 0,
      mappingStatus: "MAPPING_REQUIRED", selectorStatus: "NOT_CERTIFIED",
      canStartAMCPractice: false, reason: "mapping required",
    });
    expect(status.canStartAMCPractice).toBe(false);
    expect(status.selectorStatus).toBe("NOT_CERTIFIED");
    expect(() => parseAMCPracticeStatus({
      plugin: "AMC", pluginVersion: "1.0.0", examMode: "MCQ",
      mappedQuestionCount: 10, approvedQuestionCount: 10,
      mappingStatus: "REVIEWED_METADATA_PRESENT", selectorStatus: "CERTIFIED",
      canStartAMCPractice: true, reason: "not valid",
    })).toThrow();
  });

  it("readiness SQL does not create a fixed-weight composite or candidate-visible probability", () => {
    const readinessMigration = readFileSync(resolve(__dirname, "../../../supabase/migrations_v2/0065_amc_readiness_no_unvalidated_composite.sql"), "utf8");
    const promotionMigration = readFileSync(resolve(__dirname, "../../../supabase/migrations_v2/0067_amc_promotion_runtime_guard.sql"), "utf8");
    expect(readinessMigration).not.toMatch(/avg\s*\(\s*s\.estimate\s*\)/i);
    expect(readinessMigration).toContain("'composite_index_claim', false");
    expect(readinessMigration).toContain("'probability', NULL");
    expect(promotionMigration).toContain("AMC_READINESS_RUNTIME_NOT_VERIFIED");
  });

  it("Edge Function exposes only allow-listed AMC actions and readiness fields", () => {
    const edge = readFileSync(resolve(__dirname, "../../../supabase/functions/amc-intelligence/index.ts"), "utf8");
    expect(edge).toContain('"get_practice_status"');
    expect(edge).toContain('probability: null');
    expect(edge).toContain('status: "INSUFFICIENT_EVIDENCE"');
    expect(edge).not.toMatch(/readinessDTO[\\s\\S]{0,900}readiness\\.index/);
    expect(edge).toContain("invalid_exam_mode");
    expect(edge).toContain("user_scope_violation");
  });

});
