#!/usr/bin/env node
/**
 * End-to-end verification of the production PIE pipeline against the live V2 project,
 * using two EXISTING test accounts (never creates users, never uses service-role keys).
 *
 * Flow (user A): legacy sign-in -> v2-auth-bridge -> V2 session -> create_practice_session
 *   -> save_attempt (server grades) -> complete_practice_session -> public.rebuild_candidate_state
 *   -> public.my_pie_state -> re-read (persists) -> answer another -> state/evidence advances.
 * Isolation (user B, anon): cannot read/rebuild A's state or touch internal pie.* objects.
 *
 * Required env (no defaults for secrets):
 *   V2_URL, V2_PUBLISHABLE_KEY, LEGACY_URL, LEGACY_PUBLISHABLE_KEY,
 *   USER_A_EMAIL, USER_A_PASSWORD, USER_B_EMAIL, USER_B_PASSWORD
 * Usage: node scripts/pie-e2e-verify.mjs
 * NOTE: writes real practice attempts for the two test accounts in production.
 */
import { createClient } from "@supabase/supabase-js";

const env = (name) => {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env ${name}`);
    process.exit(2);
  }
  return value;
};

const cfg = {
  v2Url: env("V2_URL"),
  v2Key: env("V2_PUBLISHABLE_KEY"),
  legacyUrl: env("LEGACY_URL"),
  legacyKey: env("LEGACY_PUBLISHABLE_KEY"),
  a: { email: env("USER_A_EMAIL"), password: env("USER_A_PASSWORD") },
  b: { email: env("USER_B_EMAIL"), password: env("USER_B_PASSWORD") },
};

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};
const noPersist = { auth: { persistSession: false, autoRefreshToken: false } };

async function v2SessionFor({ email, password }) {
  const legacy = createClient(cfg.legacyUrl, cfg.legacyKey, noPersist);
  const { data: signIn, error: signInError } = await legacy.auth.signInWithPassword({ email, password });
  if (signInError || !signIn.session) throw new Error(`legacy sign-in failed for ${email}: ${signInError?.message}`);

  const response = await fetch(`${cfg.v2Url}/functions/v1/v2-auth-bridge`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${signIn.session.access_token}`,
      apikey: cfg.legacyKey,
      "Content-Type": "application/json",
      Origin: "https://www.zyntrahealthcareintelligence.com",
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.token_hash) throw new Error(`v2-auth-bridge failed (${response.status}): ${payload.error}`);

  const v2 = createClient(cfg.v2Url, cfg.v2Key, noPersist);
  const { error: otpError } = await v2.auth.verifyOtp({ token_hash: payload.token_hash, type: "email" });
  if (otpError) throw new Error(`V2 verifyOtp failed: ${otpError.message}`);
  const { data: s } = await v2.auth.getSession();
  if (!s.session?.user?.id) throw new Error("V2 session missing after verifyOtp");
  return { legacy, v2, v2UserId: s.session.user.id, legacyUserId: signIn.session.user.id };
}

async function readState(v2) {
  const { data, error } = await v2.from("my_pie_state")
    .select("user_id, state_version, state, confidence, calculated_at, updated_at").maybeSingle();
  return { row: data, error };
}

async function answerQuestions(a, questionIds) {
  const { data: session, error } = await a.v2.rpc("create_practice_session", {
    p_session_type: "mcq", p_config: { source: "pie-e2e-verify" }, p_question_ids: questionIds,
  });
  if (error) throw new Error(`create_practice_session: ${error.message}`);
  for (let i = 0; i < questionIds.length; i += 1) {
    const { error: saveError } = await a.v2.rpc("save_attempt", {
      p_question_id: questionIds[i], p_session_id: session.id, p_selected_answer: "A",
      p_is_correct: null, p_time_taken_seconds: 30, p_confidence_level: 3, p_answer_changes_count: 0,
      p_time_to_first_click: 5, p_change_sequence: [], p_pause_events: [], p_time_of_day: new Date().toISOString(),
      p_question_position: i, p_previous_question_correct: null, p_question_version: null,
      p_app_version: "pie-e2e-verify", p_provenance: { source: "pie-e2e-verify" },
    });
    if (saveError) throw new Error(`save_attempt: ${saveError.message}`);
  }
  const { error: completeError } = await a.v2.rpc("complete_practice_session", { p_session_id: session.id });
  if (completeError) throw new Error(`complete_practice_session: ${completeError.message}`);
  return session.id;
}

