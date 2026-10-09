import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const mig = (f: string) => readFileSync(resolve(__dirname, "../../../supabase/migrations_v2", f), "utf8");
const pool = mig("0051_pie_p3_candidate_pool.sql");
const seed = mig("0050_pie_p3_seed_lo_map_irt.sql");
const amc = mig("0049_pie_p3_readiness_to_amc.sql");
const amcBoundary = mig("0063_amc_blueprint_fail_closed.sql");
const pieClient = readFileSync(resolve(__dirname, "pie-practice-client.ts"), "utf8");

describe("P3 candidate pool contract (static)", () => {
  it("learner RPCs return no answer key or explanation", () => {
    const rpcs = pool.split("create or replace function public.").slice(1).filter((s) => s.startsWith("pie_"));
    expect(rpcs.length).toBe(2);
    for (const r of rpcs) {
      const sig = r.slice(0, r.indexOf("language"));
      expect(sig).not.toMatch(/correct_answer|explanation|is_correct/);
    }
  });
  it("has no fixed ratios, quotas or domain caps", () => {
    const selector = pool.slice(pool.indexOf("create or replace function pie.rank_candidates"), pool.indexOf("create or replace function public.pie_create_session"));
    expect(selector).not.toMatch(/ceil\(|quota|ratio|per_domain|slot/i);
  });
  it("weights are versioned and flagged as design defaults", () => {
    expect(pool).toContain("'pie-select/p3.0'");
    expect(pool).toMatch(/DESIGN DEFAULTS, uncalibrated/);
    for (const k of ["uncertainty", "misconception", "behaviour", "review_due", "recency", "difficulty", "reasoning", "coverage", "information_value"]) {
      expect(pool).toContain(`'${k}'`);
    }
  });
  it("all six NBLE types and directive trace fields exist", () => {
    for (const t of ["new_content", "remediation", "review", "verification", "prerequisite_repair", "misconception_repair"]) expect(pool).toContain(`'${t}'`);
    for (const f of ["learner_id", "decision_id", "question_id", "event_type", "subject_id", "concept_id", "lo_id", "primary_reasons", "secondary_reasons", "rejected_candidates", "policy_version", "created_at"]) expect(pool).toContain(f);
  });
  it("seed maps 225 questions and imports irt_b for 225", () => {
    const mapBlock = seed.slice(seed.indexOf("insert into pie.question_lo"), seed.indexOf("on conflict (question_id, lo_id)"));
    expect((mapBlock.match(/^\('[0-9a-f-]{36}'::uuid,'[0-9a-f-]{36}'::uuid\)/gm) ?? []).length).toBe(225);
    expect((seed.match(/'tier_prior','tier=/g) ?? []).length).toBe(225);
  });
  it("readiness tables moved to amc", () => {
    expect(amc).toMatch(/pie\.pie_exam_readiness set schema amc/);
    expect(amc).toMatch(/in \('intelligence','amc'\)/);
  });
  it("fails closed for AMC sessions until question-to-blueprint mappings are reviewed", () => {
    expect(amcBoundary).toContain("AMC_BLUEPRINT_MAPPING_REQUIRED");
    expect(amcBoundary).toContain("AMC_QUESTION_NOT_REVIEWED_AND_MAPPED_TO_ACTIVE_BLUEPRINT");
    expect(amcBoundary).toContain("amc_blueprint_lo");
    expect(amcBoundary).toContain("ZYNTRA_GENERAL");
    expect(amcBoundary).toContain("AMC_QUESTION_NOT_REVIEWED_AND_MAPPED_TO_ACTIVE_BLUEPRINT");
    expect(amcBoundary).toContain("metadata ->> 'review_status' = 'APPROVED'");
    expect(amcBoundary).toContain("qc.question_version = q.version::text");
    expect(amcBoundary).toContain("ORDER BY b2.effective_from DESC NULLS LAST");
    expect(amcBoundary).toContain("AMC_CLINICAL_SELECTOR_NOT_INTEGRATED");
    expect(amcBoundary).toContain("Clinical stations require a dedicated OSCE selector");
  });
  it("uses an exam-neutral blueprint for generic practice and diagnostic sessions", () => {
    expect(pieClient).toContain("p_blueprint_key: 'ZYNTRA_GENERAL'");
    expect(pieClient).not.toContain("p_blueprint_key: 'AMC_CAT_MCQ', p_mode: 'pie_diagnostic'");
  });

});
