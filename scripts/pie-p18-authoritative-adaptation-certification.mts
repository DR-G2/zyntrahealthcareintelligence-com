import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

const URL = process.env.V2_URL;
const KEY = process.env.V2_PUBLISHABLE_KEY;
const PASSWORD = process.env.PIE_TEST_PASSWORD;
const emailA = process.env.PIE_TEST_USER_A_EMAIL;
const emailB = process.env.PIE_TEST_USER_B_EMAIL;
if (!URL || !KEY || !PASSWORD || !emailA || !emailB) throw new Error("Missing P18 certification environment");

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
let pass = 0, fail = 0;
const check = (name: string, ok: unknown, detail = "") => {
  if (ok) pass++; else fail++;
  console.log((ok ? "PASS" : "FAIL") + "  " + name + (detail ? "  — " + detail : ""));
};

async function login(email: string) {
  const db = createClient(URL!, KEY!, opts);
  const { data, error } = await db.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.user) throw new Error("login failed: " + (error?.message ?? ""));
  return { db, id: data.user.id, token: data.session!.access_token };
}

const A = await login(emailA);
const B = await login(emailB);
check("P18-01 two authenticated identities are distinct", A.id !== B.id);

const createA = await A.db.rpc("pie_create_session", { p_count: 1, p_blueprint_key: "AMC_CAT_MCQ", p_mode: "pie_adaptive" });
const sessionId = createA.data?.[0]?.session_id as string | undefined;
check("P18-02 authoritative adaptive session is server-created", !createA.error && !!sessionId, createA.error?.message ?? "");

if (sessionId) {
  const qs = await A.db.rpc("get_practice_session_questions", { p_session_id: sessionId });
  const rows = Array.isArray(qs.data) ? qs.data as Record<string, unknown>[] : [];
  check("P18-03 adaptive question is server-selected", !qs.error && rows.length === 1);
  check("P18-04 adaptive payload contains no answer key", rows.length === 1 && !("correct_answer" in rows[0]));
  check("P18-05 adaptive payload contains no explanation", rows.length === 1 && (!("explanation" in rows[0]) || rows[0].explanation == null));
  check("P18-06 question has server position/version metadata", rows.length === 1 && rows[0].question_position !== undefined);

  const q = rows[0];
  const saved = await A.db.rpc("save_attempt", {
    p_question_id: q.question_id,
    p_session_id: sessionId,
    p_selected_answer: "A",
    p_is_correct: false,
    p_time_taken_seconds: 20,
    p_confidence_level: 3,
    p_answer_changes_count: 999,
    p_time_to_first_click: 500,
    p_change_sequence: ["A"],
    p_pause_events: [],
    p_time_of_day: "P18-cert",
    p_question_position: q.question_position,
    p_previous_question_correct: null,
    p_question_version: q.version ?? null,
    p_app_version: "P18-certification",
    p_provenance: { source: "P18-certification" }
  });
  check("P18-07 authoritative attempt persists through adaptive session", !saved.error && !!saved.data?.id, saved.error?.message ?? "");

  const next = await A.db.rpc("pie_next_question", { p_session_id: sessionId });
  check("P18-08 next question is selected server-side", !next.error && !!next.data?.[0]?.question_id, next.error?.message ?? "");
  check("P18-09 adaptation returns a decision identifier", !next.error && !!next.data?.[0]?.decision_id);
  check("P18-10 adaptation returns an NBLE decision type", !next.error && typeof next.data?.[0]?.nble_type === "string");

  const forged = await B.db.rpc("pie_next_question", { p_session_id: sessionId });
  check("P18-11 second candidate cannot advance first candidate session", !!forged.error, forged.error?.message ?? "UNEXPECTED SUCCESS");
  
  const directTrace = await A.db.schema("pie").from("decision_trace").select("learner_id").eq("session_id", sessionId).limit(1);
  check("P18-12 decision trace is protected from browser reads", !!directTrace.error);

  const done = await A.db.rpc("complete_practice_session", { p_session_id: sessionId });
  check("P18-13 adaptive session can complete through authoritative path", !done.error, done.error?.message ?? "");
}

const clientSource = await readFile("src/lib/pie/pie-practice-client.ts", "utf8");
check("P18-14 client has no question-selection algorithm", !/function .*select|sort\([^)]*score|Math\.random/.test(clientSource) && clientSource.includes("pie_create_session"));
check("P18-15 client does not accept client-supplied question IDs", !clientSource.includes("p_question_ids"));
check("P18-16 adaptive client calls only server selection RPCs", clientSource.includes("pie_create_session") && clientSource.includes("pie_next_question"));

const selectorSource = await readFile("supabase/migrations_v2/0051_pie_p3_candidate_pool.sql", "utf8");
check("P18-17 authoritative selector uses versioned selection policy", selectorSource.includes("pie.selection_policy") && selectorSource.includes("pie-select/p3.0"));
check("P18-18 authoritative selector records decision trace", selectorSource.includes("insert into pie.decision_trace") && selectorSource.includes("p_event_type"));
check("P18-19 shadow inference is not an adaptation input", !selectorSource.includes("inference_shadow") && !selectorSource.includes("pie-infer-state") && !selectorSource.includes("adaptive_policy_shadow"));

console.log("");
console.log("P18 AUTHORITATIVE ADAPTATION BOUNDARY CERTIFICATION SUMMARY: PASS=" + pass + " FAIL=" + fail);
if (fail) process.exit(1);

await A.db.auth.signOut();
await B.db.auth.signOut();
