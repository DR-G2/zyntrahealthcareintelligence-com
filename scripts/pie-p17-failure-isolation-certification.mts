import { createClient } from "@supabase/supabase-js";

const url = process.env.V2_URL;
const key = process.env.V2_PUBLISHABLE_KEY;
const email = process.env.PIE_TEST_USER_A_EMAIL;
const password = process.env.PIE_TEST_PASSWORD;
if (!url || !key || !email || !password) throw new Error("Missing P17 certification environment");

const client = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await client.auth.signInWithPassword({ email, password });
if (error || !data.session) throw new Error("login failed");

let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) pass++; else fail++;
  console.log((ok ? "PASS" : "FAIL") + "  " + name + (detail ? "  — " + detail : ""));
};

const { data: questions, error: qError } = await client.from("questions").select("id").eq("status", "active").limit(1);
check("P17-01 authenticated practice question is available", !qError && !!questions?.[0]?.id);

let attemptId = "";
let beforeCount = 0;
if (questions?.[0]?.id) {
  const before = await fetch(url + "/functions/v1/pie-p14-shadow-read", {
    method: "POST",
    headers: { Authorization: "Bearer " + data.session.access_token, apikey: key, "Content-Type": "application/json" },
    body: "{}",
  });
  const beforePayload = await before.json().catch(() => ({}));
  beforeCount = Number(beforePayload.observation_count ?? 0);

  const attempt = await client.rpc("save_attempt", {
    p_question_id: questions[0].id,
    p_session_id: null,
    p_selected_answer: "A",
    p_is_correct: false,
    p_time_taken_seconds: 10,
    p_confidence_level: 3,
    p_answer_changes_count: 0,
    p_time_to_first_click: 1000,
    p_change_sequence: [],
    p_pause_events: [],
    p_time_of_day: "P17-cert",
    p_question_position: null,
    p_previous_question_correct: null,
    p_question_version: null,
    p_app_version: "P17-cert",
    p_provenance: { source: "P17-certification" },
  });
  attemptId = attempt.data?.id ?? "";
  check("P17-02 authoritative save_attempt succeeds", !attempt.error && !!attemptId, attempt.error?.message ?? "");
  
  const after = await fetch(url + "/functions/v1/pie-p14-shadow-read", {
    method: "POST",
    headers: { Authorization: "Bearer " + data.session.access_token, apikey: key, "Content-Type": "application/json" },
    body: "{}",
  });
  const afterPayload = await after.json().catch(() => ({}));
  check("P17-03 PIE observation is produced on healthy path", after.response.ok && Number(afterPayload.observation_count ?? 0) >= beforeCount + 1);
  check("P17-04 healthy PIE read remains projection-backed", afterPayload.read_source === "projection");
}

const { readFile } = await import("node:fs/promises");
const saveSource = await readFile("supabase/migrations_v2/0044_pie_candidate_state_pipeline_repair.sql", "utf8");
check("P17-05 save_attempt isolates PIE observation failure", /begin\\s+insert into pie\\.pie_observation[\\s\\S]*?exception when others then\\s+raise warning/.test(saveSource));
check("P17-06 authoritative attempt is returned after optional intelligence blocks", /return v_attempt;/.test(saveSource) && /insert into public\\.user_attempts/.test(saveSource));

await client.auth.signOut();
console.log("");
console.log("P17 FAILURE ISOLATION CERTIFICATION SUMMARY: PASS=" + pass + " FAIL=" + fail);
if (fail) process.exit(1);
