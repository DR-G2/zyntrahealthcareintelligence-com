import { createClient } from "@supabase/supabase-js";

const url = process.env.V2_URL;
const key = process.env.V2_PUBLISHABLE_KEY;
const emailA = process.env.PIE_TEST_USER_A_EMAIL;
const emailB = process.env.PIE_TEST_USER_B_EMAIL;
const password = process.env.PIE_TEST_PASSWORD;

if (!url || !key || !emailA || !emailB || !password) throw new Error("Missing P12 certification environment");

const supabase = (email: string) => createClient(url, key, { auth: { persistSession: false } });
const A = supabase(emailA);
const B = supabase(emailB);

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) pass++; else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}

async function login(client: ReturnType<typeof supabase>, email: string) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) throw new Error(`login failed: ${error?.message ?? "no session"}`);
  return data;
}

async function invoke(client: ReturnType<typeof supabase>, body: Record<string, unknown> = {}) {
  const { data: { session } } = await client.auth.getSession();
  if (!session) throw new Error("missing session");
  const response = await fetch(`${url}/functions/v1/pie-infer-state`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}`, apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

const a = await login(A, emailA);
const b = await login(B, emailB);
check("P12 two authenticated identities", !!a.user && !!b.user && a.user.id !== b.user.id, `A=${a.user.id.slice(0,8)}… B=${b.user.id.slice(0,8)}…`);

const before = await A.rpc("get_my_pie_state");
check("authoritative state readable before shadow inference", !before.error, before.error?.message ?? "");

const first = await invoke(A, { user_id: a.user.id });
check("P12 Edge Function invocation succeeds", first.response.ok, JSON.stringify(first.payload));
check("P12 is explicitly shadow-only", first.payload.shadow_only === true && first.payload.authoritative === false && first.payload.influences_adaptation === false);
check("P12 model provenance", first.payload.model_version === "pie-inference-v2.1-shadow", String(first.payload.model_version));
check("P12 returns six-dimensional inference contract", first.payload.dimension_count === 6, `dimensions=${first.payload.dimension_count}`);
check("P12 produces deterministic inference hash", typeof first.payload.inference_hash === "string" && first.payload.inference_hash.length === 64);

const second = await invoke(A, { user_id: a.user.id });
check("P12 repeat invocation succeeds", second.response.ok);
check("P12 repeat is deterministic", second.payload.inference_hash === first.payload.inference_hash, `${first.payload.inference_hash} vs ${second.payload.inference_hash}`);

const after = await A.rpc("get_my_pie_state");
check("shadow inference does not mutate authoritative learner state", JSON.stringify(after.data) === JSON.stringify(before.data), "before/after state identical");

const cross = await invoke(B, { user_id: a.user.id });
check("cross-user inference request rejected", cross.response.status === 403 && cross.payload.error === "user_scope_violation", JSON.stringify(cross.payload));

const raw = await A.schema("pie").from("inference_shadow").select("*").limit(1);
check("raw shadow inference table remains protected", !!raw.error, raw.error?.message ?? "unexpected readable raw table");

const ownB = await invoke(B, { user_id: b.user.id });
check("B can invoke only its own inference", ownB.response.ok && ownB.payload.user_id === b.user.id, JSON.stringify(ownB.payload));

await A.auth.signOut();
await B.auth.signOut();

console.log("");
console.log(`PIE P12 SHADOW INFERENCE CERTIFICATION SUMMARY: PASS=${pass} FAIL=${fail}`);
if (fail) process.exit(1);
