import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(__dirname, "../../../supabase/migrations_v2/0091_nudge_pie_authoritative_target_selector.sql"),
  "utf8",
);
const executableSql = migration.replace(/--.*$/gm, "");

describe("Nudge ↔ PIE selector contract (static)", () => {
  it("uses server-saved attempts and primary active LO mappings", () => {
    expect(migration).toContain("public.user_attempts");
    expect(migration).toContain("ql.is_primary");
    expect(migration).toContain("lo.status = 'active'");
    expect(migration).toContain("ua.user_id = v_user");
  });

  it("does not consume heuristic mastery or shadow inference", () => {
    expect(executableSql).not.toMatch(/mastery_mean|mastery_lcb|inference_shadow|adaptive_policy_shadow/i);
  });

  it("has explicit safe outcomes and no unmapped fallback", () => {
    for (const status of ["INSUFFICIENT_EVIDENCE", "NO_SUPPORTED_GAP", "NO_ELIGIBLE_QUESTIONS", "READY"]) {
      expect(migration).toContain(status);
    }
    expect(migration).toContain("FEWER_THAN_THREE_UNSEEN_MAPPED_QUESTIONS");
    expect(migration).toContain("FEWER_THAN_THREE_DISTINCT_MAPPED_QUESTIONS");
    expect(migration).toContain("v_total_distinct < 3");
    expect(migration).toContain("and ql.is_primary");
  });

  it("requires a minimum evidence threshold and unseen eligible questions", () => {
    expect(migration).toContain("count(distinct ua.question_id) >= 3");
    expect(migration).toContain("not exists (");
    expect(migration).toContain("ua.user_id = v_user and ua.question_id = q.id");
  });

  it("restricts RPC execution and pins the security-definer search path", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("revoke all on function public.get_my_nudge_target() from public, anon");
    expect(migration).toContain("grant execute on function public.get_my_nudge_target() to authenticated, service_role");
  });

  it("does not modify the protected save_attempt or P12 inference path", () => {
    expect(migration).not.toMatch(/create or replace function public\.save_attempt|create or replace function pie\.rebuild_authoritative_inference/i);
  });
});
