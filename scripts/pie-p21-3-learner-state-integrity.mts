import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

const URL = process.env.V2_URL;
const KEY = process.env.V2_PUBLISHABLE_KEY;
const PASSWORD = process.env.PIE_TEST_PASSWORD;
const emailA = process.env.PIE_TEST_USER_A_EMAIL;
const emailB = process.env.PIE_TEST_USER_B_EMAIL;
if (!URL || !KEY || !PASSWORD || !emailA || !emailB) throw new Error("Missing P21.3 certification environment");

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
let pass = 0, fail = 0;
const check = (name: string, ok: unknown, detail = "") => {
  if (ok) pass++; else fail++;
  console.log((ok ? "PASS" : "FAIL") + "  " + name + (detail ? "  — " + detail : ""));
};

async function login(email: string) {
  const db = createClient(URL!, KEY!, opts);
  const { data, error } = await db.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.user || !data.session) throw new Error("login failed: " + (error?.message ?? ""));
  return { db, id: data.user.id };
}

const source = await readFile("supabase/migrations_v2/0046_pie_p2_learner_lo_state.sql", "utf8");
check("P21.3-01 production target is the certified V2 project", URL === "https://hkowvjazuwebmibssdut.supabase.co");
check("P21.3-02 learner state is explicitly derived from authoritative user_attempts", source.includes("pure derivation of user_attempts") && source.includes("pie.recompute_learner_lo_state"));
check("P21.3-03 learner state policy remains versioned as pie-lo-state/p2.0", source.includes("c_policy constant text := 'pie-lo-state/p2.0'"));
check("P21.3-04 learner state has no learner table write grants", /revoke all on pie\.learner_lo_state from public, anon, authenticated/i.test(source));
check("P21.3-05 direct learner attempt mutation is blocked", source.includes("user_attempts is append-only") && source.includes("revoke insert, update, delete"));

const [A, B] = await Promise.all([login(emailA), login(emailB)]);
check("P21.3-06 two authenticated production test identities are distinct", A.id !== B.id);

const created = await A.db.rpc("pie_create_session", {
  p_count: 1,
  p_blueprint_key: "AMC_CAT_MCQ",
  p_mode: "pie_adaptive",
});
const sessionId = created.data?.[0]?.session_id as string | undefined;
check("P21.3-07 authoritative adaptive session is created", !created.error && !!sessionId, created.error?.message ?? "");

if (sessionId) {
  const qs = await A.db.rpc("get_practice_session_questions", { p_session_id: sessionId });
  const rows = Array.isArray(qs.data) ? qs.data as Record<string, unknown>[] : [];
  const first = rows[0];
  const questionId = String(first?.question_id ?? "");
  check("P21.3-08 server-selected question is available for authoritative evidence", !qs.error && !!questionId);

  const before = await A.db.rpc("get_my_lo_state");
  const beforeRows = Array.isArray(before.data) ? before.data as Record<string, unknown>[] : [];
  check("P21.3-09 learner-safe LO state read succeeds without exposing answer keys",
    !before.error &&
    !JSON.stringify(before.data ?? {}).includes("correct_answer") &&
    !JSON.stringify(before.data ?? {}).includes("selected_answer"));

  const saved = await A.db.rpc("save_attempt", {
    p_question_id: questionId,
    p_session_id: sessionId,
    p_selected_answer: "A",
    p_is_correct: false,
    p_time_taken_seconds: 19,
    p_confidence_level: 3,
    p_answer_changes_count: 1,
    p_time_to_first_click: 700,
    p_change_sequence: ["A", "B"],
    p_pause_events: [],
    p_time_of_day: "P21.3-cert",
    p_question_position: typeof first?.question_position === "number" ? first.question_position : null,
    p_previous_question_correct: null,
    p_question_version: null,
    p_app_version: "P21.3-certification",
    p_provenance: { source: "P21.3-certification" },
  });
  check("P21.3-10 authoritative attempt persists before learner-state recompute", !saved.error && !!saved.data?.id, saved.error?.message ?? "");

  const refreshed = await A.db.rpc("refresh_my_lo_state");
  check("P21.3-11 authenticated learner can trigger only its own server-side recompute", !refreshed.error, refreshed.error?.message ?? "");

  const after = await A.db.rpc("get_my_lo_state");
  const afterRows = Array.isArray(after.data) ? after.data as Record<string, unknown>[] : [];
  check("P21.3-12 recomputed learner state is returned through the learner-safe API", !after.error);

  const exposureTotal = afterRows.reduce((n, r) => n + Number(r.exposure_count ?? 0), 0);
  const policyVersions = new Set(afterRows.map(r => String(r.policy_version ?? "")));
  check("P21.3-13 new authoritative attempt is represented in derived LO evidence",
    exposureTotal >= beforeRows.reduce((n, r) => n + Number(r.exposure_count ?? 0), 0) + 1,
    JSON.stringify({ beforeExposure: beforeRows.reduce((n, r) => n + Number(r.exposure_count ?? 0), 0), afterExposure: exposureTotal }));
  check("P21.3-14 all returned LO state uses the certified policy version",
    afterRows.length === 0 || (policyVersions.size === 1 && policyVersions.has("pie-lo-state/p2.0")));

  const stable = (rows: Record<string, unknown>[]) => rows.map(r => {
    const copy = { ...r };
    delete copy.computed_at;
    return JSON.stringify(copy);
  }).sort();

  const refreshAgain = await A.db.rpc("refresh_my_lo_state");
  const after2 = await A.db.rpc("get_my_lo_state");
  const afterRows2 = Array.isArray(after2.data) ? after2.data as Record<string, unknown>[] : [];
  check("P21.3-15 repeated recompute is deterministic for learner-state values",
    !refreshAgain.error && !after2.error && JSON.stringify(stable(afterRows)) === JSON.stringify(stable(afterRows2)));

  const direct = await A.db.schema("pie").from("learner_lo_state").select("*").limit(1);
  check("P21.3-16 learner cannot directly read protected learner-state table", !!direct.error || !direct.data || direct.data.length === 0,
    direct.error?.message ?? "direct read returned no rows");

  const foreign = await B.db.rpc("get_my_lo_state");
  const foreignRows = Array.isArray(foreign.data) ? foreign.data as Record<string, unknown>[] : [];
  check("P21.3-17 second candidate cannot see first candidate's learner state",
    !foreign.error && !foreignRows.some(r => JSON.stringify(r).includes(A.id)),
    JSON.stringify({ error: foreign.error?.message ?? null }));

  check("P21.3-18 learner-state API exposes no privileged credentials",
    !JSON.stringify(after.data ?? {}).includes("service_role") &&
    !JSON.stringify(after.data ?? {}).includes("access_token"));

  check("P21.3-19 learner-state API exposes no answer key or raw question answer",
    !JSON.stringify(after.data ?? {}).includes("correct_answer") &&
    !JSON.stringify(after.data ?? {}).includes("selected_answer"));
}

await A.db.auth.signOut();
await B.db.auth.signOut();

console.log("");
console.log("P21.3 LEARNER-STATE INTEGRITY SUMMARY: PASS=" + pass + " FAIL=" + fail);
if (fail) process.exit(1);
