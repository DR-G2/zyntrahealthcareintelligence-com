import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// P2-R1: admin reset_password must be email-only (no link returned to the admin = no account takeover).
const src = readFileSync(resolve(process.cwd(), "supabase/functions/admin-user-actions/index.ts"), "utf8");
const block = src.slice(src.indexOf('if (action === "reset_password")'), src.indexOf('if (action === "delete_user")'));

describe("P2-R1 admin-user-actions reset_password", () => {
  it("never returns or generates a recovery/action link", () => {
    expect(src).not.toMatch(/recovery_link|action_link|hashed_token/);
    expect(block).not.toContain("generateLink");
    expect(block).toContain("resetPasswordForEmail(");
    expect(block).toContain("/reset-password");
  });
  it("is super_admin only", () => {
    expect(block).toMatch(/if \(adminRole\.role !== "super_admin"\) \{\n[^\n]*status: 403/);
  });
  it("refuses super_admin targets (allowlist role) and fails closed on lookup error", () => {
    expect(block).toContain('.from("security_admin_allowlist")');
    expect(block).toContain('.eq("role", "super_admin")');
    expect(block).toMatch(/if \(superErr\) return fail500/);
    expect(block).toMatch(/Cannot reset a Super Admin password[^\n]*status: 403/);
  });
  it("logs failures without the email", () => {
    for (const line of block.split("\n").filter((l) => l.includes("console."))) {
      expect(line).not.toMatch(/email|targetEmail|link/i);
    }
  });
});
