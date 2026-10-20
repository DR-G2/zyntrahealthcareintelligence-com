import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const ui = readFileSync(join(process.cwd(), "src/pages/AILab.tsx"), "utf8");
const edge = readFileSync(join(process.cwd(), "supabase/functions/v2-ai-lab/index.ts"), "utf8");
describe("AI Lab V1 PIE-only contract", () => {
  it("shows only Explain my PIE and no retired launch options or teaser", () => {
    expect(ui).toContain("Explain my PIE");
    expect(ui).not.toContain("Generate Questions");
    expect(ui).not.toContain("Weak Area Drill");
    expect(ui.toLowerCase()).not.toContain("coming soon");
    expect(ui).toContain("Retired tool");
  });
  it("uses the live V2 function and rejects non-OpenAI and non-PIE modes", () => {
    expect(ui).toContain("const FUNCTION_NAME = 'v2-ai-lab'");
    expect(edge).toContain('const PROVIDERS: Record<string, ProviderAdapter> = { openai: openaiAdapter }');
    expect(edge).toContain('Only Explain my PIE is available in AI Lab V1.');
    expect(edge).toContain('Only OpenAI is supported.');
  });
  it("uses only caller-owned candidate-facing PIE state and never internal/shadow tables", () => {
    expect(edge).toContain('from("my_pie_state")');
    expect(edge).toContain('.eq("user_id", userId)');
    expect(edge).not.toContain('intelligence.readiness_dna');
    expect(edge).not.toContain('intelligence.subject_dna');
    expect(edge).not.toContain('intelligence.behavior_dna');
    expect(edge).not.toContain('behavior_profiles');
    expect(edge).not.toContain('pie.pie_observation');
  });
  it("matches candidate PIE eligibility and keeps mode evidence isolated", () => {
    expect(edge).toContain('const MIN_DIMENSION_OBSERVATIONS = 50');
    expect(edge).toContain('raw.estimate_aligned === true');
    expect(edge).toContain('raw.evidence_quality');
    expect(edge).toContain('raw.calibration_ready === true');
    expect(edge).toContain('state.mode_evidence');
    expect(edge).toContain('["normal_mcq", "Normal MCQ"]');
    expect(edge).toContain('["amc_exam", "AMC Exam"]');
    expect(edge).toContain('["nudge", "Nudge"]');
  });
  it("preserves history, supports safe retry, and does not coerce missing counts to zero", () => {
    expect(ui).toContain("Retry this question");
    expect(edge).toContain('error_code, response_text, prompt');
    expect(ui).toContain("Building, evidence count unavailable");
    expect(ui).not.toContain("evidenceCount ?? 0");
    expect(ui).toContain("Overall PIE evidence");
    expect(ui).toContain("Check for newer PIE data");
    expect(ui).toContain("Outdated snapshot");
    expect(edge).toContain('action === "pie_snapshot"');
  });
});