async function main() {
  const A = await v2SessionFor(cfg.a);
  const B = await v2SessionFor(cfg.b);
  check("V2 sessions established via auth bridge", A.v2UserId && B.v2UserId && A.v2UserId !== B.v2UserId,
    `A=${A.v2UserId} B=${B.v2UserId}`);

  const before = await readState(A.v2);
  check("my_pie_state readable by owner (before)", !before.error, before.error?.message);
  const beforeCount = Number(before.row?.state?.evidence_count ?? 0);
  const beforeVersion = Number(before.row?.state_version ?? 0);

  // Questions come from the normal (legacy) bank, exactly as Practice does.
  const { data: qs, error: qError } = await A.legacy.from("questions").select("id").limit(3);
  if (qError || !qs?.length) throw new Error(`could not load questions from the normal bank: ${qError?.message}`);
  const ids = qs.map((q) => q.id);

  const sessionId = await answerQuestions(A, ids.slice(0, 2));
  const { data: results1, error: rErr } = await A.v2.rpc("get_practice_session_results", { p_session_id: sessionId });
  check("Practice attempts persisted (server-graded)", !rErr && results1?.filter((r) => r.selected_answer).length === 2,
    rErr?.message ?? `${results1?.length ?? 0} result rows`);

  const { error: rebuildError } = await A.v2.rpc("rebuild_candidate_state", { p_user_id: A.v2UserId });
  check("public.rebuild_candidate_state(self) succeeds", !rebuildError, rebuildError?.message);

  const after1 = await readState(A.v2);
  const count1 = Number(after1.row?.state?.evidence_count ?? 0);
  check("my_pie_state returns a row for the owner", !after1.error && after1.row?.user_id === A.v2UserId, after1.error?.message);
  check("PIE observations created for new attempts", count1 >= Math.min(100, beforeCount + 2), `${beforeCount} -> ${count1}`);
  check("state_version advanced", Number(after1.row?.state_version ?? 0) > beforeVersion,
    `${beforeVersion} -> ${after1.row?.state_version}`);

  const reread = await readState(A.v2);
  check("state persists on re-read", reread.row?.state_version === after1.row?.state_version);

  await answerQuestions(A, ids.slice(2, 3).length ? ids.slice(2, 3) : ids.slice(0, 1));
  await A.v2.rpc("rebuild_candidate_state", { p_user_id: A.v2UserId });
  const after2 = await readState(A.v2);
  check("evidence/state updates after another answer",
    Number(after2.row?.state_version) > Number(after1.row?.state_version) &&
      Number(after2.row?.state?.evidence_count ?? 0) >= Math.min(100, count1 + 1),
    `v${after1.row?.state_version}/${count1} -> v${after2.row?.state_version}/${after2.row?.state?.evidence_count}`);

  // ---- Isolation ----
  const bRead = await readState(B.v2);
  check("B's my_pie_state never returns A's row", !bRead.row || bRead.row.user_id === B.v2UserId, bRead.error?.message);
  const bRebuildA = await B.v2.rpc("rebuild_candidate_state", { p_user_id: A.v2UserId });
  check("B cannot rebuild A (public wrapper)", Boolean(bRebuildA.error), bRebuildA.error?.message ?? "NO ERROR");
  const bInternalRpc = await B.v2.schema("pie").rpc("rebuild_candidate_state", { p_user_id: A.v2UserId });
  check("B cannot call internal pie.rebuild_candidate_state", Boolean(bInternalRpc.error), bInternalRpc.error?.message ?? "NO ERROR");
  const bState = await B.v2.schema("pie").from("pie_candidate_state").select("user_id").limit(5);
  check("B cannot read pie.pie_candidate_state directly", Boolean(bState.error) || (bState.data ?? []).every((r) => r.user_id === B.v2UserId),
    bState.error?.message ?? `${bState.data?.length} rows`);
  const bObs = await B.v2.schema("pie").from("pie_observation").select("user_id").limit(5);
  check("B cannot read pie.pie_observation", Boolean(bObs.error) || (bObs.data ?? []).length === 0, bObs.error?.message ?? `${bObs.data?.length} rows`);
  const bResults = await B.v2.rpc("get_practice_session_results", { p_session_id: sessionId });
  check("B cannot read A's practice results", Boolean(bResults.error) || (bResults.data ?? []).length === 0,
    bResults.error?.message ?? `${bResults.data?.length} rows`);

  const anon = createClient(cfg.v2Url, cfg.v2Key, noPersist);
  const anonRead = await anon.from("my_pie_state").select("user_id").limit(1);
  check("anon cannot read my_pie_state", Boolean(anonRead.error) || (anonRead.data ?? []).length === 0, anonRead.error?.message ?? "");
  const anonRebuild = await anon.rpc("rebuild_candidate_state", { p_user_id: A.v2UserId });
  check("anon cannot rebuild", Boolean(anonRebuild.error), anonRebuild.error?.message ?? "NO ERROR");

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error("FATAL", error.message);
  process.exit(1);
});
