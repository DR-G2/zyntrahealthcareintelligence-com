import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { hmacTarget, isPiiKey, keyTokens, normaliseTarget, redactReason, stripPii } from "../../supabase/functions/_shared/audit-pure";

const FN = resolve(process.cwd(), "supabase/functions");
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
});
const read = (p: string) => readFileSync(p, "utf8");

describe("P2c audit: pure helpers", () => {
  it("keeps non-PII keys (incl. allowlisted *_name) and never redacts bare digit strings", () => {
    const keep = {
      description: "d", explanation_tip: "t", membership: "m", recipient: "r", subject_name: "Anatomy",
      topic_name: "Cardio", lo_name: "LO", file_name: "a.csv", filename: "b.csv",
      created_ms: "1791950000000", epoch: 1791950000000, order_ref: "9876543210123", razorpay_ref: "pay_N7xYz123AbC",
    };
    expect(stripPii(keep)).toEqual(keep);
  });
  it("strips PII keys by token / whole key, at any depth", () => {
    const out = stripPii({
      user_email: 1, emailAddress: 1, first_name: 1, lastName: 1, ip_addr: 1, ip_address: 1, user_agent: 1,
      dob: 1, display_name: 1, username: 1, Name: 1, phone: 1, mobile: 1, keep: 1,
      nested: { full_name: "f", ok: true, deeper: [{ birth_date: "x", userAgent: "ua", v: 2 }] },
    });
    expect(out).toEqual({ keep: 1, nested: { ok: true, deeper: [{ v: 2 }] } });
    expect(isPiiKey("display_name")).toBe(true);
    expect(isPiiKey("subject_name")).toBe(false);
    expect(keyTokens("emailAddress")).toEqual(["email", "address"]);
  });
  it("redacts email/phone values under generic keys and in arrays; reason redacted too", () => {
    const out = stripPii({
      note: "contact a.b+x@example.com now", list: ["x@y.io", "fine"], deep: { v: [{ msg: "ping z@q.org" }] },
      au: "+61 412 345 678", in: "+91-98765-43210", local: "0412 345 678", bare: "61412345678",
    }) as Record<string, unknown>;
    expect(out.note).toBe("contact [redacted] now");
    expect(out.list).toEqual(["[redacted]", "fine"]);
    expect(out.deep).toEqual({ v: [{ msg: "ping [redacted]" }] });
    expect(out.au).toBe("[redacted]");
    expect(out.in).toBe("[redacted]");
    expect(out.local).toBe("[redacted]");
    expect(out.bare).toBe("61412345678");
    expect(stripPii(null)).toBeNull();
    expect(redactReason("refund for jane@doe.com")).toBe("refund for [redacted]");
    expect(redactReason(null)).toBeNull();
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
    expect(s).toContain("reason: redactReason(input.reason)");
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
    const add = m.indexOf("add column if not exists status text not null default 'done'");
    const setDefault = m.indexOf("alter column status set default 'pending'");
    expect(add).toBeGreaterThan(0);
    expect(setDefault).toBeGreaterThan(add);
    expect(m.indexOf("admin_activity_logs_status_check")).toBeGreaterThan(setDefault);
    expect(m).toContain("revoke all on table command.admin_activity_logs from anon, authenticated");
    expect(m).toContain("check (status in ('pending', 'done', 'failed'))");
  });
});
