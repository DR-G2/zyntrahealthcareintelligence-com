import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

const URL = process.env.V2_URL;
const KEY = process.env.V2_PUBLISHABLE_KEY;
const PASSWORD = process.env.PIE_TEST_PASSWORD;
const emailA = process.env.PIE_TEST_USER_A_EMAIL;
const emailB = process.env.PIE_TEST_USER_B_EMAIL;
if (!URL || !KEY || !PASSWORD || !emailA || !emailB) throw new Error("Missing P20 certification environment");

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

check("P20-01 deployment target is the certified V2 Supabase project", URL === "https://hkowvjazuwebmibssdut.supabase.co");
const [v2ClientSource, practiceSource, adapterSource, netlify, selectorSource] = await Promise.all([
  readFile("src/integrations/supabase/v2-client.ts", "utf8"),
  readFile("src/lib/migration/v2-practice-session.ts", "utf8"),
  readFile("src/lib/migration/v2-practice-adapter.ts", "utf8"),
  readFile("netlify.toml", "utf8"),
  readFile("supabase/migrations_v2/0051_pie_p3_candidate_pool.sql", "utf8"),
]);
check("P20-02 frontend V2 client targets certified production project", v2ClientSource.includes("hkowvjazuwebmibssdut.supabase.co"));
check("P20-03 frontend uses publishable key path only", !v2ClientSource.includes("service_role") && !v2ClientSource.includes("SUPABASE_SERVICE_ROLE_KEY"));
check("P20-04 V2 auth bridge uses caller session, not privileged client credentials", practiceSource.includes("legacyAccessToken") && practiceSource.includes("v2-auth-bridge") && !practiceSource.includes("service_role"));
check("P20-05 client practice path creates sessions only through authoritative RPC", practiceSource.includes("pie_create_session") || practiceSource.includes("only by the PIE server RPC"));
check("P20-06 V2 practice remains an explicit migration gate", adapterSource.includes("VITE_SUPABASE_V2_PRACTICE_ENABLED === 'true'"));
check("P20-07 deployment target is Netlify-compatible", netlify.includes("npm run build") && netlify.includes("publish = \"dist\"") && netlify.includes("to = \"/index.html\""));
check("P20-08 selector policy remains versioned", selectorSource.includes("pie-select/p3.0"));
check("P20-09 selector remains deterministic", selectorSource.includes("order by c.total desc, c.tie_rank asc, c.tie_hash asc"));
check("P20-10 shadow inference remains outside authoritative selector", !selectorSource.includes("inference_shadow") && !selectorSource.includes("pie-infer-state"));

const A = await login(emailA);
const B = await login(emailB);
check("P20-11 two production test identities authenticate and are distinct", A.id !== B.id);

const s = await A.db.rpc("pie_create_session", { p_count: 1, p_blueprint_key: "AMC_CAT_MCQ", p_mode: "adaptive" });
const sessionId = s.data?.[0]?.session_id as string | undefined;
check("P20-12 authoritative adaptive session can be created in production", !s.error && !!sessionId, s.error?.message ?? "");

if (sessionId) {
  const qs = await A.db.rpc("get_practice_session_questions", { p_session_id: sessionId });
  const rows = Array.isArray(qs.data) ? qs.data as Record<string, unknown>[] : [];
  const q = rows[0];
  check("P20-13 production session contains a server-selected question", !qs.error && rows.length === 1 && !!q?.question_id);
  check("P20-14 production question payload withholds answer key", !!q && !("correct_answer" in q));
  check("P20-15 production question payload withholds explanation", !!q && (!("explanation" in q) || q.explanation == null));

  const foreignRead = await B.db.rpc("get_practice_session_questions", { p_session_id: sessionId });
  check("P20-16 cross-candidate session isolation holds", !!foreignRead.error || !Array.isArray(foreignRead.data) || foreignRead.data.length === 0);

  const traceDirect = await A.db.schema("pie").from("decision_trace").select("decision_id").eq("session_id", sessionId).limit(1);
  check("P20-17 browser cannot directly read protected decision traces", !!traceDirect.error);

  const saved = await A.db.rpc("save_attempt", {
    p_question_id: q?.question_id,
    p_session_id: sessionId,
    p_selected_answer: "A",
    p_is_correct: false,
    p_time_taken_seconds: 17,
    p_confidence_level: 3,
    p_answer_changes_count: 0,
    p_time_to_first_click: 500,
    p_change_sequence: ["A"],
    p_pause_events: [],
    p_time_of_day: "P20-cert",
    p_question_position: q?.question_position,
    p_previous_question_correct: null,
    p_question_version: q?.version ?? null,
    p_app_version: "P20-certification",
    p_provenance: { source: "P20-certification" }
  });
  check("P20-18 authoritative attempt persists in production", !saved.error && !!saved.data?.id, saved.error?.message ?? "");

  const next = await A.db.rpc("pie_next_question", { p_session_id: sessionId });
  check("P20-19 next question remains server-selected", !next.error && !!next.data?.[0]?.question_id, next.error?.message ?? "");
  check("P20-20 next selection carries decision trace identifier", !next.error && !!next.data?.[0]?.decision_id);

  const complete = await A.db.rpc("complete_practice_session", { p_session_id: sessionId });
  check("P20-21 session completion persists through production path", !complete.error, complete.error?.message ?? "");

  const results = await A.db.rpc("get_practice_session_results", { p_session_id: sessionId });
  const resultRows = Array.isArray(results.data) ? results.data as Record<string, unknown>[] : [];
  check("P20-22 completed results are candidate-scoped and contain grading", !results.error && resultRows.length >= 1 && resultRows.every(r => "is_correct" in r || "correct_answer" in r));
  check("P20-23 completed results contain no privileged credential material", !results.error && resultRows.every(r => !("service_role" in r) && !("access_token" in r)));

  const forged = await B.db.rpc("pie_next_question", { p_session_id: sessionId });
  check("P20-24 foreign candidate cannot advance production session", !!forged.error);
}

console.log("");
console.log("P20 PRODUCTION DEPLOYMENT GATE SUMMARY: PASS=" + pass + " FAIL=" + fail);
if (fail) process.exit(1);

await A.db.auth.signOut();
await B.db.auth.signOut();
