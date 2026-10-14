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
const walkAll = (d: string): string[] => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  return statSync(p).isDirectory() ? walkAll(p) : [p];
});

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
      dob: 1, display_name: 1, username: 1, userAgent: 1, ipAddress: 1, firstName: 1, Name: 1, phone: 1, mobile: 1, keep: 1,
      nested: { full_name: "f", ok: true, deeper: [{ birth_date: "x", userAgent: "ua", v: 2 }] },
    });
    expect(out).toEqual({ keep: 1, nested: { ok: true, deeper: [{ v: 2 }] } });
    expect(isPiiKey("display_name")).toBe(true);
    expect(isPiiKey("subject_name")).toBe(false);
    expect(keyTokens("emailAddress")).toEqual(["email", "address"]);
    for (const k of ["userAgent", "ipAddress", "firstName"]) expect(isPiiKey(k), k).toBe(true);
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
    expect(s).toContain('sb.rpc("command_audit_begin"');
    expect(s).toContain("p_reason: redactReason(input.reason)");
    expect(s).toMatch(/if \(!key\) return \{ error:/);
    expect(s).toContain('sb.rpc("command_admin_target_status"');
    expect(s).toContain('sb.rpc("command_audit_finish"');
    for (const line of s.split("\n").filter((l) => l.includes("console."))) {
      expect(line).not.toMatch(/key\b|email|target\b|input\.|message/i);
    }
  });
  it("status migration: default 'done' (backfill + write_audit path), explicit pending in edge, service_role grants only", () => {
    const m = read(resolve(process.cwd(), "supabase/migrations_v2/0087_command_audit_log_status.sql"));
    const add = m.indexOf("add column if not exists status text not null default 'done'");
    const def = m.indexOf("alter column status set default 'done'");
    const chk = m.indexOf("admin_activity_logs_status_check");
    expect(add).toBeGreaterThan(0);
    expect(def).toBeGreaterThan(add);
    expect(chk).toBeGreaterThan(def);
    expect(m).not.toMatch(/set default 'pending'/);
    expect(m).toContain("check (status in ('pending', 'done', 'failed'))");
    expect(m).toContain("grant usage on schema command to service_role;");
    expect(m).toContain("grant select, insert, update on table command.admin_activity_logs to service_role;");
    expect(m).not.toMatch(/grant[^;]*\bto\b[^;]*\b(anon|authenticated|public)\b/i);
    expect(m).toContain("revoke all on table command.admin_activity_logs from anon, authenticated");
    // write_audit() (0016) never names status, so its rows take the 'done' default.
    const wa = read(resolve(process.cwd(), "supabase/migrations_v2/0016_privileged_functions_and_views.sql"));
    const ins = wa.slice(wa.indexOf("insert into command.admin_activity_logs"), wa.indexOf("returning id into v_id"));
    expect(ins).not.toMatch(/status/);
    // the two-phase writer (command_audit_begin) sets pending explicitly
    expect(m).toMatch(/values \(p_actor_user_id[^;]*'pending'\)/);
  });

});

describe("B1: admin-bulk-delete-users disabled until P5", () => {
  const src = read(join(FN, "admin-bulk-delete-users/index.ts"));
  it("returns 410 disabled_until_p5 with no auth/DB/email code paths", () => {
    expect(src).toContain('{ error: "disabled_until_p5" }');
    expect(src).toContain("status: 410");
    expect(src).not.toMatch(/console\./);
    for (const bad of ["createClient", "Authorization", "adminRoleRow", ".from(", "email", "user_id", "listUsers", "deleteUser", "req.json", "req.url"]) {
      expect(src, bad).not.toContain(bad);
    }
  });
});

