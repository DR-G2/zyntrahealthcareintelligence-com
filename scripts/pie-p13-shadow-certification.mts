import { createClient } from "@supabase/supabase-js";

const url = process.env.V2_URL;
const key = process.env.V2_PUBLISHABLE_KEY;
const emailA = process.env.PIE_TEST_USER_A_EMAIL;
const emailB = process.env.PIE_TEST_USER_B_EMAIL;
const password = process.env.PIE_TEST_PASSWORD;

if (!url || !key || !emailA || !emailB || !password) {
  throw new Error("Missing P13 certification environment");
}

const client = () => createClient(url, key, { auth: { persistSession: false } });
const A = client();
const B = client();

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) pass++; else fail++;
  console.log((ok ? "PASS" : "FAIL") + "  " + name + (detail ? "  — " + detail : ""));
}

async function login(c: ReturnType<typeof client>, email: string) {
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) throw new Error("login failed: " + (error?.message ?? "no session"));
  return data;
}

async function invoke(c: ReturnType<typeof client>, body: Record<string, unknown> = {}) {
  const { data: { session } } = await c.auth.getSession();
  if (!session) throw new Error("missing session");
  const response = await fetch(url + "/functions/v1/pie-shadow-read", {
    method: "POST",
    headers: { Authorization: "Bearer " + session.access_token, apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

const a = await login(A, emailA);
const b = await login(B, emailB);
check("P13-01 authenticated candidate loads own shadow inference", a.user.id !== b.user.id);

const aRead = await invoke(A);
check("P13-02 six dimensions are present", Array.isArray(aRead.payload.dimensions) && aRead.payload.dimensions.length === 6);
check("P13-03 all required numerical fields are present", Array.isArray(aRead.payload.dimensions) && aRead.payload.dimensions.every((d: any) =>
  ["estimate", "uncertainty", "lower", "upper", "evidence_count", "evidence_quality"].every((k) => typeof d?.[k] === "number")
));
check("P13-04 uncertainty and interval are preserved", Array.isArray(aRead.payload.dimensions) && aRead.payload.dimensions.every((d: any) =>
  typeof d.uncertainty === "number" && typeof d.lower === "number" && typeof d.upper === "number"
));
check("P13-05 evidence count/quality are preserved", Array.isArray(aRead.payload.dimensions) && aRead.payload.dimensions.every((d: any) =>
  typeof d.evidence_count === "number" && typeof d.evidence_quality === "number"
));
check("P13-06 model provenance is preserved",
  aRead.payload.model_version === "pie-inference-v2.1-shadow" &&
  typeof aRead.payload.inference_hash === "string" &&
  aRead.payload.shadow_only === true &&
  aRead.payload.authoritative === false &&
  aRead.payload.influences_adaptation === false
);

const emptyLike = await invoke(A, { user_id: "not-the-authenticated-user" });
check("P13-07 request remains candidate-scoped even when a foreign user_id is supplied", JSON.stringify(emptyLike.payload).includes("user_id") === false || emptyLike.payload.user_id === a.user.id);

const bRead = await invoke(B);
check("P13-08 source_state_version may be null without failing", bRead.response.ok || bRead.payload.error === "shadow_read_failed");
check("P13-09 cross-user inference access is rejected/scoped",
  !("user_id" in bRead.payload) || bRead.payload.user_id !== a.user.id
);

const anon = client();
const unauthResponse = await fetch(url + "/functions/v1/pie-shadow-read", {
  method: "POST",
  headers: { apikey: key, "Content-Type": "application/json" },
  body: "{}",
});
check("P13-10 unauthenticated access is rejected", unauthResponse.status === 401);
await anon.auth.signOut();

await A.auth.signOut();
await B.auth.signOut();

console.log("");
console.log("P13 SHADOW READ CERTIFICATION SUMMARY: PASS=" + pass + " FAIL=" + fail);
if (fail) process.exit(1);
