/**
 * Authenticated production Nudge runtime certification.
 * Uses only the two designated disposable test identities and existing public RPCs.
 * Required env: V2_URL, V2_PUBLISHABLE_KEY, PIE_TEST_USER_A_EMAIL, PIE_TEST_USER_B_EMAIL, PIE_TEST_PASSWORD.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const need = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`missing env ${k}`);
  return v;
};
const URL = need("V2_URL");
const KEY = need("V2_PUBLISHABLE_KEY");
const PASSWORD = need("PIE_TEST_PASSWORD");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
type User = { label: string; id: string; db: SupabaseClient };
let pass = 0, fail = 0;
const check = (name: string, ok: unknown, detail = "") => {
  if (ok) pass++; else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  | ${detail}` : ""}`);
};
const rpc = (u: User, fn: string, args: Record<string, unknown> = {}) => u.db.rpc(fn, args);

async function signIn(label: string, email: string): Promise<User> {
  const db = createClient(URL, KEY, options);
  const { data, error } = await db.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.user) throw new Error(`${label} sign-in failed: ${error?.message ?? "no user"}`);
  return { label, id: data.user.id, db };
}
async function target(u: User) {
  const r = await rpc(u, "get_my_nudge_target");
  if (r.error) throw new Error(`${u.label} get_my_nudge_target: ${r.error.message}`);
  return Array.isArray(r.data) ? r.data[0] : r.data;
}
async function runNudge(u: User, expectedLoId: string) {
  const created = await rpc(u, "create_my_nudge_session", { p_count: 3 });
  const session = Array.isArray(created.data) ? created.data[0] : created.data;
  check(`${u.label}: fixed Nudge session created`, !created.error && !!session?.session_id,
    created.error?.message ?? `count=${session?.question_count ?? 0}`);
  if (created.error || !session?.session_id) return null;
  check(`${u.label}: session remains scoped to selected LO`, session.lo_id === expectedLoId,
    `target=${expectedLoId}; session=${session.lo_id}`);
  check(`${u.label}: session has at least 3 questions`, Number(session.question_count) >= 3,
    `count=${session.question_count}`);

  const qr = await rpc(u, "get_practice_session_questions", { p_session_id: session.session_id });
  const questions = (qr.data ?? []) as Array<Record<string, any>>;
  check(`${u.label}: session questions served`, !qr.error && questions.length >= 3,
    qr.error?.message ?? `count=${questions.length}`);
  check(`${u.label}: answer key withheld`,
    questions.every(q => !Object.prototype.hasOwnProperty.call(q, "correct_answer") && q.explanation == null));
  if (qr.error || questions.length < 3) return { session, questions, completed: false };

  let saved = 0;
  for (const q of questions) {
    const a = await rpc(u, "save_attempt", {
      p_question_id: q.question_id,
      p_session_id: session.session_id,
      p_selected_answer: "A",
      p_is_correct: false,
      p_time_taken_seconds: 17,
      p_confidence_level: 3,
      p_answer_changes_count: 0,
      p_time_to_first_click: 4,
      p_change_sequence: ["A"],
      p_pause_events: [],
      p_time_of_day: "nudge-live-certification",
      p_question_position: q.question_position,
      p_previous_question_correct: null,
      p_question_version: q.version ?? null,
      p_app_version: "nudge-live-certification",
      p_provenance: { source: "nudge-live-certification", candidate: u.label },
    });
    if (a.error || !a.data?.id) {
      check(`${u.label}: authoritative save_attempt`, false, a.error?.message ?? "attempt not persisted");
      break;
    }
    saved++;
  }
  check(`${u.label}: all Nudge answers saved`, saved === questions.length, `${saved}/${questions.length}`);
  const completed = saved === questions.length
    ? await rpc(u, "complete_practice_session", { p_session_id: session.session_id })
    : { error: { message: "not all answers saved" } };
  check(`${u.label}: Nudge session completed`, !completed.error, completed.error?.message ?? "");
  const progress = !completed.error
    ? await rpc(u, "get_my_nudge_progress", { p_lo_id: session.lo_id })
    : { data: null, error: { message: "session not completed" } };
  const p = Array.isArray(progress.data) ? progress.data[0] : progress.data;
  check(`${u.label}: post-session reassessment available`,
    !progress.error && p?.status === "READY" && Number(p.distinct_question_count) >= 3,
    progress.error?.message ?? JSON.stringify(p ?? {}));
  return { session, questions, completed: !completed.error };
}

async function main() {
  const A = await signIn("A", need("PIE_TEST_USER_A_EMAIL"));
  const B = await signIn("B", need("PIE_TEST_USER_B_EMAIL"));
  check("two distinct disposable authenticated identities", A.id !== B.id);

  // Test A: selector repeatability and fixed target-session lifecycle.
  const a1 = await target(A);
  const a2 = await target(A);
  check("A: repeated target selection is deterministic",
    a1?.status === a2?.status && a1?.lo_id === a2?.lo_id && a1?.lo_key === a2?.lo_key,
    `first=${a1?.status}/${a1?.lo_key ?? "none"}; second=${a2?.status}/${a2?.lo_key ?? "none"}`);
  check("A: enough evidence for a supported Nudge gap", a1?.status === "READY",
    `status=${a1?.status}; reason=${a1?.reason_code}; distinct=${a1?.distinct_question_count}; eligible=${a1?.eligible_question_count}`);

  let aRun: Awaited<ReturnType<typeof runNudge>> = null;
  if (a1?.status === "READY" && a1.lo_id) aRun = await runNudge(A, a1.lo_id);

  // Test B: independent candidate target, session lifecycle, and cross-user progress denial.
  const b1 = await target(B);
  const b2 = await target(B);
  check("B: repeated target selection is deterministic",
    b1?.status === b2?.status && b1?.lo_id === b2?.lo_id && b1?.lo_key === b2?.lo_key,
    `first=${b1?.status}/${b1?.lo_key ?? "none"}; second=${b2?.status}/${b2?.lo_key ?? "none"}`);
  check("B: target is derived from B's own supported evidence", b1?.status === "READY",
    `status=${b1?.status}; reason=${b1?.reason_code}; distinct=${b1?.distinct_question_count}; eligible=${b1?.eligible_question_count}`);

  let bRun: Awaited<ReturnType<typeof runNudge>> = null;
  if (b1?.status === "READY" && b1.lo_id) bRun = await runNudge(B, b1.lo_id);

  if (aRun?.session?.lo_id) {
    const cross = await rpc(B, "get_my_nudge_progress", { p_lo_id: aRun.session.lo_id });
    check("B cannot read A's Nudge reassessment", !!cross.error,
      cross.error?.message ?? "UNEXPECTED CROSS-USER ACCESS");
  } else {
    check("B cannot read A's Nudge reassessment", false, "A did not complete a READY Nudge session");
  }
  if (aRun && bRun) {
    const aIds = new Set(aRun.questions.map(q => q.question_id));
    check("A/B sessions do not share question IDs", bRun.questions.every(q => !aIds.has(q.question_id)),
      "comparison is between the two generated Nudge batches");
  } else {
    check("A/B sessions do not share question IDs", false, "both candidates must complete a Nudge session");
  }

  console.log(`\nNUDGE LIVE CERTIFICATION SUMMARY: PASS=${pass} FAIL=${fail}`);
  if (fail) process.exit(1);
}
main().catch(e => { console.error("FATAL", e?.message ?? e); process.exit(1); });
