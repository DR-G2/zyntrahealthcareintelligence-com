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
let pass = 0, fail = 0, skipped = 0;
const check = (name: string, ok: unknown, detail = "") => {
  if (ok) pass++; else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  | ${detail}` : ""}`);
};
const skipCheck = (name: string, detail = "") => { skipped++; console.log(`SKIP  ${name}${detail ? `  | ${detail}` : ""}`); };
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


type Fixture = { loKey: string; questionIds: string[] };
const FIXTURES: Fixture[] = [
  { loKey: "WOMENS_HEALTH.EARLY_PREGNANCY.ECTOPIC_WH", questionIds: [
    "dde2f165-265d-4e2f-b0c1-d341518592fc", "d2bb4a03-0412-4164-b611-b0642c65c0fc",
    "f2e847f0-9ba5-47f4-bf55-68d0850c63eb", "e5460a6c-285f-45f7-b297-3ee7c52889c8",
    "7a782765-6126-4c5e-acef-17c99a511195", "ac91f6e3-ce01-44ae-8c22-9caeb70def12"
  ]},
  { loKey: "WOMENS_HEALTH.EARLY_PREGNANCY.MISCARRIAGE", questionIds: [
    "a5d4574b-8ec4-4a94-b161-ddb870bae651", "b621f550-4997-43e0-8259-47d17dbf91e1",
    "dabc4966-da00-4f9a-9116-e3b33979444c", "a6f226ba-8b6e-4429-a1c3-2241af4455af",
    "28aa313a-6bd2-413c-8e60-4896c9e4dea0", "64829158-834f-4c42-9b65-fc366a7b79c5"
  ]},
  { loKey: "WOMENS_HEALTH.GYNAE_EMERG.OVARIAN_TORSION", questionIds: [
    "3f1c562e-42eb-4fbe-89fa-ae7a820e8165", "940b9f25-06b6-4d6a-b2e2-92222e75e159",
    "8bc1fe63-6287-4ebf-9f71-3b05587b2703", "94ec44ff-fff1-4fc1-a6d8-947071a45583",
    "6830838e-b352-48ac-b781-b4ebce68fdea", "d173cf27-d46a-4580-a6d5-0f93969d2147"
  ]},
  { loKey: "WOMENS_HEALTH.GYNAE_EMERG.VULVAL", questionIds: [
    "a3cc4e8d-8792-40a2-9643-308778d4f6a8", "8f824ba5-2af0-496b-8144-e8e60f410a02",
    "5d31c4fe-4651-44d9-9dd1-102b5c98a7b8", "7005463c-52ab-4bd6-82b6-f66d5f73aa9f",
    "36bc72f7-1ba9-49f0-a349-cf8934974554", "56638b5e-5c5b-4266-b226-c93b13bd4c2e"
  ]}
];

async function seedMappedEvidence(u: User) {
  // Use only a fully untouched six-question fixture. Never overwrite or reset existing candidate history.
  let fixture: Fixture | undefined;
  for (const candidate of FIXTURES) {
    const existing = await u.db.from("user_attempts").select("question_id").in("question_id", candidate.questionIds);
    if (existing.error) throw new Error(`${u.label}: cannot safely inspect fixture usage: ${existing.error.message}`);
    if ((existing.data ?? []).length === 0) { fixture = candidate; break; }
  }
  check(`${u.label}: unused mapped fixture available`, !!fixture,
    fixture?.loKey ?? "all predefined fixture groups already contain attempts");
  if (!fixture) throw new Error("No untouched certification fixture remains; refusing to reuse candidate question history.");

  const created = await rpc(u, "create_practice_session", {
    p_session_type: "nudge-live-certification-seed",
    p_config: { source: "nudge-live-certification", purpose: "mapped-evidence-seed", lo_key: fixture.loKey },
    p_question_ids: fixture.questionIds.slice(0, 3),
  });
  const session = Array.isArray(created.data) ? created.data[0] : created.data;
  check(`${u.label}: mapped-evidence seed session created`, !created.error && !!session?.id,
    created.error?.message ?? `session=${session?.id ?? "none"}`);
  if (created.error || !session?.id) throw new Error("Could not create mapped-evidence seed session.");

  const qr = await rpc(u, "get_practice_session_questions", { p_session_id: session.id });
  const questions = (qr.data ?? []) as Array<Record<string, any>>;
  check(`${u.label}: three mapped seed questions served`, !qr.error && questions.length === 3,
    qr.error?.message ?? `count=${questions.length}`);
  if (qr.error || questions.length !== 3) throw new Error("Seed session did not return exactly three questions.");

  let saved = 0;
  for (const q of questions) {
    const result = await rpc(u, "save_attempt", {
      p_question_id: q.question_id, p_session_id: session.id, p_selected_answer: "B", p_is_correct: false,
      p_time_taken_seconds: 19, p_confidence_level: 2, p_answer_changes_count: 0, p_time_to_first_click: 5,
      p_change_sequence: ["B"], p_pause_events: [], p_time_of_day: "nudge-live-certification",
      p_question_position: q.question_position, p_previous_question_correct: null,
      p_question_version: q.version ?? null, p_app_version: "nudge-live-certification",
      p_provenance: { source: "nudge-live-certification", candidate: u.label, purpose: "mapped-evidence-seed", fixture: fixture.loKey },
    });
    if (result.error || !result.data?.id) {
      check(`${u.label}: seed attempt saved through authoritative RPC`, false, result.error?.message ?? "attempt not persisted");
      throw new Error("Mapped evidence seed attempt failed; refusing to continue.");
    }
    saved++;
  }
  check(`${u.label}: all seed attempts persisted`, saved === 3, `${saved}/3`);
  const completed = await rpc(u, "complete_practice_session", { p_session_id: session.id });
  check(`${u.label}: seed session completed`, !completed.error, completed.error?.message ?? "");
  if (completed.error) throw new Error("Seed session completion failed.");
  return { session, questions, fixture };
}

