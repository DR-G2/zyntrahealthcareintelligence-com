import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// P2 cutover guard: edge functions must gate admins via public.is_admin()/is_super_admin() RPCs,
// never by reading the legacy admin_roles table directly.
const FN_DIR = resolve(process.cwd(), "supabase/functions");
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|js|mjs)$/.test(n) ? [p] : [];
});
const files = walk(FN_DIR);

describe("P2: admin edge functions use is_admin RPCs", () => {
  it("has 0 occurrences of .from(\"admin_roles\") under supabase/functions", () => {
    const hits = files.filter((f) => /\.from\(\s*["'`]admin_roles["'`]\s*\)/.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });

  it("every adminRpc gate handles the error explicitly with console.error (fail closed)", () => {
    const users = files.filter((f) => /await adminRpc\(/.test(readFileSync(f, "utf8")));
    expect(users.length).toBeGreaterThanOrEqual(28);
    for (const f of users) {
      const src = readFileSync(f, "utf8");
      const calls = src.match(/const \{ data(?:: \w+)?, error(?:: \w+)? \} = await adminRpc\(/g) ?? [];
      expect(calls.length, f).toBeGreaterThan(0);
      for (const c of calls) {
        const errVar = /error: (\w+)/.exec(c)?.[1] ?? "error";
        expect(src, f).toMatch(new RegExp(`if \\(${errVar}\\) \\{\\n\\s*console\\.error\\(`));
      }
    }
  });

  it("super_admin-only functions use is_super_admin", () => {
    for (const fn of ["admin-cleanup-stations", "admin-cleanup-questions", "admin-reset-test-user",
      "admin-seed-synthetic-users", "admin-bulk-delete-users", "admin-question-bank", "admin-user-actions"]) {
      expect(readFileSync(join(FN_DIR, fn, "index.ts"), "utf8"), fn).toContain('"is_super_admin")');
    }
  });

  it("revoke migration for command.admin_roles is guarded and idempotent", () => {
    const m = readFileSync(resolve(process.cwd(), "supabase/migrations/20261014080000_revoke_command_admin_roles_client_access.sql"), "utf8");
    expect(m).toContain("to_regclass('command.admin_roles') IS NOT NULL");
    expect(m).toContain("REVOKE ALL ON TABLE command.admin_roles FROM anon, authenticated");
  });
});
