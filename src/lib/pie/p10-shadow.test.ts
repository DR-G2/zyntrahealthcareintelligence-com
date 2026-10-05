import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("PIE P10 shadow contracts", () => {
  it("keeps shadow execution non-candidate-facing", () => {
    const source = readFileSync(
      resolve(process.cwd(), "supabase/functions/pie-shadow-run/index.ts"),
      "utf8",
    );
    expect(source).toContain('mode: "SHADOW"');
    expect(source).toContain("candidate_facing: false");
    expect(source).toContain("legacy_authoritative: true");
    expect(source).toContain("promotion_allowed: false");
  });

  it("does not trust database question rows as runtime camelCase objects", () => {
    const source = readFileSync(
      resolve(process.cwd(), "supabase/functions/pie-shadow-run/index.ts"),
      "utf8",
    );
    expect(source).toContain("questionId: String(q.question_id)");
    expect(source).toContain("questionVersion: String(q.question_version)");
  });
});
