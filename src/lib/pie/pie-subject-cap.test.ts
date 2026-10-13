import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../../..");
const mig = readFileSync(resolve(root, "supabase/migrations_v2/0082_pie_subject_session_cap.sql"), "utf8");
const baseline = readFileSync(resolve(root, "supabase/verification_v2/pie_subject_cap/live_decide.sql"), "utf8");
const fn = mig.slice(mig.indexOf("create or replace function pie.decide"), mig.indexOf("$function$;") + 11);

describe("0082 PIE per-session subject cap (static contract)", () => {
  it("caps at ceil(0.4 * target) with session config, build size, or the 20-item default", () => {
    expect(fn).toMatch(/ceil\(0\.4 \* greatest\(v_target, v_served \+ 1\)\)/);
    expect(fn).toContain("config->>'target_length'");
    expect(fn).toMatch(/when p_event_type = 'SESSION_BUILD' then v_prior \+ p_n end, 20\)/);
  });
  it("excludes capped subjects with reject_reason subject_cap, unless every eligible candidate is capped", () => {
    expect(fn).toContain("reject_reason = 'subject_cap'");
    expect(fn).toMatch(/if not v_fallback then\s+update pg_temp\.pie_cand/);
  });
  it("writes cap state, exclusions and fallback into decision_trace", () => {
    for (const k of ["'subject_cap', v_cap_state", "'capped_subjects'", "'excluded_candidates'", "'fallback'", "'fallback_reason'", "'subject_cap_fallback'", "'subject_cap_applied'"]) expect(fn).toContain(k);
  });
  it("keeps SECURITY DEFINER, empty search_path and the live service_role-only EXECUTE", () => {
    expect(fn).toMatch(/security definer\s+set search_path to ''/);
    expect(mig).toMatch(/revoke all on function pie\.decide\(uuid, uuid, text, integer, text, text\) from public, anon, authenticated;/);
    expect(mig).toMatch(/grant execute on function pie\.decide\(uuid, uuid, text, integer, text, text\) to service_role;/);
    expect(mig).not.toMatch(/grant execute[^;]*pie\.decide[^;]*to[^;]*(anon|public|authenticated)/i);
  });
  it("is built on the live definition: signature, ranking call and trace columns unchanged", () => {
    expect(baseline).toContain("CREATE OR REPLACE FUNCTION pie.decide(p_user uuid, p_session uuid, p_event_type text, p_n integer");
    expect(fn).toContain("perform pie.rank_candidates(p_user, p_session, p_policy, p_blueprint_key, v_qs, v_los);");
    expect(fn).toContain("order by c.total desc, c.tie_rank asc, c.tie_hash asc limit 1");
    expect(fn).toContain("'pie-select/p3.0-authoritative'");
  });
});
