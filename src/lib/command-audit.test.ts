import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { hmacTarget, normaliseTarget, stripPii } from "../../supabase/functions/_shared/audit-pure";

const FN = resolve(process.cwd(), "supabase/functions");
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
});
const read = (p: string) => readFileSync(p, "utf8");

describe("P2c audit: pure helpers", () => {
  it("strips PII keys recursively (objects + arrays, case-insensitive)", () => {
    const out = stripPii({
      email: "a@x.test", Name: "A", keep: 1,
      nested: { display_name: "d", full_name: "f", phone: "1", ok: true, deeper: [{ ip: "1.1.1.1", ip_address: "x", user_agent: "ua", v: 2 }] },
    });
    expect(out).toEqual({ keep: 1, nested: { ok: true, deeper: [{ v: 2 }] } });
    expect(stripPii(null)).toBeNull();
    expect(stripPii("s")).toBe("s");
  });
  it("HMAC normalises case/whitespace and matches HMAC-SHA256 hex", async () => {
    expect(normaliseTarget("  A@X.Test ")).toBe("a@x.test");
    const key = "test-key";
    const a = await hmacTarget(key, " User@Example.COM ");
    const b = await hmacTarget(key, "user@example.com");
    expect(a).toBe(b);
    expect(a).toBe(createHmac("sha256", key).update("user@example.com").digest("hex"));
    const u = "8F2C7A1E-0000-4000-8000-ABCDEFABCDEF";
    expect(await hmacTarget(key, u)).toBe(await hmacTarget(key, u.toLowerCase()));
    await expect(hmacTarget("", "x")).rejects.toThrow();
  });
});

describe("P2c audit: static checks", () => {
  const files = walk(FN);
  it("nothing writes the public admin_activity_logs table", () => {
    for (const f of files) {
      const s = read(f);
      expect(s, f).not.toMatch(/supabase\.from\("admin_activity_logs"\)/);
      expect(s, f).not.toMatch(/public\.admin_activity_logs/);
      for (const m of s.matchAll(/\.from\("admin_activity_logs"\)/g)) {
        expect(s.slice(Math.max(0, m.index! - 40), m.index), f).toContain('schema("command")');
      }
    }
  });
  it("admin-user-actions: admin-target refusal, then pending audit, then the action", () => {
    const s = read(join(FN, "admin-user-actions/index.ts"));
    const guard = s.indexOf("adminTargetStatus(supabase, user_id)");
    const begin = s.indexOf("await auditBegin(supabase");
    const failClosed = s.indexOf('if ("error" in audit)');
    const run = s.indexOf("res = await runAction()");
    const firstWrite = s.indexOf('chk(await supabase.from("profiles").update');
    expect(guard).toBeGreaterThan(0);
    expect(begin).toBeGreaterThan(guard);
    expect(failClosed).toBeGreaterThan(begin);
    expect(firstWrite).toBeGreaterThan(failClosed);
    expect(run).toBeGreaterThan(failClosed);
    expect(s).toMatch(/offboard first[^\n]*status: 409/);
    expect(s).toContain("auditFinish(supabase, audit.id");
    expect(s).not.toContain("logAction(");
  });
  it("audit module: key from env, fail closed, pending status, logs stage+code only", () => {
    const s = read(join(FN, "_shared/command-audit.ts"));
    expect(s).toContain('Deno.env.get("AUDIT_HMAC_KEY")');
    expect(s).toContain('status: "pending"');
    expect(s).toMatch(/if \(!key\) return \{ error:/);
    expect(s).toContain("security_admin_allowlist");
    expect(s).toContain('from("admin_roles")');
    expect(s).toContain('eq("actor_user_id", userId)');
    for (const line of s.split("\n").filter((l) => l.includes("console."))) {
      expect(line).not.toMatch(/key\b|email|target\b|input\.|message/i);
    }
  });
  it("status migration exists, is idempotent and constrained", () => {
    const m = read(resolve(process.cwd(), "supabase/migrations_v2/0087_command_audit_log_status.sql"));
    expect(m).toContain("add column if not exists status text not null default 'pending'");
    expect(m).toContain("check (status in ('pending', 'done', 'failed'))");
  });
});
