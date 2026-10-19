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


type Fixture = { loKey: string; questionIds: string[]; subtopicId?: string | null; subjectId?: string | null };

type CandidateQuestion = { id: string; subtopic_id: string | null; subject_id: string | null; zyntra_id?: string | null };

async function discoverUntouchedMappedCandidates(u: User): Promise<Fixture[]> {
  // Question-to-LO mappings and blueprint eligibility are intentionally private to the
  // pie/amc schemas. Discover only public active question IDs here; the authoritative
  // get_my_nudge_target() response below is the gate that proves mapped evidence and
  // at least three eligible unseen questions. Never assume subtopic == LO.
  const qr = await u.db.from("questions")
    .select("id,subtopic_id,subject_id,zyntra_id")
    .eq("status", "active")
    .limit(5000);
  if (qr.error) throw new Error(`${u.label}: cannot discover active certification candidates: ${qr.error.message}`);
  const rows = (qr.data ?? []) as CandidateQuestion[];
  if (!rows.length) throw new Error("No active public questions are available for Nudge certification.");

  const ids = rows.map(q => q.id).filter((id): id is string => !!id);
  const attempted = new Set<string>();
  // Query in bounded chunks to avoid URL-size limits and preserve user-scoped RLS.
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const ar = await u.db.from("user_attempts").select("question_id").eq("user_id", u.id).in("question_id", batch);
    if (ar.error) throw new Error(`${u.label}: cannot safely inspect prior attempts: ${ar.error.message}`);
    for (const a of ar.data ?? []) attempted.add(a.question_id);
  }

  const fresh = rows.filter(q => q.id && !attempted.has(q.id));
  const groups = new Map<string, CandidateQuestion[]>();
  for (const q of fresh) {
    // Prefer tight content clusters. Subject-only groups are a fallback, but all
    // candidates are revalidated by the authoritative target RPC after seeding.
    const groupKey = q.subtopic_id ? `subtopic:${q.subtopic_id}`
      : q.subject_id ? `subject:${q.subject_id}` : "";
    if (!groupKey) continue;
    const group = groups.get(groupKey) ?? [];
    group.push(q);
    groups.set(groupKey, group);
  }
  return [...groups.entries()]
    .filter(([, group]) => group.length >= 3)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([key, group]) => ({
      loKey: key,
      questionIds: group.slice(0, 3).map(q => q.id),
      subtopicId: key.startsWith("subtopic:") ? key.slice("subtopic:".length) : null,
      subjectId: key.startsWith("subject:") ? key.slice("subject:".length) : null,
    }));
}

async function ensureMappedEvidence(u: User) {
  const current = await target(u);
  if (current?.status === "READY" && Number(current.eligible_question_count) >= 3 && current.lo_key) {
    const sessions = await u.db.from("practice_sessions").select("id,config,status,completed_at,started_at").eq("user_id", u.id).eq("status", "completed");
    if (sessions.error) throw new Error(`${u.label}: cannot inspect prior seed sessions: ${sessions.error.message}`);
    const existing = (sessions.data ?? [])
      .filter((s: any) => s.config?.source === "nudge-live-certification" && s.config?.purpose === "mapped-evidence-seed")
      .sort((a: any, b: any) => String(b.completed_at ?? b.started_at ?? "").localeCompare(String(a.completed_at ?? a.started_at ?? "")))[0];
    check(`${u.label}: existing certification evidence supports READY target`, !!existing,
      existing ? `target=${current.lo_key}; prior seed provenance found` : "no provenance-tagged seed session");
    if (!existing) throw new Error("READY target has no matching certification seed; refusing to treat unrelated history as a fixture.");
    const qr = await rpc(u, "get_practice_session_questions", { p_session_id: existing.id });
    const questions = (qr.data ?? []) as Array<Record<string, any>>;
    check(`${u.label}: prior dynamic seed batch recoverable`, !qr.error && questions.length === 3, qr.error?.message ?? `count=${questions.length}`);
    if (qr.error || questions.length !== 3) throw new Error("Could not recover the existing seed batch.");
    return { session: existing, questions, fixture: { loKey: current.lo_key, questionIds: questions.map(q => q.question_id) } };
  }
  return seedMappedEvidence(u);
}

