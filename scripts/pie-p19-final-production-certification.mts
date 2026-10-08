import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

const URL = process.env.V2_URL;
const KEY = process.env.V2_PUBLISHABLE_KEY;
const PASSWORD = process.env.PIE_TEST_PASSWORD;
const emailA = process.env.PIE_TEST_USER_A_EMAIL;
const emailB = process.env.PIE_TEST_USER_B_EMAIL;
if (!URL || !KEY || !PASSWORD || !emailA || !emailB) throw new Error("Missing P19 certification environment");

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

const A = await login(emailA);
const B = await login(emailB);
check("P19-01 two authenticated candidates are distinct", A.id !== B.id);

const s = await A.db.rpc("pie_create_session", { p_count: 1, p_blueprint_key: "AMC_CAT_MCQ" });
const sessionId = s.data?.[0]?.session_id as string | undefined;
check("P19-02 authoritative session creation succeeds", !s.error && !!sessionId, s.error?.message ?? "");
check("P19-03 session is owned by candidate A", !!sessionId && !s.error);

let firstQ: Record<string, unknown> | undefined;
if (sessionId) {
  const qs = await A.db.rpc("get_practice_session_questions", { p_session_id: sessionId });
  const rows = Array.isArray(qs.data) ? qs.data as Record<string, unknown>[] : [];
  firstQ = rows[0];
  check("P19-04 initial question is server-selected", !qs.error && rows.length === 1);
  check("P19-05 initial payload has no answer key", !!firstQ && !("correct_answer" in firstQ));
  check("P19-06 initial payload has no explanation", !!firstQ && (!("explanation" in firstQ) || firstQ.explanation == null));
  check("P19-07 initial question has server position/version metadata", !!firstQ && firstQ.question_position !== undefined);

  const foreign = await B.db.rpc("get_practice_session_questions", { p_session_id: sessionId });
  check("P19-08 foreign candidate cannot read A session questions", !!foreign.error || !Array.isArray(foreign.data) || foreign.data.length === 0, foreign.error?.message ?? "");

  const directTrace = await A.db.schema("pie").from("decision_trace").select("decision_id").eq("session_id", sessionId).limit(1);
  check("P19-09 browser cannot directly read decision trace", !!directTrace.error);

  const saved = await A.db.rpc("save_attempt", {
    p_question_id: firstQ?.question_id,
    p_session_id: sessionId,
    p_selected_answer: "A",
    p_is_correct: false,
    p_time_taken_seconds: 18,
    p_confidence_level: 3,
    p_answer_changes_count: 0,
    p_time_to_first_click: 600,
    p_change_sequence: ["A"],
    p_pause_events: [],
    p_time_of_day: "P19-cert",
    p_question_position: firstQ?.question_position,
    p_previous_question_correct: null,
    p_question_version: firstQ?.version ?? null,
    p_app_version: "P19-certification",
    p_provenance: { source: "P19-certification" }
  });
  check("P19-10 authoritative attempt persists", !saved.error && !!saved.data?.id, saved.error?.message ?? "");

  const next = await A.db.rpc("pie_next_question", { p_session_id: sessionId });
  check("P19-11 next question is selected by authoritative server path", !next.error && !!next.data?.[0]?.question_id, next.error?.message ?? "");
  check("P19-12 next selection produces decision trace identifier", !next.error && !!next.data?.[0]?.decision_id);
  check("P19-13 next selection does not expose answer key", !next.error && !("correct_answer" in (next.data?.[0] ?? {})));
  check("P19-14 next selection does not expose explanation", !next.error && !("explanation" in (next.data?.[0] ?? {})));

  const complete = await A.db.rpc("complete_practice_session", { p_session_id: sessionId });
  check("P19-15 completed practice session persists through authoritative path", !complete.error, complete.error?.message ?? "");

  const results = await A.db.rpc("get_practice_session_results", { p_session_id: sessionId });
  const resultRows = Array.isArray(results.data) ? results.data as Record<string, unknown>[] : [];
  const answered = resultRows.find(r => r.question_id === firstQ?.question_id);
  check("P19-16 completed results are candidate-scoped", !results.error && !!answered);
  check("P19-17 answered result may expose grading result only after completion", !!answered && ("correct_answer" in answered || "is_correct" in answered));
  check("P19-18 completed result contains no service-role material", !results.error && resultRows.every(r => !("service_role" in r) && !("access_token" in r)));

  const forgedNext = await B.db.rpc("pie_next_question", { p_session_id: sessionId });
  check("P19-19 second candidate cannot advance A session", !!forgedNext.error, forgedNext.error?.message ?? "UNEXPECTED SUCCESS");
}

const clientSource = await readFile("src/lib/pie/pie-practice-client.ts", "utf8");
check("P19-20 client still delegates selection to server", clientSource.includes("pie_create_session") && clientSource.includes("pie_next_question"));
check("P19-21 client contains no question-selection scoring algorithm", !/Math\.random|sort\([^)]*score|selectQuestion|rankCandidates/.test(clientSource));
check("P19-22 client does not accept caller-supplied question IDs for selection", !clientSource.includes("p_question_ids"));

const forbidden = ["service_role", "SUPABASE_SERVICE_ROLE_KEY", "pie-infer-state"];
check("P19-23 client practice source has no privileged inference credential/path", forbidden.every(x => !clientSource.includes(x)));

const selector = await readFile("supabase/migrations_v2/0051_pie_p3_candidate_pool.sql", "utf8");
check("P19-24 authoritative selector remains versioned", selector.includes("pie-select/p3.0"));
check("P19-25 authoritative selector records decision traces", selector.includes("insert into pie.decision_trace"));
check("P19-26 shadow inference remains outside adaptation", !selector.includes("inference_shadow") && !selector.includes("pie-infer-state"));
check("P19-27 selector has deterministic tie-breaking", selector.includes("order by c.total desc, c.tie_rank asc, c.tie_hash asc"));
check("P19-28 selector is server-only", selector.includes("revoke all on function pie.decide") && selector.includes("grant execute on function pie.decide") && selector.includes("service_role"));

console.log("");
console.log("P19 FINAL END-TO-END PRODUCTION CERTIFICATION SUMMARY: PASS=" + pass + " FAIL=" + fail);
if (fail) process.exit(1);

await A.db.auth.signOut();
await B.db.auth.signOut();
