import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("PIE P14 production read-path boundary", () => {
  const fn = readFileSync(resolve(process.cwd(), "supabase/functions/pie-p14-shadow-read/index.ts"), "utf8");
  const client = readFileSync(resolve(process.cwd(), "src/lib/pie/p14-shadow-client.ts"), "utf8");
  const page = readFileSync(resolve(process.cwd(), "src/pages/PerformanceIntelligenceV2.tsx"), "utf8");

  it("requires a bearer token and derives scope from auth identity", () => {
    expect(fn).toContain('authorization?.startsWith("Bearer ")');
    expect(fn).toContain("userClient.auth.getUser()");
    expect(fn).toContain('eq("user_id", user.id)');
    expect(fn).toContain("Client-supplied identity is intentionally ignored");
  });

  it("never exposes service-role credentials to the application", () => {
    expect(client).not.toContain("SERVICE_ROLE");
    expect(page).not.toContain("SERVICE_ROLE");
    expect(client).not.toContain("inference_shadow");
    expect(page).not.toContain("inference_shadow");
    expect(page).toContain("loadP14ShadowInference()");
  });

  it("uses a protected projection and never implements a second inference engine", () => {
    expect(fn).toContain('from("inference_projection")');
    expect(fn).toContain('"/functions/v1/pie-infer-state"');
    expect(fn).not.toContain("function infer(");
    expect(fn).not.toContain("Math.sqrt");
  });

  it("requires the certified six-dimensional P12 contract", () => {
    for (const dimension of ["capability", "decision", "timing", "calibration", "sustained_performance", "learning"]) {
      expect(fn).toContain('"' + dimension + '"');
    }
    expect(fn).toContain('MODEL_VERSION = "pie-inference-v2.1-shadow"');
    expect(fn).toContain("shadow_only !== true");
    expect(fn).toContain("authoritative !== false");
    expect(fn).toContain("influences_adaptation !== false");
  });

  it("fails closed on stale projection rather than serving mixed state", () => {
    expect(fn).toContain("projectionFresh");
    expect(fn).toContain("projection.observation_count === observationCount");
    expect(fn).toContain("projection.latest_observation_id ===");
    expect(fn).toContain("certified_shadow_contract_unavailable");
  });

  it("does not log credentials, user identity, raw observations, or inference values", () => {
    expect(fn).not.toContain("console.log(user");
    expect(fn).not.toContain("console.log(authorization");
    expect(fn).not.toContain("console.log(inference");
    expect(fn).toContain('console.log("p14 shadow read"');
  });
});