async function seedMappedEvidence(u: User) {
  // Seed only through the real Nudge session creator. It selects questions using
  // pie.question_lo + active LO + current AMC blueprint eligibility + quarantine
  // rules, so this certification never guesses question-to-LO mappings.
  let lastSeed: { session: any; questions: Array<Record<string, any>> } | null = null;
  const maxSessions = 20; // bounded: at most 60 disposable-account attempts
  for (let batch = 1; batch <= maxSessions; batch++) {
    const current = await target(u);
    if (current?.status === "READY" && Number(current.eligible_question_count) >= 3 && current.lo_key) {
      if (lastSeed) {
        check(`${u.label}: authoritative Nudge selector reached READY`, true,
          `lo=${current.lo_key}; eligible_unseen=${current.eligible_question_count}; seed_batches=${batch - 1}`);
        return {
          session: lastSeed.session,
          questions: lastSeed.questions,
          fixture: { loKey: current.lo_key, questionIds: lastSeed.questions.map(q => q.question_id) },
        };
      }
      throw new Error("Target was already READY but no provenance-tagged seed batch was created in this run.");
    }

    const created = await rpc(u, "create_my_nudge_session", { p_count: 3 });
    const session = Array.isArray(created.data) ? created.data[0] : created.data;
    if (created.error || !session?.session_id) {
      // A selector rejection is a candidate-state outcome, not a failed assertion.
      // If we cannot continue and the target is not READY, the final gate below fails once.
      console.log(`INFO  ${u.label}: Nudge evidence batch ${batch} not created: ${created.error?.message ?? "no session returned"}`);
      break;
    }
    const qr = await rpc(u, "get_practice_session_questions", { p_session_id: session.session_id });
    const questions = (qr.data ?? []) as Array<Record<string, any>>;
    check(`${u.label}: authoritative Nudge seed questions served`, !qr.error && questions.length === 3,
      qr.error?.message ?? `count=${questions.length}; batch=${batch}`);
    if (qr.error || questions.length !== 3) throw new Error("Authoritative Nudge seed session did not return exactly three questions.");
    check(`${u.label}: seed answer key withheld`,
      questions.every(q => !Object.prototype.hasOwnProperty.call(q, "correct_answer") && q.explanation == null),
      `batch=${batch}`);

    let saved = 0;
    for (const q of questions) {
      const result = await rpc(u, "save_attempt", {
        p_question_id: q.question_id, p_session_id: session.session_id,
        p_selected_answer: "A", p_is_correct: false,
        p_time_taken_seconds: 19, p_confidence_level: 2, p_answer_changes_count: 0, p_time_to_first_click: 5,
        p_change_sequence: ["A"], p_pause_events: [], p_time_of_day: "nudge-live-certification",
        p_question_position: q.question_position, p_previous_question_correct: null,
        p_question_version: q.version ?? null, p_app_version: "nudge-live-certification",
        p_provenance: {
          source: "nudge-live-certification", candidate: u.label, purpose: "authoritative-nudge-evidence-seed",
          batch, selector: session.lo_key ?? "MIXED_PRACTICE",
        },
      });
      if (result.error || !result.data?.id) {
        check(`${u.label}: authoritative seed attempt persisted`, false, result.error?.message ?? "attempt not persisted");
        throw new Error("Authoritative Nudge seed attempt failed.");
      }
      saved++;
    }
    check(`${u.label}: all authoritative seed attempts persisted`, saved === 3, `${saved}/3; batch=${batch}`);
    const completed = await rpc(u, "complete_practice_session", { p_session_id: session.session_id });
    check(`${u.label}: authoritative seed session completed`, !completed.error, completed.error?.message ?? `batch=${batch}`);
    if (completed.error) throw new Error("Authoritative Nudge seed session completion failed.");
    lastSeed = { session, questions };

    const after = await target(u);
    if (after?.status === "READY" && Number(after.eligible_question_count) >= 3 && after.lo_key) {
      check(`${u.label}: authoritative Nudge selector reached READY`, true,
        `lo=${after.lo_key}; eligible_unseen=${after.eligible_question_count}; batches=${batch}`);
      return {
        session,
        questions,
        fixture: { loKey: after.lo_key, questionIds: questions.map(q => q.question_id) },
      };
    }
    console.log(`INFO  ${u.label}: completed authoritative Nudge evidence batch ${batch}; target=${after?.status ?? "unknown"}; continuing without resetting history.`);
  }

  const finalTarget = await target(u);
  check(`${u.label}: authoritative Nudge evidence establishes READY target`,
    finalTarget?.status === "READY" && Number(finalTarget.eligible_question_count) >= 3 && !!finalTarget.lo_key,
    `status=${finalTarget?.status}; reason=${finalTarget?.reason_code}; mapped_interactions=${finalTarget?.distinct_question_count}; eligible_unseen=${finalTarget?.eligible_question_count}; maximum_batches=${maxSessions}`);
  if (finalTarget?.status === "READY" && Number(finalTarget.eligible_question_count) >= 3 && finalTarget.lo_key && lastSeed) {
    return {
      session: lastSeed.session,
      questions: lastSeed.questions,
      fixture: { loKey: finalTarget.lo_key, questionIds: lastSeed.questions.map(q => q.question_id) },
    };
  }
  throw new Error("Authoritative Nudge lifecycle did not establish a READY target within the bounded seed budget; no mapping was fabricated.");
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
  const seed = await ensureMappedEvidence(B);
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
