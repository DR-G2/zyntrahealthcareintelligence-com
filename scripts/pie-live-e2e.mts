/**
 * Live V2 end-to-end + isolation check for the PIE pipeline after migration 0044.
 * Uses two EXISTING test accounts through the same path the app uses
 * (legacy sign-in -> v2-auth-bridge -> V2 verifyOtp). No service-role keys, never creates users.
 * WRITES real practice attempts for the two test accounts in V2.
 *
 * Env: V2_URL, V2_PUBLISHABLE_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY,
 *      PIE_TEST_USER_A_EMAIL, PIE_TEST_USER_B_EMAIL, PIE_TEST_PASSWORD
 * Run:  npx vite-node scripts/pie-live-e2e.mts
 * Output prints truncated UUIDs only and never prints credentials.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describePieStatus, loadPieView, resolvePieView, type PieClient } from "../src/lib/pie/pie-state";

const need = (k: string) => { const v = process.env[k]; if (!v) { console.error(`missing env ${k}`); process.exit(2); } return v; };
const V2_URL = need("V2_URL"), V2_KEY = need("V2_PUBLISHABLE_KEY");
const L_URL = need("VITE_SUPABASE_URL"), L_KEY = need("VITE_SUPABASE_PUBLISHABLE_KEY");
const PW = need("PIE_TEST_PASSWORD");
const np = { auth: { persistSession: false, autoRefreshToken: false } };
const t = (id?: string | null) => (id ? `${id.slice(0, 8)}…` : String(id));
const err = (e: { code?: string; message?: string } | null) => (e ? `${e.code ?? ""} ${e.message ?? ""}`.trim() : "");

let pass = 0, fail = 0;
const check = (name: string, ok: unknown, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

type U = { label: string; v2: SupabaseClient; id: string };

async function signIn(label: string, email: string): Promise<U> {
  const legacy = createClient(L_URL, L_KEY, np);
  const { data: s, error } = await legacy.auth.signInWithPassword({ email, password: PW });
  if (error || !s.session) throw new Error(`${label}: legacy sign-in failed: ${error?.message}`);
  const res = await fetch(`${V2_URL}/functions/v1/v2-auth-bridge`, {
    method: "POST",
    headers: { Authorization: `Bearer ${s.session.access_token}`, apikey: L_KEY, "Content-Type": "application/json",
      Origin: "https://www.zyntrahealthcareintelligence.com" },
  });
  const p = await res.json().catch(() => ({}));
  if (!res.ok || !p.token_hash) throw new Error(`${label}: v2-auth-bridge ${res.status} ${p.error ?? ""}`);
  const v2 = createClient(V2_URL, V2_KEY, np);
  const v = await v2.auth.verifyOtp({ token_hash: p.token_hash, type: "email" });
  if (v.error || !v.data.user) throw new Error(`${label}: verifyOtp ${v.error?.message}`);
  return { label, v2, id: v.data.user.id };
}

const readState = async (u: U) => {
  const r = await u.v2.from("my_pie_state").select("user_id, state_version, state, confidence, calculated_at, updated_at").maybeSingle();
  return r;
};
const fmt = (row: any) => row ? `user=${t(row.user_id)} v${row.state_version} ${row.state?.evidence_level} n=${row.state?.evidence_count} conf=${Number(row.confidence).toFixed(2)} ui=${resolvePieView(row).status}` : "no row";

const save = (u: U, sessionId: string, qid: string, pos: number) => u.v2.rpc("save_attempt", {
  p_question_id: qid, p_session_id: sessionId, p_selected_answer: "A", p_is_correct: true,
  p_time_taken_seconds: 40 + pos, p_confidence_level: 3, p_answer_changes_count: pos % 2, p_time_to_first_click: 5,
  p_change_sequence: [], p_pause_events: [], p_time_of_day: "evening", p_question_position: pos,
  p_previous_question_correct: null, p_question_version: null, p_app_version: "pie-live-e2e",
  p_provenance: { source: "pie-live-e2e" },
});
const ownAttempts = async (u: U, sessionId?: string) => {
  let q = u.v2.from("user_attempts").select("id", { count: "exact", head: true }).eq("user_id", u.id);
  if (sessionId) q = q.eq("session_id", sessionId);
  const { count, error } = await q; return error ? -1 : count ?? 0;
};

async function main() {
  const A = await signIn("A", need("PIE_TEST_USER_A_EMAIL"));
  const B = await signIn("B", need("PIE_TEST_USER_B_EMAIL"));
  check("V2 sessions via v2-auth-bridge", A.id && B.id && A.id !== B.id, `A=${t(A.id)} B=${t(B.id)}`);

  for (const u of [A, B]) {
    const r = await readState(u);
    check(`${u.label}: my_pie_state readable before any rebuild (no permission error)`, !r.error, r.error ? err(r.error) : fmt(r.data));
  }

  const pool = await A.v2.rpc("get_practice_question_pool", { p_limit: 20 });
  check("question pool from legacy-bank active questions", !pool.error && (pool.data?.length ?? 0) >= 10,
    pool.error ? err(pool.error) : `${pool.data.length} questions, explanation exposed=${pool.data.some((q: any) => q.explanation)}`);
  const ids: string[] = pool.data.map((q: any) => q.id);
  const qa = ids.slice(0, 7), qb = ids.slice(7, 10);

  // ---- User A: 1 answer -> rebuild -> read; then 6 more -> rebuild -> read; re-read; rebuild again.
  const sa = await A.v2.rpc("create_practice_session", { p_session_type: "mcq", p_config: { source: "pie-live-e2e" }, p_question_ids: qa });
  check("A: create_practice_session (7 questions)", !sa.error, sa.error ? err(sa.error) : `session=${t(sa.data.id)} status=${sa.data.status}`);
  const s1 = await save(A, sa.data.id, qa[0], 0);
  check("A: save_attempt #1 persisted (server-graded)", !s1.error && s1.data?.id, s1.error ? err(s1.error) : `attempt=${t(s1.data.id)} is_correct=${s1.data.is_correct}`);
  const rb1 = await A.v2.rpc("rebuild_candidate_state", { p_user_id: A.id });
  check("A: public.rebuild_candidate_state(self) after 1 answer", !rb1.error, rb1.error ? err(rb1.error) : `state_id=${t(rb1.data)}`);
  const r1 = await readState(A);
  check("A: my_pie_state row after 1 answer (v1, n=1, Building evidence)", !r1.error && r1.data?.user_id === A.id && r1.data.state_version === 1 && r1.data.state.evidence_count === 1, r1.error ? err(r1.error) : fmt(r1.data));

  for (let i = 1; i < 7; i++) {
    const s = await save(A, sa.data.id, qa[i], i);
    if (s.error) check(`A: save_attempt #${i + 1}`, false, err(s.error));
  }
  check("A: 7 attempts persisted in session", (await ownAttempts(A, sa.data.id)) === 7, `own attempts in session=${await ownAttempts(A, sa.data.id)}`);
  const rb2 = await A.v2.rpc("rebuild_candidate_state", { p_user_id: A.id });
  check("A: rebuild after 7 answers", !rb2.error, err(rb2.error));
  const r2 = await readState(A);
  check("A: state v2, n=7, PRELIMINARY (valid PIE state)", r2.data?.state_version === 2 && r2.data.state.evidence_count === 7 && r2.data.state.evidence_level === "PRELIMINARY", r2.error ? err(r2.error) : fmt(r2.data));
  check("A: same state row id across rebuilds (one row per learner)", rb1.data && rb1.data === rb2.data, `${t(rb1.data)} vs ${t(rb2.data)}`);
  const r2b = await readState(A);
  check("A: re-read persists (fresh request, same version)", r2b.data?.state_version === 2, fmt(r2b.data));
  const rb3 = await A.v2.rpc("rebuild_candidate_state", { p_user_id: A.id });
  const r3 = await readState(A);
  check("A: rebuild again increments state_version", !rb3.error && r3.data?.state_version === 3, fmt(r3.data));

  // ---- User B: smaller flow (1 then 3 answers), session kept active for isolation tests.
  const sb = await B.v2.rpc("create_practice_session", { p_session_type: "mcq", p_config: { source: "pie-live-e2e" }, p_question_ids: qb });
  check("B: create_practice_session (3 questions)", !sb.error, sb.error ? err(sb.error) : `session=${t(sb.data.id)}`);
  const b1 = await save(B, sb.data.id, qb[0], 0);
  check("B: save_attempt #1", !b1.error, b1.error ? err(b1.error) : `attempt=${t(b1.data.id)}`);
  const brb1 = await B.v2.rpc("rebuild_candidate_state", { p_user_id: B.id });
  const br1 = await readState(B);
  check("B: rebuild + read after 1 answer (v1, n=1)", !brb1.error && br1.data?.user_id === B.id && br1.data.state_version === 1 && br1.data.state.evidence_count === 1, brb1.error ? err(brb1.error) : fmt(br1.data));
  for (let i = 1; i < 3; i++) { const s = await save(B, sb.data.id, qb[i], i); if (s.error) check(`B: save_attempt #${i + 1}`, false, err(s.error)); }
  const brb2 = await B.v2.rpc("rebuild_candidate_state", { p_user_id: B.id });
  const br2 = await readState(B);
  check("B: rebuild + read after 3 answers (v2, n=3, still Building evidence)", !brb2.error && br2.data?.state_version === 2 && br2.data.state.evidence_count === 3, fmt(br2.data));

  // ---- Isolation (both directions). A's session is still active too.
  for (const [me, other, otherSession, otherQ] of [[A, B, sb.data.id, qb[0]], [B, A, sa.data.id, qa[0]]] as const) {
    const L = `${me.label}->${other.label}`;
    const s1 = await me.v2.from("my_pie_state").select("user_id").eq("user_id", other.id);
    check(`${L}: my_pie_state filtered on other user returns nothing`, !s1.error && s1.data.length === 0, s1.error ? err(s1.error) : `rows=${s1.data.length}`);
    const all = await me.v2.from("my_pie_state").select("user_id");
    check(`${L}: my_pie_state returns only own row`, !all.error && all.data.length === 1 && all.data[0].user_id === me.id, `rows=${all.data?.length} owner=${t(all.data?.[0]?.user_id)}`);
    const fn = await me.v2.rpc("get_my_pie_state");
    check(`${L}: get_my_pie_state returns only own row`, !fn.error && fn.data.length === 1 && fn.data[0].user_id === me.id, fn.error ? err(fn.error) : `rows=${fn.data.length}`);
    const cs = await me.v2.schema("pie").from("pie_candidate_state").select("user_id").eq("user_id", other.id);
    check(`${L}: cannot read pie.pie_candidate_state`, cs.error || cs.data.length === 0, cs.error ? err(cs.error) : `rows=${cs.data.length}`);
    const ob = await me.v2.schema("pie").from("pie_observation").select("user_id").eq("user_id", other.id);
    check(`${L}: cannot read pie.pie_observation`, ob.error || ob.data.length === 0, ob.error ? err(ob.error) : `rows=${ob.data.length}`);
    const ua = await me.v2.from("user_attempts").select("id").eq("user_id", other.id);
    check(`${L}: cannot read other's user_attempts`, ua.error || ua.data.length === 0, ua.error ? err(ua.error) : `rows=${ua.data.length}`);
    const rb = await me.v2.rpc("rebuild_candidate_state", { p_user_id: other.id });
    check(`${L}: cannot rebuild other's state (public wrapper)`, rb.error, err(rb.error) || "NO ERROR");
    const ir = await me.v2.schema("pie").rpc("rebuild_candidate_state", { p_user_id: other.id });
    check(`${L}: cannot call internal pie.rebuild_candidate_state (other)`, ir.error, err(ir.error) || "NO ERROR");
    const irs = await me.v2.schema("pie").rpc("rebuild_candidate_state", { p_user_id: me.id });
    check(`${L}: cannot call internal pie.rebuild_candidate_state (self)`, irs.error, err(irs.error) || "NO ERROR");
    const ro = await me.v2.schema("pie").rpc("record_observation", { p_observation_type: "MCQ_ATTEMPT", p_payload: { outcome: "CORRECT" } });
    check(`${L}: cannot call pie.record_observation`, ro.error, err(ro.error) || "NO ERROR");
    const sv = await save(me, otherSession, otherQ, 99);
    check(`${L}: cannot save_attempt into other's active session`, sv.error, err(sv.error) || "NO ERROR");
  }

  // ---- anon
  const anon = createClient(V2_URL, V2_KEY, np);
  const an1 = await anon.from("my_pie_state").select("user_id");
  check("anon: my_pie_state blocked", an1.error || an1.data.length === 0, err(an1.error) || `rows=${an1.data?.length}`);
  const an2 = await anon.rpc("get_my_pie_state");
  check("anon: get_my_pie_state blocked", an2.error, err(an2.error) || "NO ERROR");
  const an3 = await anon.rpc("rebuild_candidate_state", { p_user_id: A.id });
  check("anon: rebuild_candidate_state blocked", an3.error, err(an3.error) || "NO ERROR");
  const an4 = await anon.schema("pie").rpc("rebuild_candidate_state", { p_user_id: A.id });
  check("anon: pie.rebuild_candidate_state blocked", an4.error, err(an4.error) || "NO ERROR");
  const an5 = await save({ label: "anon", v2: anon, id: "" }, sa.data.id, qa[0], 0);
  check("anon: save_attempt blocked", an5.error, err(an5.error) || "NO ERROR");

  // ---- complete sessions
  for (const [u, s] of [[A, sa.data.id], [B, sb.data.id]] as const) {
    const c = await u.v2.rpc("complete_practice_session", { p_session_id: s });
    check(`${u.label}: complete_practice_session`, !c.error && c.data?.status === "completed", err(c.error) || `status=${c.data?.status}`);
  }

  // ---- Frontend state mapping fed by live responses (exact production code path of PerformanceIntelligenceV2).
  const origErr = console.error, origWarn = console.warn; const logs: string[] = [];
  console.error = (...a: unknown[]) => logs.push(`error ${JSON.stringify(a).slice(0, 200)}`);
  console.warn = (...a: unknown[]) => logs.push(`warn ${JSON.stringify(a).slice(0, 200)}`);
  for (const u of [A, B]) {
    const view = await loadPieView({ ensureSession: async () => {}, getClient: () => u.v2 as unknown as PieClient });
    const copy = describePieStatus(view, false);
    const seq = view.status === "unavailable" ? "-" : view.pie?.state_sequence;
    console.log(`UI   ${u.label}: loadPieView status=${view.status} headline="${copy.headline}" detail="${copy.detail}" state_sequence=${seq}`);
    check(`${u.label}: UI not 'unavailable' and not 'Awaiting signal'`, view.status !== "unavailable" && !/awaiting signal/i.test(copy.headline), copy.headline);
  }
  console.error = origErr; console.warn = origWarn;
  for (const l of logs) console.log(`LOG  ${l}`);

  console.log(`\nSUMMARY pass=${pass} fail=${fail}`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error("FATAL", e?.message ?? e); process.exit(1); });
