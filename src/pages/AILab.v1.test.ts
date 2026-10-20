import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const ui = readFileSync(join(process.cwd(), "src/pages/AILab.tsx"), "utf8");
const edge = readFileSync(join(process.cwd(), "supabase/functions/v2-ai-lab/index.ts"), "utf8");
describe("AI Lab V1 PIE-only contract", () => {
  it("exposes only Explain my PIE, with no coming-soon card", () => {
    expect(ui).toContain("Explain my PIE");
    expect(ui).not.toContain("Generate Questions");
    expect(ui).not.toContain("Weak Area Drill");
    expect(ui.toLowerCase()).not.toContain("coming soon");
  });
  it("uses the deployed V2 function and OpenAI only", () => {
    expect(ui).toContain("const FUNCTION_NAME = 'v2-ai-lab'");
    expect(edge).toContain('const PROVIDERS: Record<string, ProviderAdapter> = { openai: openaiAdapter }');
    expect(edge).toContain('Only Explain my PIE is available in AI Lab V1.');
    expect(edge).toContain('Only OpenAI is supported.');
  });
  it("uses only the caller's candidate-facing PIE projection for model context", () => {
    expect(edge).toContain('from("my_pie_state")');
    expect(edge).toContain('.eq("user_id", userId)');
    expect(edge).not.toContain('from("intelligence.readiness_dna")');
    expect(edge).not.toContain('from("intelligence.subject_dna")');
    expect(edge).not.toContain('from("intelligence.behavior_dna")');
  });
  it("preserves retired session history and retry support", () => {
    expect(ui).toContain("Retired tool");
    expect(ui).toContain("Retry this question");
    expect(edge).toContain('response_text, prompt');
    expect(edge).toContain('error_code');
  });
});
