import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("PIE production boundary", () => {
  it("keeps production inference authenticated and user-scoped", () => {
    const source = readFileSync(resolve(process.cwd(), "supabase/functions/pie-infer-state/index.ts"), "utf8");
    expect(source).toContain("Authorization");
    expect(source).toContain("user.id");
    expect(source).toContain("requestedUserId !== user.id");
    expect(source).not.toContain("Access-Control-Allow-Origin: *");
  });

  it("does not make internal PIE tables directly writable by authenticated users", () => {
    const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20261005040000_pie_p9_security_hardening.sql"), "utf8");
    expect(migration).toContain("REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I");
    expect(migration).toContain("'pie_candidate_state'");
    expect(migration).toContain("pie_runtime_decision");
  });

});