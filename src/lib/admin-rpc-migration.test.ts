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
    // Authorization never reads admin_roles. The only allowed read is the P2c destructive-action guard on
    // command.admin_roles (explicit .schema("command")), which only REFUSES actions on admins.
    const hits = files.filter((f) => [...readFileSync(f, "utf8").matchAll(/\.from\(\s*["'`]admin_roles["'`]\s*\)/g)]
      .some((m) => !readFileSync(f, "utf8").slice(Math.max(0, m.index! - 30), m.index).includes('schema("command")')));
    expect(hits).toEqual([]);
  });

  it("every adminRoleRow gate handles the RPC error explicitly with console.error (fail closed)", () => {
    const users = files.filter((f) => /await adminRoleRow\(/.test(readFileSync(f, "utf8")));
    expect(users.length).toBeGreaterThanOrEqual(26); // admin-bulk-delete-users is a 410 stub (B1)
    for (const f of users) {
      const src = readFileSync(f, "utf8");
      const calls = [...src.matchAll(/const \{ data: \w+, error: (\w+) \} = await adminRoleRow\(/g)];
      expect(calls.length, f).toBe((src.match(/await adminRoleRow\(/g) ?? []).length);
      for (const c of calls) expect(src, f).toMatch(new RegExp(`if \\(${c[1]}\\) \\{\\n\\s*console\\.error\\(`));
    }
  });

  it("super_admin-only functions gate on the DB super_admin role", () => {
    for (const fn of ["admin-cleanup-stations", "admin-reset-test-user", "admin-seed-synthetic-users", "admin-user-actions"]) {
      expect(readFileSync(join(FN_DIR, fn, "index.ts"), "utf8"), fn).toMatch(/role !== "super_admin"/);
    }
    expect(readFileSync(join(FN_DIR, "admin-cleanup-questions", "index.ts"), "utf8")).toContain('["super_admin"]');
  });

  it("revoke migration for command.admin_roles is guarded and idempotent", () => {
    const m = readFileSync(resolve(process.cwd(), "supabase/migrations/20261014080000_revoke_command_admin_roles_client_access.sql"), "utf8");
    expect(m).toContain("to_regclass('command.admin_roles') IS NOT NULL");
    expect(m).toContain("REVOKE ALL ON TABLE command.admin_roles FROM anon, authenticated");
  });
});
