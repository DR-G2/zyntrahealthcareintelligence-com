import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("PIE P12 Edge Function contract", () => {
  const source = readFileSync(resolve(process.cwd(), "supabase/functions/pie-infer-state/index.ts"), "utf8");

  it("is authenticated, user-scoped and non-wildcard CORS", () => {
    expect(source).toContain("Authorization");
    expect(source).toContain("body?.user_id !== user.id");
    expect(source).not.toContain("Access-Control-Allow-Origin: *");
  });

  it("is explicitly shadow-only", () => {
    expect(source).toContain('MODEL_VERSION = "pie-inference-v2.1-shadow"');
    expect(source).toContain("shadow_only: true");
    expect(source).toContain("authoritative: false");
    expect(source).toContain("influences_adaptation: false");
    expect(source).toContain('schema("pie").from("inference_shadow")');
  });

  it("does not invoke authoritative learner-state rebuilds or selection RPCs", () => {
    expect(source).not.toContain("rebuild_candidate_state");
    expect(source).not.toContain("rebuild_my_pie_inference");
    expect(source).not.toContain("pie_next_question");
    expect(source).not.toContain("save_attempt");
  });

  it("matches the live PIE observation and state schemas", () => {
    expect(source).toContain('.schema("pie")');
    expect(source).toContain('.from("pie_observation")');
    expect(source).toContain('.order("observed_at"');
    expect(source).toContain("payload.outcome");
    expect(source).toContain("payload.time_total_ms");
    expect(source).toContain("payload.confidence_normalized");
    expect(source).toContain('.from("pie_candidate_state")');
    expect(source).toContain('select("state_version")');
    expect(source).not.toContain('select("state_sequence")');
    expect(source).not.toContain('.order("state_sequence"');
  });

  it("requires six dimensions", () => {
    for (const dimension of ["capability", "decision", "timing", "calibration", "sustained_performance", "learning"]) {
      expect(source).toContain(`["${dimension}"`);
    }
  });
});
