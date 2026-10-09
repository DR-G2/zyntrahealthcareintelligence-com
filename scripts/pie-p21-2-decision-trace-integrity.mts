import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

const URL = process.env.V2_URL;
const KEY = process.env.V2_PUBLISHABLE_KEY;
const PASSWORD = process.env.PIE_TEST_PASSWORD;
const emailA = process.env.PIE_TEST_USER_A_EMAIL;
const emailB = process.env.PIE_TEST_USER_B_EMAIL;
if (!URL || !KEY || !PASSWORD || !emailA || !emailB) throw new Error("Missing P21.2 certification environment");

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

check("P21.2-01 production target is the certified V2 project", URL === "https://hkowvjazuwebmibssdut.supabase.co");

const selectorSource = await readFile("supabase/migrations_v2/0051_pie_p3_candidate_pool.sql", "utf8");
check("P21.2-02 authoritative selector remains versioned as pie-select/p3.0", selectorSource.includes("pie-select/p3.0"));
check("P21.2-03 selector records immutable decision traces", selectorSource.includes("insert into pie.decision_trace"));
check("P21.2-04 selector does not use P12 shadow inference as an input", !selectorSource.includes("inference_shadow"));

const [A, B] = await Promise.all([login(emailA), login(emailB)]);
check("P21.2-05 two authenticated production test identities are distinct", A.id !== B.id);

const created = await A.db.rpc("pie_create_session", {
  p_count: 1,
  p_blueprint_key: "AMC_CAT_MCQ",
  p_mode: "pie_adaptive",
});
const sessionId = created.data?.[0]?.session_id as string | undefined;
check("P21.2-06 authoritative adaptive session is created", !created.error && !!sessionId, created.error?.message ?? "");

if (sessionId) {
  const qs = await A.db.rpc("get_practice_session_questions", { p_session_id: sessionId });
  const rows = Array.isArray(qs.data) ? qs.data as Record<string, unknown>[] : [];
  const first = rows[0];
  const firstQuestionId = String(first?.question_id ?? "");
  check("P21.2-07 initial question is server-selected and session-bound", !qs.error && !!firstQuestionId);

  const traces0 = await A.db.rpc("get_my_pie_decision_traces");
  const all0 = Array.isArray(traces0.data) ? traces0.data as Record<string, unknown>[] : [];
  const initial = all0.find(t => t.session_id === sessionId && t.decision_type === "SESSION_BUILD");
  check("P21.2-08 SESSION_BUILD decision trace exists for the candidate", !traces0.error && !!initial, traces0.error?.message ?? "");
  check("P21.2-09 SESSION_BUILD trace points to the served question",
    !!initial && initial.question_id === firstQuestionId,
    JSON.stringify({ traceQuestion: initial?.question_id ?? null, firstQuestionId }));
  check("P21.2-10 SESSION_BUILD trace is authoritative and versioned",
    !!initial &&
    initial.source === "authoritative" &&
    initial.policy_version === "pie-select/p3.0" &&
    initial.model_version === "pie-select/p3.0-authoritative");

  const saved = await A.db.rpc("save_attempt", {
    p_question_id: firstQuestionId,
    p_session_id: sessionId,
    p_selected_answer: "A",
    p_is_correct: false,
    p_time_taken_seconds: 17,
    p_confidence_level: 3,
    p_answer_changes_count: 0,
    p_time_to_first_click: 600,
    p_change_sequence: [],
    p_pause_events: [],
    p_time_of_day: "P21.2-cert",
    p_question_position: typeof first?.question_position === "number" ? first.question_position : null,
    p_previous_question_correct: null,
    p_question_version: null,
    p_app_version: "P21.2-certification",
    p_provenance: { source: "P21.2-certification" },
  });
  check("P21.2-11 authoritative attempt persists before NEXT_QUESTION", !saved.error && !!saved.data?.id, saved.error?.message ?? "");

  const next = await A.db.rpc("pie_next_question", { p_session_id: sessionId });
  const nextRow = Array.isArray(next.data) ? next.data[0] as Record<string, unknown> | undefined : undefined;
  const nextQuestionId = String(nextRow?.question_id ?? "");
  const decisionId = String(nextRow?.decision_id ?? "");
  check("P21.2-12 NEXT_QUESTION is server-selected with a decision trace id",
    !next.error && !!nextQuestionId && !!decisionId,
    next.error?.message ?? "");

  const qs2 = await A.db.rpc("get_practice_session_questions", { p_session_id: sessionId });
  const rows2 = Array.isArray(qs2.data) ? qs2.data as Record<string, unknown>[] : [];
  check("P21.2-13 session now contains both the served and next question",
    !qs2.error && rows2.length >= 2 &&
    rows2.some(q => q.question_id === firstQuestionId) &&
    rows2.some(q => q.question_id === nextQuestionId));

  const traces = await A.db.rpc("get_my_pie_decision_traces");
  const all = Array.isArray(traces.data) ? traces.data as Record<string, unknown>[] : [];
  const sessionTraces = all.filter(t => t.session_id === sessionId);
  const nextTrace = sessionTraces.find(t => t.id === decisionId);
  check("P21.2-14 NEXT_QUESTION decision trace id resolves through the candidate-scoped trace API",
    !traces.error && !!nextTrace,
    traces.error?.message ?? "");
  check("P21.2-15 NEXT_QUESTION trace points to the returned question",
    !!nextTrace && nextTrace.question_id === nextQuestionId,
    JSON.stringify({ traceQuestion: nextTrace?.question_id ?? null, nextQuestionId }));
  check("P21.2-16 all session decision traces are authoritative and use the certified policy",
    sessionTraces.length >= 2 &&
    sessionTraces.every(t =>
      t.source === "authoritative" &&
      t.policy_version === "pie-select/p3.0" &&
      t.model_version === "pie-select/p3.0-authoritative" &&
      (t.decision_type === "SESSION_BUILD" || t.decision_type === "NEXT_QUESTION")
    ));
  const sessionQuestionIds = new Set(rows2.map(q => String(q.question_id ?? "")));
  check("P21.2-17 every decision trace question is present in the authoritative session",
    sessionTraces.length >= 2 &&
    sessionTraces.every(t => sessionQuestionIds.has(String(t.question_id ?? ""))));
  const traceIds = sessionTraces.map(t => String(t.id ?? "")).filter(Boolean);
  check("P21.2-18 decision trace ids are unique within the session",
    new Set(traceIds).size === traceIds.length);
  const sessionTraceQuestions = sessionTraces.map(t => String(t.question_id ?? ""));
  check("P21.2-19 session decision traces do not duplicate a selected question",
    new Set(sessionTraceQuestions).size === sessionTraceQuestions.length);

  const foreignTraces = await B.db.rpc("get_my_pie_decision_traces");
  const foreign = Array.isArray(foreignTraces.data) ? foreignTraces.data as Record<string, unknown>[] : [];
  check("P21.2-20 second candidate cannot see the first candidate's decision traces",
    !foreignTraces.error && !foreign.some(t => t.session_id === sessionId),
    JSON.stringify({ error: foreignTraces.error?.message ?? null }));

  check("P21.2-21 decision-trace API does not expose privileged credentials",
    !JSON.stringify(traces.data ?? {}).includes("service_role") &&
    !JSON.stringify(traces.data ?? {}).includes("access_token"));
}

await A.db.auth.signOut();
await B.db.auth.signOut();

console.log("");
console.log("P21.2 DECISION-TRACE INTEGRITY SUMMARY: PASS=" + pass + " FAIL=" + fail);
if (fail) process.exit(1);