async function main() {
  const A = await signIn("A", need("PIE_TEST_USER_A_EMAIL"));
  const B = await signIn("B", need("PIE_TEST_USER_B_EMAIL"));
  check("two distinct authenticated test identities", A.id !== B.id);
  if (A.id === B.id) throw new Error("Certification identities must be distinct.");

  // A preserves the existing exhausted-pool negative-path fixture; never mutate or reset A.
  const a1 = await target(A);
  const a2 = await target(A);
  check("A: repeated target selection is deterministic",
    a1?.status === a2?.status && a1?.lo_id === a2?.lo_id && a1?.lo_key === a2?.lo_key,
    `first=${a1?.status}/${a1?.lo_key ?? "none"}; second=${a2?.status}/${a2?.lo_key ?? "none"}`);
  check("A: exhausted question pool fails closed",
    a1?.status === "NO_ELIGIBLE_QUESTIONS" &&
    a1?.reason_code === "NO_GAP_HAS_THREE_UNSEEN_QUESTIONS" &&
    Number(a1?.eligible_question_count) === 0,
    `status=${a1?.status}; reason=${a1?.reason_code}; distinct=${a1?.distinct_question_count}; eligible=${a1?.eligible_question_count}`);

  // B must have a fully untouched mapped fixture. Seed only through authenticated public RPCs.
  const seed = await seedMappedEvidence(B);
  const b1 = await target(B);
  const b2 = await target(B);
  check("B: seeded evidence reaches READY target",
    b1?.status === "READY" && !!b1?.lo_id && b1?.lo_key === seed.fixture.loKey &&
    Number(b1?.distinct_question_count) >= 3 && Number(b1?.eligible_question_count) >= 3,
    `status=${b1?.status}; key=${b1?.lo_key}; distinct=${b1?.distinct_question_count}; eligible=${b1?.eligible_question_count}`);
  check("B: repeated target selection is deterministic",
    b1?.status === b2?.status && b1?.lo_id === b2?.lo_id && b1?.lo_key === b2?.lo_key,
    `first=${b1?.status}/${b1?.lo_key ?? "none"}; second=${b2?.status}/${b2?.lo_key ?? "none"}`);

  let bRun: Awaited<ReturnType<typeof runNudge>> = null;
  if (b1?.status === "READY" && b1.lo_id) bRun = await runNudge(B, b1.lo_id);
  else {
    check("B: positive-path target available for lifecycle", false, "target did not become READY");
    throw new Error("Nudge positive path unavailable after mapped evidence seed.");
  }

  if (bRun?.session?.session_id) {
    const cross = await rpc(A, "get_practice_session_questions", { p_session_id: bRun.session.session_id });
    const leaked = !cross.error && Array.isArray(cross.data) && cross.data.length > 0;
    check("A cannot read B's Nudge session questions", !leaked,
      cross.error?.message ?? `returned_rows=${Array.isArray(cross.data) ? cross.data.length : "non-array"}`);
  } else {
    check("A cannot read B's Nudge session questions", false, "B Nudge session was not created");
  }

  const seedIds = new Set(seed.questions.map(q => q.question_id));
  check("seed and Nudge sessions use disjoint question batches",
    !!bRun && bRun.questions.every(q => !seedIds.has(q.question_id)),
    "three evidence questions are separate from the three unseen Nudge questions");

  console.log(`\\nNUDGE SELECTOR CERTIFICATION SUMMARY: PASS=${pass} FAIL=${fail} SKIP=${skipped}`);
  console.log("Fixture policy: only untouched, pre-mapped active AMC questions; test attempts are provenance-tagged; no candidate history is reset.");
  if (fail || skipped) process.exit(1);
}
main().catch(e => { console.error("FATAL", e?.message ?? e); process.exit(1); });
