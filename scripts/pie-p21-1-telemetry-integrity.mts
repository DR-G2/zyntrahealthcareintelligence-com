import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

const URL = process.env.V2_URL;
const KEY = process.env.V2_PUBLISHABLE_KEY;
const PASSWORD = process.env.PIE_TEST_PASSWORD;
const emailA = process.env.PIE_TEST_USER_A_EMAIL;
const emailB = process.env.PIE_TEST_USER_B_EMAIL;
if (!URL || !KEY || !PASSWORD || !emailA || !emailB) throw new Error("Missing P21.1 certification environment");

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

check("P21.1-01 production target is the certified V2 project", URL === "https://hkowvjazuwebmibssdut.supabase.co");

const saveSource = await readFile("supabase/migrations_v2/0044_pie_candidate_state_pipeline_repair.sql", "utf8");
check(
  "P21.1-02 save_attempt persists the authoritative attempt before PIE telemetry",
  saveSource.indexOf("insert into public.user_attempts") < saveSource.indexOf("insert into pie.pie_observation")
);
check(
  "P21.1-03 PIE telemetry failure is isolated from authoritative persistence",
  saveSource.includes("begin\n   insert into pie.pie_observation") &&
  saveSource.includes("exception when others then")
);
check(
  "P21.1-04 observation carries the authoritative attempt identifier",
  saveSource.includes("v_attempt.id,'MCQ_ATTEMPT'")
);
check(
  "P21.1-05 observation carries user and question identity from the authoritative attempt",
  saveSource.includes("v_user,p_question_id,v_attempt.id")
);
check(
  "P21.1-06 observation provenance identifies public.save_attempt",
  saveSource.includes("jsonb_build_object('source','public.save_attempt'")
);
check(
  "P21.1-07 telemetry payload maps outcome, confidence, timing and answer changes",
  saveSource.includes("'outcome',case when v_is_correct") &&
  saveSource.includes("'confidence_normalized'") &&
  saveSource.includes("'time_total_ms'") &&
  saveSource.includes("'answer_changes'")
);
check(
  "P21.1-08 certified P20 selector source remains untouched by P21.1",
  !(await readFile("supabase/migrations_v2/0051_pie_p3_candidate_pool.sql", "utf8")).includes("p21")
);

const [A, B] = await Promise.all([login(emailA), login(emailB)]);
check("P21.1-09 two authenticated production test identities are distinct", A.id !== B.id);

const before = await A.db.rpc("pie_create_session", {
  p_count: 1,
  p_blueprint_key: "AMC_CAT_MCQ",
  p_mode: "pie_adaptive",
});
const sessionId = before.data?.[0]?.session_id as string | undefined;
check("P21.1-10 production adaptive session can be created", !before.error && !!sessionId, before.error?.message ?? "");

let questionId = "";
let questionPosition: number | null = null;
if (sessionId) {
  const qs = await A.db.rpc("get_practice_session_questions", { p_session_id: sessionId });
  const rows = Array.isArray(qs.data) ? qs.data as Record<string, unknown>[] : [];
  const q = rows[0];
  questionId = String(q?.question_id ?? "");
  questionPosition = typeof q?.question_position === "number" ? q.question_position : null;
  check("P21.1-11 server-selected question is available", !qs.error && !!questionId);

  const pre = await A.db.functions.invoke("pie-telemetry-audit", { body: {} });
  const prePayload = (pre.data ?? {}) as Record<string, unknown>;
  const beforeCount = Number(prePayload.observation_count_for_attempts ?? 0);
  const beforeAttempts = Number(prePayload.attempt_count ?? 0);
  check("P21.1-12 pre-attempt telemetry audit is readable", !pre.error && prePayload.status === "ready");

  const saved = await A.db.rpc("save_attempt", {
    p_question_id: questionId,
    p_session_id: sessionId,
    p_selected_answer: "A",
    p_is_correct: false,
    p_time_taken_seconds: 19,
    p_confidence_level: 3,
    p_answer_changes_count: 1,
    p_time_to_first_click: 700,
    p_change_sequence: ["A"],
    p_pause_events: [],
    p_time_of_day: "P21.1-cert",
    p_question_position: questionPosition,
    p_previous_question_correct: null,
    p_question_version: null,
    p_app_version: "P21.1-certification",
    p_provenance: { source: "P21.1-certification" },
  });
  const attemptId = saved.data?.id as string | undefined;
  check("P21.1-13 authoritative attempt persists", !saved.error && !!attemptId, saved.error?.message ?? "");

  const after = await A.db.functions.invoke("pie-telemetry-audit", { body: {} });
  const afterPayload = (after.data ?? {}) as Record<string, unknown>;
  const afterCount = Number(afterPayload.observation_count_for_attempts ?? 0);
  const afterAttempts = Number(afterPayload.attempt_count ?? 0);
  check("P21.1-14 exactly one PIE observation is produced for the new attempt",
    !after.error &&
    afterCount === beforeCount + 1 &&
    afterAttempts === beforeAttempts + 1 &&
    afterPayload.latest_attempt_id === attemptId &&
    afterPayload.latest_attempt_has_observation === true &&
    afterPayload.latest_attempt_observation_identity_match === true &&
    Number(afterPayload.attempts_missing_observation ?? -1) === 0 &&
    Number(afterPayload.identity_mismatches ?? -1) === 0 &&
    Number(afterPayload.duplicate_attempt_observation_rows ?? -1) === 0,
    JSON.stringify({ error: after.error?.message ?? null, data: afterPayload }));

  const repeat = await A.db.functions.invoke("pie-telemetry-audit", { body: {} });
  const repeatPayload = (repeat.data ?? {}) as Record<string, unknown>;
  check("P21.1-15 repeated telemetry audit does not create a duplicate observation",
    !repeat.error &&
    Number(repeatPayload.observation_count_for_attempts ?? -1) === afterCount &&
    repeatPayload.latest_observation_id === afterPayload.latest_observation_id,
    JSON.stringify({ error: repeat.error?.message ?? null, data: repeatPayload }));

  check("P21.1-16 telemetry audit is user-scoped and reports a healthy state",
    !after.error &&
    afterPayload.user_scoped === true &&
    afterPayload.status === "ready",
    JSON.stringify(afterPayload));

  check("P21.1-17 telemetry response does not expose privileged credentials",
    !JSON.stringify(afterPayload).includes("service_role") &&
    !JSON.stringify(afterPayload).includes("access_token"));

  const foreign = await B.db.rpc("get_practice_session_questions", { p_session_id: sessionId });
  check("P21.1-18 telemetry certification session remains candidate-isolated", !!foreign.error || !Array.isArray(foreign.data) || foreign.data.length === 0);

}

await A.db.auth.signOut();
await B.db.auth.signOut();

console.log("");
console.log("P21.1 PRODUCTION TELEMETRY INTEGRITY SUMMARY: PASS=" + pass + " FAIL=" + fail);
if (fail) process.exit(1);