describe("B2: command schema only via public SECURITY INVOKER RPCs (service_role only)", () => {
  const m = read(resolve(process.cwd(), "supabase/migrations_v2/0087_command_audit_log_status.sql"));
  const RPCS = {
    command_audit_begin: "uuid, text, text, text, text, text, jsonb",
    command_audit_finish: "uuid, text, jsonb",
    command_admin_target_status: "uuid",
    command_audit_list: "integer",
  };
  it("0 .schema('command') anywhere in supabase/functions", () => {
    const hits = walk(FN).filter((f) => /\.schema\(\s*["'`]command["'`]\s*\)/.test(read(f)));
    expect(hits).toEqual([]);
  });
  it("each RPC is SECURITY INVOKER, search_path '', EXECUTE revoked from public/anon/authenticated, granted to service_role", () => {
    for (const [fn, sig] of Object.entries(RPCS)) {
      const def = m.slice(m.indexOf(`create or replace function public.${fn}(`));
      expect(def.slice(0, 600), fn).toMatch(/security invoker set search_path = ''/);
      expect(m, fn).toContain(`revoke execute on function public.${fn}(${sig}) from public, anon, authenticated;`);
      expect(m, fn).toContain(`grant execute on function public.${fn}(${sig}) to service_role;`);
    }
    const code = m.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    expect(code).not.toMatch(/security definer/i);
    expect(m).not.toMatch(/grant[^;]*\bto\b[^;]*\b(anon|authenticated|public)\b/i);
  });
  it("edge code calls the RPCs", () => {
    const a = read(join(FN, "_shared/command-audit.ts"));
    for (const fn of Object.keys(RPCS)) expect(a).toContain(`sb.rpc("${fn}"`);
    expect(read(join(FN, "admin-user-actions/index.ts"))).toContain("auditList(supabase, 500)");
  });
});

describe("P2c round 4: write_audit lockdown + single inserters + finish only from pending", () => {
  const m = read(resolve(process.cwd(), "supabase/migrations_v2/0087_command_audit_log_status.sql"));
  it("0087 revokes write_audit EXECUTE from public/anon/authenticated (static stand-in for has_function_privilege)", () => {
    expect(m).toContain("revoke execute on function command.write_audit(text, text, text, text, jsonb, jsonb, uuid) from public, anon, authenticated;");
    expect(m).not.toMatch(/grant execute on function command\.write_audit/i);
    // smoke SQL for Gus is present
    expect(m).toContain("has_function_privilege(r, 'command.write_audit(text,text,text,text,jsonb,jsonb,uuid)', 'EXECUTE')");
  });
  it("only command_audit_begin and write_audit insert into command.admin_activity_logs", () => {
    const sqlDirs = ["supabase/migrations", "supabase/migrations_v2"].map((d) => resolve(process.cwd(), d));
    const sql = sqlDirs.flatMap((d) => walkAll(d).filter((f) => f.endsWith(".sql")));
    const owners: string[] = [];
    for (const f of sql) {
      const src = read(f);
      for (const mm of src.matchAll(/insert\s+into\s+command\.admin_activity_logs/gi)) {
        const before = src.slice(0, mm.index);
        const fn = [...before.matchAll(/create\s+or\s+replace\s+function\s+([\w.]+)\s*\(/gi)].pop()?.[1] ?? "<top-level>";
        owners.push(fn.toLowerCase());
      }
    }
    expect([...new Set(owners)].sort()).toEqual(["command.write_audit", "public.command_audit_begin"]);
    // edge functions: no direct table insert at all (only RPCs)
    for (const f of walk(FN)) expect(read(f), f).not.toMatch(/admin_activity_logs"\)\s*\.insert/);
  });
  it("command_audit_finish only updates a pending row", () => {
    const def = m.slice(m.indexOf("create or replace function public.command_audit_finish("), m.indexOf("create or replace function public.command_admin_target_status("));
    expect(def).toMatch(/where id = p_id and status = 'pending'/);
    expect(def).toMatch(/if p_status not in \('done', 'failed'\)/);
    expect(def).toContain("return v_n = 1;");
  });
});

describe("B1 UI: bulk delete disabled until P5", () => {
  it("both dashboard call sites are disabled and map 410 to a safe message", async () => {
    const { bulkDeleteErrorMessage, BULK_DELETE_DISABLED, BULK_DELETE_DISABLED_MESSAGE } = await import("./bulk-delete");
    expect(BULK_DELETE_DISABLED).toBe(true);
    expect(bulkDeleteErrorMessage({ context: { status: 410 } })).toBe(BULK_DELETE_DISABLED_MESSAGE);
    expect(bulkDeleteErrorMessage(null, { error: "disabled_until_p5" })).toBe(BULK_DELETE_DISABLED_MESSAGE);
    expect(bulkDeleteErrorMessage(new Error("raw a@b.com 42P01"))).not.toMatch(/a@b|42P01|raw/);
    const d = read(resolve(process.cwd(), "src/pages/AdminDashboard.tsx"));
    expect((d.match(/invoke\('admin-bulk-delete-users'/g) ?? []).length).toBe(2);
    expect((d.match(/disabled=\{BULK_DELETE_DISABLED \|\| bulkDeleting\}/g) ?? []).length).toBe(2);
    expect((d.match(/bulkDeleteErrorMessage\(/g) ?? []).length).toBe(4);
    expect(d).toContain("{BULK_DELETE_DISABLED_MESSAGE}");
    expect(d).not.toMatch(/Delete Error', description: e\.message/);
  });
});
