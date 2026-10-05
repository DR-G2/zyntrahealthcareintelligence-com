import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());

describe("PIE P9 production safety contracts", () => {
  it("keeps PIE inference/admin functions off wildcard CORS", () => {
    for (const file of [
      "supabase/functions/pie-infer-state/index.ts",
      "supabase/functions/admin-pie-inspect-user/index.ts",
    ]) {
      const source = readFileSync(resolve(root, file), "utf8");
      expect(source).not.toContain('"Access-Control-Allow-Origin": "*"');
      expect(source).toContain("PIE_ALLOWED_ORIGIN");
    }
  });

  it("uses case-insensitive admin authorization", () => {
    const source = readFileSync(
      resolve(root, "supabase/functions/admin-pie-inspect-user/index.ts"),
      "utf8",
    );
    expect(source).toContain('.ilike("email", userData.user.email)');
  });

  it("does not expose candidate-facing PIE decisions", () => {
    const source = readFileSync(
      resolve(root, "src/lib/pie/runtime/orchestrator.ts"),
      "utf8",
    );
    expect(source).toContain("candidateFacing: false");
  });
});
